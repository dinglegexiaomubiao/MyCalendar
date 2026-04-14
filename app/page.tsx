'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCalendar, useOverrideMutations } from '@/hooks/useCalendar';
import { CalendarCell, filterNames, getRaoCycleDay, getRaoShiftType } from '@/lib/calendar-logic';

const today = new Date();

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [displayDate, setDisplayDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentModalDate, setCurrentModalDate] = useState<string | null>(null);
  const [currentModalStatus, setCurrentModalStatus] = useState<string | null>(null);
  const [editSelectedStatus, setEditSelectedStatus] = useState<string | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [tooltip, setTooltip] = useState<{ visible: boolean; text: string; x: number; y: number }>({
    visible: false, text: '', x: 0, y: 0
  });

  const [bindCode, setBindCode] = useState('');
  const [bindLoading, setBindLoading] = useState(false);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth() + 1;

  const { data, isLoading } = useCalendar(year, month);
  const { saveOverride, deleteOverride, revalidateCalendar } = useOverrideMutations();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const cells = useMemo(() => {
    if (!data || !data.cells) return [];
    if (activeFilters.length === 0) return data.cells;
    return data.cells.map((cell) => ({
      ...cell,
      highlighted: shouldHighlightFromCell(cell, activeFilters),
      dimmed: activeFilters.length > 0 && !shouldHighlightFromCell(cell, activeFilters),
    }));
  }, [data, activeFilters]);

  const currentCell = useMemo(() => {
    if (!currentModalDate || !data || !data.cells) return null;
    return data.cells.find((c) => c.date === currentModalDate) || null;
  }, [currentModalDate, data]);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
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
    setActiveFilters((prev) => {
      if (prev.includes(filter)) {
        return prev.filter((f) => f !== filter);
      }
      return [...prev, filter];
    });
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const openViewModal = (dateStr: string, status: string) => {
    setCurrentModalDate(dateStr);
    setCurrentModalStatus(status);
    setViewModalOpen(true);
  };

  const closeViewModal = () => {
    setViewModalOpen(false);
  };

  const openEditModal = () => {
    setViewModalOpen(false);
    if (currentModalStatus) {
      setEditSelectedStatus(currentModalStatus);
      setEditModalOpen(true);
    }
  };

  const selectEditOption = (status: string) => {
    setEditSelectedStatus(status);
  };

  const saveEdit = async () => {
    if (!editSelectedStatus || !currentModalDate) {
      showToast('请选择一个状态');
      return;
    }
    try {
      await saveOverride(currentModalDate, editSelectedStatus as CalendarCell['status']);
      await revalidateCalendar(year, month);
      const prevMonth = new Date(displayDate);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      await revalidateCalendar(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
      const nextMonth = new Date(displayDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await revalidateCalendar(nextMonth.getFullYear(), nextMonth.getMonth() + 1);
      setEditModalOpen(false);
      showToast('已保存修改');
    } catch {
      showToast('保存失败，请重试');
    }
  };

  const clearManualEdit = async () => {
    if (!currentModalDate) return;
    try {
      await deleteOverride(currentModalDate);
      await revalidateCalendar(year, month);
      const prevMonth = new Date(displayDate);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      await revalidateCalendar(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
      const nextMonth = new Date(displayDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await revalidateCalendar(nextMonth.getFullYear(), nextMonth.getMonth() + 1);
      setEditModalOpen(false);
      showToast('已恢复自动计算');
    } catch {
      showToast('恢复失败，请重试');
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
  };

  const handleBindCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindCode.trim()) return;
    setBindLoading(true);
    const res = await fetch('/api/user/bind-couple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: bindCode.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('绑定成功');
      window.location.reload();
    } else {
      showToast(data.error || '绑定失败');
    }
    setBindLoading(false);
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

  const monthYearText = `${year}年${month}月`;

  const filterInfoText = useMemo(() => {
    if (activeFilters.length === 0) {
      return '点击上方按钮可多选筛选，显示所有选中状态的日期';
    }
    const selectedNames = activeFilters.map((f) => filterNames[f]).join('、');
    return `当前筛选：${selectedNames}（${activeFilters.length}项）- 白/晚班筛选包含所有对应班次`;
  }, [activeFilters]);

  const filterInfoActive = activeFilters.length > 0;

  const viewModalContent = useMemo(() => {
    if (!currentCell || !data || !data.schedule) return null;
    const dateStr = currentCell.date;
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayOfWeek = new Date(dateStr).getDay();
    const isManual = currentCell.isOverride;
    const cycleDay = getRaoCycleDay(dateStr, data.schedule);
    const shiftType = getRaoShiftType(dateStr, data.schedule);

    let statusText = '';
    let statusBg = '';
    let statusColor = '#ffffff';
    let detailText = '';

    switch (currentCell.status) {
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
      cycleInfo: `饶处于${data.schedule.raoCycleLength}天周期第${cycleDay}天`,
      isManual,
    };
  }, [currentCell, data]);

  const editModalDateText = useMemo(() => {
    if (!currentModalDate) return '修改日程';
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `修改 ${currentModalDate} ${weekdays[new Date(currentModalDate).getDay()]} 的日程`;
  }, [currentModalDate]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3f0', color: '#888' }}>
        加载中...
      </div>
    );
  }

  const userName = session?.user?.name;
  const canAccess = userName === '李' || userName === '饶';

  if (status === 'authenticated' && !canAccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3f0', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 18, color: '#3d3d3d', fontWeight: 500 }}>抱歉，您没有权限访问此日程表</div>
        <div style={{ fontSize: 14, color: '#888' }}>该日程表仅限特定用户查看</div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            borderRadius: 14,
            border: 'none',
            background: '#8b7d6b',
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          退出登录
        </button>
      </div>
    );
  }

  const hasCouple = !!session?.user?.coupleId;

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
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, opacity: 0.9 }}>
            {session?.user?.name || session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            退出登录
          </button>
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

      {!hasCouple && (
        <div style={{ padding: '24px 20px', background: '#faf9f7', borderBottom: '1px solid #e8e6e3' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: '#3d3d3d', marginBottom: 8, fontWeight: 500 }}>
              你还没有绑定日历组
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              请输入对方分享的邀请码，加入同一个日程日历
            </div>
            <form onSubmit={handleBindCouple} style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={bindCode}
                onChange={(e) => setBindCode(e.target.value)}
                placeholder="输入邀请码"
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #d0ccc5',
                  fontSize: 14,
                  minWidth: 200,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={bindLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#8b7d6b',
                  color: '#fff',
                  fontSize: 14,
                  cursor: bindLoading ? 'not-allowed' : 'pointer',
                  opacity: bindLoading ? 0.7 : 1,
                }}
              >
                {bindLoading ? '绑定中...' : '绑定'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="calendar-wrapper">
        {isLoading && !data && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>加载中...</div>
        )}
        <div className="calendar-grid" style={!hasCouple ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
          {cells.map((cell) => {
            const classNames = [
              'day-cell',
              `status-${cell.status}`,
              cell.isToday ? 'is-today' : '',
              !cell.isCurrentMonth ? 'other-month' : '',
              cell.isOverride ? 'manual-edit' : '',
              cell.highlighted ? 'highlighted' : '',
              cell.dimmed ? 'dimmed' : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={cell.date}
                className={classNames}
                data-status={cell.status}
                data-date={cell.date}
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
                  if (cell.isOverride) text += ' (已修改)';
                  setTooltip({
                    visible: true,
                    text: `${cell.date} · ${text}`,
                    x: e.clientX + 10,
                    y: e.clientY - 30
                  });
                }}
                onMouseMove={(e) => {
                  setTooltip((prev) => ({ ...prev, x: e.clientX + 10, y: e.clientY - 30 }));
                }}
                onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
              >
                <div className="day-number">{cell.day}</div>
                <div className="day-lunar">{cell.lunar}</div>
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
            ].map((opt) => (
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

function shouldHighlightFromCell(cell: CalendarCell, activeFilters: string[]): boolean {
  for (const filter of activeFilters) {
    if (filter === cell.status) return true;
    if (filter === 'rao-day' && cell.shiftType === 'day') return true;
    if (filter === 'rao-night' && cell.shiftType === 'night') return true;
    if (filter === 'rao-rest' && (cell.status === 'rao-rest' || cell.status === 'both-rest')) return true;
    if (filter === 'li-rest' && (cell.status === 'li-rest' || cell.status === 'both-rest')) return true;
  }
  return false;
}
