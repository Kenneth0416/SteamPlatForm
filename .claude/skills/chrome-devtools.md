---
name: chrome-devtools
description: Chrome DevTools MCP 使用指南。避免 "Request too large (max 20MB)" 错误，掌握快照、截图、网络调试的最佳实践。
---

# Chrome DevTools MCP 最佳实践

## 核心问题：Request too large (max 20MB)

MCP 协议对单次工具响应有 20MB 限制。以下操作容易触发：
- `take_screenshot` 全页截图（base64 编码后体积翻倍）
- `take_snapshot` 在复杂 DOM 页面 + `verbose: true`
- `get_network_request` 返回大型响应体

## 防御策略（按优先级）

### 1. 始终使用 filePath 保存到磁盘

这是最可靠的方法，绕过 20MB 限制：

```
# 截图 → 保存文件
take_screenshot({ filePath: "/tmp/page.png" })

# 快照 → 保存文件
take_snapshot({ filePath: "/tmp/snapshot.txt" })

# 网络请求 → 保存响应体
get_network_request({ reqid: 123, responseFilePath: "/tmp/response.json" })
```

保存后用 Read 工具读取文件内容（可分段读取大文件）。

### 2. 缩小截图范围

```
# 差：全页截图（可能几十 MB）
take_screenshot({ fullPage: true })

# 好：只截可视区域
take_screenshot({})

# 最好：只截目标元素
take_screenshot({ uid: "target-element-uid" })
```

### 3. 控制快照详细度

```
# 差：verbose 模式在复杂页面会爆
take_snapshot({ verbose: true })

# 好：默认精简模式
take_snapshot({})
take_snapshot({ verbose: false })
```

### 4. 缩小视口再截图

```
# 先缩小视口
resize_page({ width: 800, height: 600 })

# 再截图
take_screenshot({ filePath: "/tmp/small.png" })
```

### 5. 使用压缩格式

```
# JPEG 比 PNG 小很多
take_screenshot({ format: "jpeg", quality: 70 })

# WebP 更小
take_screenshot({ format: "webp", quality: 70 })
```

## 标准工作流程

### 页面调试流程

```
1. list_pages → 找到目标页面
2. select_page({ pageId: N })
3. take_snapshot() → 获取 DOM 结构（不加 verbose）
4. 如需截图 → take_screenshot({ filePath: "/tmp/debug.png" })
5. 如需检查元素 → take_screenshot({ uid: "xxx", filePath: "/tmp/el.png" })
```

### 网络请求调试流程

```
1. list_network_requests({ resourceTypes: ["fetch", "xhr"] }) → 过滤请求类型
2. get_network_request({ reqid: N }) → 小响应直接看
3. get_network_request({ reqid: N, responseFilePath: "/tmp/resp.json" }) → 大响应存文件
```

### 表单交互流程

```
1. take_snapshot() → 获取元素 uid
2. fill / fill_form / click → 操作元素
3. take_snapshot() → 验证结果（不要截图验证，快照更轻量）
```

## 常见陷阱

| 操作 | 风险 | 解决 |
|------|------|------|
| `take_screenshot({ fullPage: true })` | 长页面轻松超 20MB | 用 `filePath` 或去掉 `fullPage` |
| `take_snapshot({ verbose: true })` | 复杂 SPA 的 a11y 树巨大 | 默认 `verbose: false` |
| `get_network_request` 大响应 | API 返回大 JSON/文件 | 用 `responseFilePath` |
| 连续多次截图不存文件 | 累积上下文超限 | 每次都用 `filePath` |
| 高分辨率 + PNG 格式 | 4K 截图可达 10MB+ | 用 JPEG/WebP + 降低 quality |

## 测试检查清单

在使用 Chrome DevTools MCP 前，按此清单检查：

- [ ] 截图是否指定了 `filePath`？
- [ ] 是否避免了 `fullPage: true`（除非页面很短）？
- [ ] 快照是否用默认 `verbose: false`？
- [ ] 网络请求大响应是否用 `responseFilePath`？
- [ ] 截图格式是否选了 JPEG/WebP（非必要不用 PNG）？
- [ ] 视口尺寸是否合理（不超过 1280x800）？

## 错误恢复

如果已经触发 20MB 错误：

1. 按 `Esc Esc` 返回
2. 改用 `filePath` 参数重试同一操作
3. 如果是截图，缩小范围或降低质量
4. 如果是快照，关掉 `verbose`
5. 如果是网络请求，用 `responseFilePath`
