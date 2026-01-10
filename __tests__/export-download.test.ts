import { downloadBlob } from "@/lib/download"

describe("downloadBlob", () => {
  const ensureUrlApi = () => {
    const anyUrl = URL as unknown as {
      createObjectURL?: (blob: Blob) => string
      revokeObjectURL?: (url: string) => void
    }

    if (typeof anyUrl.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        value: (_blob: Blob) => "blob:default",
        writable: true,
        configurable: true,
      })
    }

    if (typeof anyUrl.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", {
        value: (_url: string) => {},
        writable: true,
        configurable: true,
      })
    }
  }

  beforeEach(() => {
    jest.useFakeTimers()
    ensureUrlApi()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("creates an anchor, triggers click, and revokes the object URL", () => {
    const blob = new Blob(["hello"], { type: "text/plain" })

    const createSpy = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock")
    const revokeSpy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const appendSpy = jest.spyOn(document.body, "appendChild")
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    downloadBlob(blob, "file name.txt")

    expect(createSpy).toHaveBeenCalledWith(blob)
    expect(appendSpy).toHaveBeenCalledTimes(1)

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(anchor.href).toBe("blob:mock")
    expect(anchor.download).toBe("file name.txt")
    expect(anchor.rel).toBe("noopener")
    expect(anchor.style.display).toBe("none")

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(document.body.contains(anchor)).toBe(false)

    jest.runOnlyPendingTimers()
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock")
  })

  it("does not throw for empty filenames", () => {
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-2")
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    expect(() => downloadBlob(new Blob(["x"]), "")).not.toThrow()
  })
})
