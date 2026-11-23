# Component Usage

All UI primitives live under `src/components/ui/`. They are built on Radix UI, styled with Tailwind utility classes, and themed through CSS custom properties defined in `src/index.css`.

---

## Button

```tsx
import { Button } from '@/components/ui/Button'

// Variants
<Button variant="default">Submit</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Learn more</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">View details</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><TrashIcon /></Button>

// Loading state
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Saving…
</Button>
```

---

## Input

```tsx
import { Input } from '@/components/ui/Input'

<Input type="text" placeholder="Search waste items…" />
<Input type="email" placeholder="you@example.com" />
<Input type="number" min={0} placeholder="Weight (kg)" />

// With label and helper text
<div className="flex flex-col gap-1">
  <label htmlFor="weight" className="text-sm font-medium">Weight (kg)</label>
  <Input id="weight" type="number" min={0} />
  <span className="text-xs text-muted-foreground">Enter the total batch weight</span>
</div>
```

---

## Card

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/Card'

;<Card>
  <CardHeader>
    <CardTitle>Waste Summary</CardTitle>
    <CardDescription>Last 30 days</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold text-primary">124 kg</p>
  </CardContent>
  <CardFooter>
    <Button variant="outline" size="sm">
      View report
    </Button>
  </CardFooter>
</Card>
```

---

## Badge

```tsx
import { Badge } from '@/components/ui/Badge'

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="outline">Draft</Badge>
<Badge variant="destructive">Rejected</Badge>
```

---

## Select

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/Select'

;<Select>
  <SelectTrigger>
    <SelectValue placeholder="Waste type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="plastic">Plastic</SelectItem>
    <SelectItem value="metal">Metal</SelectItem>
    <SelectItem value="paper">Paper</SelectItem>
    <SelectItem value="glass">Glass</SelectItem>
  </SelectContent>
</Select>
```

---

## Dialog

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/Dialog'

;<Dialog>
  <DialogTrigger asChild>
    <Button>Confirm transfer</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Transfer</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Checkbox

```tsx
import { Checkbox } from '@/components/ui/Checkbox'

;<div className="flex items-center gap-2">
  <Checkbox id="agree" />
  <label htmlFor="agree" className="text-sm">
    I agree to the terms
  </label>
</div>
```

---

## Switch

```tsx
import { Switch } from '@/components/ui/Switch'

;<div className="flex items-center gap-2">
  <Switch id="notifications" defaultChecked />
  <label htmlFor="notifications" className="text-sm">
    Email notifications
  </label>
</div>
```

---

## StatCard

```tsx
import { StatCard } from '@/components/ui/StatCard'

;<StatCard title="Total collected" value="2,430 kg" change="+12% vs last month" trend="up" />
```

---

## EmptyState

```tsx
import { EmptyState } from '@/components/ui/EmptyState'
import { Inbox } from 'lucide-react'

;<EmptyState
  icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
  title="No items yet"
  description="Submit your first waste batch to get started."
  action={<Button>Submit batch</Button>}
/>
```

---

## Skeletons

```tsx
import { Skeleton } from '@/components/ui/Skeletons'

// Single skeleton block
<Skeleton className="h-4 w-[250px]" />

// Card placeholder
<div className="flex flex-col gap-2">
  <Skeleton className="h-[125px] w-full rounded-xl" />
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>
```

---

## WasteCard

```tsx
import { WasteCard } from '@/components/ui/WasteCard'

;<WasteCard wasteType="plastic" weight={42} status="verified" submittedAt={new Date()} />
```

---

## Storybook

Every component listed above has a corresponding `.stories.tsx` file under `src/components/ui/`. Run Storybook to browse live examples with controls:

```bash
npm run storybook
```
