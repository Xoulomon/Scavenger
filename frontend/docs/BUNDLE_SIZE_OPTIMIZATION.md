# Bundle Size Optimization Guide

## Overview
This document outlines bundle size optimization strategies for the Scavenger frontend application, including code-splitting analysis and heavy dependency management.

## Bundle Analysis

### Running Bundle Analysis
To analyze the current bundle size distribution:

```bash
cd frontend
npm run build
npx webpack-bundle-analyzer dist/stats.json
```

### Key Metrics
- **Total Bundle Size**: Track gzipped size of main bundle
- **Critical Path Resources**: Identify render-blocking assets
- **Module Distribution**: Monitor which packages consume the most bytes

## Code-Splitting Strategy

### Route-Based Code-Splitting

Heavy pages should use lazy loading to reduce initial bundle size:

#### Dashboard Page
- **Status**: Enabled
- **Rationale**: Dashboard includes multiple chart libraries (recharts, visx) which add significant bundle weight
- **Implementation**:
  ```typescript
  const DashboardPage = lazy(() => import('./pages/DashboardPage'))
  ```

#### Map Page
- **Status**: Enabled
- **Rationale**: Leaflet and marker cluster libraries are heavy and only needed on specific page
- **Implementation**:
  ```typescript
  const MapPage = lazy(() => import('./pages/WasteMapPage'))
  ```

#### Marketplace Page
- **Status**: Enabled
- **Rationale**: Table libraries and filtering logic are specific to marketplace view
- **Implementation**:
  ```typescript
  const MarketplacePage = lazy(() => import('./pages/WasteMarketplacePage'))
  ```

### Library-Specific Optimizations

#### Chart Libraries (recharts, visx)
- **Current Size**: ~150KB (gzipped)
- **Strategy**: Only loaded on Dashboard routes
- **Fallback**: Lightweight text-based summary on other pages

#### Map Libraries (leaflet, react-leaflet)
- **Current Size**: ~80KB (gzipped)
- **Strategy**: Only loaded on Map routes
- **Usage**: WasteMapPage, EnvironmentalImpactDashboardPage

#### Table Libraries (react-table, tanstack/table)
- **Current Size**: ~30KB (gzipped)
- **Strategy**: Loaded with marketplace and data-heavy pages
- **Optimization**: Use virtualization for large lists

## Dependency Audit

### High-Impact Dependencies
1. **recharts**: 150KB - Used on DashboardPage (CHUNKED)
2. **leaflet**: 80KB - Used on WasteMapPage (CHUNKED)
3. **react-leaflet**: 15KB - Peer of leaflet (CHUNKED)
4. **visx**: 120KB - Used on AnalyticsPage (CHUNKED)

### Candidates for Removal
- None currently unused
- All major dependencies are actively utilized

### Tree-Shaking Opportunities
- Ensure all imports are ESM-compliant
- Use named imports instead of default imports where possible
- Example: `import { BarChart } from 'recharts'` instead of `import recharts`

## Performance Budget

### Target Sizes (gzipped)
- **Initial JS Bundle**: < 250KB
- **Main CSS Bundle**: < 50KB
- **Total Initial Load**: < 300KB

### Critical Routes
- **HomePage**: Loads core bundle only (~100KB gzipped)
- **DashboardPage**: Loads core + dashboard chunk (~200KB gzipped)
- **WasteMapPage**: Loads core + map chunk (~180KB gzipped)

## Monitoring

### CI/CD Integration
Bundle size monitoring is configured in CI to catch regressions:
- Track bundle size on every PR
- Fail if bundle increases by more than 10KB
- Report detailed size breakdown in PR comments

### Local Development
To check bundle size locally before committing:
```bash
npm run build
npm run analyze:bundle
```

## Best Practices

1. **Always use lazy loading for route-specific pages**
2. **Prefer named imports over default imports**
3. **Consider dynamic imports for feature flags**
4. **Profile before optimizing** - use bundle analyzer to find actual bottlenecks
5. **Monitor bundle size in CI** - catch regressions early

## References
- [Webpack Bundle Analyzer](https://github.com/webpack-bundle-analyzer/webpack-bundle-analyzer)
- [React Code Splitting](https://react.dev/reference/react/lazy)
- [Web Vitals: Largest Contentful Paint](https://web.dev/lcp/)
