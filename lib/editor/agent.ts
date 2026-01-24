import { BlockIndexService } from './block-index'
import { ReadWriteGuard } from './tools/middleware'
import { createEditorTools, ToolContext, createListDocumentsTool, createSwitchDocumentTool, MultiDocToolContext } from './tools'
import { DocumentManager } from './document-manager'
import { ToolTrace, detectStuck } from './agent/runtime'
import { createLLMClient } from '@/lib/langchain/llm-factory'
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import type { Block, PendingDiff, EditorDocument } from './types'

const SYSTEM_PROMPT = `You are a document editing assistant. You help users modify their documents through natural language commands.

EFFICIENCY RULES (CRITICAL):
1. MINIMIZE tool calls - plan ALL operations upfront, execute in ONE batch
2. After list_blocks, you should know exactly which blocks to read/edit - do it in ONE call
3. Maximum 3 tool calls per request: list_blocks → read_blocks → edit_blocks
4. Batch ALL add/delete operations in ONE call
5. For large documents (>50 blocks):
   - Read only blocks you plan to edit (not entire document)
   - Use withContext=false to reduce tokens
   - Split into multiple batches if absolutely necessary (but prefer one)
6. MAX 30 iterations - plan carefully to avoid loops
7. If stuck after 3 attempts, ask user for clarification instead of repeating

WORKFLOW (follow strictly):
1. list_blocks - get document structure (REQUIRED first step)
2. read_blocks - read ALL relevant blocks in ONE call
   - SKIP only for read-only queries about document structure
   - ALWAYS read before editing/deleting for full context
3. Execute operations in ONE batch:
   - Use edit_blocks for modifications
   - Use add_blocks for insertions (max 25)
   - Use delete_blocks for removals (max 25)
4. Respond with summary

RULES:
- Be precise - only modify what the user asks for
- For READ-ONLY queries: list_blocks → read_blocks → answer immediately (NO edits)
- STOP when you have enough info - don't over-read
- Never add empty headings or duplicate content

ERROR HANDLING:
- If tool fails, READ the error message carefully
- "Block not found" → call list_blocks to refresh document state
- "not read yet" → call read_blocks before retrying
- "already deleted" → skip that block and continue
- Never retry the same operation 3+ times (prevents infinite loops)

Available tools:
- list_blocks: See document structure with previews (call first)
- read_blocks: PREFERRED - Batch read blocks in ONE call (max 25)
- edit_blocks: PREFERRED - Batch edit blocks in ONE call (max 25) - requires read_blocks first
- add_blocks: PREFERRED - Batch add blocks in ONE call (max 25) - no prior read needed
  POSITIONING RULES:
  - afterBlockId=null → appends to document END (use only when adding to end)
  - afterBlockId=<existing block ID> → inserts AFTER that block (use for middle insertions)
  - To insert at a specific location: first call list_blocks to find the target block ID
  CHAINING MULTIPLE BLOCKS (when adding several blocks together):
  - First block: afterBlockId=<target position block ID> (or null for end)
  - Second block: afterBlockId=<first block's newBlockId from result>
  - Third block: afterBlockId=<second block's newBlockId from result>
  COMMON MISTAKE: Using afterBlockId=null for every block → all blocks go to end separately!
- delete_blocks: PREFERRED - Batch delete blocks in ONE call (max 25) - requires read_blocks first

RESPONSE STYLE (CRITICAL):
- Keep responses concise: 2-5 sentences maximum
- Only state what was changed, not detailed explanations of how
- No verbose summaries, bullet lists, or step-by-step recaps unless user explicitly asks
- For read-only queries, answer directly without preamble`

const MULTI_DOC_SYSTEM_PROMPT = `You are a document editing assistant that can work with multiple documents.

MULTI-DOCUMENT WORKFLOW:
1. list_documents - see all open documents (call first if user mentions multiple docs)
2. switch_document(docId) - switch to target document
⚠️ CRITICAL: switch_document RESETS read guards - call list_blocks again after switching
3. list_blocks → read_blocks → edit_blocks/add_blocks/delete_blocks (operate on active document)

RULES:
- Always confirm which document you're editing
- After switch_document, all block operations target the new document
- Use list_documents if unsure which document to edit

EFFICIENCY RULES (CRITICAL):
1. MINIMIZE tool calls - plan ALL operations upfront
2. Use batch operations: read_blocks, edit_blocks, add_blocks, delete_blocks
3. Batch ALL add/delete operations in ONE call
4. Maximum 4 tool calls: list_documents → switch_document → list_blocks → edit_blocks

Available tools:
- list_documents: See all open documents
- switch_document: Switch active document
- list_blocks: See document structure with previews (call first)
- read_blocks: PREFERRED - Batch read blocks in ONE call (max 25)
- edit_blocks: PREFERRED - Batch edit blocks in ONE call (max 25) - requires read_blocks first
- add_blocks: PREFERRED - Batch add blocks in ONE call (max 25) - no prior read needed
- delete_blocks: PREFERRED - Batch delete blocks in ONE call (max 25) - requires read_blocks first`

export interface EditorAgentResult {
  response: string
  pendingDiffs: PendingDiff[]
}

export async function runEditorAgent(
  userMessage: string,
  blocks: Block[],
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<EditorAgentResult> {
  const blockIndex = new BlockIndexService(blocks)
  const guard = new ReadWriteGuard()
  const pendingDiffs: PendingDiff[] = []

  const ctx: ToolContext = {
    blockIndex,
    guard,
    pendingDiffs,
  }

  const tools = createEditorTools(ctx)
  const llm = createLLMClient("documentEditing")

  // Bind tools to the model
  const llmWithTools = llm.bindTools(tools)

  // Build message history
  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(SYSTEM_PROMPT),
  ]

  for (const msg of chatHistory) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content))
    } else {
      messages.push(new AIMessage(msg.content))
    }
  }

  messages.push(new HumanMessage(userMessage))

  // Run agent loop
  let iterations = 0
  const maxIterations = 30
  const toolTrace = new ToolTrace(maxIterations)

  console.log('[EditorAgent] Starting agent loop for message:', userMessage)
  console.log('[EditorAgent] Document has', blocks.length, 'blocks')

  while (iterations < maxIterations) {
    iterations++
    console.log(`[EditorAgent] Iteration ${iterations}/${maxIterations}`)

    const response = await llmWithTools.invoke(messages)
    messages.push(response)

    // Check if there are tool calls
    const toolCalls = response.tool_calls || []
    console.log(`[EditorAgent] Response has ${toolCalls.length} tool calls, content:`,
      typeof response.content === 'string' ? response.content.slice(0, 100) : 'non-string')

    if (toolCalls.length === 0) {
      // No more tool calls, return the response
      console.log('[EditorAgent] No tool calls, returning response. Pending diffs:', pendingDiffs.length)
      return {
        response: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
        pendingDiffs,
      }
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      console.log(`[EditorAgent] Executing tool: ${toolCall.name}`, toolCall.args)
      const tool = tools.find(t => t.name === toolCall.name)
      if (tool) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (tool.func as (args: any) => Promise<string>)(toolCall.args)
          console.log(`[EditorAgent] Tool ${toolCall.name} result:`, result.slice(0, 200))
          toolTrace.add({ name: toolCall.name, args: toolCall.args as Record<string, unknown>, status: 'success', timestamp: Date.now() })
          // Use ToolMessage for tool results (compatible with OpenAI-style APIs)
          messages.push(new ToolMessage({
            content: result,
            tool_call_id: toolCall.id || `call_${Date.now()}`,
          }))
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Tool execution failed'
          console.log(`[EditorAgent] Tool ${toolCall.name} error:`, errorMsg)
          toolTrace.add({ name: toolCall.name, args: toolCall.args as Record<string, unknown>, status: 'error', timestamp: Date.now() })
          messages.push(new ToolMessage({
            content: `Error: ${errorMsg}`,
            tool_call_id: toolCall.id || `call_${Date.now()}`,
          }))
        }
      } else {
        console.log(`[EditorAgent] Tool not found: ${toolCall.name}`)
      }
    }

    // Check for stuck patterns
    const stuckResult = detectStuck(toolTrace)
    if (stuckResult.isStuck) {
      console.warn(`[EditorAgent] Stuck detected: ${stuckResult.reason}`)
    }
  }

  console.log('[EditorAgent] Max iterations reached. Pending diffs:', pendingDiffs.length)
  return {
    response: 'Max iterations reached. Please try a simpler request.',
    pendingDiffs,
  }
}

export interface ToolCallEvent {
  id: string
  name: string
  status: 'calling' | 'success' | 'error'
  args?: Record<string, unknown>
  result?: string
}

export type AgentStreamEvent =
  | { type: 'tool_call'; data: ToolCallEvent }
  | { type: 'content'; data: string }
  | { type: 'diff'; data: PendingDiff }
  | { type: 'new_turn' }
  | { type: 'done' }

export async function* runEditorAgentStream(
  userMessage: string,
  blocks: Block[],
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
): AsyncGenerator<AgentStreamEvent> {
  console.log('[EditorAgentStream] Starting for message:', userMessage)
  const blockIndex = new BlockIndexService(blocks)
  const guard = new ReadWriteGuard()
  const pendingDiffs: PendingDiff[] = []
  const yieldedDiffIds = new Set<string>()

  // Queue for diffs to yield immediately
  const diffQueue: PendingDiff[] = []

  const ctx: ToolContext = {
    blockIndex,
    guard,
    pendingDiffs,
    onDiffCreated: (diff) => {
      diffQueue.push(diff)
    },
  }

  const tools = createEditorTools(ctx)
  const llm = createLLMClient("documentEditing")
  const llmWithTools = llm.bindTools(tools)

  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(SYSTEM_PROMPT),
  ]

  for (const msg of chatHistory) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content))
    } else {
      messages.push(new AIMessage(msg.content))
    }
  }

  messages.push(new HumanMessage(userMessage))

  let iterations = 0
  const maxIterations = 30
  const toolTrace = new ToolTrace(maxIterations)

  while (iterations < maxIterations) {
    iterations++

    // Signal new turn for frontend to create new message
    if (iterations > 1) {
      yield { type: 'new_turn' }
    }

    // Use invoke for reliable tool call handling
    const response = await llmWithTools.invoke(messages)
    messages.push(response)

    const contentStr = typeof response.content === 'string' ? response.content : ''
    const toolCalls = response.tool_calls || []

    // Yield content for frontend typewriter effect
    if (contentStr) {
      yield { type: 'content', data: contentStr }
    }

    if (toolCalls.length === 0) {
      console.log('[EditorAgentStream] No tool calls, done')
      // Yield any remaining diffs not yet yielded
      for (const diff of pendingDiffs) {
        if (!yieldedDiffIds.has(diff.id)) {
          console.log('[EditorAgentStream] Yielding remaining diff:', diff.id)
          yield { type: 'diff', data: diff }
          yieldedDiffIds.add(diff.id)
        }
      }
      yield { type: 'done' }
      return
    }

    for (const toolCall of toolCalls) {
      const callId = toolCall.id || `call_${Date.now()}`

      // Emit tool call start
      yield {
        type: 'tool_call',
        data: { id: callId, name: toolCall.name, status: 'calling', args: toolCall.args }
      }

      const tool = tools.find(t => t.name === toolCall.name)
      if (tool) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (tool.func as (args: any) => Promise<string>)(toolCall.args)

          // Emit tool call success
          yield {
            type: 'tool_call',
            data: { id: callId, name: toolCall.name, status: 'success', result: result.slice(0, 100) }
          }
          toolTrace.add({ name: toolCall.name, args: toolCall.args as Record<string, unknown>, status: 'success', timestamp: Date.now() })

          // Immediately yield any new diffs created by this tool
          while (diffQueue.length > 0) {
            const diff = diffQueue.shift()!
            if (!yieldedDiffIds.has(diff.id)) {
              console.log('[EditorAgentStream] Streaming diff:', diff.id, diff.action, diff.blockId)
              yield { type: 'diff', data: diff }
              yieldedDiffIds.add(diff.id)
            }
          }

          messages.push(new ToolMessage({ content: result, tool_call_id: callId }))
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Tool execution failed'

          // Emit tool call error
          yield {
            type: 'tool_call',
            data: { id: callId, name: toolCall.name, status: 'error', result: errorMsg }
          }
          toolTrace.add({ name: toolCall.name, args: toolCall.args as Record<string, unknown>, status: 'error', timestamp: Date.now() })

          messages.push(new ToolMessage({ content: `Error: ${errorMsg}`, tool_call_id: callId }))
        }
      }
    }

    // Check for stuck patterns
    const stuckResult = detectStuck(toolTrace)
    if (stuckResult.isStuck) {
      console.warn(`[EditorAgentStream] Stuck detected: ${stuckResult.reason}`)
    }
  }

  console.log('[EditorAgentStream] Max iterations reached. Pending diffs:', pendingDiffs.length)
  yield { type: 'content', data: 'Max iterations reached. Please try a simpler request.' }
  for (const diff of pendingDiffs) {
    if (!yieldedDiffIds.has(diff.id)) {
      console.log('[EditorAgentStream] Yielding remaining diff:', diff.id)
      yield { type: 'diff', data: diff }
    }
  }
  yield { type: 'done' }
}

// Multi-document agent stream
export interface MultiDocAgentResult {
  response: string
  pendingDiffsByDoc: Map<string, PendingDiff[]>
}

export async function* runMultiDocAgentStream(
  userMessage: string,
  documents: EditorDocument[],
  activeDocId: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
): AsyncGenerator<AgentStreamEvent> {
  console.log('[MultiDocAgentStream] Starting for message:', userMessage)
  console.log('[MultiDocAgentStream] Documents:', documents.length, 'Active:', activeDocId)

  const documentManager = new DocumentManager(documents, activeDocId)
  const activeDoc = documentManager.getActiveDocument()
  if (!activeDoc) {
    yield { type: 'content', data: 'Error: No active document found.' }
    yield { type: 'done' }
    return
  }

  let blockIndex = new BlockIndexService(activeDoc.blocks)
  const guard = new ReadWriteGuard()
  const pendingDiffsByDoc = new Map<string, PendingDiff[]>()
  documents.forEach(d => pendingDiffsByDoc.set(d.id, []))

  const yieldedDiffIds = new Set<string>()
  const diffQueue: PendingDiff[] = []

  // Current document's pending diffs (mutable reference)
  let currentPendingDiffs = pendingDiffsByDoc.get(activeDocId) || []

  const ctx: MultiDocToolContext = {
    documentManager,
    blockIndex,
    guard,
    pendingDiffs: currentPendingDiffs,
    pendingDiffsByDoc,
    onDiffCreated: (diff) => {
      const docId = documentManager.getActiveDocId()
      const enrichedDiff = { ...diff, docId }
      const docDiffs = pendingDiffsByDoc.get(docId) || []
      docDiffs.push(enrichedDiff)
      pendingDiffsByDoc.set(docId, docDiffs)
      diffQueue.push(enrichedDiff)
    },
    onDocumentSwitch: (docId, blocks) => {
      blockIndex = new BlockIndexService(blocks)
      ctx.blockIndex = blockIndex
      currentPendingDiffs = pendingDiffsByDoc.get(docId) || []
      ctx.pendingDiffs = currentPendingDiffs
    },
  }

  // Create tools with multi-doc support
  const blockTools = createEditorTools(ctx)
  const docTools = [
    createListDocumentsTool(ctx),
    createSwitchDocumentTool(ctx),
  ]
  const tools = [...docTools, ...blockTools]

  const llm = createLLMClient()
  const llmWithTools = llm.bindTools(tools)

  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(MULTI_DOC_SYSTEM_PROMPT),
  ]

  for (const msg of chatHistory) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content))
    } else {
      messages.push(new AIMessage(msg.content))
    }
  }

  messages.push(new HumanMessage(userMessage))

  let iterations = 0
  const maxIterations = 30
  const toolTrace = new ToolTrace(maxIterations)

  while (iterations < maxIterations) {
    iterations++

    if (iterations > 1) {
      yield { type: 'new_turn' }
    }

    const response = await llmWithTools.invoke(messages)
    messages.push(response)

    const contentStr = typeof response.content === 'string' ? response.content : ''
    const toolCalls = response.tool_calls || []

    if (contentStr) {
      yield { type: 'content', data: contentStr }
    }

    if (toolCalls.length === 0) {
      console.log('[MultiDocAgentStream] No tool calls, done')
      // Yield remaining diffs from all documents
      for (const [docId, diffs] of pendingDiffsByDoc) {
        for (const diff of diffs) {
          if (!yieldedDiffIds.has(diff.id)) {
            yield { type: 'diff', data: { ...diff, docId } }
            yieldedDiffIds.add(diff.id)
          }
        }
      }
      yield { type: 'done' }
      return
    }

    for (const toolCall of toolCalls) {
      const callId = toolCall.id || `call_${Date.now()}`

      yield {
        type: 'tool_call',
        data: { id: callId, name: toolCall.name, status: 'calling', args: toolCall.args }
      }

      const tool = tools.find(t => t.name === toolCall.name)
      if (tool) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (tool.func as (args: any) => Promise<string>)(toolCall.args)

          yield {
            type: 'tool_call',
            data: { id: callId, name: toolCall.name, status: 'success', result: result.slice(0, 100) }
          }
          toolTrace.add({ name: toolCall.name, args: toolCall.args as Record<string, unknown>, status: 'success', timestamp: Date.now() })

          while (diffQueue.length > 0) {
            const diff = diffQueue.shift()!
            if (!yieldedDiffIds.has(diff.id)) {
              console.log('[MultiDocAgentStream] Streaming diff:', diff.id, diff.docId)
              yield { type: 'diff', data: diff }
              yieldedDiffIds.add(diff.id)
            }
          }

          messages.push(new ToolMessage({ content: result, tool_call_id: callId }))
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Tool execution failed'

          yield {
            type: 'tool_call',
            data: { id: callId, name: toolCall.name, status: 'error', result: errorMsg }
          }
          toolTrace.add({ name: toolCall.name, args: toolCall.args as Record<string, unknown>, status: 'error', timestamp: Date.now() })

          messages.push(new ToolMessage({ content: `Error: ${errorMsg}`, tool_call_id: callId }))
        }
      }
    }

    const stuckResult = detectStuck(toolTrace)
    if (stuckResult.isStuck) {
      console.warn(`[MultiDocAgentStream] Stuck detected: ${stuckResult.reason}`)
    }
  }

  console.log('[MultiDocAgentStream] Max iterations reached')
  yield { type: 'content', data: 'Max iterations reached. Please try a simpler request.' }
  for (const [docId, diffs] of pendingDiffsByDoc) {
    for (const diff of diffs) {
      if (!yieldedDiffIds.has(diff.id)) {
        yield { type: 'diff', data: { ...diff, docId } }
      }
    }
  }
  yield { type: 'done' }
}
