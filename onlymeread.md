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
| 认证 | NextAuth.js v5 (beta) | Credentials Provider（邮箱+密码），JWT 策略 |
| 后端 API | Next.js Route Handlers | 内置在 `app/api/` 下，无需独立后端服务 |
| 数据库 | PostgreSQL (Neon) | 云原生 Serverless PostgreSQL |
| ORM | Prisma 7.7.0 | 类型安全的数据库访问 + 迁移管理 |
| 连接驱动 | `pg` + `@prisma/adapter-pg` | Neon 要求使用 pg 适配器 |
| 密码加密 | `bcryptjs` | 用户密码哈希存储 |
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
├── proxy.ts                          # Next.js 16 Proxy（路由权限拦截）
├── lunar-javascript.d.ts             # lunar-javascript 的类型声明补充
│
├── app/                              # Next.js App Router 主目录
│   ├── globals.css                   # 全局样式（日历 UI）
│   ├── layout.tsx                    # 根布局（HTML/Metadata）
│   ├── page.tsx                      # 首页（客户端组件，日历主界面）
│   │
│   ├── login/page.tsx                # 登录页
│   ├── register/page.tsx             # 注册页（预留）
│   │
│   ├── api/                          # API Route Handlers（后端接口）
│   │   ├── auth/[...nextauth]/route.ts        # NextAuth 入口
│   │   ├── calendar/[year]/[month]/route.ts   # GET：按月获取日历数据
│   │   ├── overrides/route.ts                 # POST/DELETE：手动修改日程
│   │   ├── register/route.ts                  # POST：用户注册
│   │   └── user/bind-couple/route.ts          # POST：邀请码绑定日历组
│   │
│   └── generated/prisma/             # Prisma 自动生成的类型安全客户端
│       ├── client.ts                 # 主入口，导出 PrismaClient
│       ├── models.ts                 # 各模型 TypeScript 类型
│       └── models/                   # 各模型详细类型定义
│
├── components/
│   └── SessionProvider.tsx           # NextAuth SessionProvider 封装
│
├── hooks/                            # 前端自定义 React Hooks
│   └── useCalendar.ts                # SWR 封装：useCalendar + useOverrideMutations
│
├── lib/                              # 前后端共享的业务逻辑与工具
│   ├── access.ts                     # 权限白名单工具（hasAccess）
│   ├── auth.ts                       # NextAuth v5 配置
│   ├── calendar-logic.ts             # 纯函数：排班计算、农历、日历构建
│   ├── init-default.ts               # 数据库默认数据初始化（Couple/Schedule）
│   └── prisma.ts                     # Prisma Client 单例（全局复用）
│
├── prisma/                           # Prisma Schema 与迁移
│   ├── schema.prisma                 # 数据库模型定义
│   ├── seed.ts                       # 2026 年节假日种子数据
│   └── migrations/                   # 数据库迁移文件
│
├── public/                           # 静态资源目录（当前为空）
├── types/
│   └── next-auth.d.ts                # NextAuth 类型扩展（JWT / Session）
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
| `email` | String @unique | 用户邮箱，登录凭证 |
| `name` | String? | 昵称，**用于权限控制（白名单：李/饶）** |
| `password` | String? | bcrypt 哈希后的密码 |
| `image` | String? | 头像 URL |
| `coupleId` | String? | 外键 → `Couple.id` |
| `createdAt` | DateTime | 注册时间 |

- 关系：一个用户属于一个 `Couple`（可选）。
- 用途：登录认证 + 权限校验（只有 `name` 为 "李" 或 "饶" 的用户才能查看日程表）。

#### `Couple` — 情侣关系/日历组表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id @default(cuid()) | 主键，日历组的唯一标识 |
| `inviteCode` | String? @unique @default(uuid()) | 邀请码，用于两人绑定 |
| `createdAt` | DateTime | 创建时间 |

- 关系：包含多个 `User`、一条 `Schedule`、多条 `CalendarOverride`。
- 设计意图：所有日历数据（排班规则、手动修改）都挂在 `Couple` 下。

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

- 用途：存储饶 & 李的排班算法参数。
- 默认值：9天周期（4白+3晚+2休），基准日 2026-04-08 为第 7 天。

#### `CalendarOverride` — 手动修改记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id | 主键 |
| `coupleId` | String | 外键 → `Couple.id` |
| `date` | String | 日期，如 `"2026-04-13"` |
| `status` | String | 覆盖后的状态：`rao-day` / `rao-night` / `rao-rest` / `li-rest` / `both-rest` |
| `createdBy` | String? | 外键 → `User.id`（审计，可选） |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

- **唯一约束**：`@@unique([coupleId, date])`。
- **索引**：`@@index([coupleId, date])`。

#### `Holiday` — 节假日配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String @id | 主键 |
| `date` | String @unique | 日期 |
| `name` | String | 节日名称 |
| `type` | String | `holiday`（放假）或 `workday_makeup`（调休上班） |
| `year` | Int | 所属年份 |

- **索引**：`@@index([year])`。
- 初始数据：已通过 `prisma/seed.ts` 写入 2026 年法定节假日和调休上班日。

---

## 四、认证与权限控制

### 4.1 登录流程

```
浏览器 /login
    │
    ▼
输入邮箱密码 → signIn("credentials")
    │
    ▼
POST /api/auth/callback/credentials
    │
    ▼
lib/auth.ts authorize(credentials)
    ├── 查 User（Prisma）
    ├── bcrypt.compare 校验密码
    └── 密码正确 → 返回 { id, email, name }
    │
    ▼
jwt callback → 将 id/name 写入 JWT token
    │
    ▼
浏览器写入 Cookie，跳转 /
    │
    ▼
GET /
    │
    ▼
proxy.ts 拦截请求 → 读取 Session → name 在白名单？
    ├── 是（李/饶）→ 正常显示日历
    └── 否 / 未登录 → 重定向 /login
```

### 4.2 权限白名单

文件：`lib/access.ts`

```ts
export const ALLOWED_NAMES = ["李", "饶"];
export function hasAccess(name?: string | null) {
  return !!name && ALLOWED_NAMES.includes(name);
}
```

权限控制分 **三层**：
1. **Proxy 层**（`proxy.ts`）：所有页面/API 请求的统一入口拦截
2. **API 层**：每个 API 路由内部再次校验（防止绕过页面直接调接口）
3. **页面层**（`app/page.tsx`）：客户端兜底，显示无权限提示页

> **注意**：不要在 `authorize` 里直接 `throw Error` 做权限拦截。在 Vercel 生产环境下，这会导致 `signIn` 请求挂起，前端一直显示"登录中..."（见下文踩坑记录）。

---

## 五、前后端交互关系

### 5.1 数据流总览

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

### 5.2 API 接口清单

#### `GET /api/calendar/{year}/{month}`
获取指定月份的完整日历数据。

**内部逻辑：**
1. `ensureDefaultCouple()`：如果数据库中没有 `Couple`，自动创建一个，并附带默认 `Schedule`。
2. 查询该月份前后缓冲范围内的 `CalendarOverride`。
3. 查询当年及相邻年份的 `Holiday`。
4. 调用 `buildMonthCells()` 计算 42 个格子的完整数据。

#### `POST /api/overrides`
保存或更新某天的手动修改状态。

**请求体：**
```json
{
  "date": "2026-04-13",
  "status": "both-rest"
}
```

**内部逻辑：** 使用 Prisma `upsert`，基于 `coupleId + date` 唯一约束进行插入或更新。

#### `DELETE /api/overrides?date=2026-04-13`
删除某天的手动修改，恢复为自动计算。

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
2. 无手动修改时，根据饶的周期和李的休息规则自动计算。

### 农历计算
使用 `lunar-javascript` 库将公历转为真实农历。

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

### 部署到 Vercel
1. 将代码推送到 Git 仓库。
2. 在 Vercel 导入项目。
3. 在 **Vercel Dashboard → Settings → Environment Variables** 中添加以下变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host/db?sslmode=require` |
| `AUTH_SECRET` | NextAuth JWT 加密密钥 | `openssl rand -base64 32` |
| `AUTH_URL` | 你的站点公网地址 | `https://calendar.playerallocationsystem.online` |

4. 点击 **Redeploy** 重新部署。

> **注意**：修改环境变量后必须 **Redeploy** 才会生效。

---

## 八、Vercel 部署踩坑记录

### 8.1 Prisma Client 自定义输出目录导致构建失败

**现象**：Vercel 构建时报 `Module not found: Can't resolve '../app/generated/prisma/client'`。

**原因**：`schema.prisma` 中设置了自定义 output：
```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}
```
Vercel 不会自动运行 `prisma generate`。

**修复**：在 `package.json` 中添加：
```json
"postinstall": "prisma generate",
"build": "prisma generate && next build"
```

---

### 8.2 NextAuth v5 beta 在 Vercel 上登录正确密码后卡住

**现象**：错误密码立刻提示"邮箱或密码错误"，正确密码却一直显示"登录中..."。

**原因 1：`AUTH_SECRET` 缺失**
- NextAuth v5 在生成 session/JWT 时必须使用 `secret`。
- 缺失时服务端崩溃或挂起，前端 `signIn` Promise 永远不返回。

**原因 2：`AUTH_URL` 缺失**
- Credentials Provider 登录成功后，NextAuth 内部需要知道站点域名来完成 callback。
- 缺失时请求挂起，表现为"登录中..."。

**修复**：在 Vercel 环境变量中同时配置 `AUTH_SECRET` 和 `AUTH_URL`。

---

### 8.3 `authorize` 回调里 `throw Error` 导致前端挂起

**现象**：密码正确，Vercel 上一直"登录中..."，本地 `npm run dev` 正常。

**原因**：之前在 `authorize` 里用 `throw new Error("UNAUTHORIZED_NAME")` 做权限拦截。NextAuth v5 beta 在 Vercel Serverless 环境下，`authorize` 中 `throw Error` 会让 `signIn` 请求挂起。

**修复**：
- 权限拦截从 `authorize` 中移除
- 登录只验证密码，通过后再由 `proxy.ts` 和页面层做权限控制

---

### 8.4 `authorize` 返回对象带 `undefined` 字段导致 `CredentialsSignin`

**现象**：`authorize` 和 `jwt` 都成功执行了，但浏览器仍收到 `error: 'CredentialsSignin'`。

**原因**：`authorize` 返回了 `{ id, email, name, image: undefined, coupleId: undefined }`。NextAuth v5 beta 在序列化这个对象时，`undefined` 字段可能触发内部校验失败。

**修复**：`authorize` 只返回最精简的字段：
```ts
return {
  id: user.id,
  email: user.email,
  name: user.name ?? null,
};
```

---

### 8.5 `getToken()` 在 `proxy.ts` 里读不到 NextAuth v5 的 Cookie

**现象**：登录成功，Cookie 已写入，但访问 `/` 时 `proxy.ts` 认为用户未登录，被踢回 `/login`。

**原因**：`next-auth/jwt` 的 `getToken()` 是为 v4 设计的，v5 beta 的 cookie 命名和加密格式不同，导致 `getToken` 无法解密。

**修复**：将 `proxy.ts` 从 `getToken` 改为使用 NextAuth v5 官方的 `auth()` 函数：
```ts
import { auth } from "@/lib/auth";

const session = await auth();
const isLoggedIn = !!session?.user;
const name = session?.user?.name;
```

---

### 8.6 Edge Runtime 不支持 Prisma/Node.js 内置模块

**现象**：构建或运行时报错 `Native module not found: node:path`。

**原因**：`middleware.ts` / `proxy.ts` 间接引入了 `lib/prisma.ts` → `app/generated/prisma/client.ts`，该文件使用了 `node:path` 和 `node:url`。

**修复**：
1. 废弃 `middleware.ts`，改用 `proxy.ts`（Next.js 16 推荐）
2. 确保 `proxy.ts` 不引入 Prisma，使用 `auth()` 做 session 读取
3. 把权限工具（`hasAccess`）拆到无依赖的 `lib/access.ts` 中

---

## 九、已修复的历史 Bug

| Bug | 修复方式 |
|-----|---------|
| 日历起始偏移 `% 8` | 改为 `% 7`（一周 7 天） |
| `today` 硬编码为 2026-04-13 | 改为 `new Date()` 动态获取 |
| 农历算法错误（天数对 30 取模） | 接入 `lunar-javascript` 真实农历库 |
| 手动修改不持久化 | 接入 PostgreSQL + SWR 数据流 |
| 节假日硬编码在前端 | 迁移到 `Holiday` 表，通过 API 读取 |
| 单文件 HTML 无法扩展 | 整体重构为 Next.js App Router 项目 |
| 登录后无权限控制 | 接入 NextAuth + Proxy + 名字白名单 |
| Vercel 正确密码登录卡住 | 配置 `AUTH_SECRET` + `AUTH_URL`，简化 `authorize` 返回值 |
| 登录成功仍被踢回登录页 | `proxy.ts` 从 `getToken` 改为 `auth()` 读取 session |

---

## 十、后续可扩展方向

1. **底部统计栏**
   - CSS 中已预留 `.bottom-stats` 样式，可统计当月各类状态天数。

2. **排班规则配置页**
   - 当前 `Schedule` 是自动创建的，后续可开放页面让用户自行修改基准日和周期参数。

3. **节假日管理后台**
   - 支持手动添加/编辑 2025、2027 及以后的节假日数据。
