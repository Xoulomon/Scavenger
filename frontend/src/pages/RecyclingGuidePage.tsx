import { useState, useMemo } from 'react'
import {
  Search,
  BookOpen,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Printer
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import { WasteType } from '@/api/types'
import { wasteTypeLabel } from '@/lib/helpers'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GuideEntry {
  wasteType: WasteType
  description: string
  dos: string[]
  donts: string[]
  steps: string[]
  tips: string[]
}

// ── Guide data (exported for tests) ──────────────────────────────────────────

export const RECYCLING_GUIDES: GuideEntry[] = [
  {
    wasteType: WasteType.Paper,
    description:
      'Paper is one of the most recycled materials. Keeping it clean and dry maximises its value.',
    dos: [
      'Flatten cardboard boxes before recycling',
      'Remove staples and plastic windows from envelopes',
      'Keep paper dry and free from food contamination',
      'Bundle newspapers and magazines together'
    ],
    donts: [
      'Do not recycle greasy pizza boxes',
      'Do not mix paper with wet waste',
      'Do not shred paper into very small pieces',
      'Do not include wax-coated paper'
    ],
    steps: [
      'Sort paper by type (cardboard, newspaper, office paper)',
      'Remove any non-paper attachments',
      'Flatten and bundle securely',
      'Place in designated paper recycling bin'
    ],
    tips: ['Dry paper fetches higher prices', 'Office paper is the most valuable grade']
  },
  {
    wasteType: WasteType.PetPlastic,
    description:
      'PET (polyethylene terephthalate) plastic is highly recyclable and in demand by manufacturers.',
    dos: [
      'Rinse bottles before recycling',
      'Remove caps and labels where possible',
      'Crush bottles to save space',
      'Keep PET separate from other plastics'
    ],
    donts: [
      'Do not include PVC or HDPE bottles',
      'Do not leave liquid inside bottles',
      'Do not mix with general plastic waste',
      'Do not include contaminated bottles'
    ],
    steps: [
      'Empty and rinse each bottle',
      'Remove caps (recycle separately if possible)',
      'Crush flat',
      'Bundle or bag together'
    ],
    tips: ['Clear PET is worth more than coloured', 'Baled PET commands premium prices']
  },
  {
    wasteType: WasteType.Plastic,
    description: 'Mixed rigid plastics can be recycled but require careful sorting by resin type.',
    dos: [
      'Check the resin code on the bottom',
      'Clean containers before recycling',
      'Keep rigid plastics separate from film',
      'Flatten where possible'
    ],
    donts: [
      'Do not include plastic bags or film',
      'Do not include polystyrene foam',
      'Do not mix food-contaminated plastics',
      'Do not include multi-layer packaging'
    ],
    steps: [
      'Identify resin type using the recycling symbol',
      'Clean and dry the item',
      'Sort by resin code',
      'Place in correct collection stream'
    ],
    tips: ['HDPE (code 2) and PP (code 5) are most valuable', 'Sorting by colour increases value']
  },
  {
    wasteType: WasteType.Metal,
    description:
      'Metals are infinitely recyclable without loss of quality, making them highly valuable.',
    dos: [
      'Separate ferrous (iron/steel) from non-ferrous (aluminium, copper)',
      'Remove non-metal attachments',
      'Crush cans to save space',
      'Keep metals dry to prevent rust'
    ],
    donts: [
      'Do not include paint or chemical containers',
      'Do not mix metals with other waste',
      'Do not include radioactive or hazardous metals',
      'Do not include metal with heavy coatings'
    ],
    steps: [
      'Use a magnet to separate ferrous from non-ferrous',
      'Clean and dry all metal items',
      'Crush cans where possible',
      'Sort by metal type and deliver to collection point'
    ],
    tips: ['Aluminium is the most valuable common metal', 'Copper wire commands premium prices']
  },
  {
    wasteType: WasteType.Glass,
    description: 'Glass is 100% recyclable and can be recycled endlessly without quality loss.',
    dos: [
      'Sort by colour: clear, green, brown',
      'Remove lids and caps',
      'Rinse bottles and jars',
      'Handle carefully to avoid breakage'
    ],
    donts: [
      'Do not include window glass or mirrors',
      'Do not include ceramics or pyrex',
      'Do not mix colours if colour-sorted collection is available',
      'Do not include light bulbs'
    ],
    steps: [
      'Empty and rinse containers',
      'Remove metal lids',
      'Sort by colour',
      'Place gently in glass recycling bin'
    ],
    tips: ['Clear glass is most valuable', 'Broken glass should be wrapped safely before disposal']
  }
]

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function searchGuides(guides: GuideEntry[], query: string): GuideEntry[] {
  if (!query.trim()) return guides
  const q = query.toLowerCase()
  return guides.filter(
    (g) =>
      wasteTypeLabel(g.wasteType).toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.dos.some((d) => d.toLowerCase().includes(q)) ||
      g.donts.some((d) => d.toLowerCase().includes(q)) ||
      g.tips.some((t) => t.toLowerCase().includes(q))
  )
}

export function getGuideByWasteType(
  guides: GuideEntry[],
  wasteType: WasteType
): GuideEntry | undefined {
  return guides.find((g) => g.wasteType === wasteType)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GuideCard({ guide }: { guide: GuideEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            {wasteTypeLabel(guide.wasteType)}
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{guide.description}</p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Do's */}
            <div>
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" /> Do's
              </p>
              <ul className="space-y-1">
                {guide.dos.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            {/* Don'ts */}
            <div>
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-destructive">
                <XCircle className="h-4 w-4" /> Don'ts
              </p>
              <ul className="space-y-1">
                {guide.donts.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Steps */}
          <div>
            <p className="mb-2 text-sm font-semibold">Step-by-step instructions</p>
            <ol className="space-y-1 list-decimal list-inside">
              {guide.steps.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          <div className="flex flex-wrap gap-2">
            {guide.tips.map((t, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RecyclingGuidePage() {
  useAppTitle('Recycling Guide')

  const [query, setQuery] = useState('')
  const results = useMemo(() => searchGuides(RECYCLING_GUIDES, query), [query])

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recycling Guide</h1>
          <p className="mt-1 text-muted-foreground">
            Learn how to properly recycle each waste type
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent print:hidden"
          aria-label="Print guide"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search guides…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recycling guides"
        />
      </div>

      {/* Guides */}
      {results.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No guides match your search.</div>
      ) : (
        <div className="space-y-3">
          {results.map((guide) => (
            <GuideCard key={guide.wasteType} guide={guide} />
          ))}
        </div>
      )}
    </div>
  )
}
