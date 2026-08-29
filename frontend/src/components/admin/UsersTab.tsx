import { useState } from 'react'
import { UserX, UserCheck } from 'lucide-react'
import { formatDate } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { addAuditEntry } from './auditLog'

export interface AdminUser {
  address: string
  role: string
  name: string
  status: 'active' | 'suspended'
  joined: number
}
export type MockUser = AdminUser

interface UsersTabProps {
  initialUsers?: AdminUser[]
}

export function UsersTab({ initialUsers = [] }: UsersTabProps = {}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [search, setSearch] = useState('')


  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.address.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  )

  function toggleStatus(address: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.address === address
          ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' }
          : u
      )
    )
    addAuditEntry('toggle_user_status', address)
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, address or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search users"
      />
      <div className="divide-y divide-border rounded-lg border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          filtered.map((u) => (
            <div key={u.address} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.address} · {u.role} · Joined {formatDate(u.joined)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={u.status === 'active' ? 'default' : 'outline'}>
                  {u.status}
                </Badge>
                <Button
                  size="sm"
                  variant={u.status === 'active' ? 'destructive' : 'outline'}
                  onClick={() => toggleStatus(u.address)}
                  aria-label={u.status === 'active' ? 'Suspend user' : 'Reactivate user'}
                >
                  {u.status === 'active' ? (
                    <UserX className="h-3.5 w-3.5" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
