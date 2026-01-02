# Missing Railway Environment Variables

## Problem
Users are seeing $ (USD) instead of their preferred currency (₪ for Avi, € for Serena) because the preferred currency environment variables are not configured in Railway.

## Solution
Add the following environment variables to Railway:

### Required Environment Variables

| Variable Name | Value |
|--------------|-------|
| `AUTH_USER1_PREFERRED_CURRENCY` | `ILS` |
| `AUTH_USER2_PREFERRED_CURRENCY` | `EUR` |

## How to Add (Railway UI)

1. Go to: https://railway.app
2. Open the project → Service → **Variables** tab.
3. Add each variable:
   - **Name**: `AUTH_USER1_PREFERRED_CURRENCY`
   - **Value**: `ILS`
   - Click **Add**
4. Repeat for `AUTH_USER2_PREFERRED_CURRENCY` with value `EUR`
5. Redeploy the application.

## Expected Result

After adding these variables and redeploying:
- ✅ **Avi** will see all amounts in **₪** (Israeli Shekel)
- ✅ **Serena** will see all amounts in **€** (Euro)
- ✅ No more **$** symbols (unless viewing actual USD transactions)

## Verification

The code is already deployed with the fix. The environment variables are the only missing piece.

Current code behavior:
- `src/lib/auth.ts` reads `process.env.AUTH_USER1_PREFERRED_CURRENCY` (returns `undefined` if not set)
- `src/lib/auth.ts` defaults to `Currency.USD` when undefined
- `src/components/dashboard/dashboard-page.tsx` uses `data.preferredCurrency || Currency.USD`

Without the env vars, it always defaults to USD.
