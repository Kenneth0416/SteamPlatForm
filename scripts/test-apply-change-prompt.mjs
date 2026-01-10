import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import * as ts from "typescript"

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const applyChangeAgentPath = path.resolve(__dirname, "../lib/langchain/apply-change-agent.ts")
const sourceText = fs.readFileSync(applyChangeAgentPath, "utf8")

const sourceFile = ts.createSourceFile(
  applyChangeAgentPath,
  sourceText,
  ts.ScriptTarget.Latest,
  /*setParentNodes*/ true,
  ts.ScriptKind.TS
)

const promptConstants = new Map()

function recordPrompt(node) {
  if (!ts.isVariableDeclaration(node)) return
  if (!ts.isIdentifier(node.name)) return
  if (!node.initializer) return

  const name = node.name.text
  if (!name.startsWith("EDIT_PROMPT_")) return

  const init = node.initializer
  if (ts.isNoSubstitutionTemplateLiteral(init) || ts.isStringLiteral(init)) {
    promptConstants.set(name, init.text)
    return
  }

  if (ts.isTemplateExpression(init)) {
    let text = init.head.text
    for (const span of init.templateSpans) {
      text += "${...}" + span.literal.text
    }
    promptConstants.set(name, text)
  }
}

function walk(node) {
  recordPrompt(node)
  ts.forEachChild(node, walk)
}

walk(sourceFile)

try {
  const required = ["EDIT_PROMPT_EN", "EDIT_PROMPT_ZH"]
  for (const key of required) {
    assert(promptConstants.has(key), `Missing prompt constant: ${key}`)
  }

  for (const [name, prompt] of promptConstants.entries()) {
    assert(
      prompt.includes("{currentLesson}"),
      `${name} missing required placeholder: {currentLesson}`
    )
    assert(
      prompt.includes("{suggestedChange}"),
      `${name} missing required placeholder: {suggestedChange}`
    )
    assert(
      prompt.includes('"changes"') || prompt.includes("changes"),
      `${name} missing required mention of changes field`
    )
  }

  process.exit(0)
} catch (error) {
  console.error(error?.stack || String(error))
  process.exit(1)
}

