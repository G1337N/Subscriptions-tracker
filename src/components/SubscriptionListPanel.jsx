import { useState } from 'react'
import { canLoadMoreSubscriptions, DEFAULT_VISIBLE_SUBSCRIPTIONS, getVisibleSubscriptions } from './subscriptionListView'

export default function SubscriptionListPanel({
  categoryFilter,
  categoryOptions,
  currencyFormatter,
  dueWindowFilter,
  filteredSubscriptions,
  getCategoryLabel,
  getCleanPayments,
  getDaysLeft,
  getDueLabel,
  handleDelete,
  handleEdit,
  handleOpenRenew,
  handleOpenSubscriptionLink,
  handlePause,
  linkErrors,
  query,
  setCategoryFilter,
  setDueWindowFilter,
  setQuery,
  setSortKey,
  setStatusFilter,
  sortKey,
  statusFilter,
  statusOptions,
  statusStyles,
  toDateValue,
  todayValue,
}) {
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_SUBSCRIPTIONS)


  const visibleSubscriptions = getVisibleSubscriptions(filteredSubscriptions, visibleCount)
  const canLoadMore = canLoadMoreSubscriptions(filteredSubscriptions, visibleCount)

  return (
    <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Your subscriptions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filteredSubscriptions.length} items</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${dueWindowFilter === '7d'
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300'}`}
            onClick={() => setDueWindowFilter((current) => (current === '7d' ? 'all' : '7d'))}
          >
            Due in 7 days
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${dueWindowFilter === '30d'
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300'}`}
            onClick={() => setDueWindowFilter((current) => (current === '30d' ? 'all' : '30d'))}
          >
            Due in 30 days
          </button>
          <div className="relative">
            <input
              className="w-56 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {['All', ...statusOptions].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            {['All', ...categoryOptions].map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
          >
            <option value="nextPayment">Sort by next payment</option>
            <option value="name">Sort by name</option>
            <option value="amount">Sort by cost</option>
            <option value="category">Sort by category</option>
          </select>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {filteredSubscriptions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No subscriptions match the current filters.
          </div>
        )}

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
          {visibleSubscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="flex flex-col gap-4 rounded-xl border border-slate-100 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800"
            >
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{subscription.name}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[subscription.status]}`}>
                    {subscription.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <span>{getCategoryLabel(subscription.category, subscription.categoryDetail)}</span>
                  <span>•</span>
                  <span>{subscription.billingCycle}</span>
                  <span>•</span>
                  <span>
                    {currencyFormatter.format(subscription.amount)} / {subscription.billingCycle}
                  </span>
                </div>
                {subscription.link && (
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      className="text-sm text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      onClick={() => handleOpenSubscriptionLink(subscription)}
                    >
                      Open subscription link
                    </button>
                    {linkErrors[subscription.id] && (
                      <p className="text-xs text-rose-600 dark:text-rose-300">{linkErrors[subscription.id]}</p>
                    )}
                  </div>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400">{subscription.notes || 'No notes yet.'}</p>
              </div>
              <div className="flex flex-col items-start gap-3 text-sm md:items-end">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Next payment</p>
                  <p className="text-base font-semibold">{toDateValue(subscription.nextPayment)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{getDueLabel(subscription.nextPayment)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getDaysLeft(subscription.nextPayment, todayValue) > 0
                      ? `${getDaysLeft(subscription.nextPayment, todayValue)} days left`
                      : 'Expired'}
                  </p>
                  {subscription.currentPayment && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Current payment: {toDateValue(subscription.currentPayment)}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">Logged payments: {getCleanPayments(subscription).length}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                    onClick={() => handlePause(subscription)}
                    disabled={subscription.status !== 'Active'}
                  >
                    Pause
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                    onClick={() => handleOpenRenew(subscription)}
                    disabled={subscription.status === 'Cancelled'}
                  >
                    Renew
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                    onClick={() => handleEdit(subscription)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-400 dark:border-rose-500/40 dark:text-rose-300"
                    onClick={() => handleDelete(subscription.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {canLoadMore && (
          <div className="flex justify-center">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
              onClick={() => setVisibleCount((current) => current + DEFAULT_VISIBLE_SUBSCRIPTIONS)}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
