# Scavenger Indexer

Stellar blockchain indexer for the Scavenger recycling platform.

## Directory Structure

```
src/
├── db/                    # Database layer
│   ├── client.ts         # Connection pooling and transaction management
│   ├── migrate.ts        # Database migrations
│   └── queryOptimizer.ts # Query performance monitoring and optimization
├── errors/               # Error handling
│   ├── AppError.ts       # Centralized error types and handling
│   └── index.ts          # Error exports
├── handlers/             # Event handlers
│   ├── dispatcher.ts     # Event routing
│   └── eventHandlers.ts  # Contract event processors
├── queries/              # Query functions
│   └── search.ts         # Search and aggregation queries
├── stellar/              # Stellar integration
│   └── streamer.ts       # Event streaming from Stellar
├── sync/                 # Synchronization
│   └── syncStatus.ts     # Sync state management
├── utils/                # Utility functions
│   ├── validators.ts     # Input validation
│   ├── formatters.ts     # Data formatting
│   └── index.ts          # Utility exports
├── types.ts              # Type definitions
├── indexer.ts            # Main indexer logic
└── index.ts              # Entry point
```

## Key Modules

### Database (`db/`)

- Connection pooling with automatic retry
- Transaction support with rollback
- Query performance monitoring
- Optimized indexes for common queries

### Error Handling (`errors/`)

- Typed error codes for consistency
- Specific error classes for different scenarios
- Error serialization for API responses
- Automatic error recovery

### Utilities (`utils/`)

- Address, waste type, and role validation
- Data formatting (addresses, weights, dates)
- Reusable validation and formatting functions

### Event Handlers (`handlers/`)

- Processes contract events from Stellar
- Maintains database state in sync with blockchain
- Supports batch operations

## Usage

```typescript
import { getPool, withTransaction } from './db/client'
import { ensureIndexes } from './db/queryOptimizer'
import { ValidationError } from './errors'
import { isValidAddress } from './utils'

// Initialize database
const pool = getPool()
await ensureIndexes(pool)

// Use transactions
await withTransaction(async (client) => {
  // Your database operations
})
```

## Performance

- Query metrics tracked automatically
- Slow queries logged with threshold (100ms default)
- Composite indexes for common filter combinations
- Connection pooling for efficient resource usage
