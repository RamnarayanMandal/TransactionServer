# Transactional Ledger Service

A simplified internal ledger system that handles money movement between accounts with financial accuracy under high load and failure conditions.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Choice & Schema](#database-choice--schema)
- [Concurrency Strategy](#concurrency-strategy)
- [Features](#features)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Trade-offs & Scalability](#trade-offs--scalability)

## Overview

This service provides a RESTful API for managing financial accounts and transactions with the following capabilities:

- **Create Accounts**: Initialize wallets for users with USD or INR currency
- **Record Transactions**: Deposit or withdraw funds with overdraft protection
- **Internal Transfers**: Atomically move funds between accounts
- **Balance & History**: Retrieve current balance and paginated transaction history

## Architecture

### Technology Stack

- **Language**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Containerization**: Docker & Docker Compose

### System Design

The system follows a **double-entry bookkeeping** approach where:

1. **Accounts** store current balance and version (for optimistic concurrency control)
2. **Transactions** are immutable records that represent all money movements
3. **Balance** is calculated from the sum of transactions (though we also maintain a cached balance for performance)
4. **Idempotency** is handled via a dedicated table that stores request/response pairs

### Key Components

```
src/
├── config/          # Database configuration
├── middleware/      # Idempotency, validation, error handling
├── routes/          # API route handlers
├── services/        # Business logic (AccountService, TransactionService)
├── types/           # TypeScript type definitions
└── utils/           # Utility functions (idempotency key hashing)
```

## Database Choice & Schema

### Why PostgreSQL?

**PostgreSQL** was chosen over MongoDB for the following reasons:

1. **ACID Compliance**: Financial transactions require strict ACID guarantees. PostgreSQL provides:
   - **Atomicity**: Transactions are all-or-nothing
   - **Consistency**: Database constraints ensure data integrity
   - **Isolation**: Row-level locking prevents race conditions
   - **Durability**: Committed transactions are guaranteed to persist

2. **Relational Integrity**: 
   - Foreign key constraints ensure referential integrity
   - Check constraints prevent invalid data (e.g., negative balances)
   - Unique constraints prevent duplicate accounts

3. **Concurrency Control**:
   - `SELECT FOR UPDATE` provides pessimistic locking
   - Optimistic concurrency control via version columns
   - Deadlock detection and resolution

4. **Performance**:
   - Indexes for fast lookups
   - Query optimization for complex joins
   - Connection pooling support

### Schema Design

#### Accounts Table

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    currency VARCHAR(3) CHECK (currency IN ('USD', 'INR')),
    balance DECIMAL(20, 2) CHECK (balance >= 0),
    version INTEGER DEFAULT 0,  -- Optimistic concurrency control
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(user_id, currency)
);
```

**Key Design Decisions**:
- `balance` has a check constraint to prevent negative values at the database level
- `version` column enables optimistic concurrency control
- Unique constraint on `(user_id, currency)` prevents duplicate accounts

#### Transactions Table (Double-Entry Bookkeeping)

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    account_id UUID REFERENCES accounts(id),
    type VARCHAR(20) CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_CREDIT')),
    amount DECIMAL(20, 2) CHECK (amount > 0),
    balance_after DECIMAL(20, 2) CHECK (balance_after >= 0),
    related_transaction_id UUID REFERENCES transactions(id),  -- Links transfer pairs
    description TEXT,
    created_at TIMESTAMP
);
```

**Double-Entry Bookkeeping**:
- Each transfer creates **two linked transactions**: one DEBIT and one CREDIT
- `related_transaction_id` links the pair together
- `balance_after` stores the account balance after each transaction (audit trail)
- Transactions are **immutable** - once created, they cannot be modified

**Why this approach?**
- **Audit Trail**: Complete history of all money movements
- **Reconciliation**: Can verify balances by summing transactions
- **Compliance**: Meets accounting standards for financial systems
- **Debugging**: Easy to trace issues by examining transaction history

#### Idempotency Table

```sql
CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY,
    key_hash VARCHAR(255) UNIQUE,  -- SHA-256 hash of method:path:key
    request_method VARCHAR(10),
    request_path TEXT,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMP,
    expires_at TIMESTAMP
);
```

**Design**:
- Stores hashed idempotency keys to prevent duplicate processing
- 24-hour expiration for automatic cleanup
- Returns cached response for duplicate requests

## Concurrency Strategy

### Problem: Race Conditions

When multiple requests try to modify the same account simultaneously, we must prevent:
- **Double-spending**: Same money being withdrawn twice
- **Negative balances**: Accounts going below zero
- **Lost updates**: Concurrent modifications overwriting each other

### Solution: Pessimistic Locking + Optimistic Concurrency Control

#### 1. Pessimistic Locking (SELECT FOR UPDATE)

For critical operations (transfers, withdrawals), we use PostgreSQL's row-level locking:

```typescript
// Lock the account row
const account = await client.query(
  `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`,
  [accountId]
);
```

**How it works**:
- `FOR UPDATE` locks the row until the transaction commits
- Other transactions trying to lock the same row will wait
- Prevents concurrent modifications

#### 2. Optimistic Concurrency Control (Version Column)

Even with locking, we add a version check to detect concurrent modifications:

```typescript
// Update only if version matches
UPDATE accounts
SET balance = $1, version = version + 1
WHERE id = $2 AND version = $3
```

**How it works**:
- Each account has a `version` number that increments on update
- Update only succeeds if the version matches (no concurrent modification)
- If version mismatch, throw error and client retries

#### 3. Deadlock Prevention

For transfers involving two accounts, we lock accounts in a **consistent order**:

```typescript
// Sort account IDs to ensure consistent locking order
const accountIds = [fromAccountId, toAccountId].sort();
// Lock in sorted order
```

This prevents deadlocks when multiple transfers involve overlapping accounts.

### Example: Concurrent Withdrawals

**Scenario**: 10 simultaneous withdrawal requests for $100 each from an account with $500 balance.

**What happens**:
1. All 10 requests acquire locks sequentially (PostgreSQL queues them)
2. Each request checks balance before withdrawing
3. First 5 succeed (balance: $500 → $400 → $300 → $200 → $100 → $0)
4. Remaining 5 fail with "Insufficient funds" (balance is already $0)
5. Final balance: **$0** (correct, never negative)

**Test Coverage**: See `src/__tests__/integration/raceCondition.test.ts`

## Features

### 1. Create Account

Initialize a wallet for a user with a starting balance of 0.

**Endpoint**: `POST /api/accounts`

**Request**:
```json
{
  "user_id": "user123",
  "currency": "USD"
}
```

**Response**: Account object with generated UUID

### 2. Record Transaction

Deposit or withdraw funds with automatic overdraft protection.

**Endpoint**: `POST /api/transactions`

**Request**:
```json
{
  "account_id": "uuid",
  "type": "DEPOSIT" | "WITHDRAWAL",
  "amount": 100.50,
  "description": "Optional description"
}
```

**Protection**: Rejects withdrawals that would cause negative balance

### 3. Internal Transfer

Atomically move funds from Account A to Account B.

**Endpoint**: `POST /api/transactions/transfer`

**Request**:
```json
{
  "from_account_id": "uuid",
  "to_account_id": "uuid",
  "amount": 200.00,
  "description": "Optional description"
}
```

**Atomicity**: Uses database transaction - if debit fails, credit doesn't happen

### 4. Get Balance

Retrieve current account balance.

**Endpoint**: `GET /api/transactions/:accountId/balance`

**Response**:
```json
{
  "account_id": "uuid",
  "balance": 1500.75
}
```

### 5. Get Transaction History

Retrieve paginated list of transactions.

**Endpoint**: `GET /api/transactions/:accountId/history?page=1&limit=20`

**Response**:
```json
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 45,
  "total_pages": 3
}
```

### 6. Idempotency

All endpoints support idempotency via `Idempotency-Key` header.

**Usage**:
```bash
curl -X POST /api/transactions/transfer \
  -H "Idempotency-Key: unique-key-123" \
  -d '{"from_account_id": "...", ...}'
```

**Behavior**:
- First request: Processes normally, stores response
- Duplicate request: Returns cached response (same transaction ID)
- Expires after 24 hours

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- No local Node.js or PostgreSQL installation required

### Running the Application

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd traction_app
   ```

2. **Start the services**:
   ```bash
   docker-compose up --build
   ```

   This will:
   - Start PostgreSQL database
   - Initialize database schema
   - Build and start the Node.js application
   - Expose API on `http://localhost:3000`

3. **Verify health**:
   ```bash
   curl http://localhost:3000/health
   ```

### Development Setup (Optional)

If you want to run locally without Docker:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   ```

3. **Run database migrations**:
   ```bash
   # Database schema is auto-created via init.sql in Docker
   # For local setup, run init.sql manually
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Run tests**:
   ```bash
   npm test
   ```

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Endpoints

See `API_EXAMPLES.md` or `postman_collection.json` for detailed examples.

## Testing

### Running Tests

```bash
npm test
```

### Test Coverage

- **Unit Tests**: Service layer logic
- **Integration Tests**: Full API endpoints
- **Race Condition Tests**: Concurrent request handling

### Key Test Scenarios

1. **Concurrent Withdrawals**: 10 simultaneous withdrawals, verify balance accuracy
2. **Concurrent Transfers**: 20 simultaneous transfers, verify no double-spending
3. **Idempotency**: Duplicate requests with same key return cached response
4. **Overdraft Protection**: Rejects withdrawals that would cause negative balance
5. **Currency Validation**: Rejects transfers between different currencies

## Trade-offs & Scalability

### Current Design (Suitable for ~1,000-10,000 TPS)

**Strengths**:
- Strong consistency (ACID guarantees)
- Simple architecture
- Easy to reason about
- Good for financial accuracy

**Limitations**:
- Single database becomes bottleneck
- Row-level locking can cause contention
- Synchronous processing

### Scaling to 1 Million TPS

To handle 1 million transactions per second, consider:

#### 1. **Database Sharding**

- **Partition accounts by user_id hash**
- Each shard handles subset of accounts
- Reduces lock contention

```typescript
const shardId = hash(user_id) % numShards;
const db = getShardConnection(shardId);
```

#### 2. **Event Sourcing + CQRS**

- **Write Side**: Append-only event log (Kafka, EventStore)
- **Read Side**: Materialized views for balances
- **Benefits**: 
  - Infinite write scalability
  - Complete audit trail
  - Can replay events for debugging

#### 3. **Asynchronous Processing**

- **Immediate**: Return transaction ID, process async
- **Queue**: Use message queue (RabbitMQ, Kafka) for transfers
- **Eventual Consistency**: Balance updates may lag slightly

#### 4. **Caching Layer**

- **Redis**: Cache hot account balances
- **Write-through**: Update cache on balance changes
- **Reduces database load**

#### 5. **Read Replicas**

- **Master-Slave**: Write to master, read from replicas
- **Geographic Distribution**: Replicas in different regions
- **Reduces read load on master**

#### 6. **Optimistic Concurrency with Retries**

- Remove `FOR UPDATE` locks (too slow)
- Use version-based updates with exponential backoff
- Accept occasional conflicts, retry automatically

#### 7. **Microservices Architecture**

- **Account Service**: Manages accounts
- **Transaction Service**: Processes transactions
- **Ledger Service**: Maintains immutable ledger
- **Notification Service**: Sends confirmations

#### 8. **Database Choice Re-evaluation**

For extreme scale, consider:
- **CockroachDB**: Distributed SQL with strong consistency
- **ScyllaDB**: High-performance NoSQL (if eventual consistency acceptable)
- **Custom Solution**: In-memory ledger with periodic snapshots

### Recommended Architecture for 1M TPS

```
┌─────────────┐
│   API GW    │
└──────┬──────┘
       │
       ├───┐
       │   │
   ┌───▼───▼───┐
   │  Kafka    │  ← Event log (append-only)
   └───┬───────┘
       │
   ┌───▼───────────┐
   │ Transaction  │  ← Process events
   │  Processors  │
   └───┬───────────┘
       │
   ┌───▼───────┐     ┌──────────────┐
   │ PostgreSQL │◄────┤ Read Replicas│
   │  (Sharded) │     └──────────────┘
   └───────────┘
       │
   ┌───▼───────┐
   │   Redis   │  ← Cache balances
   └───────────┘
```

**Key Changes**:
1. **Kafka** for event streaming (unlimited write throughput)
2. **Sharded PostgreSQL** for account storage
3. **Redis** for balance caching
4. **Read replicas** for scaling reads
5. **Async processing** for non-critical paths

**Trade-offs**:
- **Complexity**: Much more complex system
- **Latency**: Some operations become eventually consistent
- **Cost**: Requires significant infrastructure
- **Consistency**: May need to accept eventual consistency for some operations

## License

ISC

## Author

[Your Name]
[Your Designation]

