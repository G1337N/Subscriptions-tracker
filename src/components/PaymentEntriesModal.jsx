export default function PaymentEntriesModal({
  currencyFormatter,
  onClose,
  paymentEntriesModalEntries,
  paymentEntriesModalMonth,
}) {
  if (!paymentEntriesModalMonth) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-entries-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="payment-entries-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Payment entries · {paymentEntriesModalMonth.monthKey}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Exact transactions for this month ({currencyFormatter.format(paymentEntriesModalMonth.total)} total)
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {paymentEntriesModalEntries.length === 0 ? (
            <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No payment entries logged for this month.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {paymentEntriesModalEntries.map((entry) => (
                <li key={`${entry.subscriptionId}-${entry.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{entry.subscriptionName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{entry.category} · {entry.date}</p>
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{currencyFormatter.format(entry.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
