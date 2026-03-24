

## Plan: Fix Data Flow Bugs (Operations → CustomerSheet → Bill)

### Issues Found

After tracing the code end-to-end, I found **3 bugs** causing data mismatches:

---

### Bug 1: Local reads return unfiltered data

**File:** `src/hooks/useFarmData.ts` (line 33)

`useFarmQuery` reads ALL items from IndexedDB (`getCollection`) but never applies the `filters` parameter locally. When offline (or before server responds), `useTransactions(dateKey)` returns every transaction ever stored — not just that date's. This corrupts the Operations page draft initialization and totals.

**Fix:** After reading from IndexedDB, apply the same filters locally before returning.

---

### Bug 2: Transaction mutations don't invalidate React Query cache

**File:** `src/hooks/useFarmData.ts` (lines 264-310)

The `add` and `update` mutations inside `useTransactionMutations` have no `onSuccess` callbacks to invalidate queries. After saving in Operations, navigating to CustomerSheet or Bill shows stale cached data until a manual refresh.

**Fix:** Add `onSuccess` handlers to both `add` and `update` mutations that invalidate all `TX_KEYS`.

---

### Bug 3: `mila` (received amount) not shown in Bill

**File:** `src/pages/CustomerBill.tsx` (line 141)

The bill shows "Payments Received" from the `payments` table only. But `mila` entered in Operations is stored on each transaction and subtracted from `tx.total`. It never appears as a line item in the bill. The user expects their daily `mila` inputs to show up as received amounts.

**Fix:** Add a "Mila (Daily Received)" row in the bill summary that sums `tx.mila` across all transactions for the month, separate from formal payments.

---

### Implementation

| File | Change |
|------|--------|
| `src/hooks/useFarmData.ts` | Apply local filters in `useFarmQuery`; add `onSuccess` to transaction `add`/`update` mutations |
| `src/pages/CustomerBill.tsx` | Add `mila` total row in bill summary; include in balance calculation |

### Technical Details

**Local filtering logic** (useFarmQuery):
```
// After getCollection, filter locally
const filtered = local.filter(item => {
  for (const [key, value] of Object.entries(filters)) {
    if (key.endsWith('_like')) {
      if (!item[realKey]?.startsWith(value.replace('%',''))) return false;
    } else {
      if (item[key] !== value) return false;
    }
  }
  return true;
});
return filtered;
```

**Bill mila calculation:**
- Sum `tx.mila` from `customerTransactions` for the month
- Display as separate line: "Mila (Daily Received): ₹X"
- Adjust final balance: `previousBalance + totalAmount - totalPayments - totalMila`

