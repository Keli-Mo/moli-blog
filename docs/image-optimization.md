# 图片加载性能优化指南

针对 Gallery 页面大量图片加载的性能优化方案。

## 已实现的优化

### 1. 懒加载 (Lazy Loading)
- 使用 `loading="lazy"` 属性
- 图片进入视口才加载
- 减少初始网络请求

### 2. 虚拟滚动 (Virtual Scrolling)
- Masonic 库只渲染可视区域图片
- 滚动时动态回收/创建 DOM 节点
- 支持上万张图片不卡顿

### 3. 预加载 (Preloading)
- 预加载首屏 + 下屏图片（约20张）
- 滚动时提前加载即将进入视口的图片
- 减少滚动时的白屏等待

### 4. CDN 加速
- Cloudflare R2 + Pages 全球分发
- 图片缓存在边缘节点
- 自动压缩和 WebP 转换

## 进一步优化方案

### A. 图片格式优化

**推荐格式优先级：**
```
AVIF > WebP > JPEG
```

**实现方式：**
1. 后端存储多格式版本
2. 使用 `<picture>` 标签根据浏览器支持自动选择

```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" loading="lazy">
</picture>
```

### B. 响应式图片尺寸

根据容器宽度加载不同尺寸：

```html
<img 
  srcset="
    image-400w.webp 400w,
    image-800w.webp 800w,
    image-1200w.webp 1200w
  "
  sizes="(max-width: 768px) 100vw, 33vw"
  src="image-800w.webp"
  loading="lazy"
/>
```

**建议尺寸：**
| 场景 | 宽度 | 用途 |
|------|------|------|
| 缩略图 | 400px | 瀑布流展示 |
| 预览图 | 800px | 灯箱查看 |
| 原图 | 原尺寸 | 下载/全屏 |

### C. 渐进式加载 (Progressive Loading)

1. **模糊占位符**
   - 先显示极小的模糊缩略图（1-2KB）
   - 高清图加载完成后淡入替换

2. **低质量图片占位 (LQIP)**
   ```html
   <div class="blur-load" style="background-image: url(tiny-thumb.jpg)">
     <img src="full-image.webp" loading="lazy" />
   </div>
   ```

### D. 图片压缩工具

项目已集成压缩工具：`/image-toolbox`

**推荐压缩参数：**
```javascript
{
  "quality": 0.8,        // WebP 质量 80%
  "maxWidth": 1920,      // 最大宽度
  "maxHeight": 1080,     // 最大高度
  "format": "webp"       // 输出格式
}
```

### E. 浏览器缓存策略

在 R2 存储桶配置响应头：
```
Cache-Control: public, max-age=31536000, immutable
```

- `immutable`: 文件内容不变，浏览器永久缓存
- 文件名包含哈希值，更新时 URL 变化

### F. HTTP/2 Server Push (如使用 Cloudflare)

预推送关键资源：
```http
Link: </critical.css>; rel=preload; as=style
Link: </font.woff2>; rel=preload; as=font
```

## 大量图片的特殊处理

### 分页加载

当图片超过 500 张时，考虑分页：

```typescript
// 每次只加载 50 张，滚动到底部再加载下一页
const [page, setPage] = useState(1)
const pageSize = 50

const displayedPictures = useMemo(() => {
  return allPictures.slice(0, page * pageSize)
}, [allPictures, page])

// 监听滚动到底部
useEffect(() => {
  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
      setPage(p => p + 1)
    }
  }
  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

### 图片分组/分类

按时间或标签分组，默认只展开最近的一组：

```
2025年4月 (20张) ▼
  [图片] [图片] ...
2025年3月 (35张) ▶
2025年2月 (28张) ▶
```

## 性能监控

### 关键指标

1. **LCP (Largest Contentful Paint)**: < 2.5s
2. **FID (First Input Delay)**: < 100ms
3. **CLS (Cumulative Layout Shift)**: < 0.1

### 测量代码

```typescript
// 测量图片加载时间
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'resource' && entry.name.includes('.webp')) {
      console.log(`图片加载: ${entry.name}, 耗时: ${entry.duration}ms`)
    }
  }
}).observe({ entryTypes: ['resource'] })
```

## 实施优先级

| 优先级 | 优化项 | 预计提升 | 工作量 |
|--------|--------|----------|--------|
| 🔴 高 | 预加载首屏 | 50%+ | 1小时 |
| 🔴 高 | WebP 格式 | 30-50% | 后端支持 |
| 🟡 中 | 响应式尺寸 | 20-30% | 2小时 |
| 🟡 中 | 渐进式加载 | 体验优化 | 3小时 |
| 🟢 低 | HTTP/2 Push | 10-20% | 配置调整 |
| 🟢 低 | AVIF 格式 | 20-30% | 需浏览器支持 |

## 参考

- [Web.dev - 图片优化](https://web.dev/optimize-lcp/#optimize-your-images)
- [Cloudflare - 图片优化](https://developers.cloudflare.com/images/)
- [Masonic 虚拟滚动](https://github.com/jaredLunde/masonic)
