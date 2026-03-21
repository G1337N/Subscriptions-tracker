export default function UpcomingRenewalsCard({ currencyFormatter, getDueLabel, upcomingPayments }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <h2 className="text-xl font-semibold">Upcoming renewals</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Your next three active renewals.</p>
      <div className="mt-4 space-y-3">
        {upcomingPayments.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No active subscriptions yet.</p>}
        {upcomingPayments.map((subscription) => (
          <div key={subscription.id} className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{subscription.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{getDueLabel(subscription.nextPayment)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{currencyFormatter.format(subscription.amount)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{subscription.billingCycle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
