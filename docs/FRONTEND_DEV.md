# Frontend Developer Guide

A quick-start reference for contributors to the Scavenger frontend.

---

## Project Structure

```
frontend/src/
├── api/            # ScavengerClient, types, and API index
├── components/
│   ├── layout/     # AppShell, navigation
│   ├── modals/     # Transaction modals (RegisterWaste, TransferWaste, CreateIncentive)
│   └── ui/         # Reusable primitives (Button, Card, Dialog, TransactionConfirmDialog…)
├── context/        # React Context providers (Auth, Wallet, Contract, Theme)
├── hooks/          # Custom hooks for contract mutations and queries
├── lib/            # Utilities, contract re-export, Stellar helpers, error parsing
├── pages/          # One file per route
├── router.tsx      # React Router config with lazy-loaded pages
├── main.tsx        # App entry point, providers, QueryClient setup
└── index.css       # Tailwind base styles
```

---

## Feature Modules

New domain code goes in `frontend/src/features/<domain>/`, not in `pages/`,
`components/` or `hooks/`. Decision and alternatives: [ADR 0009](adr/0009-feature-folder-layout.md).

```
features/<domain>/
  components/   React components owned by the domain
  hooks/        React hooks owned by the domain
  api/          Network calls and query keys
  schemas/      Validation schemas and types for the domain's input
  __tests__/    Tests for the domain
  index.ts      The public surface. The only file other code may import.
```

Import a feature only through its `index.ts`:

```ts
import { BADGES } from '@/features/gamification'      // allowed
import { BADGES } from '@/features/gamification/badges' // lint error (no-restricted-imports)
```

Existing `features/gamification` and `features/importWaste` are not yet in this
layout. Migrate a domain when you next change it.

## State Management

The app uses two complementary layers:

**React Context** — for global, low-frequency state:
- `AuthContext` — authenticated user (address, role, name), persisted to `localStorage`.
- `WalletContext` — Freighter wallet connection state and `connect`/`disconnect` helpers.
- `ContractContext` — active RPC URL, network, and contract ID (can be changed in Settings).

**TanStack React Query** — for all server/contract state:
- Queries cache on-chain reads (participant info, waste lists, incentives).
- Mutations handle write transactions and automatically invalidate related queries on success.
- Global error toasts are wired in `main.tsx` via `QueryCache` / `MutationCache` `onError`.

---

## Adding a New Page

1. Create `src/pages/MyNewPage.tsx` and export a named component:

```tsx
export function MyNewPage() {
  return <div>My new page</div>
}
```

2. Add a lazy import in `src/router.tsx`:

```tsx
const MyNewPage = lazy(() =>
  import('@/pages/MyNewPage').then((m) => ({ default: m.MyNewPage }))
)
```

3. Add a route inside the protected `children` array (or at the top level for public routes):

```tsx
{ path: 'my-page', element: <MyNewPage /> },
```

The `PageFallback` wrapper in `ProtectedLayout` automatically shows a skeleton while the chunk loads.

---

## Adding a New Contract Integration

All contract calls go through `ScavengerClient` in `src/api/client.ts`. The pattern is:

### Read (query)

```ts
// src/hooks/useMyData.ts
import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'

export function useMyData() {
  const { address } = useWallet()
  const { config } = useContract()

  return useQuery({
    queryKey: ['my-data', address],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.myReadMethod(address!)
    },
    enabled: !!address,
  })
}
```

### Write (mutation)

```ts
// src/hooks/useMyAction.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'

export function useMyAction() {
  const { address } = useWallet()
  const { config } = useContract()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { foo: string }) => {
      if (!address) throw new Error('Wallet not connected.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.myWriteMethod(params.foo, address)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data'] })
    },
  })
}
```

If the action requires a confirmation step before signing, use `TransactionConfirmDialog`:

```tsx
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'

// In your modal/page:
<TransactionConfirmDialog
  open={showConfirm}
  action="My Action"
  params={[{ label: 'Param', value: someValue }]}
  isPending={mutation.isPending}
  onConfirm={() => mutation.mutate(params)}
  onCancel={() => setShowConfirm(false)}
/>
```

### Adding a new method to ScavengerClient

Add the method to `src/api/client.ts` following the existing pattern:

```ts
async myWriteMethod(arg: string, signer: string): Promise<void> {
  return this.invoke<void>(
    'my_contract_fn',
    [nativeToScVal(arg, { type: 'string' })],
    signer
  )
}
```

- Pass `signer` for mutating calls (triggers Freighter signing).
- Omit `signer` for read-only calls (simulation only).

---

## Running Locally

```bash
cd frontend
cp .env.example .env   # fill in CONTRACT_ID and RPC_URL
npm install
npm run dev
```

Lint and format:

```bash
npm run lint
npm run format
```
