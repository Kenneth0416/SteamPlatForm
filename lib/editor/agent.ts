import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { BlockIndexService } from './block-index'
import { ReadWriteGuard } from './tools/middleware'
import { createEditorTools, ToolContext } from './tools'
import { ToolTrace, detectStuck } from './agent/runtime'
import type { Block, PendingDiff } from './types'

const SYSTEM_PROMPT = `You are a document editing assistant. You help users modify their documents through natural language commands.

IMPORTANT RULES:
1. ALWAYS call list_blocks first to see the document structure
2. ALWAYS read blocks before editing - use read_blocks for multiple blocks, read_block for single
3. Use BATCH tools (read_blocks, edit_blocks) when modifying multiple blocks - this is more efficient
4. Be precise - only modify what the user asks for
5. Explain your changes clearly in the reason field
6. If unsure which block to edit, ask for clarification
7. CRITICAL: Before EVERY tool call, briefly explain what you're about to do in plain text. Example: "Let me first check the document structure." then call list_blocks.
8. NEVER add empty headings or headings without content following them
9. NEVER add duplicate headings - check existing structure first
10. When adding new sections, always include meaningful content, not just headings

Available tools:
- list_blocks: See all blocks in the document (call this first)
- read_block: Read a single block's full content
- read_blocks: Batch read multiple blocks (PREFERRED for multiple blocks, max 25)
- edit_block: Modify a single block's content
- edit_blocks: Batch edit multiple blocks (PREFERRED for multiple edits, max 25)
- add_block: Add a new block
- delete_block: Remove a block

BATCH WORKFLOW (for multiple changes):
1. Call list_blocks to understand the document
2. Identify all target block IDs from the list
3. Call read_blocks with all target IDs (up to 25 at once)
4. Call edit_blocks with all edits (up to 25 at once)
5. If more than 25 blocks, repeat in batches
6. Summarize what changes were proposed

SINGLE BLOCK WORKFLOW:
1. Call list_blocks to understand the document
2. Call read_block for the target block
3. Call edit_block to make the change
4. Summarize what was proposed`

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
    temperature: 0.3,
    maxTokens: 2048,
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

    const response = await llmWithTools.invoke(messages)
    messages.push(response)

    const toolCalls = response.tool_calls || []

    // Yield AI content before tool calls (explains what the AI is about to do)
    const contentStr = typeof response.content === 'string' ? response.content : ''
    if (contentStr.trim()) {
      console.log('[EditorAgentStream] Yielding AI content:', contentStr.slice(0, 100))
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
