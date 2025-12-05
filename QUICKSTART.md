# Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- No other dependencies required

## Running the Application

1. **Start the services**:
   ```bash
   docker-compose up --build
   ```

   This single command will:
   - Pull PostgreSQL 15 image
   - Create and initialize the database
   - Build the Node.js application
   - Start both services
   - Expose API on `http://localhost:3000`

2. **Verify it's running**:
   ```bash
   curl http://localhost:3000/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-15T10:00:00.000Z"
   }
   ```

## Quick Test

1. **Create an account**:
   ```bash
   curl -X POST http://localhost:3000/api/accounts \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test_user", "currency": "USD"}'
   ```

   Save the `id` from the response.

2. **Deposit money**:
   ```bash
   curl -X POST http://localhost:3000/api/transactions \
     -H "Content-Type: application/json" \
     -d '{
       "account_id": "<account_id_from_step_1>",
       "type": "DEPOSIT",
       "amount": 1000
     }'
   ```

3. **Check balance**:
   ```bash
   curl http://localhost:3000/api/transactions/<account_id>/balance
   ```

## Stopping the Application

Press `Ctrl+C` or run:
```bash
docker-compose down
```

To remove all data (volumes):
```bash
docker-compose down -v
```

## Running Tests

If you want to run tests locally (requires Node.js):

```bash
npm install
npm test
```

## Next Steps

- See `API_EXAMPLES.md` for detailed API usage
- Import `postman_collection.json` into Postman for GUI testing
- Read `README.md` for architecture details

