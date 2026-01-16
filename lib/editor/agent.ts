import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { BlockIndexService } from './block-index'
import { ReadWriteGuard } from './tools/middleware'
import { createEditorTools, ToolContext, createListDocumentsTool, createSwitchDocumentTool, MultiDocToolContext } from './tools'
import { DocumentManager } from './document-manager'
import { ToolTrace, detectStuck } from './agent/runtime'
import type { Block, PendingDiff, EditorDocument } from './types'

const SYSTEM_PROMPT = `You are a document editing assistant. You help users modify their documents through natural language commands.

EFFICIENCY RULES (CRITICAL):
1. MINIMIZE tool calls - plan ALL operations upfront, execute in ONE batch
2. NEVER use read_block/edit_block when multiple blocks are involved - ALWAYS use read_blocks/edit_blocks
3. After list_blocks, you should know exactly which blocks to read/edit - do it in ONE call
4. Maximum 3 tool calls per request: list_blocks → read_blocks → edit_blocks

WORKFLOW (follow strictly):
1. list_blocks - get document structure (REQUIRED first step)
2. read_blocks - read ALL relevant blocks in ONE call (skip if list_blocks preview is enough)
3. edit_blocks - make ALL edits in ONE call
4. Respond with summary

RULES:
- Be precise - only modify what the user asks for
- For READ-ONLY queries: list_blocks → read_blocks → answer immediately (NO edits)
- STOP when you have enough info - don't over-read
- Never add empty headings or duplicate content

Available tools:
- list_blocks: See document structure with previews (call first)
- read_blocks: Batch read blocks (max 25) - ALWAYS use this over read_block
- edit_blocks: Batch edit blocks (max 25) - ALWAYS use this over edit_block
- add_block: Add a new block
- delete_block: Remove a block`

const MULTI_DOC_SYSTEM_PROMPT = `You are a document editing assistant that can work with multiple documents.

MULTI-DOCUMENT WORKFLOW:
1. list_documents - see all open documents (call first if user mentions multiple docs)
2. switch_document(docId) - switch to target document
3. list_blocks → read_blocks → edit_blocks (operate on current document)

RULES:
- Always confirm which document you're editing
- After switch_document, all block operations target the new document
- Use list_documents if unsure which document to edit

EFFICIENCY RULES (CRITICAL):
1. MINIMIZE tool calls - plan ALL operations upfront
2. Use batch operations: read_blocks, edit_blocks
3. Maximum 4 tool calls: list_documents → switch_document → list_blocks → edit_blocks

Available tools:
- list_documents: See all open documents
- switch_document: Switch active document
- list_blocks, read_blocks, edit_blocks, add_block, delete_block (operate on active document)`

function createLLMClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set')
  }

  return new ChatOpenAI({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    apiKey,
    configuration: {
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    },
    temperature: 0.2,
    maxTokens: 8192,
  })
}

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
  const llm = createLLMClient()

  // Bind tools to the model
  const llmWithTools = llm.bindTools(tools)

  // Build message history
  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
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
  const llm = createLLMClient()
  const llmWithTools = llm.bindTools(tools)

  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
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

  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
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
