---
paths: ["src/app/actions/**"]
---

# Server Actions Rules

## Action Pipeline (Required Order)

Every mutating server action MUST follow this exact pipeline:

```typescript
export async function someAction(input: SomeInput) {
  // 1. Parse and validate input with Zod schema
  const parsed = parseInput(someSchema, input)
  if ('error' in parsed) return parsed

  // 2. Validate CSRF token (mutating actions only)
  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // 3. Check subscription status (if gated)
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  // 4. Authenticate user
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // 5. Authorize (verify ownership/access)
  // e.g., check account.userId === authUser.id

  // 6. Execute business logic in try/catch
  try {
    // ... Prisma operations
    revalidatePath('/')
    return success({ ... }) // or successVoid()
  } catch (error) {
    return handlePrismaError(error, { ... })
  }
}
```

## Return Types

Import from `@/lib/action-result`:

```typescript
// Success with data
return success({ id: created.id })

// Success without data
return successVoid()

// Field-level errors
return { error: { fieldName: ['Error message'] } }

// General errors
return generalError('Something went wrong')
```

## Shared Utilities

From `./shared.ts`:
- `parseInput(schema, input)` - Zod validation
- `toDecimalString(number)` - Convert to 2-decimal string for Prisma.Decimal
- `requireCsrfToken(token)` - CSRF validation
- `requireAuthUser()` - Get authenticated user
- `requireActiveSubscription()` - Check subscription status
- `ensureAccountAccess(accountId)` - Verify account ownership
- `ensureAccountAccessWithSubscription(accountId)` - Combined check

## Schema Requirements

All schemas in `src/schemas/` must include:
- `csrfToken: z.string()` for mutating actions
- Proper field constraints matching Prisma schema

## Cache Invalidation

After mutations:
```typescript
import { revalidatePath } from 'next/cache'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

revalidatePath('/')
await invalidateDashboardCache({ monthKey, accountId })
```

## Error Handling

Always use `handlePrismaError`:
```typescript
return handlePrismaError(error, {
  action: 'actionName',
  userId: authUser.id,
  input: data,
  uniqueMessage: 'Custom unique constraint message',
  foreignKeyMessage: 'Custom FK violation message',
  fallbackMessage: 'Generic error message',
})
```
