import { NextRequest, NextResponse } from "next/server"
import { applyChangeWithLLM } from "@/lib/langchain/apply-change-agent"

export async function POST(request: NextRequest) {
  try {
    const { currentLesson, suggestedChange, lang = "en" } = await request.json()

    if (!currentLesson || !suggestedChange) {
      return NextResponse.json(
        { error: "Missing currentLesson or suggestedChange" },
        { status: 400 }
      )
    }

    const result = await applyChangeWithLLM(
      currentLesson,
      suggestedChange,
      lang
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Apply change error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply change" },
      { status: 500 }
    )
  }
}
