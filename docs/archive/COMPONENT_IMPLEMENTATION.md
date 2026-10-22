# Component Implementation Guide

This document describes the implementation of key UI components in the Scavngr frontend.

## WasteCard Component

**Location**: `frontend/src/components/ui/WasteCard.tsx`

### Features Implemented

✅ **Waste Type Icon and Label**
- Dynamic icons for each waste type (Paper, PET Plastic, Plastic, Metal, Glass)
- Color-coded backgrounds with dark mode support
- Accessible icon presentation with `aria-hidden`

✅ **Weight Display**
- Automatic unit conversion (grams to kilograms)
- Formatted display: "500 g" or "1.50 kg"
- Responsive layout

✅ **Status Badge**
- Three states: Confirmed (green), Pending (yellow), Inactive (gray)
- Icon indicators (CheckCircle, Clock, XCircle)
- Accessible color contrast

✅ **Waste ID**
- Monospace font for readability
- Displayed as "#123" format
- Supports BigInt IDs

✅ **Current Owner**
- Truncated address display
- Link to block explorer
- Responsive text wrapping

✅ **Action Buttons Slot**
- Flexible `actions` prop for custom buttons
- Rendered in card footer
- Supports multiple buttons with proper spacing

✅ **Responsive Layout**
- Mobile-first design
- Flexbox layout for optimal spacing
- Card component with proper padding

### Usage Example

```tsx
import { WasteCard } from '@/components/ui/WasteCard'
import { Button } from '@/components/ui/Button'

<WasteCard
  waste={wasteItem}
  actions={
    <>
      <Button variant="outline" onClick={handleTransfer}>
        Transfer
      </Button>
      <Button onClick={handleConfirm}>
        Confirm
      </Button>
    </>
  }
/>
```

### Props

```typescript
interface WasteCardProps {
  waste: Waste              // Waste item data
  actions?: React.ReactNode // Optional action buttons
  className?: string        // Additional CSS classes
}
```

## CreateIncentiveModal Component

**Location**: `frontend/src/components/modals/CreateIncentiveModal.tsx`

### Features Implemented

✅ **Waste Type Selector**
- Dropdown with all waste types
- Labeled options (Paper, PET Plastic, etc.)
- Keyboard navigation support
- Accessible with proper ARIA labels

✅ **Reward Per Gram Input**
- Number input with validation
- Minimum value: 1
- Step: 1 (integer values)
- Placeholder text for guidance

✅ **Total Budget Input**
- Number input with validation
- Minimum value: 1
- Step: 1 (integer values)
- Clear labeling

✅ **Preview of Estimated Rewards**
- Real-time calculation: `budget / reward_per_gram`
- Automatic unit conversion (grams to kg)
- Formatted display with context
- Updates as user types
- Accessible with `role="status"` and `aria-live="polite"`

✅ **Submit Integration**
- Calls `createIncentive` from `useIncentives` hook
- Transaction confirmation dialog
- Loading states during submission
- Error handling with user feedback
- Success callback with created incentive data

✅ **Form Validation**
- Required fields
- Positive number validation
- Submit button disabled when invalid
- Clear error messages

✅ **Responsive Design**
- Mobile-friendly modal
- Proper spacing and typography
- Accessible focus management

### Usage Example

```tsx
import { CreateIncentiveModal } from '@/components/modals/CreateIncentiveModal'

const [isOpen, setIsOpen] = useState(false)

<CreateIncentiveModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  onSuccess={(incentive) => {
    console.log('Created:', incentive)
    // Refresh incentives list
  }}
/>
```

### Props

```typescript
interface Props {
  open: boolean                           // Modal visibility
  onClose: () => void                     // Close handler
  onSuccess?: (incentive: Incentive) => void // Success callback
}
```

### Transaction Flow

1. User fills form (waste type, reward, budget)
2. Preview shows estimated coverage
3. User clicks "Create incentive"
4. Transaction confirmation dialog appears
5. User confirms in dialog
6. Transaction submitted to blockchain
7. Loading state shown during processing
8. On success: modal closes, callback fired
9. On error: error message displayed, modal stays open

## Design Patterns

### Accessibility
- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation
- Focus management
- Screen reader announcements

### Responsive Design
- Mobile-first approach
- Flexible layouts
- Proper touch targets
- Readable typography

### Error Handling
- User-friendly error messages
- Non-blocking errors
- Clear recovery paths
- Loading states

### Performance
- Memoized components
- Optimized re-renders
- Efficient calculations
- Lazy loading where appropriate

## Testing Recommendations

### WasteCard
- [ ] Renders all waste types correctly
- [ ] Shows correct status badges
- [ ] Formats weight properly (g/kg)
- [ ] Truncates long addresses
- [ ] Renders action buttons in footer
- [ ] Responsive on mobile/desktop

### CreateIncentiveModal
- [ ] Validates required fields
- [ ] Calculates preview correctly
- [ ] Handles form submission
- [ ] Shows loading states
- [ ] Displays errors appropriately
- [ ] Calls success callback
- [ ] Resets form on close

## Future Enhancements

### WasteCard
- Add waste image/photo support
- Show transfer count badge
- Add quick actions menu
- Implement card animations

### CreateIncentiveModal
- Add incentive templates
- Support recurring incentives
- Add budget recommendations
- Implement draft saving

## Adding a Story Test

Stories are run as interaction and accessibility tests via the
`@storybook/addon-vitest` Vitest project configured in `frontend/vitest.config.ts`.

### How to add a story test

1. **Create or open the `.stories.tsx` file** for your component (e.g.,
   `src/components/MyWidget.stories.tsx`).

2. **Import the testing helpers** at the top of the file:
   ```tsx
   import { userEvent, within, expect } from '@storybook/test'
   ```

3. **Add a `play` function** to any story that should be tested:
   ```tsx
   export const Default: Story = {
     args: { label: 'Click me' },
     play: async ({ canvasElement }) => {
       const canvas = within(canvasElement)
       const btn = canvas.getByRole('button', { name: /click me/i })
       await expect(btn).toBeInTheDocument()
       await userEvent.click(btn)
       // assert post-interaction state
       await expect(canvas.getByText(/done/i)).toBeInTheDocument()
     },
   }
   ```

4. **Accessibility violations fail automatically.** The `a11y` addon is
   configured with `{ test: 'error' }` in `.storybook/preview.ts`, so any
   serious or critical axe-core violation will fail the story test.

5. **Run story tests** as part of the regular test suite:
   ```bash
   pnpm --filter frontend test
   ```
   Or target the Storybook project only:
   ```bash
   pnpm --filter frontend vitest --project storybook
   ```

### Rules for story tests

- Use `getByRole` and other accessible queries (from `@testing-library/dom`)
  rather than CSS selectors or `data-testid`.
- Keep each `play` function focused on one interaction scenario.
- Do not add `play` functions to purely visual/documentation stories — keep
  those as pure `args`-only stories and test interaction in a dedicated story.

## Related Components

- `Badge` - Status indicators
- `Card` - Layout container
- `AddressDisplay` - Address formatting
- `TransactionConfirmDialog` - Transaction confirmation
- `Select` - Dropdown selector
- `Input` - Form inputs
- `Button` - Action buttons
- `Dialog` - Modal container
