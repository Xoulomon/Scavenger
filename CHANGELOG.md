# Changelog

## [Unreleased]

### Removed - Issue #1077
- **Export Endpoints Cleanup**: Removed legacy export formats that had no active client usage.
  - Removed `GET /api/export/excel` - Legacy Excel format
  - Removed `GET /api/export/xml` - Legacy XML format
  - Removed `GET /api/export/pdf` - Legacy PDF format
  - Removed `GET /api/export/legacy` - Legacy endpoint

### Changed - Issue #1077
- **Export Endpoints**: Active export endpoints now support only CSV and JSON formats.
  - `GET /api/export/waste` - CSV and JSON
  - `GET /api/export/users` - CSV and JSON (admin only)
  - `GET /api/export/analytics` - CSV and JSON (admin only)

### Migration Guide
Clients should migrate to the active endpoints:
- Use `format=csv` for CSV data
- Use `format=json` for JSON data

### Date
2024-01-15: Legacy endpoints removed
