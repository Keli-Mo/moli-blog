# 博客系统完整技术文档

> Next.js 16 / React 19 个人博客站点，以 GitHub 仓库作为唯一内容后端，无数据库。

---

## 目录

1. [技术栈总览](#技术栈总览)
2. [NPM 脚本](#npm-脚本)
3. [目录结构](#目录结构)
4. [页面路由](#页面路由)
5. [核心依赖包](#核心依赖包)
6. [全局配置](#全局配置)
7. [样式系统](#样式系统)
8. [状态管理](#状态管理)
9. [工具函数库（src/lib）](#工具函数库)
10. [React Hooks（src/hooks）](#react-hooks)
11. [全局组件（src/components）](#全局组件)
12. [GitHub 鉴权流程](#github-鉴权流程)
13. [写入服务（services）](#写入服务)
14. [关键数据流](#关键数据流)
15. [SVG 工作流](#svg-工作流)
16. [部署方式](#部署方式)

---

## 技术栈总览

| 分类 | 技术 |
|------|------|
| 前端框架 | Next.js 16（App Router）+ React 19 |
| 开发语言 | TypeScript 5 |
| 样式 | Tailwind CSS v4 + PostCSS |
| 动画 | Motion (Framer Motion) |
| 状态管理 | Zustand 5 |
| 数据获取 | SWR 2 |
| Markdown | marked + shiki + KaTeX |
| 图标 | Lucide React |
| Toast 提示 | Sonner |
| 瀑布流布局 | Masonic |
| GitHub 鉴权 | jsrsasign（JWT 签名） |
| 私钥加密 | Web Crypto API（AES-256-GCM） |
| 内容后端 | GitHub Contents API（无数据库） |
| 部署 | Cloudflare Workers / Vercel |

---

## NPM 脚本

```bash
pnpm dev          # 启动开发服务器（端口 3001，Turbopack）
pnpm build        # 构建 Next.js 生产版本
pnpm start        # 运行生产服务器
pnpm svg          # 重新生成 SVG 索引（修改 SVG 后必须执行）

# Cloudflare 部署
pnpm build:cf     # 构建 Cloudflare 版本（opennextjs-cloudflare）
pnpm preview      # 本地预览 Cloudflare 构建
pnpm deploy       # 部署到 Cloudflare Workers
pnpm cf-typegen   # 生成 Cloudflare 环境变量类型定义
```

---

## 目录结构

```
root/
├── public/
│   ├── blogs/                     # 博客内容（Markdown + 配置）
│   │   ├── index.json             # 所有文章元数据索引
│   │   ├── categories.json        # 分类列表
│   │   └── <slug>/
│   │       ├── index.md           # 文章正文
│   │       └── config.json        # 文章额外配置
│   └── images/
│       └── pictures/              # 图床图片（WebP）
│
├── src/
│   ├── app/
│   │   ├── (home)/                # 首页（卡片拖拽布局）
│   │   │   ├── stores/            # config-store / layout-edit-store
│   │   │   ├── services/          # push-site-content.ts
│   │   │   └── config-dialog/     # 主题色、卡片开关配置面板
│   │   ├── blog/                  # 博客列表 & 详情
│   │   ├── write/                 # 文章编辑器
│   │   │   ├── stores/            # write-store / preview-store
│   │   │   └── services/          # push-blog.ts / delete-blog.ts
│   │   ├── gallery/               # 图片瀑布流
│   │   │   ├── list.json          # 图片数据源
│   │   │   ├── components/        # masonic-layout / upload-dialog
│   │   │   └── services/          # push-pictures.ts
│   │   ├── about/
│   │   ├── share/
│   │   ├── projects/
│   │   ├── bloggers/
│   │   ├── snippets/
│   │   ├── image-toolbox/
│   │   └── ...其他页面
│   │
│   ├── components/                # 全局 UI 组件
│   ├── hooks/                     # 全局 React Hooks
│   ├── lib/                       # 工具函数
│   ├── config/
│   │   ├── site-content.json      # 站点元信息、主题色、社交链接
│   │   ├── card-styles.json       # 首页卡片位置/尺寸（用户配置）
│   │   └── card-styles-default.json
│   ├── styles/
│   │   ├── globals.css            # 全局样式 + 自定义工具类
│   │   ├── theme.css              # Tailwind 主题变量
│   │   └── article.css            # 文章正文样式
│   ├── svgs/                      # SVG 图标（自动生成 index.ts）
│   ├── consts.ts                  # 全局常量 & 环境变量
│   └── ...
│
├── scripts/
│   └── gen-svgs-index.js          # SVG 索引生成脚本
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

---

## 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页，多卡片拖拽布局 |
| `/blog` | 文章列表 |
| `/blog/[id]` | 文章详情 |
| `/write` | 新建文章（需鉴权） |
| `/write/[slug]` | 编辑已有文章（需鉴权） |
| `/gallery` | 图片瀑布流 |
| `/about` | 关于页 |
| `/share` | 推荐资源分享 |
| `/projects` | 项目展示 |
| `/bloggers` | 优秀博客列表 |
| `/snippets` | 代码片段 |
| `/image-toolbox` | 图片压缩工具 |
| `/clock` | 时钟页 |
| `/music` | 音乐页 |
| `/live2d` | Live2D 看板娘 |
| `/rss.xml` | RSS 订阅源 |

---

## 核心依赖包

### 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `next` | 16.0.10 | 核心框架（App Router） |
| `react` / `react-dom` | 19.x | UI 框架 |
| `zustand` | ^5.0.8 | 全局状态管理 |
| `swr` | ^2.3.6 | 数据获取与缓存 |
| `motion` | ^12.x | 动画（Framer Motion） |
| `masonic` | ^4.1.0 | 瀑布流网格布局 |
| `marked` | ^17.0.0 | Markdown 解析 |
| `shiki` | ^3.15.0 | 代码语法高亮 |
| `katex` | ^0.16.27 | 数学公式渲染（LaTeX） |
| `html-react-parser` | ^5.2.8 | HTML 字符串转 React 组件 |
| `jsrsasign` | ^11.1.0 | JWT 签名（GitHub App 鉴权） |
| `lucide-react` | ^0.553.0 | 图标库 |
| `sonner` | ^2.0.7 | Toast 提示组件 |
| `dayjs` | ^1.11.18 | 日期格式化 |
| `clsx` | ^2.1.1 | 条件 className 拼接 |
| `tailwind-merge` | ^3.3.1 | Tailwind 类名去重合并 |
| `ts-debounce` | ^4.0.0 | 防抖函数 |
| `@vercel/analytics` | ^2.0.1 | Vercel 访问统计 |
| `@opennextjs/cloudflare` | ^1.14.4 | Cloudflare Workers 适配器 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| `typescript` | TypeScript 编译器 |
| `tailwindcss` + `@tailwindcss/postcss` | Tailwind CSS v4 |
| `@svgr/webpack` | SVG 文件转 React 组件 |
| `prettier` + `prettier-plugin-tailwindcss` | 代码格式化 |
| `next-sitemap` | 自动生成 sitemap.xml |
| `wrangler` | Cloudflare Workers CLI |
| `babel-plugin-react-compiler` | React 编译器优化 |
| `code-inspector-plugin` | 点击组件跳转源码 |

---

## 全局配置

### 环境变量（src/consts.ts）

```typescript
export const GITHUB_CONFIG = {
  OWNER:       process.env.NEXT_PUBLIC_GITHUB_OWNER,    // 仓库所有者
  REPO:        process.env.NEXT_PUBLIC_GITHUB_REPO,     // 仓库名
  BRANCH:      process.env.NEXT_PUBLIC_GITHUB_BRANCH,   // 目标分支
  APP_ID:      process.env.NEXT_PUBLIC_GITHUB_APP_ID,   // GitHub App ID
  ENCRYPT_KEY: process.env.NEXT_PUBLIC_GITHUB_ENCRYPT_KEY  // 私钥加密密钥
}

export const CARD_SPACING = 36      // 首页卡片间距（桌面）
export const ANIMATION_DELAY = 0.1  // 卡片入场动画间隔（秒）
```

### 站点内容（src/config/site-content.json）

| 字段 | 说明 |
|------|------|
| `meta.title` | 站点名称 |
| `meta.description` | 站点描述 |
| `theme` | 主题色（brand/primary/secondary/bg/card/border/brandSecondary） |
| `backgrounds` | 背景图片列表 |
| `socialLinks` | 社交链接（GitHub、掘金、Email 等） |
| `enableChristmas` | 是否启用圣诞主题 |
| `isCachePem` | 是否在浏览器缓存私钥 |
| `hideEditButton` | 是否隐藏编辑按钮 |
| `beian` | 备案信息 |

### 卡片布局（src/config/card-styles.json）

每张首页卡片包含以下属性：

| 属性 | 说明 |
|------|------|
| `width` / `height` | 卡片尺寸（px） |
| `order` | 入场动画顺序 |
| `offsetX` / `offsetY` | 相对中心点的位置偏移（null = 自动计算） |
| `enabled` | 是否显示该卡片 |

卡片列表：`artCard`、`hiCard`、`clockCard`、`calendarCard`、`musicCard`、`socialButtons`、`shareCard`、`articleCard`、`navCard`、`beianCard`、`snkGithubActivityCalendar`

---

## 样式系统

### Tailwind CSS v4

- 通过 `@tailwindcss/postcss` 集成，无需 `tailwind.config.js`
- 主题变量在 `src/styles/theme.css` 中以 `@theme { }` 声明

### CSS 变量（主题色）

```css
--color-primary          /* 主文字色 */
--color-secondary        /* 次要文字色 */
--color-brand            /* 品牌色（按钮、链接） */
--color-brand-secondary  /* 品牌辅助色 */
--color-bg               /* 页面背景色 */
--color-card             /* 卡片背景色（带透明度） */
--color-border           /* 边框色 */
```

> 主题色由 `site-content.json` 的 `theme` 字段在 `src/app/layout.tsx` 中动态注入为 `style` 属性，实现运行时换色。

### 自定义工具类（globals.css）

```css
@utility card          /* 卡片基础样式：absolute + rounded + border + bg */
@utility card-rounded  /* 圆角卡片变体 */
@utility text-linear   /* 渐变文字 */
@utility brand-btn     /* 品牌色按钮 */
```

---

## 状态管理

### Zustand Store 一览

| Store 文件 | 管理的状态 |
|-----------|-----------|
| `src/hooks/use-auth.ts` | GitHub 私钥、Token、认证状态 |
| `src/hooks/use-center.ts` | 视口中心坐标（响应式计算） |
| `src/hooks/use-size.ts` | 当前断点（XL/LG/MD/SM/XS） |
| `src/hooks/use-read-articles.ts` | 已读文章记录（本地持久化） |
| `(home)/stores/config-store.ts` | 站点配置 + 首页卡片样式 |
| `(home)/stores/layout-edit-store.ts` | 卡片拖拽编辑模式 |
| `write/stores/write-store.ts` | 编辑器表单数据 + 图片管理 |
| `write/stores/preview-store.ts` | 预览模式开关 |

### SWR 数据获取

| Hook | 数据来源 |
|------|---------|
| `use-blog-index.ts` | `public/blogs/index.json`（文章元数据列表） |
| `use-categories.ts` | `public/blogs/categories.json`（分类列表） |

---

## 工具函数库

> 路径：`src/lib/`

| 文件 | 功能 |
|------|------|
| `github-client.ts` | GitHub API 封装：JWT 签发、Token 获取、文件读写、Git 树/提交/Ref 操作 |
| `auth.ts` | 鉴权流程：Token 缓存、PEM 加密存储、从 Token 换取 Installation Token |
| `aes256-util.ts` | AES-256-GCM 加密/解密（Web Crypto API），用于保护本地缓存的私钥 |
| `markdown-renderer.ts` | Markdown 渲染引擎：marked 解析 → shiki 代码高亮 → KaTeX 公式 → html-react-parser |
| `blog-index.ts` | 博客索引 CRUD：在 `index.json` 中增删改文章条目 |
| `load-blog.ts` | 从 `public/blogs/<slug>/` 加载文章内容和配置 |
| `file-utils.ts` | 文件处理：读取为 Base64、SHA-256 哈希计算（去重用） |
| `color.ts` | 颜色格式转换：Hex ↔ RGB ↔ HSL ↔ HSVA |
| `utils.ts` | 通用工具：`cn()`（className 合并）、文件扩展名获取 |
| `log.ts` | 美化控制台日志（彩色输出、图片预览） |

---

## React Hooks

> 路径：`src/hooks/`

| Hook | 说明 |
|------|------|
| `use-auth.ts` | Zustand store：私钥管理、Token 缓存、鉴权状态 |
| `use-center.ts` | Zustand store：监听窗口大小，计算视口中心点坐标，供首页卡片定位使用 |
| `use-size.ts` | Zustand store：Tailwind 断点映射（maxSM / maxMD 等布尔值） |
| `use-read-articles.ts` | Zustand + localStorage：记录用户已读文章 slug 列表 |
| `use-blog-index.ts` | SWR：获取文章元数据列表，支持按权限过滤草稿 |
| `use-categories.ts` | SWR：获取博客分类列表 |
| `use-markdown-render.tsx` | 异步 Markdown 渲染 Hook：调用 `markdown-renderer.ts`，处理代码块复制、图片懒加载 |

---

## 全局组件

> 路径：`src/components/`

| 组件 | 说明 |
|------|------|
| `card.tsx` | 基础卡片容器，支持绝对/固定定位、入场动画（按 order 延迟） |
| `nav-card.tsx` | 导航卡片，自动切换三种形态：full（首页）/ icons（子页）/ mini（写作页） |
| `dialog-modal.tsx` | 通用模态对话框 |
| `code-block.tsx` | 代码块：shiki 语法高亮 + 一键复制 |
| `markdown-image.tsx` | Markdown 内图片懒加载组件 |
| `color-picker.tsx` / `color-picker-panel.tsx` | 颜色拾取器（用于主题色配置） |
| `blog-preview.tsx` | 文章编辑器右侧预览面板 |
| `blog-sidebar.tsx` | 文章详情侧边栏（目录 + 元信息） |
| `blog-toc.tsx` | 目录树（基于标题自动生成） |
| `music-card.tsx` | 音乐播放卡片 |
| `scroll-top-button.tsx` | 返回顶部按钮 |
| `like-button.tsx` | 文章点赞按钮 |
| `star-rating.tsx` / `editable-star-rating.tsx` | 星评组件（只读 / 可编辑） |
| `select.tsx` | 下拉选择器 |
| `liquid-grass/` | Canvas 液体草地背景特效 |
| `wip.tsx` | "建设中"占位组件 |

---

## GitHub 鉴权流程

本站所有写操作（发布文章、上传图片、修改配置）都通过 GitHub App 完成，全程在浏览器端执行，无服务器中转。

```
用户输入 Private Key（PEM 格式）
        ↓
jsrsasign 签名生成 JWT
        ↓
POST /app/installations/{id}/access_tokens
        ↓
获取 Installation Access Token（有效期 1h）
        ↓
调用 GitHub Contents API 进行文件读写
```

**私钥保护：**
- 可选将私钥用 AES-256-GCM（Web Crypto API）加密后存入 localStorage
- 加密密钥由 `NEXT_PUBLIC_GITHUB_ENCRYPT_KEY` 环境变量提供
- 由 `siteContent.isCachePem` 控制是否启用缓存

**相关文件：**
- `src/lib/github-client.ts` — API 封装
- `src/lib/auth.ts` — Token 获取与缓存
- `src/lib/aes256-util.ts` — 私钥加解密
- `src/hooks/use-auth.ts` — 鉴权 Zustand store

---

## 写入服务

所有写操作均通过 GitHub Git Data API（Tree + Commit + Ref）原子提交，保证一次操作不产生多个 commit。

### 博客发布（write/services/push-blog.ts）

```
1. 获取 GitHub Token
2. 获取当前分支最新 Commit SHA
3. 将本地图片上传为 Blob，替换正文中的本地 URL
4. 创建文章文件（index.md、config.json）的 Blob
5. 更新 public/blogs/index.json（新增或替换条目）
6. 创建包含所有变更的 Git Tree
7. 创建 Commit → 更新分支 Ref
```

### 博客删除（write/services/delete-blog.ts）

```
1. 列出 public/blogs/<slug>/ 下所有文件
2. 将所有文件 sha 设为 null（删除）
3. 从 index.json 中移除对应条目
4. 原子提交
```

### 图片库保存（gallery/services/push-pictures.ts）

```
1. 计算新图片 SHA-256 哈希（去重）
2. 上传新图片为 Blob
3. 读取旧 list.json，对比找出被删除的图片 URL
4. 检查被删除图片是否真实存在于仓库（避免 422 错误）
5. 将不再使用的图片文件 sha 设为 null（删除）
6. 更新 src/app/gallery/list.json
7. 原子提交
```

### 站点配置保存（(home)/services/push-site-content.ts）

```
1. 将最新 site-content.json / card-styles.json 序列化
2. 创建对应 Blob
3. 原子提交到仓库
```

---

## 关键数据流

### 首页卡片定位

```
窗口尺寸变化
    ↓
use-center.ts 计算视口中心点 (x, y)
    ↓
各卡片组件读取 center + cardStyles.offsetX/Y
    ↓
计算绝对位置 → 传给 Card 组件的 x/y prop
    ↓
motion.div animate={{ left: x, top: y }} 平滑移动
```

### Markdown 渲染流程

```
文章 .md 文件（字符串）
    ↓
marked.parse()  →  HTML 字符串
    ↓
shiki           →  代码块替换为带高亮的 HTML
    ↓
KaTeX           →  数学公式替换
    ↓
html-react-parser →  挂载到 React，替换自定义组件（CodeBlock、MarkdownImage）
```

---

## SVG 工作流

```
1. 将 .svg 文件放入 src/svgs/
2. 运行 pnpm svg（执行 scripts/gen-svgs-index.js）
3. 脚本递归扫描 src/svgs/，自动生成 src/svgs/index.ts
4. 生成内容：所有 SVG 的具名导出 + SvgComponent 类型 + svgItems 数组
5. 在代码中 import XxxSVG from '@/svgs/xxx.svg' 作为 React 组件使用
6. next.config.ts 通过 @svgr/webpack 处理 .svg 导入
```

---

## 部署方式

### Cloudflare Workers（主要）

```bash
pnpm build:cf   # 使用 opennextjs-cloudflare 构建
pnpm preview    # 本地预览
pnpm deploy     # 部署到 Cloudflare Workers
```

- 适配器：`@opennextjs/cloudflare`
- 环境变量在 Cloudflare Dashboard 配置
- 类型生成：`pnpm cf-typegen`

### Vercel（监测/备用）

- 集成 `@vercel/analytics` 统计访问数据
- 支持直接 Git 推送自动部署

---

## next.config.ts 关键配置

```typescript
{
  reactCompiler: true,          // 启用 React 编译器（自动 memo）
  reactStrictMode: false,       // 关闭严格模式（避免开发双调用）
  typescript: {
    ignoreBuildErrors: true     // 构建时忽略 TS 类型错误
  },
  turbopack: {
    rules: { '*.svg': { loaders: ['@svgr/webpack'] } }  // SVG 转组件
  },
  redirects: [
    { source: '/zh', destination: '/', permanent: true },
    { source: '/en', destination: '/', permanent: true }
  ]
}
```
