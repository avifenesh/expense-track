# Missing Vercel Environment Variables

## Problem
Users are seeing $ (USD) instead of their preferred currency (₪ for Avi, € for Serena) because the preferred currency environment variables are not configured in Vercel.

## Solution
Add the following environment variables to Vercel:

### Required Environment Variables

| Variable Name | Value | Environments |
|--------------|-------|--------------|
| `AUTH_USER1_PREFERRED_CURRENCY` | `ILS` | Production, Preview, Development |
| `AUTH_USER2_PREFERRED_CURRENCY` | `EUR` | Production, Preview, Development |

## How to Add (Web UI)

1. Go to: https://vercel.com/avi-feneshs-projects/expense-track/settings/environment-variables
2. Click "Add New"
3. Add each variable:
   - **Name**: `AUTH_USER1_PREFERRED_CURRENCY`
   - **Value**: `ILS`
   - **Environments**: Select all (Production, Preview, Development)
   - Click "Save"
4. Repeat for `AUTH_USER2_PREFERRED_CURRENCY` with value `EUR`
5. Redeploy the application (Settings → Deployments → click ⋯ on latest → Redeploy)

## How to Add (CLI)

If you prefer using the command line:

```bash
# Login to Vercel first
vercel login

# Add the environment variables
vercel env add AUTH_USER1_PREFERRED_CURRENCY production preview development
# When prompted, enter: ILS

vercel env add AUTH_USER2_PREFERRED_CURRENCY production preview development
# When prompted, enter: EUR

# Redeploy
vercel --prod
```

## Expected Result

After adding these variables and redeploying:
- ✅ **Avi** will see all amounts in **₪** (Israeli Shekel)
- ✅ **Serena** will see all amounts in **€** (Euro)
- ✅ No more **$** symbols (unless viewing actual USD transactions)

## Verification

The code is already deployed with the fix (commit `6c6726a`). The environment variables are the only missing piece.

Current code behavior:
- `src/lib/auth.ts` line 17: Reads `process.env.AUTH_USER1_PREFERRED_CURRENCY` (returns `undefined` if not set)
- `src/lib/auth.ts` line 17: Defaults to `Currency.USD` when undefined
- `src/components/dashboard/dashboard-page.tsx` line 141: Uses `data.preferredCurrency || Currency.USD`

Without the env vars, it always defaults to USD.
