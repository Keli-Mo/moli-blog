# Gallery 图床模块业务流程文档

## 1. 模块概述

Gallery 是一个基于 GitHub 仓库作为存储后端的图片管理模块，支持瀑布流展示、批量上传、编辑删除等功能。

**核心特性：**
- 瀑布流布局展示（使用 masonic 库）
- 支持单图/多图分组管理
- 本地预览 + GitHub 无服务器存储
- 文件去重（SHA256 哈希命名）
- 自动清理废弃图片文件

---

## 2. 文件结构

```
src/app/gallery/
├── page.tsx                    # 主页面组件，状态管理
├── list.json                   # 图片数据源（提交到 GitHub）
├── components/
│   ├── upload-dialog.tsx       # 图片上传弹窗
│   └── masonic-layout.tsx      # 瀑布流布局组件
└── services/
    └── push-pictures.ts        # 保存到 GitHub 的服务

public/images/pictures/         # 图片文件存储目录（GitHub 仓库中）
```

---

## 3. 数据模型

### 3.1 图片组（Picture）

```typescript
interface Picture {
  id: string           // 唯一标识（时间戳 + 随机数）
  uploadedAt: string   // ISO 8601 时间戳
  description?: string // 描述文字（可选）
  image?: string       // 单图 URL（兼容旧数据）
  images?: string[]    // 多图 URL 数组
}
```

### 3.2 图片项（ImageItem）

```typescript
type ImageItem =
  | { type: 'url'; url: string }                          // 远程图片
  | { type: 'file'; file: File; previewUrl: string }      // 本地待上传文件
```

### 3.3 数据源示例（list.json）

```json
[
  {
    "id": "pic-001",
    "uploadedAt": "2026-03-30T12:00:00.000Z",
    "images": ["/images/pictures/043e88bf6b427bb8.webp"]
  }
]
```

---

## 4. 业务流程图

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   查看模式   │────▶│   编辑模式   │────▶│   上传弹窗   │────▶│   保存提交   │
│  (默认状态)  │◀────│ (Ctrl + ,)   │◀────│              │◀────│              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                   │                   │
       ▼                    ▼                   ▼                   ▼
 • 瀑布流展示           • 显示删除按钮      • 多选文件上传      • 上传新图片文件
 • 点击放大查看         • 删除单图/整组     • 添加描述          • 更新 list.json
 • 灯箱查看             • 添加上传入口      • 本地预览堆叠      • 清理废弃文件
                                                              • Git 提交推送
```

---

## 5. 核心功能流程

### 5.1 进入编辑模式

| 触发方式 | 操作 |
|---------|------|
| 快捷键 | `Ctrl/Cmd + ,` |
| 按钮点击 | 右上角「编辑」按钮 |

**状态变更：**
- `isEditMode = true`
- 显示操作工具栏（取消、上传、保存）
- 图片卡片显示删除按钮

### 5.2 上传图片流程

```
用户点击「上传」
       │
       ▼
┌─────────────────┐
│ 打开上传弹窗     │
└─────────────────┘
       │
       ▼
用户选择图片文件（支持多选）
       │
       ▼
┌───────────────────────────────────┐
│ 1. 生成 Object URL 用于本地预览    │
│ 2. 创建 ImageItem 存入 Map         │
│ 3. 创建 Picture 对象加入列表       │
└───────────────────────────────────┘
       │
       ▼
用户点击「确认上传」
       │
       ▼
关闭弹窗，图片显示在瀑布流中（尚未保存到 GitHub）
```

### 5.3 删除图片流程

**删除单张图片：**
- 编辑模式下悬停图片显示删除按钮
- 从 `pictures` 列表中移除对应图片
- 从 `imageItems` Map 中删除关联的文件项
- 重新索引同组内后续图片的 key

**删除整组图片：**
- 确认后删除整个 Picture 对象
- 清理该组关联的所有 `imageItems`

### 5.4 保存流程（push-pictures.ts）

```
开始保存
   │
   ├──▶ 1. 获取 GitHub Token
   │
   ├──▶ 2. 处理待上传文件
   │      ├── 计算 SHA256 哈希作为文件名
   │      ├── Base64 编码文件内容
   │      ├── createBlob 创建文件 blob
   │      ├── 加入 treeItems 待提交列表
   │      └── 更新 pictures 中的 URL 为 /images/pictures/{hash}.webp
   │
   ├──▶ 3. 清理废弃文件
   │      ├── 读取旧的 list.json
   │      ├── 对比找出不再使用的本地图片
   │      └── 将废弃文件以 sha: null 加入 treeItems（标记删除）
   │
   ├──▶ 4. 更新 list.json
   │      ├── 将 pictures 数组转为 JSON
   │      ├── createBlob 创建 blob
   │      └── 加入 treeItems
   │
   └──▶ 5. Git 提交
          ├── createTree(treeItems) 创建文件树
          ├── createCommit(treeData.sha) 创建提交
          └── updateRef(commitData.sha) 更新分支引用

保存完成
```

### 5.5 取消编辑流程

- 将 `pictures` 恢复到 `originalPictures`
- 清空 `imageItems` Map
- 释放所有 Object URL（避免内存泄漏）
- `isEditMode = false`

---

## 6. 状态管理

| 状态 | 类型 | 用途 |
|------|------|------|
| `pictures` | `Picture[]` | 当前图片列表（编辑中） |
| `originalPictures` | `Picture[]` | 原始数据（用于取消恢复） |
| `isEditMode` | `boolean` | 是否处于编辑模式 |
| `imageItems` | `Map<string, ImageItem>` | 待上传的文件缓存 |
| `isSaving` | `boolean` | 保存中状态 |

---

## 7. 组件职责

### 7.1 page.tsx（页面主组件）

- 管理全局状态（pictures、isEditMode、imageItems）
- 处理编辑/保存/取消操作
- 整合上传弹窗和瀑布流布局
- 监听快捷键（Ctrl/Cmd + ,）

### 7.2 upload-dialog.tsx（上传弹窗）

- 文件选择（支持多选）
- 生成本地预览 URL
- 描述输入
- 堆叠预览效果展示

### 7.3 masonic-layout.tsx（瀑布流布局）

- 使用 masonic 实现响应式瀑布流
- 3列布局，16px 间距
- 子组件：
  - **ImageCard**: 单图卡片（显示、删除、放大）
  - **ImageLightbox**: 全屏灯箱查看

---

## 8. GitHub 存储规范

### 8.1 文件存储路径

```
public/images/pictures/{hash}.webp
```

- `{hash}`: 文件内容的 SHA256 哈希（16进制，前16位）
- 自动去重：相同内容的文件不会重复上传

### 8.2 元数据存储

```
src/app/gallery/list.json
```

包含所有图片组的结构化数据，与图片文件分离管理。

### 8.3 Git 操作原子性

所有变更通过 Git Tree + Commit 一次性提交：
1. 上传新图片（blob）
2. 删除废弃图片（sha: null）
3. 更新 list.json（blob）

---

## 9. 交互行为汇总

| 场景 | 操作 | 结果 |
|------|------|------|
| 进入编辑 | `Ctrl/Cmd + ,` 或点击「编辑」 | 显示操作工具栏，图片显示删除按钮 |
| 上传图片 | 点击「上传」→ 选择文件 → 确认 | 本地预览，加入待上传队列 |
| 删除单图 | 编辑模式悬停 → 点击 X | 移除该图，同步更新缓存 |
| 删除整组 | 编辑模式确认删除 | 移除整组及相关缓存 |
| 保存 | 点击「保存」 | 上传文件 → 更新 list → 清理废弃文件 |
| 取消编辑 | 点击「取消」 | 恢复到上次保存状态 |
| 查看大图 | 非编辑模式点击图片 | 打开全屏灯箱，支持 Esc 关闭 |

---

## 10. 注意事项

1. **内存管理**：上传弹窗关闭时需释放所有 Object URL
2. **文件去重**：依赖 SHA256 哈希，不同名相同内容的文件不会重复存储
3. **取消恢复**：编辑过程中可随时取消，数据恢复到上次保存状态
4. **GitHub API 限制**：大批量操作可能触发速率限制
