# MyDate 项目架构与运行逻辑文档

> 本文档用于说明当前项目的整体框架、目录结构、数据库设计、前后端交互关系以及运行方式。
> 项目定位：一款基于 Next.js 16 + React 19 的情侣日程对照表 Web 应用。

---

## 一、技术栈

| 层级 | 技术/库 | 说明 |
|------|---------|------|
| 前端框架 | Next.js 16.2.3 (App Router) | 使用 App Router 架构，支持 RSC/RCC 混合渲染 |
| UI 库 | React 19.2.4 | 客户端状态管理使用原生 useState |
| 数据获取 | SWR 2.4.1 | 客户端缓存、自动重验证、乐观更新 |
| 后端 API | Next.js Route Handlers | 内置在 `app/api/` 下，无需独立后端服务 |
| 数据库 | PostgreSQL (Neon) | 云原生 Serverless PostgreSQL |
| ORM | Prisma 7.7.0 | 类型安全的数据库访问 + 迁移管理 |
| 连接驱动 | `pg` + `@prisma/adapter-pg` | Neon 要求使用 pg 适配器 |
| 农历计算 | `lunar-javascript` | 真实的农历转换，替代之前的伪算法 |
| 语言 | TypeScript 5 | 全栈类型安全 |

---

## 二、项目目录结构

```
mydate/
├── .env                              # 数据库连接字符串（已加入 .gitignore）
├── .gitignore
├── next.config.ts                    # Next.js 配置文件
├── package.json
├── prisma.config.ts                  # Prisma 7 配置文件
├── tsconfig.json
├── lunar-javascript.d.ts             # lunar-javascript 的类型声明补充
│
├── app/                              # Next.js App Router 主目录
│   ├── globals.css                   # 全局样式（日历 UI）
│   ├── layout.tsx                    # 根布局（HTML/Metadata）
│   ├── page.tsx                      # 首页（客户端组件，日历主界面）
│   │
│   ├── api/                          # API Route Handlers（后端接口）
│   │   ├── calendar/[year]/[month]/route.ts   # GET：按月获取日历数据
│   │   └── overrides/route.ts                 # POST/DELETE：手动修改日程
│   │
│   └── generated/prisma/             # Prisma 自动生成的类型安全客户端
│       ├── client.ts                 # 主入口，导出 PrismaClient
│       ├── models.ts                 # 各模型 TypeScript 类型
│       └── models/                   # 各模型详细类型定义
│
├── hooks/                            # 前端自定义 React Hooks
│   └── useCalendar.ts                # SWR 封装：useCalendar + useOverrideMutations
│
├── lib/                              # 前后端共享的业务逻辑与工具
│   ├── calendar-logic.ts             # 纯函数：排班计算、农历、日历构建
│   ├── init-default.ts               # 数据库默认数据初始化（Couple/Schedule）
│   └── prisma.ts                     # Prisma Client 单例（全局复用）
│
├── prisma/                           # Prisma Schema 与迁移
│   ├── schema.prisma                 # 数据库模型定义
│   ├── seed.ts                       # 2026 年节假日种子数据
│   └── migrations/                   # 数据库迁移文件
│       └── 20260413083021_init/
│           └── migration.sql
│
├── public/                           # 静态资源目录（当前为空）
└── mydate.html.bak                   # 原始单文件 HTML 版本备份
```

---

## 三、数据库设计（Prisma Schema）

数据库采用 PostgreSQL，部署在 **Neon** 上。共 5 张表，关系如下：

```
User (N) ─────── belongs to ───────> Couple (1)
                                         │
                                         ├── has one ───> Schedule (1)
                                         │
                                         └── has many ──> CalendarOverride (N)

Holiday (独立表，按年份维护)
```

### 3.1 表详情

#### `User` — 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id @default(cuid()) | 主键 |
| `email` | String @unique | 用户邮箱，未来用于认证识别 |
| `name` | String? | 昵称 |
| `image` | String? | 头像 URL |
| `coupleId` | String? | 外键 → `Couple.id` |
| `createdAt` | DateTime | 注册时间 |

- 关系：一个用户属于一个 `Couple`（可选）。
- 用途：当前版本尚未接入 Auth.js，表已预留，支持后续登录/审计功能。

#### `Couple` — 情侣关系/日历组表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id @default(cuid()) | 主键，日历组的唯一标识 |
| `createdAt` | DateTime | 创建时间 |

- 关系：包含多个 `User`、一条 `Schedule`、多条 `CalendarOverride`。
- 设计意图：所有日历数据（排班规则、手动修改）都挂在 `Couple` 下，未来支持"邀请码绑定"两人到同一组。

#### `Schedule` — 排班配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id | 主键 |
| `coupleId` | String @unique | 外键 → `Couple.id`（一对一） |
| `raoBaseDate` | String | 饶的排班基准日，如 `"2026-04-08"` |
| `raoBaseCycleDay` | Int @default(7) | 基准日是周期第几天 |
| `raoCycleLength` | Int @default(9) | 周期总长 |
| `raoDayShiftDays` | Int @default(4) | 白班天数 |
| `raoNightShiftDays` | Int @default(3) | 晚班天数 |
| `raoRestDays` | Int @default(2) | 休息天数 |
| `liRestType` | String @default("weekend_and_holiday") | 李的休息规则 |

- 用途：存储饶 & 李的排班算法参数。未来可扩展为每对情侣自定义不同周期。
- 默认值：9天周期（4白+3晚+2休），基准日 2026-04-08 为第 7 天。

#### `CalendarOverride` — 手动修改记录表（核心业务表）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id | 主键 |
| `coupleId` | String | 外键 → `Couple.id` |
| `date` | String | 日期，如 `"2026-04-13"` |
| `status` | String | 覆盖后的状态：`rao-day` / `rao-night` / `rao-rest` / `li-rest` / `both-rest` |
| `createdBy` | String? | 外键 → `User.id`（审计，可选） |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

- **唯一约束**：`@@unique([coupleId, date])`，确保同一天只有一条覆盖记录。
- **索引**：`@@index([coupleId, date])`，加速按月范围查询。
- 用途：用户在日历上点击某天并修改状态后，数据持久化到这里。刷新页面后不会丢失。

#### `Holiday` — 节假日配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id | 主键 |
| `date` | String @unique | 日期，如 `"2026-01-01"` |
| `name` | String | 节日名称 |
| `type` | String | `holiday`（放假）或 `workday_makeup`（调休上班） |
| `year` | Int | 所属年份 |

- **索引**：`@@index([year])`，API 按年查询时加速。
- 用途：将原本硬编码在前端的节假日数据迁移到数据库，支持后续扩展更多年份。
- 初始数据：已通过 `prisma/seed.ts` 写入 2026 年法定节假日和调休上班日。

---

## 四、前后端交互关系

### 4.1 数据流总览

```
浏览器打开 /
    │
    ▼
app/page.tsx (Client Component 'use client')
    │
    ├── 渲染 UI 框架（header、筛选栏、日历网格容器）
    │
    └── SWR 自动请求 ───────────────┐
                                    │
                                    ▼
                         GET /api/calendar/2026/4
                                    │
                                    ▼
                         app/api/calendar/[year]/[month]/route.ts
                                    │
                         ┌──────────┴──────────┐
                         ▼                      ▼
               ensureDefaultCouple()    查询 CalendarOverride
               （无数据则自动创建）      （该月及跨月缓冲范围）
                         │                      │
                         └──────────┬──────────┘
                                    ▼
                         查询 Holiday（当年及相邻年份）
                                    │
                                    ▼
                         buildMonthCells()（lib/calendar-logic.ts）
                                    │
                                    ▼
                         返回 JSON：{ year, month, coupleId, schedule, cells }
                                    │
                                    ▼
                         前端渲染 42 格日历（含状态、农历、标签）
```

### 4.2 API 接口清单

#### `GET /api/calendar/{year}/{month}`
获取指定月份的完整日历数据。

**参数：**
- `year`：年份，如 `2026`
- `month`：月份，如 `4`

**内部逻辑：**
1. 调用 `ensureDefaultCouple()`：如果数据库中没有 `Couple`，自动创建一个，并附带默认 `Schedule`。
2. 查询该月份前后缓冲范围内的 `CalendarOverride`（因为日历网格会跨月）。
3. 查询当年及相邻年份的 `Holiday`。
4. 调用纯函数 `buildMonthCells()` 计算 42 个格子的完整数据。

**返回示例（片段）：**
```json
{
  "year": 2026,
  "month": 4,
  "coupleId": "cl...",
  "schedule": {
    "raoBaseDate": "2026-04-08",
    "raoBaseCycleDay": 7,
    "raoCycleLength": 9,
    "raoDayShiftDays": 4,
    "raoNightShiftDays": 3,
    "raoRestDays": 2,
    "liRestType": "weekend_and_holiday"
  },
  "cells": [
    {
      "date": "2026-03-30",
      "day": 30,
      "isCurrentMonth": false,
      "isToday": false,
      "status": "rao-day",
      "shiftType": "day",
      "cycleDay": 4,
      "isOverride": false,
      "isHoliday": false,
      "isWorkdayMakeup": false,
      "lunar": "十二",
      "tags": "<div class=\"day-tag\" style=\"color:#666\">白</div>"
    },
    {
      "date": "2026-04-04",
      "day": 4,
      "isCurrentMonth": true,
      "isToday": false,
      "status": "both-rest",
      "shiftType": "rest",
      "cycleDay": 9,
      "isOverride": false,
      "isHoliday": true,
      "holidayName": "清明节",
      "isWorkdayMakeup": false,
      "lunar": "十八",
      "tags": "<div class=\"day-tag\">同休</div>"
    }
  ]
}
```

---

#### `POST /api/overrides`
保存或更新某天的手动修改状态。

**请求体：**
```json
{
  "coupleId": "cl...",      // 可选，不传则使用默认 Couple
  "date": "2026-04-13",
  "status": "both-rest"
}
```

**响应：**
```json
{
  "success": true,
  "override": { ... }
}
```

**内部逻辑：** 使用 Prisma `upsert`，基于 `coupleId + date` 唯一约束进行插入或更新。

---

#### `DELETE /api/overrides?date=2026-04-13&coupleId=xxx`
删除某天的手动修改，恢复为自动计算。

**查询参数：**
- `date`（必填）：要恢复的日期
- `coupleId`（可选）：不传则使用默认 Couple

**响应：**
```json
{ "success": true }
```

---

## 五、前端状态与数据流

### 5.1 核心 Hooks

文件：`hooks/useCalendar.ts`

```ts
// 获取某月日历数据
const { data, error, isLoading } = useCalendar(2026, 4);

// 获取修改操作的方法
const { saveOverride, deleteOverride, revalidateCalendar } = useOverrideMutations(coupleId);
```

### 5.2 用户修改日历后的数据流

```
用户点击日期 → 打开 View Modal → 点击"修改" → 选择状态 → 点击"保存"
    │
    ▼
调用 saveOverride(date, status)
    │
    ├── POST /api/overrides
    │   └── 数据写入 Neon DB 的 CalendarOverride 表
    │
    └── 成功后调用 revalidateCalendar(year, month)
        └── SWR 自动重新请求 GET /api/calendar/{year}/{month}
            └── 前端 UI 自动更新（同时刷新相邻月份缓存）
```

### 5.3 筛选逻辑

筛选状态保存在前端 `useState` 中（`activeFilters`）。
- 当用户勾选筛选条件时，`cells` 通过 `useMemo` 重新计算，给每个 `CalendarCell` 附加 `highlighted` 和 `dimmed` 属性。
- 高亮匹配项，非匹配项变淡（opacity: 0.15）。

---

## 六、排班算法说明（lib/calendar-logic.ts）

### 饶的排班规则
- **周期**：9 天（4 天白班 + 3 天晚班 + 2 天休息）
- **基准日**：`2026-04-08` 是周期第 7 天（晚班第 3 天）
- **计算方式**：`cycleDay = ((diffDays + baseCycleDay - 1) % 9 + 9) % 9 + 1`

### 李的休息规则
- 周末（周六、日）休息
- 法定节假日休息
- 调休上班日（`workday_makeup`）需正常上班

### 每日状态推导
1. 查询 `CalendarOverride`，如有手动修改直接返回该状态。
2. 无手动修改时，根据饶的周期和李的休息规则自动计算：
   - 饶休息 + 李休息 = `both-rest`
   - 饶休息 + 李上班 = `rao-rest`
   - 饶白班/晚班 + 李休息 = `li-rest`
   - 饶白班 + 李上班 = `rao-day`
   - 饶晚班 + 李上班 = `rao-night`

### 农历计算
使用 `lunar-javascript` 库将公历转为真实农历：
- 初一显示为月份，如"四月"
- 其他日期显示为"初二"、"初三"等

---

## 七、运行与部署

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
访问 `http://localhost:3000`。

第一次访问时，API 会自动在数据库中创建默认的 `Couple` 和 `Schedule` 记录，因此无需手动初始化。

### 数据库操作
```bash
# 执行 Prisma 迁移（修改 schema 后）
npx prisma migrate dev --name xxx

# 重新生成客户端
npx prisma generate

# 重新写入节假日种子数据
npx prisma db seed
```

### 构建
```bash
npm run build
```
已验证构建成功，产物在 `.next/` 目录。

### 部署到 Vercel（推荐）
1. 将代码推送到 Git 仓库。
2. 在 Vercel 导入项目。
3. 在 Vercel Dashboard → Settings → Environment Variables 中添加：
   - `DATABASE_URL` = `postgresql://neondb_owner:...`
4. 重新部署即可。

---

## 八、已修复的历史 Bug

| Bug | 修复方式 |
|-----|---------|
| 日历起始偏移 `% 8` | 改为 `% 7`（一周 7 天） |
| `today` 硬编码为 2026-04-13 | 改为 `new Date()` 动态获取 |
| 农历算法错误（天数对 30 取模） | 接入 `lunar-javascript` 真实农历库 |
| 手动修改不持久化 | 接入 PostgreSQL + SWR 数据流 |
| 节假日硬编码在前端 | 迁移到 `Holiday` 表，通过 API 读取 |

---

## 九、后续可扩展方向

1. **用户认证（Auth.js）**
   - 接入 Credentials Provider（邮箱+密码）或 Magic Link 登录。
   - 登录后通过"邀请码"将两人绑定到同一个 `Couple`。

2. **底部统计栏**
   - CSS 中已预留 `.bottom-stats` 样式，可统计当月各类状态天数。

3. **排班规则配置页**
   - 当前 `Schedule` 是自动创建的，后续可开放页面让用户自行修改基准日和周期参数。

4. **节假日管理后台**
   - 支持手动添加/编辑 2025、2027 及以后的节假日数据。
