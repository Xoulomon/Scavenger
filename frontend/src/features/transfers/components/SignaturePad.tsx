import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'

export function SignaturePad({
  onSign,
  signed,
}: {
  onSign: (signed: boolean) => void
  signed: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        }
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    },
    []
  )

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      setIsDrawing(true)
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    },
    [getPos]
  )

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      e.preventDefault()
      const pos = getPos(e)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      setHasDrawn(true)
    },
    [isDrawing, getPos]
  )

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    if (hasDrawn) {
      onSign(true)
    }
  }, [hasDrawn, onSign])

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onSign(false)
  }, [onSign])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Digital Signature</label>
        {hasDrawn && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSignature}
            aria-label="Clear signature"
          >
            Clear
          </Button>
        )}
      </div>
      <div
        className={`rounded-lg border-2 ${
          signed ? 'border-emerald-500' : 'border-dashed border-muted-foreground/30'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair touch-none rounded-lg bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          aria-label="Signature pad - draw your signature"
          role="img"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Draw your signature above to confirm the transfer.
      </p>
    </div>
  )
}
