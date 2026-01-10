"use client"

import type React from "react"

import { useEffect, useRef, useState, memo } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ZoomIn, ZoomOut, Maximize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface MermaidDiagramProps {
  chart: string
  className?: string
}

export const MermaidDiagram = memo(function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const renderChart = async (container: HTMLDivElement) => {
    if (!container || !chart) return

    try {
      setError(null)

      const mermaid = (await import("mermaid")).default

      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
      })

      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
      const { svg } = await mermaid.render(id, chart)

      container.innerHTML = svg
    } catch (err) {
      console.error("[v0] Mermaid render error:", err)
      setError(err instanceof Error ? err.message : "Failed to render diagram")
    }
  }

  useEffect(() => {
    let mounted = true

    const renderPreview = async () => {
      if (!ref.current || !chart) return

      try {
        setIsLoading(true)
        await renderChart(ref.current)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    renderPreview()

    return () => {
      mounted = false
    }
  }, [chart])

  useEffect(() => {
    let mounted = true

    const renderModal = async () => {
      if (isModalOpen && modalRef.current) {
        setIsModalLoading(true)
        try {
          // Clear previous content
          modalRef.current.innerHTML = ""
          await renderChart(modalRef.current)
        } finally {
          if (mounted) {
            setIsModalLoading(false)
          }
        }
      }
    }

    renderModal()

    return () => {
      mounted = false
    }
  }, [isModalOpen, chart])

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to render diagram: {error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <div className={`mermaid-container relative ${className}`}>
        {isLoading && (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
        <div className={`relative ${isLoading ? "hidden" : ""}`}>
          <div className="max-h-[400px] overflow-auto border rounded-lg p-4 bg-muted/30">
            <div ref={ref} className="flex items-center justify-center min-h-[200px]" />
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 z-10"
            onClick={() => setIsModalOpen(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-[96vw] max-h-[96vh] p-0 overflow-hidden rounded-3xl" showCloseButton={false}>
          <VisuallyHidden>
            <DialogTitle>Mermaid Diagram Viewer</DialogTitle>
          </VisuallyHidden>
          <div className="relative w-full h-[92vh] bg-background">
            <div className="absolute top-4 right-4 z-20 flex gap-2 bg-background/80 backdrop-blur-md p-2 rounded-xl border shadow-lg">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} className="hover:bg-accent/50">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleResetZoom} className="hover:bg-accent/50">
                1:1
              </Button>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} className="hover:bg-accent/50">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px bg-border mx-1" />
              <Button variant="ghost" size="icon" onClick={handleCloseModal} className="hover:bg-accent/50">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="absolute top-4 left-4 z-20 bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-medium border shadow-lg">
              {Math.round(zoom * 100)}%
            </div>

            {isModalLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            )}

            <div
              className="w-full h-full overflow-hidden cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                className="w-full h-full flex items-center justify-center transition-transform"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                <div ref={modalRef} className="p-8" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
