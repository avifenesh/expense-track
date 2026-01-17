# Decimal Precision Standards

This document explains the decimal precision choices in the database schema.

## Overview

The application handles financial data with different precision requirements:
- Currency amounts (USD, EUR, ILS) need 2 decimal places
- Asset quantities (stocks, crypto) need higher precision for fractional holdings
- Percentages need moderate precision for expense splitting

## Precision Types

### Monetary Amounts: `Decimal(12, 2)`

Used for all standard currency values.

**Fields:**
- `Transaction.amount`
- `Budget.planned`
- `SharedExpense.totalAmount`
- `ExpenseParticipant.shareAmount`
- `Holding.averageCost`
- `RecurringTemplate.amount`

**Specifications:**
- 12 total digits, 2 decimal places
- Range: -9,999,999,999.99 to 9,999,999,999.99
- Handles amounts up to ~$10 billion

**Rationale:**
Standard currencies (USD, EUR, ILS) have 2 decimal places. The 12-digit total provides headroom for aggregations and prevents overflow in budget summaries.

### Asset Quantities: `Decimal(18, 6)`

Used for holding quantities that may be fractional.

**Fields:**
- `Holding.quantity`

**Specifications:**
- 18 total digits, 6 decimal places
- Supports fractional shares (e.g., 0.123456 shares)
- Handles cryptocurrency with high precision

**Rationale:**
Brokerages now support fractional share purchasing. Cryptocurrencies like Bitcoin are often held in small fractions. Six decimal places handles most use cases while 18 total digits support large holdings.

### Percentages: `Decimal(5, 2)`

Used for percentage splits.

**Fields:**
- `ExpenseParticipant.sharePercentage`

**Specifications:**
- 5 total digits, 2 decimal places
- Range: 0.00 to 999.99
- Allows percentages over 100% for edge cases

**Rationale:**
Two decimal places provide sufficient precision for percentage splits (e.g., 33.33%). The range above 100% handles edge cases where shares may be adjusted.

## Code Patterns

### Converting Numbers to Decimals

Always use `toDecimalString()` when creating Prisma Decimal values:

```typescript
import { Prisma } from '@prisma/client'
import { toDecimalString } from '@/utils/decimal'

// For monetary amounts (2 decimal places)
amount: new Prisma.Decimal(toDecimalString(100.50))

// For quantities (6 decimal places)
quantity: new Prisma.Decimal(quantity.toFixed(6))
```

### Decimal Comparisons

Prisma Decimal values should be converted before comparison:

```typescript
// Convert to number for comparisons
const amount = holding.quantity.toNumber()

// Or compare strings for exact equality
if (budget.planned.toString() === '0.00') { ... }
```

## Migration Notes

**Do not change precision without migration:**
- Changing `Decimal(12, 2)` to `Decimal(10, 2)` could cause data loss
- Always test with production-scale data before applying precision changes
- Create a new field and migrate data rather than altering existing precision
