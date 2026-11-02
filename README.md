# ForgeQuality

ForgeQuality is a database-backed manufacturing quality and production monitoring application. It provides role-aware authentication, production and nonconformance registers, inspection outcomes, equipment/issue tracking, maintenance work orders, downtime recording, reports, and equipment QR codes.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and replace every placeholder. Use a unique URL-safe database password, a long random signing key, and an initial administrator password of at least 12 characters.
2. Start the stack: `docker compose up --build`.
3. Open the application at [http://localhost:8080](http://localhost:8080). The API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).
4. Sign in with the administrator username and password set in `.env`. The bootstrap administrator is created only when the users table is empty. Administrators can provision role-specific accounts through `POST /api/auth/users`.

The backend runs Alembic migrations before starting. PostgreSQL data is persisted in the `postgres_data` volume.

## Local development

- API: from `backend`, run `pip install -r requirements.txt`, set `DATABASE_URL`, `SECRET_KEY`, `INITIAL_ADMIN_USERNAME`, and `INITIAL_ADMIN_PASSWORD`, run `alembic upgrade head`, then run `uvicorn app.main:app --reload`.
- UI: from `frontend`, run `npm install` and `npm run dev`. Set `VITE_API_URL` if the API is not served by the same origin.
- Backend tests: from `backend`, run `pytest`.
- Frontend build/tests: from `frontend`, run `npm run build` and `npm test`.

## API modules

All operational endpoints require a bearer token obtained from `POST /api/auth/login`. Modules are available at `/api/production`, `/api/defects`, `/api/inspections`, `/api/equipment`, `/api/issues`, `/api/downtime`, and `/api/maintenance`. Records support listing/search, validated creation, and status/field updates. Failed inspections derive pass/fail from configured lower and upper limits and can create linked nonconformance records. Reporting an equipment issue as stopped creates a separate downtime event; reporting an issue does not otherwise imply downtime.

Defect reports accept multiple image attachments from a camera or device library, by file picker or drag-and-drop. Common raster photo formats, including HEIC/HEIF, are validated and kept in PostgreSQL with a browser-friendly preview; original photos remain available to download. The current limit is 10 photos per defect, 10 MB each, and 40 MB per upload request.

## KPI definitions and current scope

- Yield = good units / actual production units.
- Defect rate = defective quantity / inspected quantity recorded on defect reports.
- Inspection pass rate = passed inspection records / all inspection records.
- Downtime duration is elapsed time from start to end, or to the current time for an open event. Overlapping events are merged per equipment asset before reporting plant asset-hours. Availability and MTBF are intentionally omitted until reliable planned operating-time and failure-event data are available.
- Records are linked to production batches and assets using their batch identifiers and equipment record IDs. Additional customer-specific sampling plans, audit trails, attachment storage, notification delivery, and ERP/MES integrations require deployment configuration and extensions.

## Production deployment notes

Protect bootstrap credentials, rotate secrets, use TLS at the ingress, and configure restricted origins and database backups. The initial admin is created automatically only when the user table is empty. For regulated production use, add approved identity lifecycle, immutable audit history, file storage/scanning, and alert-delivery integrations.
