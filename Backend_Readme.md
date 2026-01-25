Nudge Backend (FastAPI)

This repository contains the backend for Nudge, built with FastAPI and PostgreSQL.
At this stage, the backend provides:

A running FastAPI service

A health check endpoint

Database connectivity to Postgres (local Docker or Neon)

A verified database connection smoke test

No database tables or models exist yet.

Tech Stack

Python 3.11+

FastAPI – HTTP API framework

SQLAlchemy 2.0 (sync) – database engine and sessions

PostgreSQL – database (local Docker for dev, Neon in prod)

pytest – tests

Docker – local Postgres for development only

Project Structure (Current)
app/
  main.py        # FastAPI app entrypoint
  settings.py    # Environment configuration
  db.py          # Database engine + session dependency
tests/
  test_health.py     # Health endpoint test
  test_db_smoke.py   # DB connectivity smoke test
requirements.txt
requirements-dev.txt
README.md

Environment Variables
Required

The backend will not start unless this is set:

DATABASE_URL

Examples

Local Docker Postgres

postgresql+psycopg://postgres:postgres@localhost:5432/nudge


Neon (SSL required)

postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require


The backend fails fast with a clear error if DATABASE_URL is missing.

Local Development Setup
1. Start Postgres (Docker)
docker-compose up -d


This starts a local Postgres database for development.

2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
.venv\Scripts\activate       # Windows

3. Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

4. Set environment variables

Create a .env file:

DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/nudge

5. Run the API
uvicorn app.main:app --reload


Visit:

http://localhost:8000/health


Expected response:

{"status":"ok"}

Database Connectivity (What Exists Today)

One shared SQLAlchemy engine

Conservative connection pooling (safe for Neon free tier)

A get_db() FastAPI dependency for future endpoints

No models, tables, or migrations yet

No database writes yet

This is intentional: schema and ingestion logic come next.

Running Tests
pytest

Tests included:

Health test – verifies API boots

DB smoke test – opens a DB connection and runs SELECT 1

If DATABASE_URL is not set, the DB test is skipped.

What Is NOT Implemented Yet

Database tables or models

Alembic migrations

Item ingestion endpoints

Background workers

Authentication logic

URL extraction logic

These will be added step-by-step next.

Next Planned Steps

Add Alembic wired to the same DATABASE_URL

Create the core tables (users, items, item_content, extraction_attempts)

Implement POST /items

Add background worker for URL extraction

Implement fallback pasted-text flow