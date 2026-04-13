'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Solar } from 'lunar-javascript';

// 2026年法定节假日
const holidays2026: Record<string, string> = {
  '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
  '2026-02-15': '春节', '2026-02-16': '春节', '2026-02-17': '春节',
  '2026-02-18': '春节', '2026-02-19': '春节', '2026-02-20': '春节',
  '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
  '2026-04-04': '清明节', '2026-04-05': '清明节', '2026-04-06': '清明节',
  '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节',
  '2026-05-04': '劳动节', '2026-05-05': '劳动节',
  '2026-06-19': '端午节', '2026-06-20': '端午节', '2026-06-21': '端午节',
  '2026-09-25': '中秋节', '2026-09-26': '中秋节', '2026-09-27': '中秋节',
  '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节',
  '2026-10-04': '国庆节', '2026-10-05': '国庆节', '2026-10-06': '国庆节',
  '2026-10-07': '国庆节'
};

// 调休上班日
const workdays2026: Record<string, string> = {
  '2026-01-04': '元旦调休',
  '2026-02-14': '春节调休',
  '2026-02-28': '春节调休',
  '2026-05-09': '劳动节调休',
  '2026-09-20': '国庆调休',
  '2026-10-10': '国庆调休'
};

// 基准日期：2026年4月8日是饶的第7天（晚班第3天）
const baseDate = new Date(2026, 3, 8);

const today = new Date();

const filterNames: Record<string, string> = {
  'rao-day': '饶白班',
  'rao-night': '饶晚班',
  'rao-rest': '饶休息日',
  'li-rest': '李休息日',
  'both-rest': '两人同休'
};

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getRaoCycleDay(date: Date) {
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = targetDate.getTime() - baseDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const cycleDay = ((diffDays + 6) % 9 + 9) % 9 + 1;
  return cycleDay;
}

function getRaoShiftType(date: Date) {
  const cycleDay = getRaoCycleDay(date);
  if (cycleDay >= 1 && cycleDay <= 4) return 'day';   // 白班
  if (cycleDay >= 5 && cycleDay <= 7) return 'night'; // 晚班
  return 'rest'; // 休息（第8-9天）
}

function isLiRestDay(date: Date) {
  const day = date.getDay();
  const dateStr = formatDateKey(date);
  if (workdays2026[dateStr]) return false;
  if (day === 0 || day === 6) return true;
  if (holidays2026[dateStr]) return true;
  return false;
}

function getDayStatus(date: Date, manualEdits: Record<string, string>) {
  const dateStr = formatDateKey(date);
  if (Object.prototype.hasOwnProperty.call(manualEdits, dateStr)) {
    return manualEdits[dateStr];
  }
  const shiftType = getRaoShiftType(date);
  const liRest = isLiRestDay(date);
  if (shiftType === 'rest') {
    return liRest ? 'both-rest' : 'rao-rest';
  }
  if (liRest) {
    return 'li-rest';
  }
  if (shiftType === 'day') return 'rao-day';
  if (shiftType === 'night') return 'rao-night';
  return 'rao-day';
}

function shouldHighlight(date: Date, status: string, activeFilters: string[]) {
  if (activeFilters.length === 0) return true;
  const shiftType = getRaoShiftType(date);
  for (const filter of activeFilters) {
    if (filter === status) return true;
    if (filter === 'rao-day' && shiftType === 'day') return true;
    if (filter === 'rao-night' && shiftType === 'night') return true;
    if (filter === 'rao-rest' && (status === 'rao-rest' || status === 'both-rest')) return true;
    if (filter === 'li-rest' && (status === 'li-rest' || status === 'both-rest')) return true;
  }
  return false;
}

function getLunarDate(date: Date) {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = solar.getLunar();
  const day = lunar.getDayInChinese();
  if (day === '初一') {
    return lunar.getMonthInChinese() + '月';
  }
  return day;
}

export default function HomePage() {
  const [displayDate, setDisplayDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [manualEdits, setManualEdits] = useState<Record<string, string>>({});

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentModalDate, setCurrentModalDate] = useState<Date | null>(null);
  const [currentModalStatus, setCurrentModalStatus] = useState<string | null>(null);
  const [editSelectedStatus, setEditSelectedStatus] = useState<string | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [tooltip, setTooltip] = useState<{ visible: boolean; text: string; x: number; y: number }>({
    visible: false, text: '', x: 0, y: 0
  });

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const todayStr = formatDateKey(today);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2000);
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(displayDate);
    newDate.setMonth(newDate.getMonth() + delta);
    if (newDate.getFullYear() < 2025 || newDate.getFullYear() > 2027) {
      showToast('只能查看2025-2027年的日程');
      return;
    }
    setDisplayDate(newDate);
    showToast(`${newDate.getFullYear()}年${newDate.getMonth() + 1}月`);
  };

  const goToToday = () => {
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    if (displayDate.getFullYear() === todayYear && displayDate.getMonth() === todayMonth) {
      showToast('已在当前月份');
    } else {
      setDisplayDate(new Date(todayYear, todayMonth, 1));
      showToast(`${todayYear}年${todayMonth + 1}月`);
    }
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      if (prev.includes(filter)) {
        return prev.filter(f => f !== filter);
      }
      return [...prev, filter];
    });
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const openViewModal = (date: Date, status: string) => {
    setCurrentModalDate(date);
    setCurrentModalStatus(status);
    setViewModalOpen(true);
  };

  const closeViewModal = () => {
    setViewModalOpen(false);
  };

  const openEditModal = () => {
    setViewModalOpen(false);
    if (currentModalDate && currentModalStatus) {
      const dateStr = formatDateKey(currentModalDate);
      const status = manualEdits[dateStr] || currentModalStatus;
      setEditSelectedStatus(status);
      setEditModalOpen(true);
    }
  };

  const selectEditOption = (status: string) => {
    setEditSelectedStatus(status);
  };

  const saveEdit = () => {
    if (!editSelectedStatus || !currentModalDate) {
      showToast('请选择一个状态');
      return;
    }
    const dateStr = formatDateKey(currentModalDate);
    setManualEdits(prev => ({ ...prev, [dateStr]: editSelectedStatus }));
    setEditModalOpen(false);
    showToast('已保存修改');
  };

  const clearManualEdit = () => {
    if (!currentModalDate) return;
    const dateStr = formatDateKey(currentModalDate);
    if (Object.prototype.hasOwnProperty.call(manualEdits, dateStr)) {
      setManualEdits(prev => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
      setEditModalOpen(false);
      showToast('已恢复自动计算');
    } else {
      showToast('当前为自动计算，无需恢复');
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
  };

  // 键盘与触摸事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewModalOpen(false);
        setEditModalOpen(false);
      }
      if (e.key === 'ArrowLeft') changeMonth(-1);
      if (e.key === 'ArrowRight') changeMonth(1);
      if (e.key === 't' || e.key === 'T') goToToday();
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].screenX;
      if (touchEndX.current < touchStartX.current - 50) changeMonth(1);
      if (touchEndX.current > touchStartX.current + 50) changeMonth(-1);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [displayDate]);

  const { cells, monthYearText, filterInfoText, filterInfoActive } = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startOffset);

    const cellsData: {
      date: Date;
      dateStr: string;
      status: string;
      cycleDay: number;
      shiftType: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isManualEdit: boolean;
      tags: string;
      highlighted: boolean;
      dimmed: boolean;
    }[] = [];

    for (let i = 0; i < 40; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);
      const dateStr = formatDateKey(cellDate);
      const status = getDayStatus(cellDate, manualEdits);
      const cycleDay = getRaoCycleDay(cellDate);
      const shiftType = getRaoShiftType(cellDate);
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = dateStr === todayStr;
      const isManualEdit = Object.prototype.hasOwnProperty.call(manualEdits, dateStr);
      const highlighted = activeFilters.length > 0 && shouldHighlight(cellDate, status, activeFilters);
      const dimmed = activeFilters.length > 0 && !highlighted;

      let tags = '';
      if (status === 'both-rest') {
        tags += `<div class="day-tag">同休</div>`;
      } else if (holidays2026[dateStr]) {
        tags += `<div class="day-tag">节</div>`;
      } else if (workdays2026[dateStr]) {
        tags += `<div class="day-tag">班</div>`;
      }

      if (!isManualEdit && (status === 'rao-day' || status === 'rao-night' ||
        (status === 'li-rest' && shiftType !== 'rest'))) {
        const shiftText = shiftType === 'day' ? '白' : (shiftType === 'night' ? '晚' : '');
        if (shiftText) {
          tags += `<div class="day-tag" style="color:#666">${shiftText}</div>`;
        }
      }

      cellsData.push({
        date: cellDate,
        dateStr,
        status,
        cycleDay,
        shiftType,
        isCurrentMonth,
        isToday,
        isManualEdit,
        tags,
        highlighted,
        dimmed
      });
    }

    let filterInfoText = '点击上方按钮可多选筛选，显示所有选中状态的日期';
    let filterInfoActive = false;
    if (activeFilters.length > 0) {
      const selectedNames = activeFilters.map(f => filterNames[f]).join('、');
      filterInfoText = `当前筛选：${selectedNames}（${activeFilters.length}项）- 白/晚班筛选包含所有对应班次`;
      filterInfoActive = true;
    }

    return {
      cells: cellsData,
      monthYearText: `${year}年${month + 1}月`,
      filterInfoText,
      filterInfoActive
    };
  }, [displayDate, activeFilters, manualEdits]);

  const viewModalContent = useMemo(() => {
    if (!currentModalDate || !currentModalStatus) return null;
    const dateStr = formatDateKey(currentModalDate);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayOfWeek = currentModalDate.getDay();
    const isManual = Object.prototype.hasOwnProperty.call(manualEdits, dateStr);
    const cycleDay = getRaoCycleDay(currentModalDate);
    const shiftType = getRaoShiftType(currentModalDate);

    let statusText = '';
    let statusBg = '';
    let statusColor = '#ffffff';
    let detailText = '';

    switch (currentModalStatus) {
      case 'both-rest':
        statusText = '两人同休';
        statusBg = '#2d5a4e';
        detailText = '今天两人都有空，可以一起安排活动';
        break;
      case 'rao-rest':
        statusText = '仅饶休息';
        statusBg = '#c97b7b';
        detailText = '饶今天休息，李在上班';
        break;
      case 'li-rest':
        statusText = '李休息日';
        statusBg = '#7db9a8';
        detailText = `李今天休息，饶${shiftType === 'day' ? '上白班' : '上晚班'}`;
        break;
      case 'rao-day':
        statusText = '饶白班';
        statusBg = '#a8c8dc';
        statusColor = '#3d3d3d';
        detailText = '饶上白班（第' + cycleDay + '天），李在上班';
        break;
      case 'rao-night':
        statusText = '饶晚班';
        statusBg = '#4a5568';
        detailText = '饶上晚班（第' + cycleDay + '天），李在上班';
        break;
    }

    return {
      dateText: `${dateStr} ${weekdays[dayOfWeek]}`,
      statusText,
      statusBg,
      statusColor,
      detailText,
      cycleInfo: `饶处于9天周期第${cycleDay}天`,
      isManual
    };
  }, [currentModalDate, currentModalStatus, manualEdits]);

  const editModalDateText = useMemo(() => {
    if (!currentModalDate) return '修改日程';
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `修改 ${formatDateKey(currentModalDate)} ${weekdays[currentModalDate.getDay()]} 的日程`;
  }, [currentModalDate]);

  return (
    <div className="container">
      <header>
        <h1>饶 &amp; 李 的日程对照表</h1>
        <p className="subtitle">两个人的时间，找到交集</p>
        <div className="couple-info">
          <div className="person-tag">
            <div className="dot-rao"></div>
            <span>饶 · 9天周期制（4白+3晚+2休）</span>
          </div>
          <div className="person-tag">
            <div className="dot-li"></div>
            <span>李 · 标准双休制</span>
          </div>
        </div>
      </header>

      <div className="top-controls">
        <div className="nav-section">
          <div className="nav-group">
            <button className="btn btn-nav" onClick={() => changeMonth(-1)}>‹</button>
            <div className="month-year">{monthYearText}</div>
            <button className="btn btn-nav" onClick={() => changeMonth(1)}>›</button>
          </div>
        </div>

        <div className="filter-section">
          <button className={`filter-btn ${activeFilters.includes('rao-day') ? 'active' : ''}`} data-filter="rao-day" onClick={() => toggleFilter('rao-day')}>
            <div className="filter-dot"></div>
            <span>饶白班</span>
          </button>
          <button className={`filter-btn ${activeFilters.includes('rao-night') ? 'active' : ''}`} data-filter="rao-night" onClick={() => toggleFilter('rao-night')}>
            <div className="filter-dot"></div>
            <span>饶晚班</span>
          </button>
          <button className={`filter-btn ${activeFilters.includes('rao-rest') ? 'active' : ''}`} data-filter="rao-rest" onClick={() => toggleFilter('rao-rest')}>
            <div className="filter-dot"></div>
            <span>饶休息日</span>
          </button>
          <button className={`filter-btn ${activeFilters.includes('li-rest') ? 'active' : ''}`} data-filter="li-rest" onClick={() => toggleFilter('li-rest')}>
            <div className="filter-dot"></div>
            <span>李休息日</span>
          </button>
          <button className={`filter-btn ${activeFilters.includes('both-rest') ? 'active' : ''}`} data-filter="both-rest" onClick={() => toggleFilter('both-rest')}>
            <div className="filter-dot"></div>
            <span>两人同休</span>
          </button>
          {activeFilters.length > 0 && (
            <button className="btn btn-clear" onClick={clearAllFilters}>清除筛选</button>
          )}
        </div>

        <button className="btn btn-today" onClick={goToToday}>今天</button>
      </div>

      <div className={`filter-info ${filterInfoActive ? 'active' : ''}`}>
        {filterInfoText}
      </div>

      <div className="calendar-wrapper">
        <div className="calendar-grid">
          {cells.map((cell) => {
            const classNames = [
              'day-cell',
              `status-${cell.status}`,
              cell.isToday ? 'is-today' : '',
              !cell.isCurrentMonth ? 'other-month' : '',
              cell.isManualEdit ? 'manual-edit' : '',
              cell.highlighted ? 'highlighted' : '',
              cell.dimmed ? 'dimmed' : ''
            ].filter(Boolean).join(' ');

            return (
              <div
                key={cell.dateStr}
                className={classNames}
                data-status={cell.status}
                data-date={cell.dateStr}
                onClick={() => openViewModal(cell.date, cell.status)}
                onMouseEnter={(e) => {
                  let text = '';
                  switch (cell.status) {
                    case 'both-rest': text = '两人同休'; break;
                    case 'rao-rest': text = '仅饶休息'; break;
                    case 'li-rest': text = '李休息日（饶' + (cell.shiftType === 'day' ? '白班' : '晚班') + ')'; break;
                    case 'rao-day': text = '饶白班'; break;
                    case 'rao-night': text = '饶晚班'; break;
                  }
                  if (cell.isManualEdit) text += ' (已修改)';
                  setTooltip({
                    visible: true,
                    text: `${cell.dateStr} · ${text}`,
                    x: e.clientX + 10,
                    y: e.clientY - 30
                  });
                }}
                onMouseMove={(e) => {
                  setTooltip(prev => ({ ...prev, x: e.clientX + 10, y: e.clientY - 30 }));
                }}
                onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
              >
                <div className="day-number">{cell.date.getDate()}</div>
                <div className="day-lunar">{getLunarDate(cell.date)}</div>
                <div className="day-tags" dangerouslySetInnerHTML={{ __html: cell.tags }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      <div
        className="tooltip"
        style={{ opacity: tooltip.visible ? 1 : 0, left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.text}
      </div>

      {/* Toast */}
      <div className={`toast ${toast.visible ? 'show' : ''}`}>{toast.message}</div>

      {/* View Modal */}
      <div className={`modal ${viewModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.currentTarget === e.target) closeViewModal(); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {viewModalContent && (
            <>
              <div className="modal-date">{viewModalContent.dateText}</div>
              <div className="modal-status" style={{ background: viewModalContent.statusBg, color: viewModalContent.statusColor }}>
                {viewModalContent.statusText}
              </div>
              <div className="modal-details">
                {viewModalContent.detailText}
                {viewModalContent.isManual && <br />}
                {viewModalContent.isManual && <span style={{ color: '#8b7d6b', fontSize: '0.85em' }}>（已手动修改）</span>}
                <br />
                <span style={{ color: '#999', fontSize: '0.85em' }}>{viewModalContent.cycleInfo}</span>
              </div>
              <button className="btn btn-primary" onClick={openEditModal} style={{ marginTop: 12 }}>修改</button>
              <button className="close-btn" onClick={closeViewModal} style={{ marginLeft: 8 }}>关闭</button>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`modal edit-modal ${editModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.currentTarget === e.target) closeEditModal(); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-date">{editModalDateText}</div>

          <div className="edit-options">
            {[
              { status: 'rao-day', title: '☀️ 饶白班', desc: '饶上白班（1-4天）' },
              { status: 'rao-night', title: '🌙 饶晚班', desc: '饶上晚班（5-7天）' },
              { status: 'rao-rest', title: '☕ 饶休息日', desc: '仅饶休息' },
              { status: 'li-rest', title: '📚 李休息日', desc: '仅李休息' },
              { status: 'both-rest', title: '✨ 两人同休', desc: '两人都有空' },
            ].map(opt => (
              <div
                key={opt.status}
                className={`edit-option ${editSelectedStatus === opt.status ? 'selected' : ''}`}
                data-status={opt.status}
                onClick={() => selectEditOption(opt.status)}
              >
                <div className="option-title">{opt.title}</div>
                <div className="option-desc">{opt.desc}</div>
              </div>
            ))}
          </div>

          <div className="edit-actions">
            <button className="btn btn-secondary" onClick={closeEditModal}>取消</button>
            <button className="btn btn-danger" onClick={clearManualEdit}>恢复自动</button>
            <button className="btn btn-primary" onClick={saveEdit}>保存</button>
          </div>

          <div className="edit-hint">
            提示：手动修改后会覆盖自动计算，点击&quot;恢复自动&quot;可还原
          </div>
        </div>
      </div>
    </div>
  );
}
