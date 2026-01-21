# 前端测试指南 - System Prompt 改进验证

## 📋 测试概述

本文档指导您如何在前端界面上验证 System Prompt 改进是否生效。

---

## 🚀 快速启动

### 1. 启动开发服务器

```bash
# 确保数据库运行
docker compose up -d

# 启动开发服务器
pnpm dev
```

访问: http://localhost:3030

### 2. 打开 Editor 页面

导航到任意课程的编辑器页面：
```
http://localhost:3030/editor/{lessonId}
```

---

## 🧪 测试场景

### 场景 1: 验证批量工具优化（改进 1）

**目的**: 验证 LLM 使用批量工具（edit_blocks, add_blocks, delete_blocks）

**测试步骤**:

1. **创建测试文档**
   - 在编辑器中创建一个包含多个段落的新文档
   - 示例内容：
     ```markdown
     # 课程计划

     ## 第一部分
     这是第一段内容。

     ## 第二部分
     这是第二段内容。

     ## 第三部分
     这是第三段内容。
     ```

2. **发送批量编辑命令**

   在 AI Editor 聊天框中输入：
   ```
   请将所有"部分"改为"章节"，并添加简短介绍
   ```

3. **观察浏览器控制台**

   打开浏览器开发者工具（F12），查看 Console 日志：
   ```javascript
   // 应该看到类似这样的日志：
   [EditorChat] SSE line: data: {"type":"tool_call","data":{"name":"edit_blocks",...}}
   [EditorChat] Parsed event: tool_call {...}
   ```

4. **验证批量行为**

   ✅ **预期结果**:
   - LLM 应该调用 `edit_blocks` **一次**，而不是多次
   - `edits` 数组应包含所有修改（例如 3 个块）
   - 不会看到多次单独的 `edit_block` 调用

   ❌ **失败标志**:
   - 多次 `edit_blocks` 调用（每次只编辑 1 个块）
   - 使用单数形式的工具名称（`edit_block`）

**验证命令**（在浏览器 Console 中执行）:
```javascript
// 查看最近的工具调用
let toolCallCount = 0;
let batchSize = 0;
console.log('检查最近的工具调用...');

// 在聊天框发送命令后，观察 Console 日志中的：
// - tool_call 次数（应该尽量少）
// - edits 数组长度（应该尽量大）
```

---

### 场景 2: 验证错误恢复机制（改进 2）

**目的**: 验证 LLM 能够正确处理工具错误并恢复

**测试步骤**:

1. **发送不存在的块编辑命令**

   在 AI Editor 中输入：
   ```
   请编辑第 100 段的内容（假设文档只有 5 段）
   ```

2. **观察恢复行为**

   ✅ **预期结果**:
   - LLM 首先尝试编辑，收到错误："Block not found"
   - 然后 LLM 自动调用 `list_blocks` 刷新文档状态
   - 最后给出合理的回复（例如："文档只有 5 段，您想编辑哪一段？"）

   **日志示例**:
   ```
   [EditorChat] Parsed event: tool_call {name: "edit_blocks", ...}
   [EditorChat] Parsed event: tool_call {name: "list_blocks", ...}  ← 自动恢复
   [EditorChat] Parsed event: content {data: "文档只有 5 段..."}
   ```

3. **验证"卡死"避免**

   发送可能触发循环的命令：
   ```
   重复编辑第二段，每次修改一个字
   ```

   ✅ **预期结果**:
   - LLM 应该在 3 次尝试后停止
   - 给出提示："I need your clarification on which specific changes you want"

---

### 场景 3: 验证批量添加/删除（改进 4）

**目的**: 验证工作流包含 add_blocks/delete_blocks

**测试步骤**:

1. **批量添加命令**

   在 AI Editor 中输入：
   ```
   在每两个章节之间添加一个"小结"段落
   ```

2. **验证批量添加**

   ✅ **预期结果**:
   - LLM 调用 `list_blocks`（第一步）
   - LLM 调用 `read_blocks` 读取相关块（第二步）
   - LLM 调用 `add_blocks` **一次**，`additions` 数组包含多个块（第三步）
   - **不会**看到多次 `add_block` 调用

3. **批量删除命令**

   输入：
   ```
   删除所有空段落
   ```

   ✅ **预期结果**:
   - LLM 调用 `read_blocks` 读取所有块（先读再删）
   - LLM 调用 `delete_blocks` **一次**，`deletions` 数组包含多个块
   - **不会**看到多次 `delete_block` 调用

---

### 场景 4: 验证大型文档优化（改进 5）

**目的**: 验证 >50 块文档的性能优化

**测试步骤**:

1. **创建大型文档**

   使用 API 或手动创建包含 60+ 个块的文档：
   ```bash
   # 在浏览器 Console 中执行
   fetch('/api/editor/documents/generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       lessonId: '{当前课程ID}',
       blockCount: 60
     })
   })
   ```

2. **发送编辑命令**

   在 AI Editor 中输入：
   ```
   将所有标题的格式统一为 ## 格式
   ```

3. **观察优化行为**

   ✅ **预期结果**:
   - LLM **只读取**要编辑的标题块（不是全部 60 个块）
   - 使用 `withContext: false` 减少 Token
   - 一次性批量编辑所有标题

   **验证方法**:
   - 查看控制台日志中的 `read_blocks` 调用
   - 检查 `blockIds` 数组长度（应该 << 60）

---

### 场景 5: 验证多文档 Guard 重置（改进 3）

**目的**: 验证切换文档后 Guard 重置警告生效

**测试步骤**:

1. **创建多个文档**

   - 文档 A：包含 3 个段落
   - 文档 B：包含 3 个段落

2. **跨文档操作**

   **步骤 A**: 在文档 A 中编辑第二段
   ```
   请修改文档 A 的第二段
   ```
   ✅ 成功（已读取）

   **步骤 B**: 切换到文档 B，直接编辑
   ```
   切换到文档 B，修改第二段
   ```

3. **验证 Guard 重置**

   ✅ **预期结果**:
   - LLM 调用 `switch_document`
   - **重要**: LLM 应该自动调用 `list_blocks`（因为 Guard 重置了）
   - 然后调用 `read_blocks` 读取文档 B 的块
   - 最后执行编辑

   **日志示例**:
   ```
   [EditorChat] Parsed event: tool_call {name: "switch_document", ...}
   [EditorChat] Parsed event: tool_call {name: "list_blocks", ...}  ← 自动调用！
   [EditorChat] Parsed event: tool_call {name: "read_blocks", ...}
   [EditorChat] Parsed event: tool_call {name: "edit_blocks", ...}
   ```

   ❌ **失败标志**:
   - 切换文档后直接 `edit_blocks`（没有 `list_blocks`）
   - 收到 "not read yet" 错误

---

## 🔍 调试技巧

### 1. 启用详细日志

在浏览器 Console 中执行：
```javascript
// 启用所有 Editor 相关日志
localStorage.setItem('debug', 'editor:*');

// 或者直接查看 SSE 事件
// （代码中已有 console.log，打开 F12 即可看到）
```

### 2. 监控网络请求

打开开发者工具 → Network 标签页：
- 筛选 `stream` 请求
- 查看 EventStream 内容
- 验证 `tool_call` 事件的参数

### 3. 查看 Pending Diffs

在 React DevTools 中：
```javascript
// 查看 store 状态
const store = useEditorStore.getState();
console.log('Pending diffs:', store.pendingDiffs);
console.log('Documents:', store.documents);
```

### 4. 测试工具调用统计

创建一个自定义脚本来统计工具调用：

```javascript
// 在浏览器 Console 中执行
let toolCalls = [];
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0]?.includes?.('/api/editor/command/stream')) {
    const readerPromise = originalFetch.apply(this, args).then(response => {
      const reader = response.body?.getReader();
      if (!reader) return response;

      const decoder = new TextDecoder();
      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'tool_call' && event.data?.status === 'calling') {
                  toolCalls.push({
                    name: event.data.name,
                    timestamp: Date.now(),
                    args: event.data.args
                  });
                  console.log('🔧 Tool Call:', event.data.name, event.data.args);
                }
              } catch (e) {}
            }
          }
        }
      };

      processStream();
      return response;
    });
    return readerPromise;
  }
  return originalFetch.apply(this, args);
};

// 查看统计
setInterval(() => {
  const summary = {};
  toolCalls.forEach(call => {
    summary[call.name] = (summary[call.name] || 0) + 1;
  });
  console.table(summary);
  console.log('Total tool calls:', toolCalls.length);
}, 5000);
```

---

## 📊 性能指标验证

### 预期改进（与改进前对比）

| 指标 | 改进前 | 改进后 | 验证方法 |
|------|--------|--------|----------|
| **平均工具调用次数** | 6-8 次 | 3-4 次 | 统计 `tool_call` 事件 |
| **批量操作占比** | ~30% | ~80% | 检查 `edits`/`additions`/`deletions` 数组长度 |
| **失败请求率** | ~10% | <5% | 观察 "Block not found" 错误恢复 |
| **Token 使用量** | 基准 | -5% 至 -10% | 查看大型文档的 `read_blocks` 调用 |

### 如何测量

**方法 1: 使用浏览器开发者工具**

```javascript
// 在 Console 中执行
let metrics = {
  toolCallCount: 0,
  batchOperations: 0,
  totalEdits: 0
};

// 观察工具调用日志，手动统计
// 每次看到 `tool_call` 事件，计数器 +1
// 检查 `edits` 数组长度，如果 >1 记为批量操作
```

**方法 2: 查看服务器日志**

```bash
# SSH 到服务器
tail -f /var/log/your-app.log | grep EditorAgent
```

日志示例：
```
[EditorAgent] Tool edit_blocks result: {"results":[{...},{...},{...}]}
```
- 检查 `results` 数组长度
- 统计总调用次数

---

## ✅ 验证清单

完成以下测试项以确保所有改进生效：

- [ ] **场景 1**: 批量编辑 - 一次调用包含多个修改
- [ ] **场景 2**: 错误恢复 - "Block not found" 后自动调用 list_blocks
- [ ] **场景 2**: 卡死避免 - 3 次失败后停止重试
- [ ] **场景 3**: 批量添加 - add_blocks 一次添加多个块
- [ ] **场景 3**: 批量删除 - delete_blocks 一次删除多个块
- [ ] **场景 4**: 大型文档 - 只读取要编辑的块（withContext: false）
- [ ] **场景 5**: 多文档切换 - switch_document 后自动调用 list_blocks
- [ ] **性能**: 平均工具调用次数 <4
- [ ] **性能**: 批量操作占比 >70%
- [ ] **日志**: 无 "not read yet" 错误（除故意测试场景）

---

## 🐛 常见问题排查

### 问题 1: LLM 仍然使用单数工具名

**现象**: 看到 `edit_block` 而不是 `edit_blocks`

**可能原因**:
- System Prompt 缓存未清除
- LLM 模型未使用更新后的 Prompt

**解决方法**:
```bash
# 重启开发服务器
pnpm dev

# 清除浏览器缓存
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (Mac)
```

### 问题 2: 没有看到批量行为

**现象**: 仍然看到多次工具调用

**排查步骤**:
1. 检查 `lib/editor/agent.ts` 是否包含最新更改
   ```bash
   git diff HEAD~1 lib/editor/agent.ts | grep PREFERRED
   ```
2. 验证构建输出
   ```bash
   ls -la .next/server/chunks/lib_editor_agent_ts*
   ```
3. 重新构建
   ```bash
   rm -rf .next
   pnpm dev
   ```

### 问题 3: 测试通过但生产环境无效

**可能原因**:
- 生产环境未部署最新代码
- 环境变量不同（使用不同的 LLM 模型）

**验证方法**:
```bash
# 检查生产环境部署的 commit
git log origin/main --oneline -1

# 应该看到:
# 78d93a1 feat: improve System Prompts based on code review
```

---

## 📝 测试报告模板

完成测试后，记录结果：

```markdown
## System Prompt 改进测试报告

**测试日期**: 2026-XX-XX
**测试人员**: [Your Name]
**Commit**: 78d93a1

### 测试结果

| 场景 | 状态 | 备注 |
|------|------|------|
| 批量工具优化 | ✅/❌ | [观察结果] |
| 错误恢复 | ✅/❌ | [观察结果] |
| 批量添加/删除 | ✅/❌ | [观察结果] |
| 大型文档优化 | ✅/❌ | [观察结果] |
| 多文档 Guard 重置 | ✅/❌ | [观察结果] |

### 性能指标

- 平均工具调用次数: __ 次
- 批量操作占比: __ %
- 失败请求率: __ %

### 问题和建议

[记录任何观察到的问题或改进建议]
```

---

## 🚀 下一步

完成前端测试后：

1. **生产监控**（48-72 小时）
   - 观察实际使用中的工具调用模式
   - 收集用户反馈
   - 监控错误率变化

2. **性能基准测试**
   - 对比改进前后的响应时间
   - 测量 Token 使用量
   - 记录 API 成本变化

3. **持续优化**
   - 根据实际数据调整 Prompt
   - 考虑添加更多工具调用模式
   - 优化错误恢复策略

---

**祝测试顺利！** 🎉

如有问题，请参考：
- Code Review: `.claude/reviews/system-prompt-review.md`
- Dev Plan: `.claude/specs/system-prompt-improvements/dev-plan.md`
- API 文档: `app/api/editor/command/stream/route.ts`
