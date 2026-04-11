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

### Gallery 外部图源

Gallery 支持直接从外部图床（如 Cloudflare R2）加载图片，无需下载到本地仓库：

- `src/app/gallery/list.json` — 本地上传的图片列表
- `src/app/gallery/external-source.json` — 外部图源配置（URL模板、编号范围）
- `src/app/gallery/external-index.json` — 外部图源索引（已检测到的有效URL列表）

**工作原理（本地索引模式）**：
- 页面加载时直接读取 `external-index.json`，无需网络检测
- 编辑模式下点击「刷新索引」遍历检测图片存在性
- 检测完成后自动保存有效URL到索引文件
- 登录状态下推送到 GitHub，跨设备同步

**配置方式**：见 `docs/gallery-external-source.md`

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
- `src/app/gallery/` — 图片瀑布流，支持本地上传 + 外部图源（R2等）混合显示
- 其他页面：`about`、`pictures`、`share`、`projects`、`bloggers`、`snippets`

### 各功能模块的写入服务

每个页面功能模块在 `services/` 目录下都有对应的推送逻辑，统一封装对 GitHub API 的写操作：

- `src/app/write/services/push-blog.ts` — 发布文章（同时更新 `index.json`）
- `src/app/(home)/services/push-site-content.ts` — 保存站点配置
- `src/app/pictures/services/push-pictures.ts` — 上传图片
- `src/app/gallery/services/push-pictures.ts` — 保存本地图片列表到 `list.json`
- `src/app/gallery/services/push-external-source.ts` — 保存外部图源配置到 `external-source.json`
- `src/app/gallery/services/push-external-index.ts` — 保存外部图源索引到 `external-index.json`
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

## 行为规则

### 1. 先规划，再动手

- 非 trivial 任务（3 步以上或涉及架构决策）先进入计划模式
- 动手前写清楚详细 spec，消除歧义
- 如果方向跑偏，立刻停下来重新规划，不要硬推

### 2. 子 Agent 策略

- 把调研、探索、并行分析任务交给子 Agent
- 保持主上下文干净，每个子 Agent 只做一件事
- 复杂问题多开子 Agent，用算力换效率

### 3. 自我进化循环

- 每次被纠正后：把模式记录到 `tasks/lessons.md`
- 写下能防止同类错误再犯的规则
- 每次会话开始时回顾 lessons

### 4. 完成前必须验证

- 没有证明能跑，不算完成
- 问自己："高级工程师会认可这个方案吗？"

### 5. 追求优雅

- 非 trivial 改动前停下来问："有没有更优雅的方案？"
- 如果方案感觉很 hacky：换成优雅的实现
- 简单明显的修复跳过此步，不要过度设计

### 6. 自主修复 Bug

- 拿到 bug 报告直接修，不需要用户手把手指导
- 主动看日志、报错，然后解决
- 不要反复向用户确认，自己判断并执行

## 任务管理

1. **先写计划** — 在 `tasks/todo.md` 写下可勾选的任务项
2. **确认计划** — 开始实现前与用户对齐一次
3. **追踪进度** — 完成一项勾一项
4. **解释变更** — 每步给出高层次说明
5. **记录结果** — 在 `tasks/todo.md` 补充 review 区块
6. **沉淀经验** — 每次被纠正后更新 `tasks/lessons.md`

## 代码修改原则

- **最小化改动**：更改代码时只修改必要的部分，避免无关的重构或格式调整
- **添加注释**：对每处改动添加简洁的中文注释，说明修改原因或逻辑
- **简单优先**：每次改动尽可能小，影响尽可能少
- **不走捷径**：找根本原因，不打临时补丁
- **不重蹈覆辙**：`tasks/lessons.md` 是唯一的经验积累来源
