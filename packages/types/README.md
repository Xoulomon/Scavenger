# @scavngr/types

Shared TypeScript types for the Scavngr ecosystem.

## Overview

This package provides a centralized collection of TypeScript types, interfaces, and enums used across all Scavngr packages including:

- Frontend React application
- Indexer service
- SDK client library
- Backend services

## Installation

```bash
npm install @scavngr/types
```

## Usage

```typescript
import {
  ParticipantRole,
  WasteType,
  Participant,
  Waste,
  ApiResponse,
} from '@scavngr/types'

// Use the shared types in your application
const participant: Participant = {
  address: 'GXXXXXX...',
  role: ParticipantRole.Recycler,
  name: 'John Doe',
  latitude: 40.7128,
  longitude: -74.0060,
  registeredAt: Date.now()
}
```

## Key Type Categories

### Core Enums
- `ParticipantRole` - Recycler, Collector, Manufacturer
- `WasteType` - Paper, Plastic, Metal, Glass, etc.
- `WasteStatus` - Submitted, Verified, Transferred, Deactivated
- `CertificationLevel` - Beginner, Intermediate, Advanced, Expert
- `StellarNetwork` - Testnet, Mainnet, Futurenet, Standalone

### Data Interfaces
- `Participant` - User account information
- `Waste` - Waste item details
- `Incentive` - Reward program configuration
- `WasteTransfer` - Transfer transaction records

### API Types
- `ApiResponse<T>` - Standardized API response wrapper
- `ApiError` - Error response structure
- `QueryResult<T>` - React Query compatible result type

### Form Types
- `RegistrationFormData` - User registration form
- `WasteSubmissionFormData` - Waste submission form
- `WasteTransferFormData` - Waste transfer form

### Configuration
- `ContractConfig` - Stellar contract connection settings
- `NetworkConfig` - Stellar network parameters
- `ClientOptions` - SDK initialization options

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Watch for changes during development
npm run dev

# Type check
npm run type-check
```

## Versioning

This package follows semantic versioning. Breaking changes to type definitions will result in major version bumps to prevent runtime issues in consuming packages.

## Contributing

When adding new types:

1. Ensure they are genuinely shared across multiple packages
2. Use clear, descriptive names and JSDoc comments
3. Group related types together logically
4. Update this README with new type categories
5. Consider backward compatibility for existing consumers