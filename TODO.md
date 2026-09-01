# TODO: Add Export/Import Functionality (#416)

## Plan
- [x] 1. Create TODO.md
- [ ] 2. Install dependencies (papaparse, jspdf, @types/papaparse)
- [ ] 3. Create `frontend/src/lib/exportImport.ts` utility
- [ ] 4. Create `frontend/src/hooks/useExportImport.ts` hook
- [ ] 5. Create `frontend/src/components/modals/ImportWasteModal.tsx` component
- [ ] 6. Update `frontend/src/pages/AdminDashboardPage.tsx` (add import tab + modal)
- [ ] 7. Update `frontend/src/pages/AnalyticsPage.tsx` (wire real exports)
- [ ] 8. Update `frontend/src/hooks/useAnalyticsExport.ts` (refactor to delegate)
- [ ] 9. Write tests in `frontend/src/hooks/__tests__/useExportImport.test.ts`
- [ ] 10. Run tests and build to verify
