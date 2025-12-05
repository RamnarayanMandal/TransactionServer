# Environment Variables Setup

## Quick Setup

1. **Copy the example file**:
   ```bash
   cp env.example .env
   ```

2. **Edit `.env`** with your configuration (if needed)

## Environment Files

### `.env` (Local Development)
Create this file for local development. It's already in `.gitignore` so it won't be committed.

```env
# Database Configuration
DATABASE_URL=postgresql://ledger_user:ledger_password@localhost:5432/ledger_db

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Logging
LOG_LEVEL=info
```

### `.env.test` (Testing)
For running tests locally:

```env
# Test Database Configuration
DATABASE_URL=postgresql://ledger_user:ledger_password@localhost:5432/ledger_test

# Server Configuration
PORT=3001
NODE_ENV=test

# Logging
LOG_LEVEL=error
```

## Docker Setup

When using Docker Compose, environment variables are set in `docker-compose.yml`. You don't need a `.env` file for Docker deployment.

## Variables Explained

- **DATABASE_URL**: PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database`
  - For Docker: Use `postgres` as hostname
  - For Local: Use `localhost` as hostname

- **PORT**: Server port (default: 3000)

- **NODE_ENV**: Environment mode
  - `development`: Local development
  - `production`: Production (Docker)
  - `test`: Testing

- **LOG_LEVEL**: Logging verbosity (optional)
  - `info`: Normal logging
  - `error`: Only errors
  - `debug`: Detailed logging

