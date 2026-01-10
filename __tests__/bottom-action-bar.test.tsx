import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { BottomActionBar } from "@/components/steam-agent/bottom-action-bar"
import { WysiwygEditor } from "@/components/wysiwyg-editor"
import { exportLessonPdf, exportLessonWord, saveLesson } from "@/lib/api"
import { downloadBlob } from "@/lib/download"
import { loadSettings } from "@/lib/settingsStorage"

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}))

const mockVditor = jest.fn()
jest.mock("@/components/vditor-editor", () => ({
  __esModule: true,
  default: (props: any) => {
    mockVditor(props)
    return (
      <div data-testid="vditor-proxy" data-placeholder={props.placeholder}>
        <button onClick={() => props.onChange("synced from vditor")}>push-change</button>
      </div>
    )
  },
}))

const toastMock = jest.fn()
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}))

jest.mock("@/lib/settingsStorage", () => ({
  loadSettings: jest.fn(),
}))

jest.mock("@/lib/download", () => ({
  downloadBlob: jest.fn(),
}))

jest.mock("@/lib/api", () => ({
  saveLesson: jest.fn(),
  exportLessonPdf: jest.fn(),
  exportLessonWord: jest.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("BottomActionBar exports", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(loadSettings as jest.Mock).mockReturnValue({
      aiOutputLanguage: "en",
      exportPdfTemplate: "minimal",
      exportWordTemplate: "detailed",
      includeImages: false,
      theme: "system",
    })
  })

  const requirements = {
    gradeLevel: "p1-3",
    numberOfSessions: 1,
    durationPerSession: 30,
    steamDomains: ["S"],
    lessonTopic: "Topic",
    schoolThemes: [],
    teachingApproach: "direct",
    difficultyLevel: "beginner",
  } as const

  it("disables export buttons when no lesson content", () => {
    render(
      <BottomActionBar
        lang="en"
        currentLesson="   "
        currentRequirements={null}
      />,
    )

    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "PDF template options" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Export Word" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Word template options" })).toBeDisabled()
  })

  it("renders export split-buttons with main action and dropdown trigger", () => {
    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    const exportPdfButton = screen.getByRole("button", { name: "Export PDF" })
    const pdfTrigger = screen.getByRole("button", { name: "PDF template options" })
    expect(exportPdfButton.parentElement).toBe(pdfTrigger.parentElement)
    expect(exportPdfButton.parentElement).toHaveClass("inline-flex")

    const exportWordButton = screen.getByRole("button", { name: "Export Word" })
    const wordTrigger = screen.getByRole("button", { name: "Word template options" })
    expect(exportWordButton.parentElement).toBe(wordTrigger.parentElement)
    expect(exportWordButton.parentElement).toHaveClass("inline-flex")
  })

  it("does not save when requirements are missing", async () => {
    const user = userEvent.setup()
    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(saveLesson).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  it("saves a lesson and calls onSaveSuccess", async () => {
    const user = userEvent.setup()
    ;(saveLesson as jest.Mock).mockResolvedValueOnce({ id: "saved-1" })
    const onSaveSuccess = jest.fn()

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={requirements as any}
        currentLessonId="lesson-1"
        onSaveSuccess={onSaveSuccess}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saveLesson).toHaveBeenCalledWith("# My Lesson\n\nHello", requirements, "lesson-1"))
    expect(onSaveSuccess).toHaveBeenCalledWith("saved-1")
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
      }),
    )
  })

  it("clicking Export PDF calls API and triggers download with loading state", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    const pending = deferred<Blob>()
    ;(exportLessonPdf as jest.Mock).mockReturnValueOnce(pending.promise)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export PDF" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled(),
    )
    expect(screen.getByRole("button", { name: "Export PDF" }).querySelector(".animate-spin")).toBeInTheDocument()

    expect(exportLessonPdf).toHaveBeenCalledWith("# My Lesson\n\nHello", "minimal", false)

    pending.resolve(pdfBlob)

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, "My-Lesson.pdf"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Export PDF" })).not.toBeDisabled())
  })

  it("shows error toast when PDF export fails with an empty error message", async () => {
    const user = userEvent.setup()
    ;(exportLessonPdf as jest.Mock).mockRejectedValueOnce(new Error(""))

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export PDF" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "Failed to export PDF",
          variant: "destructive",
        }),
      ),
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it("shows error toast when PDF export fails with an error message", async () => {
    const user = userEvent.setup()
    ;(exportLessonPdf as jest.Mock).mockRejectedValueOnce(new Error("Boom"))

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export PDF" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "Boom",
          variant: "destructive",
        }),
      ),
    )
  })

  it("shows PDF and Word template options in dropdowns", async () => {
    const user = userEvent.setup()

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "PDF template options" }))
    expect(screen.getByRole("menuitem", { name: "Standard" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Detailed" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Minimal" })).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Word template options" }))
    expect(screen.getByRole("menuitem", { name: "Standard" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Detailed" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Minimal" })).not.toBeInTheDocument()
  })

  it("opens and closes the dropdown on chevron click", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    const pdfTrigger = screen.getByRole("button", { name: "PDF template options" })

    await user.click(pdfTrigger)
    expect(screen.getByRole("menuitem", { name: "Standard" })).toBeInTheDocument()

    await user.click(pdfTrigger)
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Standard" })).not.toBeInTheDocument(),
    )
  })

  it("shows correct template option counts (PDF: 3, Word: 2)", async () => {
    const user = userEvent.setup()

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "PDF template options" }))
    expect(screen.getAllByRole("menuitem")).toHaveLength(3)
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Word template options" }))
    expect(screen.getAllByRole("menuitem")).toHaveLength(2)
    expect(screen.queryByRole("menuitem", { name: "Minimal" })).not.toBeInTheDocument()
  })

  it("uses the default templates from loadSettings() for main export actions", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    const wordBlob = new Blob(["docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    ;(exportLessonPdf as jest.Mock).mockResolvedValueOnce(pdfBlob)
    ;(exportLessonWord as jest.Mock).mockResolvedValueOnce(wordBlob)
    ;(loadSettings as jest.Mock).mockReturnValue({
      aiOutputLanguage: "en",
      exportPdfTemplate: "standard",
      exportWordTemplate: "standard",
      includeImages: true,
      theme: "system",
    })

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export PDF" }))
    await waitFor(() => expect(exportLessonPdf).toHaveBeenCalledWith("# My Lesson\n\nHello", "standard", true))

    await user.click(screen.getByRole("button", { name: "Export Word" }))
    await waitFor(() => expect(exportLessonWord).toHaveBeenCalledWith("# My Lesson\n\nHello", "standard", true))
  })

  it("selecting a PDF template exports once without persisting the selection", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    ;(exportLessonPdf as jest.Mock).mockResolvedValue(pdfBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "PDF template options" }))
    await user.click(screen.getByRole("menuitem", { name: "Detailed" }))

    await waitFor(() => expect(exportLessonPdf).toHaveBeenCalledWith("# My Lesson\n\nHello", "detailed", false))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, "My-Lesson.pdf"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Export PDF" })).not.toBeDisabled())

    await user.click(screen.getByRole("button", { name: "Export PDF" }))

    await waitFor(() => expect(exportLessonPdf).toHaveBeenCalledWith("# My Lesson\n\nHello", "minimal", false))
  })

  it("does not persist Word dropdown selection (next export uses default again)", async () => {
    const user = userEvent.setup()
    const wordBlob = new Blob(["docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    ;(exportLessonWord as jest.Mock).mockResolvedValue(wordBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Word template options" }))
    await user.click(screen.getByRole("menuitem", { name: "Standard" }))
    await waitFor(() => expect(exportLessonWord).toHaveBeenCalledWith("# My Lesson\n\nHello", "standard", false))

    await user.click(screen.getByRole("button", { name: "Export Word" }))
    await waitFor(() => expect(exportLessonWord).toHaveBeenCalledWith("# My Lesson\n\nHello", "detailed", false))
  })

  it("uses a safe fallback filename when the lesson title sanitizes to empty", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    ;(exportLessonPdf as jest.Mock).mockResolvedValueOnce(pdfBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={'# \\\\/:*?"<>| \n\nHello'}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export PDF" }))

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, "lesson.pdf"))
  })

  it("uses the default English filename when no title is present", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    ;(exportLessonPdf as jest.Mock).mockResolvedValueOnce(pdfBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"Hello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export PDF" }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, "lesson.pdf"))
  })

  it("uses Chinese labels and default filename when exporting in zh", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    ;(exportLessonPdf as jest.Mock).mockResolvedValueOnce(pdfBlob)

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={"Hello"}
        currentRequirements={null}
      />,
    )

    expect(screen.getByRole("button", { name: "PDF 模板選項" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "匯出 PDF" }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, "課程.pdf"))
  })

  it("renders i18n template strings in zh for both dropdowns", async () => {
    const user = userEvent.setup()

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={"# 我的課程\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "PDF 模板選項" }))
    expect(screen.getByRole("menuitem", { name: "標準" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "詳細" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "精簡" })).toBeInTheDocument()
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Word 模板選項" }))
    expect(screen.getByRole("menuitem", { name: "標準" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "詳細" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "精簡" })).not.toBeInTheDocument()
  })

  it("uses the default Chinese filename when the title sanitizes to empty", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    ;(exportLessonPdf as jest.Mock).mockResolvedValueOnce(pdfBlob)

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={'# \\\\/:*?"<>| \n\nHello'}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "匯出 PDF" }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, "課程.pdf"))
  })

  it("shows Chinese error toast when PDF export fails", async () => {
    const user = userEvent.setup()
    ;(exportLessonPdf as jest.Mock).mockRejectedValueOnce(new Error(""))

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={"Hello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "匯出 PDF" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "錯誤",
          description: "PDF 匯出失敗",
          variant: "destructive",
        }),
      ),
    )
  })

  it("exports using PDF dropdown selections (standard and minimal)", async () => {
    const user = userEvent.setup()
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    ;(exportLessonPdf as jest.Mock).mockResolvedValue(pdfBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "PDF template options" }))
    await user.click(screen.getByRole("menuitem", { name: "Standard" }))
    await waitFor(() => expect(exportLessonPdf).toHaveBeenCalledWith("# My Lesson\n\nHello", "standard", false))
    await waitFor(() => expect(screen.getByRole("button", { name: "Export PDF" })).not.toBeDisabled())

    await user.click(screen.getByRole("button", { name: "PDF template options" }))
    await user.click(screen.getByRole("menuitem", { name: "Minimal" }))
    await waitFor(() => expect(exportLessonPdf).toHaveBeenCalledWith("# My Lesson\n\nHello", "minimal", false))
  })

  it("clicking Export Word calls API and triggers download", async () => {
    const user = userEvent.setup()
    const wordBlob = new Blob(["docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    ;(exportLessonWord as jest.Mock).mockResolvedValueOnce(wordBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export Word" }))

    await waitFor(() => expect(exportLessonWord).toHaveBeenCalledWith("# My Lesson\n\nHello", "detailed", false))
    expect(downloadBlob).toHaveBeenCalledWith(wordBlob, "My-Lesson.docx")
  })

  it("shows error toast when Word export fails with an empty error message", async () => {
    const user = userEvent.setup()
    ;(exportLessonWord as jest.Mock).mockRejectedValueOnce(new Error(""))

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export Word" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "Failed to export Word document",
          variant: "destructive",
        }),
      ),
    )
  })

  it("shows Chinese error toast when Word export fails", async () => {
    const user = userEvent.setup()
    ;(exportLessonWord as jest.Mock).mockRejectedValueOnce(new Error(""))

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={"# 我的課程\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "匯出 Word" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "錯誤",
          description: "Word 匯出失敗",
          variant: "destructive",
        }),
      ),
    )
  })

  it("clicking Export Word shows loading spinner while exporting", async () => {
    const user = userEvent.setup()
    const pending = deferred<Blob>()
    ;(exportLessonWord as jest.Mock).mockReturnValueOnce(pending.promise)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export Word" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export Word" })).toBeDisabled(),
    )
    expect(screen.getByRole("button", { name: "Export Word" }).querySelector(".animate-spin")).toBeInTheDocument()

    pending.resolve(new Blob(["docx"]))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export Word" })).not.toBeDisabled(),
    )
  })

  it("selecting a Word template exports with the chosen template", async () => {
    const user = userEvent.setup()
    const wordBlob = new Blob(["docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    ;(exportLessonWord as jest.Mock).mockResolvedValue(wordBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Word template options" }))
    await user.click(screen.getByRole("menuitem", { name: "Standard" }))

    await waitFor(() => expect(exportLessonWord).toHaveBeenCalledWith("# My Lesson\n\nHello", "standard", false))
    expect(downloadBlob).toHaveBeenCalledWith(wordBlob, "My-Lesson.docx")
  })

  it("exports using Word dropdown detailed selection", async () => {
    const user = userEvent.setup()
    const wordBlob = new Blob(["docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    ;(exportLessonWord as jest.Mock).mockResolvedValueOnce(wordBlob)

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Word template options" }))
    await user.click(screen.getByRole("menuitem", { name: "Detailed" }))

    await waitFor(() => expect(exportLessonWord).toHaveBeenCalledWith("# My Lesson\n\nHello", "detailed", false))
  })

  it("shows a toast for duplicate action", async () => {
    const user = userEvent.setup()
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Duplicate" }))

    expect(logSpy).toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Coming Soon",
      }),
    )

    logSpy.mockRestore()
  })

  it("shows Chinese duplicate toast in zh", async () => {
    const user = userEvent.setup()
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={"# 我的課程\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "複製" }))

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "即將推出",
      }),
    )

    logSpy.mockRestore()
  })

  it("shows Chinese save toast in zh", async () => {
    const user = userEvent.setup()
    ;(saveLesson as jest.Mock).mockResolvedValueOnce({ id: "saved-zh" })

    render(
      <BottomActionBar
        lang="zh"
        currentLesson={"# 我的課程\n\nHello"}
        currentRequirements={requirements as any}
      />,
    )

    await user.click(screen.getByRole("button", { name: "儲存" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "成功",
          description: "課程已成功儲存！",
        }),
      ),
    )
  })

  it("shows error toast when export fails", async () => {
    const user = userEvent.setup()
    ;(exportLessonWord as jest.Mock).mockRejectedValueOnce(new Error("Boom"))

    render(
      <BottomActionBar
        lang="en"
        currentLesson={"# My Lesson\n\nHello"}
        currentRequirements={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Export Word" }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "Boom",
          variant: "destructive",
        }),
      ),
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})

describe("WysiwygEditor coverage", () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    mockVditor.mockClear()
  })

  it("renders the Vditor wrapper and applies language metadata", () => {
    render(<WysiwygEditor value="Content" onChange={mockOnChange} lang="zh" placeholder="Type here" />)

    expect(screen.getByTestId("wysiwyg-editor")).toHaveAttribute("data-lang", "zh")
    expect(screen.getByTestId("vditor-proxy")).toHaveAttribute("data-placeholder", "Type here")
  })

  it("bubbles up changes emitted by the Vditor proxy", async () => {
    const user = userEvent.setup()
    render(<WysiwygEditor value="Start" onChange={mockOnChange} />)

    await user.click(screen.getByRole("button", { name: "push-change" }))

    expect(mockOnChange).toHaveBeenCalledWith("synced from vditor")
  })
})
