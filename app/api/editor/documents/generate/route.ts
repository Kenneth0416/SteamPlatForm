import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { DOCUMENT_TEMPLATES, type TemplateKey } from '@/lib/editor/document-templates'

function createLLMClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set')

  return new ChatOpenAI({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    apiKey,
    configuration: {
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    },
    temperature: 0.7,
    maxTokens: 4096,
  })
}

interface GenerateRequest {
  templateKey: TemplateKey
  lessonId: string
  existingDocuments: { name: string; content: string }[]
  lang?: 'en' | 'zh'
}

export async function POST(request: NextRequest) {
  try {
    const { templateKey, existingDocuments, lang } = (await request.json()) as GenerateRequest

    const template = DOCUMENT_TEMPLATES[templateKey]
    if (!template) {
      return NextResponse.json({ error: 'Invalid template key' }, { status: 400 })
    }

    // Build context from existing documents
    const docsContext = existingDocuments
      .map((doc) => `### ${doc.name}\n${doc.content}`)
      .join('\n\n---\n\n')

    // Detect language from document content (check for Chinese characters)
    const hasChinese = /[\u4e00-\u9fff]/.test(docsContext)
    const requestedLang = lang === 'en' || lang === 'zh' ? lang : undefined
    const targetLang = requestedLang ?? (hasChinese ? 'zh' : 'en')
    const docType = targetLang === 'zh' ? template.name : template.nameEn
    const documentName = docType

    const humanMessage = targetLang === 'zh'
      ? `以下是現有的課程相關文檔：

{documents}

請基於以上內容，生成一份新的「{docType}」文檔。`
      : `Below are the existing course documents:

{documents}

Based on the above content, generate a new "{docType}" document.`

    const languageInstruction = requestedLang
      ? requestedLang === 'en'
        ? 'Generate content in English'
        : 'Generate content in Traditional Chinese (繁體中文)'
      : `IMPORTANT: You MUST generate content in the SAME LANGUAGE as the existing documents. If the documents are in English, write in English. If in Chinese, write in Chinese. Match the language exactly.`

    const systemMessage = [template.systemPrompt, languageInstruction].filter(Boolean).join('\n\n')

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemMessage],
      ['human', humanMessage],
    ])

    const llm = createLLMClient()
    const chain = prompt.pipe(llm)

    // Stream response using SSE format
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = await chain.stream({
            documents: docsContext || '（尚無現有文檔 / No existing documents）',
            docType,
          })
          for await (const chunk of stream) {
            const text = chunk.content as string
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          // Send document metadata at the end
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, name: documentName, type: template.type })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Generate document error:', error)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}
