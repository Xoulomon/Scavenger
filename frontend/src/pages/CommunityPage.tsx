import { Award, Trophy, Star, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import { LeaderboardRow } from '@/design-system'
import { ContributorRecognition } from '@/components/community/ContributorRecognition'

interface LeaderboardEntry {
  rank: number
  address: string
  points: number
  wasteCount: number
  badge: string
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, address: 'GAXYZ...ABC123', points: 15420, wasteCount: 87, badge: 'Gold' },
  { rank: 2, address: 'GBDEF...XYZ789', points: 12350, wasteCount: 72, badge: 'Silver' },
  { rank: 3, address: 'GCHIJ...LMN456', points: 10890, wasteCount: 65, badge: 'Bronze' },
  { rank: 4, address: 'GDKLM...OPQ321', points: 9240, wasteCount: 58, badge: 'Rising Star' },
  { rank: 5, address: 'GENOP...RST654', points: 8150, wasteCount: 51, badge: 'Contributor' }
]

const achievements = [
  {
    icon: Trophy,
    title: 'First Recycler',
    description: 'Submit your first waste item',
    unlocked: true
  },
  { icon: Star, title: 'Eco Warrior', description: 'Recycle 50 items', unlocked: true },
  {
    icon: Award,
    title: 'Community Leader',
    description: 'Reach top 10 leaderboard',
    unlocked: false
  },
  { icon: TrendingUp, title: 'Consistency King', description: '30 day streak', unlocked: false }
]

export function CommunityPage() {
  useAppTitle('Community')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Community Hub</h1>
        <p className="mt-1 text-muted-foreground">
          Connect with fellow recyclers and track your impact
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockLeaderboard.map((entry) => (
                <LeaderboardRow
                  key={entry.rank}
                  rank={entry.rank}
                  address={entry.address}
                  points={entry.points}
                  tier={entry.badge}
                >
                  <div className="text-xs text-muted-foreground">
                    {entry.wasteCount} items recycled
                  </div>
                </LeaderboardRow>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {achievements.map((achievement, idx) => {
                const Icon = achievement.icon
                return (
                  <div
                    key={idx}
                    className={`flex gap-3 rounded-lg border p-3 ${
                      achievement.unlocked ? 'bg-primary/5' : 'opacity-50'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        achievement.unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{achievement.title}</div>
                      <div className="text-xs text-muted-foreground">{achievement.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Community Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Members</span>
                <span className="text-xl font-bold">1,247</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Today</span>
                <span className="text-xl font-bold">342</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Items Recycled</span>
                <span className="text-xl font-bold">45.2K</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">#127</div>
              <p className="mt-2 text-sm text-muted-foreground">
                You're in the top 11% of recyclers
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[89%] bg-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Milestone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <div>
                  <div className="font-medium">Top 100</div>
                  <div className="text-xs text-muted-foreground">850 points to go</div>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[65%] bg-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contributor Recognition Program */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Contributor Recognition Program</h2>
        <ContributorRecognition />
      </div>
    </div>
  )
}
