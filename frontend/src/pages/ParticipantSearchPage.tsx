import { useState, useMemo } from 'react'
import { Search, MapPin, Award, Zap, Filter } from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useAppTitle } from '@/hooks/useAppTitle'

export function ParticipantSearchPage() {
  useAppTitle('Find Participants')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'rewards' | 'waste'>('name')
  const { results: searchResults, isLoading: isSearching } = useSearch(searchQuery)

  const filteredResults = useMemo(() => {
    let filtered = searchResults || []

    if (roleFilter !== 'all') {
      filtered = filtered.filter((p) => p.role === roleFilter)
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rewards':
          return Number(b.stats.rewards - a.stats.rewards)
        case 'waste':
          return Number(b.stats.totalWaste - a.stats.totalWaste)
        case 'name':
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [searchResults, roleFilter, sortBy])

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Recycler':
        return 'bg-green-100 text-green-800'
      case 'Collector':
        return 'bg-blue-100 text-blue-800'
      case 'Manufacturer':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Find Participants</h1>
        <p className="text-gray-600">Search and discover participants in the recycling network</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search by name, address, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Sort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="Recycler">Recycler</option>
                <option value="Collector">Collector</option>
                <option value="Manufacturer">Manufacturer</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'rewards' | 'waste')}>
                <option value="name">Name (A-Z)</option>
                <option value="rewards">Highest Rewards</option>
                <option value="waste">Most Waste Processed</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        {isSearching ? (
          <div className="text-center py-8 text-gray-500">Searching participants...</div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No participants found matching your search' : 'Enter a search query to find participants'}
          </div>
        ) : (
          filteredResults.map((participant) => (
            <Card key={participant.address} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{participant.name}</h3>
                        <p className="text-sm text-gray-500 font-mono">
                          {participant.address.slice(0, 10)}...{participant.address.slice(-8)}
                        </p>
                      </div>
                      <Badge className={getRoleColor(participant.role)}>{participant.role}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>
                          {participant.location.lat.toFixed(2)}, {participant.location.lon.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-gray-400" />
                        <span>{participant.stats.totalWaste.toString()} kg</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-gray-400" />
                        <span>{participant.stats.verifications} verifications</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{participant.stats.rewards.toString()} pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
