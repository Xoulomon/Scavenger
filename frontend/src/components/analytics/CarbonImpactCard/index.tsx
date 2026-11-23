import { Leaf, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card'

export function CarbonImpactCard() {
  const carbonData = {
    totalOffset: 2450,
    monthlyGrowth: 12.5,
    treesEquivalent: 112,
    co2Reduced: 3.2
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-green-500" />
          Carbon Credits Impact
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center p-6 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {carbonData.totalOffset.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Total Carbon Credits Earned</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+{carbonData.monthlyGrowth}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Monthly Growth</p>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{carbonData.treesEquivalent}</p>
              <p className="text-xs text-muted-foreground">Trees Planted Equivalent</p>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg col-span-2">
              <p className="text-2xl font-bold">{carbonData.co2Reduced} tons</p>
              <p className="text-xs text-muted-foreground">CO₂ Emissions Reduced</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
