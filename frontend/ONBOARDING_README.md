# Onboarding Tutorial

This document describes the interactive onboarding tutorial implemented for new users of the Scavenger platform.

## Features

### 1. Welcome Screen
- **App Overview**: Introduces users to the Scavenger platform and its purpose
- **Role-Specific Content**: Tailored messaging based on user role (Recycler, Collector, Manufacturer, Admin)
- **Skip Option**: Users can skip the tutorial entirely
- **"Don't Show Again"**: Option to permanently disable the tutorial

### 2. Interactive Tooltips
- **Step-by-Step Guidance**: Sequential tooltips highlighting key features
- **Contextual Content**: Each tooltip explains the purpose and usage of specific UI elements
- **Visual Indicators**: Clear highlighting of target elements during tutorial

### 3. Navigation Controls
- **Next/Previous**: Standard navigation between tutorial steps
- **Skip**: Jump to the end of the tutorial at any time
- **Progress Indicator**: Visual progress bar showing completion status

### 4. Role-Specific Tutorials
- **Recycler**: Focuses on waste submission, incentives, and tracking
- **Collector**: Emphasizes collection routes, verification, and waste mapping
- **Manufacturer**: Highlights supply chain monitoring and incentive creation
- **Admin**: Covers platform-wide analytics and management features

### 5. Persistent State
- **localStorage**: Tutorial completion status stored locally
- **Role Awareness**: Different tutorials for different user roles
- **Restart Option**: Available in Settings page

### 6. Mobile Responsive
- **Touch-Friendly**: Optimized for mobile devices
- **Responsive Design**: Adapts to different screen sizes
- **Accessible**: Proper ARIA labels and keyboard navigation

## Technical Implementation

### Core Components

#### `useOnboarding` Hook
Manages onboarding state and persistence:

```typescript
const { state, startOnboarding, completeOnboarding, skipOnboarding, resetOnboarding } = useOnboarding()
```

#### `OnboardingTutorial` Component
Main tutorial component using react-joyride:

```typescript
<OnboardingTutorial
  userRole={userRole}
  isVisible={shouldShowTutorial}
  onComplete={handleTutorialComplete}
/>
```

#### `getOnboardingSteps` Function
Generates role-specific tutorial steps:

```typescript
const steps = getOnboardingSteps('Recycler') // Returns array of Step objects
```

### Data Attributes

UI elements are marked with data attributes for tutorial targeting:

```html
<nav data-onboarding="sidebar">
  <div data-onboarding="search">
    <!-- Search component -->
  </div>
</nav>
```

### State Management

Onboarding state is stored in localStorage:

```json
{
  "completed": false,
  "skipped": false,
  "currentStep": 0,
  "role": "Recycler"
}
```

## Usage

### Automatic Display

The tutorial automatically shows when:
1. User is authenticated
2. User has not completed or skipped the tutorial
3. User's role matches the stored tutorial role (or no role is stored)

### Manual Restart

Users can restart the tutorial from Settings:
1. Navigate to Settings page
2. Find "Onboarding" section
3. Click "Restart Tutorial"
4. Tutorial will show on next login

### Integration

The tutorial is integrated into the main AppShell component:

```typescript
const { isVisible, hideTutorial } = useOnboardingTutorial(user?.role)

return (
  <>
    <AppShell>
      {/* Main app content */}
    </AppShell>
    <OnboardingTutorial
      userRole={user?.role}
      isVisible={isVisible}
      onComplete={hideTutorial}
    />
  </>
)
```

## Customization

### Adding New Steps

To add steps for a new feature:

1. Add data attribute to the target element:
```html
<div data-onboarding="new-feature">
```

2. Add step to the appropriate role in `getOnboardingSteps()`:
```typescript
{
  target: '[data-onboarding="new-feature"]',
  content: (
    <div>
      <h3>New Feature</h3>
      <p>Description of how to use it</p>
    </div>
  ),
  placement: 'bottom',
}
```

### Modifying Content

Update step content in `onboardingSteps.ts` to change tutorial messaging.

### Styling

Customize appearance using the `getOnboardingStyles()` function.

## Testing

Run the onboarding tests:

```bash
npm test src/lib/onboarding.test.tsx
```

Tests cover:
- Hook state management
- localStorage persistence
- Step generation for different roles
- Component interactions
- Integration scenarios

## Browser Support

- Modern browsers with localStorage support
- React Joyride requires ES6+ features
- Progressive enhancement for older browsers

## Future Enhancements

- Video tutorials for complex features
- Advanced analytics tracking tutorial progress
- A/B testing different tutorial flows
- Multi-language support
- Contextual help tooltips (not just onboarding)
