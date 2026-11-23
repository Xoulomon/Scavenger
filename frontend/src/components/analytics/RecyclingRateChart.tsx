import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const data = [
  { month: 'Jan', rate: 72 },
  { month: 'Feb', rate: 75 },
  { month: 'Mar', rate: 78 },
  { month: 'Apr', rate: 76 },
  { month: 'May', rate: 82 },
  { month: 'Jun', rate: 87 }
]

const W = 400
const H = 120
const PAD = 20
const minRate = 60
const maxRate = 100

function toX(i: number) {
  return PAD + (i / (data.length - 1)) * (W - PAD * 2)
}
function toY(rate: number) {
  return H - PAD - ((rate - minRate) / (maxRate - minRate)) * (H - PAD * 2)
}

export function RecyclingRateChart() {
  const points = data.map((d, i) => `${toX(i)},${toY(d.rate)}`).join(' ')
  const areaPoints = [
    `${toX(0)},${H - PAD}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.rate)}`),
    `${toX(data.length - 1)},${H - PAD}`
  ].join(' ')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Recycling Rate Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          aria-label="Recycling rate line chart"
          role="img"
        >
          {/* Grid lines */}
          {[70, 80, 90].map((y) => (
            <g key={y}>
              <line
                x1={PAD}
                y1={toY(y)}
                x2={W - PAD}
                y2={toY(y)}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="4 4"
              />
              <text
                x={PAD - 4}
                y={toY(y) + 4}
                textAnchor="end"
                fontSize="9"
                fill="currentColor"
                opacity={0.5}
              >
                {y}%
              </text>
            </g>
          ))}

          {/* Area fill */}
          <polygon points={areaPoints} fill="#22c55e" fillOpacity={0.1} />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.map((d, i) => (
            <g key={d.month}>
              <circle cx={toX(i)} cy={toY(d.rate)} r="4" fill="#22c55e" />
              <text
                x={toX(i)}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fill="currentColor"
                opacity={0.6}
              >
                {d.month}
              </text>
            </g>
          ))}
        </svg>
      </CardContent>
    </Card>
  )
}
