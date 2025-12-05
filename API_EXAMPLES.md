# API Examples - cURL Commands

Base URL: `http://localhost:3000`

## 1. Create Account

### Create USD Account
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "currency": "USD"
  }'
```

### Create INR Account
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "currency": "INR"
  }'
```

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "currency": "USD",
  "balance": 0,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "version": 0
}
```

## 2. Get Account Details

```bash
curl http://localhost:3000/api/accounts/550e8400-e29b-41d4-a716-446655440000
```

## 3. Record Transaction - Deposit

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "DEPOSIT",
    "amount": 1000.50,
    "description": "Initial deposit"
  }'
```

**Response**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "account_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "DEPOSIT",
  "amount": 1000.50,
  "balance_after": 1000.50,
  "related_transaction_id": null,
  "description": "Initial deposit",
  "created_at": "2024-01-15T10:35:00.000Z"
}
```

## 4. Record Transaction - Withdrawal

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "WITHDRAWAL",
    "amount": 200.25,
    "description": "ATM withdrawal"
  }'
```

## 5. Internal Transfer

```bash
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from_account_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_account_id": "770e8400-e29b-41d4-a716-446655440002",
    "amount": 300.00,
    "description": "Payment for services"
  }'
```

**Response**:
```json
{
  "debit_transaction": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "account_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "TRANSFER_DEBIT",
    "amount": 300.00,
    "balance_after": 500.25,
    "related_transaction_id": "990e8400-e29b-41d4-a716-446655440004",
    "description": "Payment for services",
    "created_at": "2024-01-15T10:40:00.000Z"
  },
  "credit_transaction": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "account_id": "770e8400-e29b-41d4-a716-446655440002",
    "type": "TRANSFER_CREDIT",
    "amount": 300.00,
    "balance_after": 300.00,
    "related_transaction_id": "880e8400-e29b-41d4-a716-446655440003",
    "description": "Payment for services",
    "created_at": "2024-01-15T10:40:00.000Z"
  }
}
```

## 6. Get Balance

```bash
curl http://localhost:3000/api/transactions/550e8400-e29b-41d4-a716-446655440000/balance
```

**Response**:
```json
{
  "account_id": "550e8400-e29b-41d4-a716-446655440000",
  "balance": 500.25
}
```

## 7. Get Transaction History

### First Page (default: 20 items)
```bash
curl "http://localhost:3000/api/transactions/550e8400-e29b-41d4-a716-446655440000/history"
```

### With Pagination
```bash
curl "http://localhost:3000/api/transactions/550e8400-e29b-41d4-a716-446655440000/history?page=1&limit=10"
```

**Response**:
```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "account_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "TRANSFER_DEBIT",
      "amount": 300.00,
      "balance_after": 500.25,
      "related_transaction_id": "990e8400-e29b-41d4-a716-446655440004",
      "description": "Payment for services",
      "created_at": "2024-01-15T10:40:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "account_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "DEPOSIT",
      "amount": 1000.50,
      "balance_after": 1000.50,
      "related_transaction_id": null,
      "description": "Initial deposit",
      "created_at": "2024-01-15T10:35:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 2,
  "total_pages": 1
}
```

## 8. Idempotency Example

### First Request
```bash
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-12345" \
  -d '{
    "from_account_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_account_id": "770e8400-e29b-41d4-a716-446655440002",
    "amount": 100.00
  }'
```

### Duplicate Request (Same Idempotency Key)
```bash
# This will return the same response as the first request
# without processing the transfer again
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-12345" \
  -d '{
    "from_account_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_account_id": "770e8400-e29b-41d4-a716-446655440002",
    "amount": 100.00
  }'
```

## 9. Error Examples

### Insufficient Funds
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "WITHDRAWAL",
    "amount": 10000.00
  }'
```

**Response** (400):
```json
{
  "error": "Insufficient funds. Account cannot go negative."
}
```

### Account Not Found
```bash
curl http://localhost:3000/api/accounts/00000000-0000-0000-0000-000000000000
```

**Response** (404):
```json
{
  "error": "Account not found"
}
```

### Different Currency Transfer
```bash
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from_account_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_account_id": "770e8400-e29b-41d4-a716-446655440002",
    "amount": 100.00
  }'
```

**Response** (400):
```json
{
  "error": "Cannot transfer between different currencies"
}
```

## 10. Health Check

```bash
curl http://localhost:3000/health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

