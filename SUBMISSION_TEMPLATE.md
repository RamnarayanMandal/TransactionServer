# Transactional Ledger Service - Submission Document

## Personal Information

**Name**: [Your Name]  
**Designation**: [Your Designation]

## Git Repository

**Repository URL**: [Your GitHub/GitLab Repository Link]

---

## Project Overview

This project implements a simplified internal ledger system that handles money movement between accounts with financial accuracy under high load and failure conditions. The system is built using Node.js with TypeScript, Express.js, and PostgreSQL.

## Key Features Implemented

### Functional Requirements

✅ **Create Account**: Initialize wallets for users with USD or INR currency  
✅ **Record Transaction**: Deposit/Withdrawal with overdraft protection  
✅ **Internal Transfer**: Atomic money movement between accounts  
✅ **Get Balance & History**: Retrieve balance and paginated transaction history  

### Technical Challenges

✅ **Concurrency & Race Conditions**: Implemented using PostgreSQL row-level locking (`SELECT FOR UPDATE`) combined with optimistic concurrency control (version column)  
✅ **Idempotency**: Full support via `Idempotency-Key` header with 24-hour caching  
✅ **Double-Entry Bookkeeping**: All transfers create linked DEBIT/CREDIT transaction pairs  

### Non-Functional Requirements

✅ **Dockerized**: Single command deployment (`docker-compose up`)  
✅ **Testing**: Comprehensive integration tests including race condition scenarios  
✅ **Strict Typing**: Full TypeScript with Zod validation  

## Architecture Highlights

### Database Choice: PostgreSQL

**Why PostgreSQL over MongoDB?**

1. **ACID Compliance**: Financial transactions require strict ACID guarantees
2. **Relational Integrity**: Foreign keys and check constraints ensure data integrity
3. **Concurrency Control**: Row-level locking prevents race conditions
4. **Performance**: Optimized for complex queries and transactions

### Concurrency Strategy

**Problem**: Prevent double-spending and negative balances under concurrent load.

**Solution**: 
- **Pessimistic Locking**: `SELECT FOR UPDATE` locks account rows during transactions
- **Optimistic Concurrency Control**: Version column detects concurrent modifications
- **Deadlock Prevention**: Consistent locking order for multi-account operations

**Test Results**: Successfully handles 10+ concurrent withdrawals without negative balances.

### Double-Entry Bookkeeping

Instead of just updating a balance column, the system maintains an immutable transaction ledger:

- Each transfer creates **two linked transactions** (DEBIT and CREDIT)
- `related_transaction_id` links transfer pairs
- `balance_after` stores audit trail
- Balance can be verified by summing transactions

**Benefits**:
- Complete audit trail
- Reconciliation capability
- Compliance with accounting standards

## Scalability Considerations

### Current Design (1,000-10,000 TPS)

- Single PostgreSQL database
- Row-level locking
- Synchronous processing
- Strong consistency

### Scaling to 1 Million TPS

Key changes needed:

1. **Database Sharding**: Partition accounts by user_id hash
2. **Event Sourcing**: Append-only event log (Kafka) for writes
3. **CQRS**: Separate read/write models with materialized views
4. **Caching**: Redis for hot account balances
5. **Read Replicas**: Geographic distribution for reads
6. **Async Processing**: Queue-based transaction processing
7. **Microservices**: Split into Account, Transaction, Ledger services

**Trade-offs**:
- Increased complexity
- Eventual consistency for some operations
- Higher infrastructure costs
- Lower latency for some paths

## Testing

### Test Coverage

- ✅ Unit tests for services
- ✅ Integration tests for all API endpoints
- ✅ Race condition tests (10+ concurrent requests)
- ✅ Idempotency tests
- ✅ Error handling tests

### Running Tests

```bash
npm test
```

## Getting Started

### Quick Start

```bash
docker-compose up --build
```

That's it! The system will be available at `http://localhost:3000`

### API Documentation

- **cURL Examples**: See `API_EXAMPLES.md`
- **Postman Collection**: Import `postman_collection.json`

## Project Structure

```
traction_app/
├── src/
│   ├── config/          # Database configuration
│   ├── middleware/      # Idempotency, validation, error handling
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   ├── types/           # TypeScript definitions
│   └── utils/           # Utility functions
├── src/__tests__/       # Integration tests
├── docker-compose.yml   # Docker orchestration
├── Dockerfile           # Application container
├── init.sql            # Database schema
├── README.md           # Full documentation
├── API_EXAMPLES.md     # cURL examples
└── postman_collection.json  # Postman collection
```

## Key Design Decisions

1. **PostgreSQL**: Chosen for ACID guarantees and relational integrity
2. **Double-Entry Bookkeeping**: Immutable transaction ledger for audit trail
3. **Pessimistic + Optimistic Locking**: Prevents race conditions while maintaining performance
4. **Idempotency Table**: Stores request/response pairs to prevent duplicate processing
5. **Version Column**: Enables optimistic concurrency control

## Deliverables Checklist

- ✅ Source code in Git repository
- ✅ Architecture/Design document (README.md)
- ✅ DB choice & schema explanation
- ✅ Concurrency strategy documentation
- ✅ Scalability trade-offs discussion
- ✅ Postman collection (postman_collection.json)
- ✅ cURL commands (API_EXAMPLES.md)
- ✅ Docker setup (docker-compose.yml)
- ✅ Integration tests including race conditions

## Conclusion

This implementation provides a robust, financially accurate ledger system that handles concurrent operations correctly while maintaining data integrity. The architecture is designed to scale from thousands to millions of transactions per second with appropriate modifications.

---

**Repository**: [Your Repository Link]  
**Documentation**: See README.md for complete architecture details

