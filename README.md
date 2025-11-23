# TinyLink - URL Shortener

A complete URL shortener service built with Node.js, Express, and Neon PostgreSQL, meeting all requirements from the assignment specification.

## Features

✅ **All Core Requirements:**
- Create short links with auto-generated or custom codes
- HTTP 302 redirect with click tracking
- Delete links (returns 404 after deletion)
- Dashboard with search/filter
- Stats page for individual links
- Health check endpoint

✅ **API Endpoints (Exact paths as specified):**
- `POST /api/links` - Create link (409 if code exists)
- `GET /api/links` - List all links  
- `GET /api/links/:code` - Stats for one code
- `DELETE /api/links/:code` - Delete link

✅ **UI/UX Requirements:**
- Clean, responsive design with Tailwind CSS
- Loading, empty, error states
- Form validation with inline feedback
- Copy to clipboard functionality
- Search and filter capabilities

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** Neon PostgreSQL
- **Frontend:** Vanilla JavaScript + Tailwind CSS
- **Deployment:** render + Neon

## Setup & Deployment

### 1. Local Development
```bash
# Clone and install
git clone https://github.com/MahaboobJeelani/tinyurl.git
cd tinylink
npm install

# Initialize database
npm run setup-db

# Start server
npm run dev