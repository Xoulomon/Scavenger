# Feature Flags Guide

## Active Feature Flags

| Flag | Description | Status | Default |
|------|-------------|--------|---------|
| `solo_mode` | Enable solo mode for testing | Active | false |
| `chat_enabled` | Enable chat functionality | Active | false |
| `new_circuits` | Use new circuit implementations | Active | false |
| `contract_upgrade` | Enable contract upgrade features | Active | false |

## Adding a New Feature Flag

### 1. Define the Flag
```typescript
export const FEATURE_FLAGS = {
  NEW_FEATURE: 'new_feature',
} as const;
import { useFeatureFlag } from '../hooks/useFeatureFlag';

function MyComponent() {
  const isEnabled = useFeatureFlag('new_feature');
  return <div>{isEnabled && <NewFeature />}</div>;
}
it('should show new feature when enabled', () => {
  render(
    <FeatureFlagProvider flags={{ new_feature: true }}>
      <MyComponent />
    </FeatureFlagProvider>
  );
  expect(screen.getByText('New Feature')).toBeInTheDocument();
});
./scripts/audit-feature-flags.sh
./scripts/remove-feature-flag.sh <flag-name>
