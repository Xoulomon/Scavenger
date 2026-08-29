# Frontend Error Boundary Strategy

Resolves #1050.

## Background

Issue #1050 assumed two error boundary components existed side by side —
`components/ErrorBoundary.tsx` and `components/RouteErrorBoundary.tsx` — and
asked for them to be reconciled into one documented strategy.

On `main`, only `components/ErrorBoundary.tsx` exists. `RouteErrorBoundary.tsx`
was added on a branch (commit `fbdf0d2`, "Add per-route error boundaries")
that was never merged into `main` — it isn't in this branch's history, so
there was no live duplication to resolve. This doc instead formalizes how the
single existing component is meant to be used, and applies it consistently
across the route tree per the issue's acceptance criteria.

## Strategy

`ErrorBoundary` (`frontend/src/components/ErrorBoundary.tsx`) is the only
error-boundary component in the app. It's a standard class component that
catches render-time errors in its subtree, logs them, and shows a fallback
UI with a "Try again" reset action.

It's used at two levels:

1. **App root** (`main.tsx`) — wraps the entire `<App />` tree (inside
   `ThemeProvider`, outside the auth/wallet/contract providers). This is the
   last line of defense: if anything above the router crashes (a provider,
   the router itself), the user sees a fallback instead of a blank page.

2. **Per route** (`router.tsx`) — every route's `element` is individually
   wrapped via a `routeBoundary()` helper. Because each route renders a
   different element, React mounts a fresh `ErrorBoundary` instance on
   navigation, so an error on one page doesn't persist into — or take down —
   the next page, the nav shell (`AppShell`), or sibling routes. A crash in
   one page's render also no longer blanks the shared shell/nav, since the
   boundary sits around just that page's element, not around `AppShell`.

There is deliberately only one component. React Router's data-router APIs
also offer route-level `errorElement` for loader/action errors, but that's a
different failure mode (data loading, not render errors) and isn't needed
here since none of the current routes use loaders/actions.

## Adding a new route

Wrap its element with the existing `routeBoundary()` helper in
`router.tsx`, the same way every other route is wrapped:

```tsx
{ path: 'new-page', element: routeBoundary(<NewPage />) }
```

No new boundary component is needed.
