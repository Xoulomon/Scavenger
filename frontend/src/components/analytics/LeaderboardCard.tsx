import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const mockLeaderboard = [
  { rank: 1, name: 'EcoCollector Pro', points: 15420, avatar: '🏆' },
  { rank: 2, name: 'Green Recycler', points: 12350, avatar: '🥈' },
  { rank: 3, name: 'Waste Warrior', points: 10890, avatar: '🥉' },
  { rank: 4, name: 'Planet Saver', points: 9560, avatar: '⭐' },
  { rank: 5, name: 'Eco Champion', points: 8720, avatar: '🌟' },
];

export function LeaderboardCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Participants
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockLeaderboard.map((participant) => (
            <div
              key={participant.rank}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{participant.avatar}</span>
                <div>
                  <p className="font-medium">{participant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Rank #{participant.rank}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{participant.points.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
