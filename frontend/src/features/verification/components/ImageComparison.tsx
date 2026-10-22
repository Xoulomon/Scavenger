import { Eye, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'

import { getMockImages } from '../mockImages'

export function ImageComparison({ materialId }: { materialId: number }) {
  const [sliderPos, setSliderPos] = useState(50)
  const [mode, setMode] = useState<'slider' | 'side-by-side'>('side-by-side')
  const images = getMockImages(materialId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Image Comparison</span>
        <div className="flex gap-1">
          <Button
            variant={mode === 'side-by-side' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setMode('side-by-side')}
            aria-pressed={mode === 'side-by-side'}
            aria-label="Side by side view"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={mode === 'slider' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setMode('slider')}
            aria-pressed={mode === 'slider'}
            aria-label="Slider comparison view"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {mode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Before</span>
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={images.before}
                alt={`Before image for material ${materialId}`}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">After</span>
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={images.after}
                alt={`After image for material ${materialId}`}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-40 overflow-hidden rounded-lg border bg-muted" aria-label="Image comparison slider">
          <img
            src={images.after}
            alt={`After image for material ${materialId}`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={images.before}
              alt={`Before image for material ${materialId}`}
              className="h-full w-full object-cover"
              style={{ width: `${(100 / sliderPos) * 100}%`, maxWidth: 'none' }}
              loading="lazy"
            />
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
            style={{ left: `${sliderPos}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-col-resize opacity-0"
            aria-label="Drag to compare before and after images"
          />
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            Before
          </div>
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            After
          </div>
        </div>
      )}
    </div>
  )
}
