# Data Export

## Overview

Export platform data in multiple formats for analysis and reporting.

## Supported Formats

- **CSV** - Comma-separated values for spreadsheet applications
- **JSON** - Structured JSON format for programmatic access
- **PDF** - Formatted PDF documents for printing and archiving

## API Endpoints

### Export Waste Data
```
GET /api/export/waste?format=csv
GET /api/export/waste?format=json
GET /api/export/waste?format=pdf
```

Query Parameters:
- `format` (required): `csv`, `json`, or `pdf`
- `start_date` (optional): ISO 8601 date (e.g., 2024-01-01)
- `end_date` (optional): ISO 8601 date (e.g., 2024-12-31)
- `waste_type` (optional): Filter by waste type
- `participant_id` (optional): Filter by participant

### Export Participant Stats
```
GET /api/export/stats?format=json
GET /api/export/stats?format=csv
```

### Export Incentives
```
GET /api/export/incentives?format=json
```

## CSV Format

```
ID,Waste Type,Weight,Status,Created At
waste_001,Plastic,5.5,Verified,2024-05-30T10:00:00Z
waste_002,Metal,2.3,Transferred,2024-05-30T11:00:00Z
```

## JSON Format

```json
[
  {
    "id": "waste_001",
    "waste_type": "Plastic",
    "weight": 5.5,
    "status": "Verified",
    "created_at": "2024-05-30T10:00:00Z"
  },
  {
    "id": "waste_002",
    "waste_type": "Metal",
    "weight": 2.3,
    "status": "Transferred",
    "created_at": "2024-05-30T11:00:00Z"
  }
]
```

## PDF Format

PDF exports include:
- Header with export date and time
- Summary statistics
- Detailed data table
- Footer with page numbers

## Usage Examples

### Export all waste as CSV
```bash
curl -X GET "http://localhost:8080/api/export/waste?format=csv" \
  -H "Authorization: Bearer ${YOUR_API_TOKEN}" \
  -o waste_export.csv
```

### Export waste from specific date range as JSON
```bash
curl -X GET "http://localhost:8080/api/export/waste?format=json&start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer ${YOUR_API_TOKEN}" \
  -o waste_export.json
```

### Export participant statistics as PDF
```bash
curl -X GET "http://localhost:8080/api/export/stats?format=pdf" \
  -H "Authorization: Bearer ${YOUR_API_TOKEN}" \
  -o stats_export.pdf
```

## File Size Limits

- CSV: Up to 100 MB
- JSON: Up to 50 MB
- PDF: Up to 25 MB

Larger exports should be requested with date range filters.

## Performance

Export operations are asynchronous for large datasets. The API returns:

```json
{
  "export_id": "exp_123",
  "status": "processing",
  "download_url": "https://api.example.com/exports/exp_123/download",
  "expires_at": "2024-05-31T10:00:00Z"
}
```

Check status:
```bash
GET /api/exports/exp_123/status
```

Download when ready:
```bash
GET /api/exports/exp_123/download
```
