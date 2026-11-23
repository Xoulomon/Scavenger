# Design Patterns

Recurring patterns used across the Scavngr frontend. Follow these conventions when building new features.

---

## Layout

### Page Structure

```tsx
// Standard page shell
<div className="min-h-screen bg-background">
  <main className="container mx-auto px-4 py-8 max-w-7xl">{/* page content */}</main>
</div>
```

### Two-column with sidebar

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
  <aside>{/* sidebar */}</aside>
  <section>{/* main content */}</section>
</div>
```

### Card grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id}>…</Card>
  ))}
</div>
```

---

## Data Fetching

Use the custom hooks in `src/hooks/` for all data fetching. Never call API functions directly inside components.

```tsx
// ✅ Preferred
const { data, isLoading, error } = useWasteItems()

// ❌ Avoid
const [data, setData] = useState(null)
useEffect(() => {
  fetchWasteItems().then(setData)
}, [])
```

### Loading states

Render skeleton placeholders while data is loading:

```tsx
if (isLoading) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[140px] rounded-xl" />
      ))}
    </div>
  )
}
```

### Error states

```tsx
if (error) {
  return (
    <EmptyState
      title="Failed to load"
      description={error.message}
      action={<Button onClick={refetch}>Retry</Button>}
    />
  )
}
```

### Empty states

```tsx
if (!data?.length) {
  return (
    <EmptyState
      title="No waste items"
      description="Submit your first batch to get started."
      action={<Button>Submit batch</Button>}
    />
  )
}
```

---

## Forms

### Controlled form with validation

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  weight: z.number().positive('Weight must be positive'),
  wasteType: z.string().min(1, 'Waste type is required')
})

function WasteForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema)
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Weight (kg)</label>
        <Input type="number" {...register('weight', { valueAsNumber: true })} />
        {errors.weight && <span className="text-xs text-destructive">{errors.weight.message}</span>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Submit'}
      </Button>
    </form>
  )
}
```

---

## Async Actions

Use `toast` notifications for async feedback rather than inline status text.

```tsx
import { toast } from 'sonner'

async function handleSubmit(data) {
  try {
    await submitWasteBatch(data)
    toast.success('Batch submitted successfully')
  } catch (err) {
    toast.error('Submission failed', { description: err.message })
  }
}
```

---

## Modals and Dialogs

- Use `Dialog` from `@/components/ui/Dialog` for confirmations and short forms.
- Keep modal content focused — one action per dialog.
- Always provide a clear cancel path.

```tsx
// Confirmation pattern
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete item?</DialogTitle>
      <DialogDescription>This will permanently remove the waste record.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Navigation and Routing

- Use `react-router-dom` `<Link>` for all internal navigation.
- Programmatic navigation uses `useNavigate`.
- Active route highlighting uses `NavLink`.

---

## Theming

Toggle between light and dark mode using the `ThemeProvider` context:

```tsx
import { useTheme } from 'next-themes'
const { setTheme } = useTheme()

setTheme('light') // force light
setTheme('dark') // force dark
setTheme('system') // follow OS preference
```

Never hard-code colour hex values in components. Always use Tailwind semantic classes (`text-primary`, `bg-background`, `border-border`) so components adapt automatically to theme changes.

---

## Naming Conventions

| Thing             | Convention                | Example              |
| ----------------- | ------------------------- | -------------------- |
| Components        | PascalCase                | `WasteCard.tsx`      |
| Hooks             | `use` prefix              | `useWasteItems.ts`   |
| Utility functions | camelCase                 | `formatWeight.ts`    |
| Constants         | UPPER_SNAKE_CASE          | `MAX_BATCH_SIZE`     |
| Stories           | co-located `.stories.tsx` | `Button.stories.tsx` |
| Tests             | co-located `.test.tsx`    | `Button.test.tsx`    |
