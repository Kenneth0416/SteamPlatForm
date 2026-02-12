# Tool Optimization - Development Plan

## Overview
优化编辑器工具调用能力 - 重構全局 ID 生成器、啟用 ReadCache 緩存、添加內容長度驗證

## Task Breakdown

### Task 1: 重構全局 ID 生成器
- **ID**: task-1
- **type**: default
- **Description**: 將 `blockIdCounter` 從全局變量改為 ToolContext 實例成員,解決多文檔環境下的 ID 衝突問題
- **File Scope**: lib/editor/tools/index.ts (line 21-24), lib/editor/types.ts (添加 blockIdCounter 字段)
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/tools.test.ts __tests__/editor/document-tools.test.ts --coverage
- **Test Focus**:
  - 多文檔並發場景下 blockId 不重複
  - add_blocks 在不同文檔間生成唯一 ID
  - ID 格式驗證 (`block-${timestamp}-${counter}`)
  - 大批量添加時計數器正確遞增

### Task 2: 啟用 ReadCache 緩存
- **ID**: task-2
- **type**: default
- **Description**: 在 read_blocks 中集成 ReadCache,寫操作時失效緩存,減少重複讀取開銷
- **File Scope**: lib/editor/tools/index.ts (read_blocks 函數), lib/editor/tools/document-tools.ts, lib/editor/agent.ts
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/tools.test.ts __tests__/editor/agent.test.ts --coverage
- **Test Focus**:
  - read_blocks 命中緩存時返回相同數據
  - edit_blocks/add_blocks/delete_blocks 後緩存失效
  - withContext 參數變化時正確處理緩存
  - 多次讀取同一 block 時性能提升驗證

### Task 3: 添加內容長度驗證
- **ID**: task-3
- **type**: quick-fix
- **Description**: 在 edit_blocks/add_blocks 中驗證內容長度 ≤ 50000,防止超長內容導致性能問題
- **File Scope**: lib/editor/tools/index.ts (edit_blocks, add_blocks 函數)
- **Dependencies**: None
- **Test Command**: npm test -- __tests__/editor/tools.test.ts --coverage
- **Test Focus**:
  - edit_blocks 拒絕 >50000 字符的內容
  - add_blocks 拒絕 >50000 字符的內容
  - 邊界測試:50000 字符通過,50001 字符拒絕
  - 錯誤信息明確說明長度限制

## Acceptance Criteria
- [ ] blockIdCounter 移至 ToolContext,多文檔環境無 ID 衝突
- [ ] ReadCache 正確緩存讀取結果,寫操作後失效
- [ ] 內容長度驗證生效,超限操作返回明確錯誤
- [ ] 所有單元測試通過
- [ ] 代碼覆蓋率 ≥90%

## Technical Notes
- **全局狀態問題**:當前 blockIdCounter 是模塊級變量,多 agent 實例會共享同一計數器
- **ID 衝突場景**:同時編輯多個文檔時,不同文檔的 block 可能生成相同 ID
- **緩存策略**:基於 blockId + pendingDiffs 版本建立緩存 key,寫操作時清空相關緩存
- **長度限制原因**:超長內容會導致 LLM token 消耗過大,影響響應速度和成本
- **MAX_CONTENT_LENGTH**: 50000 字符約 12500 tokens (DeepSeek),留有安全餘量
- **測試框架**: Jest + ts-jest,使用 npm test 運行
- **並行執行**:三個任務相互獨立,可並行開發
