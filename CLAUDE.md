# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
pnpm dev          # 启动开发服务器（端口 2025，使用 Turbopack）
pnpm build        # 构建生产版本（Next.js）
pnpm start        # 运行生产服务器
pnpm svg          # 重新生成 SVG 索引（修改 SVG 文件后运行）

# Cloudflare 部署
pnpm build:cf     # 构建 Cloudflare 版本
pnpm preview      # 本地预览 Cloudflare 构建
pnpm deploy       # 部署到 Cloudflare
```

> 无测试框架，无 lint 脚本。

## 架构概览

这是一个 **Next.js 16 / React 19** 的个人博客站点，使用 **GitHub App** 作为唯一的内容后端——没有数据库，所有内容直接读写 GitHub 仓库文件。

### 内容存储结构

所有博客内容存放于 `public/blogs/`：

- `public/blogs/index.json` — 全部文章的元数据索引（slug、title、date、tags、cover 等）
- `public/blogs/<slug>/index.md` — 文章正文（Markdown）
- `public/blogs/<slug>/config.json` — 文章额外配置
- `public/blogs/categories.json` — 分类列表

网站全局配置存放于 `src/config/`：

- `src/config/site-content.json` — 站点元信息、主题色、社交链接、背景图等
- `src/config/card-styles.json` — 首页各卡片的位置偏移与启用状态
- `src/config/card-styles-default.json` — 上述配置的默认值

### GitHub App 鉴权流程

前端编辑功能通过 GitHub App 私钥在浏览器端完成鉴权，全程无服务器：

1. 用户输入 **Private Key（PEM 格式）**
2. `src/lib/github-client.ts` 用 `jsrsasign` 签名生成 JWT
3. 用 JWT 换取 Installation Token
4. 用 Token 调用 GitHub Contents API 读写文件

鉴权状态由 `src/hooks/use-auth.ts`（Zustand store）管理，私钥可选择性缓存到浏览器（由 `siteContent.isCachePem` 控制）。

环境变量配置见 `src/consts.ts`：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_GITHUB_OWNER` | 仓库所有者 |
| `NEXT_PUBLIC_GITHUB_REPO` | 仓库名 |
| `NEXT_PUBLIC_GITHUB_BRANCH` | 目标分支 |
| `NEXT_PUBLIC_GITHUB_APP_ID` | GitHub App ID |

### 页面路由结构

- `src/app/(home)/` — 首页，由多个可拖拽 Card 组成（`hi-card`, `art-card`, `clock-card` 等）
- `src/app/blog/` — 文章列表页
- `src/app/blog/[id]/` — 文章详情页
- `src/app/write/[slug]/` — 文章编辑器（需鉴权）
- `src/app/write/` — 新建文章
- `src/app/(home)/config-dialog/` — 首页配置面板（主题色、卡片开关、站点设置）
- 其他页面：`about`、`pictures`、`share`、`projects`、`bloggers`、`snippets`

### 各功能模块的写入服务

每个页面功能模块在 `services/` 目录下都有对应的推送逻辑，统一封装对 GitHub API 的写操作：

- `src/app/write/services/push-blog.ts` — 发布文章（同时更新 `index.json`）
- `src/app/(home)/services/push-site-content.ts` — 保存站点配置
- `src/app/pictures/services/push-pictures.ts` — 上传图片
- 其他模块同理

### 全局状态管理

使用 **Zustand**，主要 store：

- `src/app/(home)/stores/config-store.ts` — 站点配置 + 首页卡片样式（从 `site-content.json` / `card-styles.json` 初始化）
- `src/app/(home)/stores/layout-edit-store.ts` — 首页卡片拖拽编辑状态
- `src/app/write/stores/write-store.ts` — 编辑器数据
- `src/hooks/use-auth.ts` — 鉴权状态

### Markdown 渲染

`src/lib/markdown-renderer.ts` 使用 **marked** 解析，**shiki** 做代码高亮，**KaTeX** 渲染数学公式，最终通过 `html-react-parser` 挂载到 React。

### SVG 组件

`.svg` 文件通过 `@svgr/webpack` 作为 React 组件导入。`scripts/gen-svgs-index.js` 自动生成 SVG 索引，添加新 SVG 后需运行 `pnpm svg`。

### 样式系统

使用 **Tailwind CSS v4**，主题色以 CSS 变量形式注入（`--color-brand`、`--color-primary` 等），在 `src/app/layout.tsx` 的 `htmlStyle` 中由 `site-content.json` 的 `theme` 字段驱动。

## 代码修改原则

- **最小化改动**：更改代码时只修改必要的部分，避免无关的重构或格式调整
- **添加注释**：对每处改动添加简洁的中文注释，说明修改原因或逻辑
