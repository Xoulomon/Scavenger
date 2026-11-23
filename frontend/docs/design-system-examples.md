# Design System Examples

Concrete, copy-paste examples for common UI scenarios in the Scavngr frontend.

---

## Stat Dashboard Row

```tsx
import { StatCard } from '@/components/ui/StatCard'

function DashboardStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard title="Total collected" value="2,430 kg" change="+12%" trend="up" />
      <StatCard title="Verified batches" value="148" change="+5%" trend="up" />
      <StatCard title="Pending review" value="7" change="-3%" trend="down" />
      <StatCard title="Active collectors" value="32" change="0%" trend="neutral" />
    </div>
  )
}
```

---

## Waste Submission Form

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/Select'

const schema = z.object({
  wasteType: z.string().min(1),
  weight: z.number().positive()
})

function WasteSubmissionForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema)
  })

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        await submitBatch(data)
        onSuccess()
      })}
      className="flex flex-col gap-4 max-w-sm"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Waste type</label>
        <Select onValueChange={(v) => setValue('wasteType', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plastic">Plastic</SelectItem>
            <SelectItem value="metal">Metal</SelectItem>
            <SelectItem value="paper">Paper</SelectItem>
            <SelectItem value="glass">Glass</SelectItem>
          </SelectContent>
        </Select>
        {errors.wasteType && (
          <span className="text-xs text-destructive">{errors.wasteType.message}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Weight (kg)</label>
        <Input type="number" min={0} step={0.1} {...register('weight', { valueAsNumber: true })} />
        {errors.weight && <span className="text-xs text-destructive">{errors.weight.message}</span>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit batch'}
      </Button>
    </form>
  )
}
```

---

## Delete Confirmation Dialog

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/Dialog'

function DeleteItemButton({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteItem(itemId)
      toast.success('Item deleted')
      setOpen(false)
    } catch (err) {
      toast.error('Failed to delete', { description: err.message })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete item?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Loading / Empty / Error States

```tsx
import { Skeleton } from '@/components/ui/Skeletons'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { WasteCard } from '@/components/ui/WasteCard'
import { Inbox } from 'lucide-react'

function WasteList() {
  const { data, isLoading, error, refetch } = useWasteItems()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load items"
        description={error.message}
        action={<Button onClick={refetch}>Try again</Button>}
      />
    )
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
        title="No waste items yet"
        description="Submit your first batch to get started."
        action={<Button>Submit batch</Button>}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {data.map((item) => (
        <WasteCard key={item.id} {...item} />
      ))}
    </div>
  )
}
```

---

## Badge Status Variants

```tsx
import { Badge } from '@/components/ui/Badge'

const STATUS_BADGE: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  verified: 'default',
  pending: 'secondary',
  draft: 'outline',
  rejected: 'destructive'
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_BADGE[status] ?? 'outline'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
```

---

## Dark-mode Aware Chart Colour

```tsx
import { semanticColor } from '@/design-system'
import { LineChart, Line } from 'recharts'

function WasteChart({ data }: { data: ChartData[] }) {
  const primary = semanticColor('primary') // adapts to current theme

  return (
    <LineChart data={data}>
      <Line type="monotone" dataKey="weight" stroke={primary} strokeWidth={2} />
    </LineChart>
  )
}
```
