# Feature Flag Cleanup Analysis

## Overview
This document identifies stale feature flags and provides guidance for their removal.

## Flags to Remove

### 1. `enable_analytics`
- **Status:** Stale (always on)
- **Impact:** Low
- **Action:** Remove flag and keep analytics enabled

### 2. `beta_features`
- **Status:** Stale (all features are now stable)
- **Impact:** Low
- **Action:** Remove flag and enable all features

### 3. `ai_assistant`
- **Status:** Never implemented
- **Impact:** None
- **Action:** Remove completely

### 4. `dark_mode` (if not used)
- **Status:** Check usage
- **Impact:** Medium
- **Action:** Keep if used, remove if not

### 5. `notifications_v2`
- **Status:** Implemented and stable
- **Impact:** Low
- **Action:** Remove flag and keep v2

### 6. `api_v2`
- **Status:** Implemented and stable
- **Impact:** Low
- **Action:** Remove flag and keep v2

## Flags to Keep

### 1. `solo_mode`
- **Status:** Active
- **Reason:** Used for feature toggling

### 2. `chat_enabled`
- **Status:** Active
- **Reason:** Used for feature toggling

### 3. `new_circuits`
- **Status:** Active
- **Reason:** Used for feature toggling

### 4. `contract_upgrade`
- **Status:** Active
- **Reason:** Used for feature toggling

## Cleanup Process

### Step 1: Audit Flags
```bash
./scripts/audit-feature-flags.sh
./scripts/remove-feature-flag.sh <flag-name>
# Check flag usage
grep -r "flag_name" src/
# Verify removal
grep -r "flag_name" src/ | wc -l
# Should be 0
// src/config/feature-flags.ts
export const FEATURE_FLAGS = {
  NEW_FEATURE: 'new_feature',
} as const;
// src/components/MyComponent.tsx
import { useFeatureFlag } from '../hooks/useFeatureFlag';

function MyComponent() {
  const isEnabled = useFeatureFlag('new_feature');
  
  return (
    <div>
      {isEnabled && <NewFeature />}
      {!isEnabled && <LegacyFeature />}
    </div>
  );
}
// __tests__/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { FeatureFlagProvider } from '../src/providers/FeatureFlagProvider';

describe('MyComponent', () => {
  it('should show new feature when enabled', () => {
    render(
      <FeatureFlagProvider flags={{ new_feature: true }}>
        <MyComponent />
      </FeatureFlagProvider>
    );
    expect(screen.getByText('New Feature')).toBeInTheDocument();
  });
});
./scripts/audit-feature-flags.sh
./scripts/remove-feature-flag.sh <flag-name>
