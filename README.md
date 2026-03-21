# Clockify Timesheet Generator

A serverless web application that converts Clockify CSV exports into professional, print-ready timesheets with intelligent pagination and banking details.

## Features

- **CSV Import**: Upload Clockify time entries and automatically generate formatted timesheets
- **Smart Pagination**: Intelligent page breaking that keeps related content together
- **Print-Ready Output**: Optimized A4 layout with proper page margins and breaks
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Zero Dependencies**: Runs entirely on Cloudflare Workers edge network

## Technical Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Frontend**: React 18 (via CDN)
- **Styling**: Inline styles with print media queries
- **CSV Parsing**: PapaParse
- **Deployment**: Wrangler CLI

## Key Implementation Details

- Serverless architecture with sub-50ms response times
- Smart chunking algorithm that estimates content height by complexity
- Dynamic reserve space calculation for totals and banking details
- South African date/currency formatting (en-ZA locale)
- Pure functional React components with minimal state management

## Deployment

```bash
npm install -g wrangler
wrangler deploy
```

## Credit

This project was created primarily with the use of Claude Opus 4.6. 

The human developer provided requirements, reviewed outputs, and guided architectural decisions, while Claude handled implementation details, edge case handling, and bug fixes.
