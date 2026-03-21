export default function AnalyticsPanel({
  analyticsRangeMonths,
  analyticsRangeOptions,
  currencyFormatter,
  expandedMonthCategories,
  handleCategoryToggle,
  handleExportMonthlySpend,
  handleMonthClick,
  highestMonthlyActualSpend,
  lockedMonthKey,
  monthlyActualSpend,
  selectedMonthCategoryColors,
  selectedMonthDetails,
  selectedMonthEntriesByCategory,
  selectedMonthKey,
  setAnalyticsRangeMonths,
  setExpandedMonthCategories,
  setHoveredMonthKey,
  setLockedMonthKey,
  setPaymentEntriesModalMonthKey,
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Actual spend (default: last 6 months)</p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="analytics-range" className="text-xs font-medium text-slate-500 dark:text-slate-400">Range</label>
          <select
            id="analytics-range"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-500/40"
            value={analyticsRangeMonths}
            onChange={(event) => {
              setAnalyticsRangeMonths(Number(event.target.value))
              setHoveredMonthKey('')
              setLockedMonthKey('')
              setExpandedMonthCategories({})
              setPaymentEntriesModalMonthKey('')
            }}
          >
            {analyticsRangeOptions.map((months) => (
              <option key={months} value={months}>{months} months</option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
            onClick={handleExportMonthlySpend}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-3 flex h-24 items-end gap-2">
        {monthlyActualSpend.map((month) => {
          const barHeight = highestMonthlyActualSpend > 0 ? Math.max((month.total / highestMonthlyActualSpend) * 100, month.total > 0 ? 8 : 0) : 0
          const isSelected = selectedMonthKey === month.monthKey
          return (
            <div key={month.monthKey} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <button
                type="button"
                className={`flex h-16 w-full items-end rounded px-1 transition ${isSelected ? 'bg-brand-100 ring-1 ring-brand-400 dark:bg-brand-500/20 dark:ring-brand-300' : 'bg-slate-200/70 dark:bg-slate-700/70'}`}
                onMouseEnter={() => setHoveredMonthKey(month.monthKey)}
                onMouseLeave={() => setHoveredMonthKey('')}
                onClick={() => handleMonthClick(month.monthKey)}
                title={`${month.label}: ${currencyFormatter.format(month.total)}`}
              >
                <span
                  className="w-full rounded bg-brand-500"
                  style={{ height: `${barHeight}%` }}
                />
              </button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{month.label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        {selectedMonthDetails ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {selectedMonthDetails.monthKey} total: {currencyFormatter.format(selectedMonthDetails.total)}
              </p>
              {lockedMonthKey && (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                  onClick={() => {
                    setLockedMonthKey('')
                    setExpandedMonthCategories({})
                    setPaymentEntriesModalMonthKey('')
                  }}
                >
                  Clear selection
                </button>
              )}
            </div>

            {selectedMonthDetails.categories.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No category spend logged for this month.</p>
            ) : (
              <ul className="space-y-1">
                {selectedMonthDetails.categories.map((entry) => {
                  const monthExpanded = expandedMonthCategories[selectedMonthKey] || {}
                  const isExpanded = Boolean(monthExpanded[entry.category])
                  const categoryRows = selectedMonthEntriesByCategory[entry.category] || []

                  return (
                    <li key={`${selectedMonthDetails.monthKey}-${entry.category}`} className="rounded-lg border border-transparent p-1 hover:border-slate-200 dark:hover:border-slate-700">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-full border border-slate-200 px-2 py-1 text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                          onClick={() => handleCategoryToggle(entry.category)}
                          aria-expanded={isExpanded}
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedMonthCategoryColors[entry.category] || '#64748b' }} />
                          {entry.category}
                          <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{currencyFormatter.format(entry.total)}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 space-y-1 rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
                          {categoryRows.length === 0 ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">No entries found.</p>
                          ) : (
                            categoryRows.map((row) => (
                              <div key={`${row.subscriptionId}-${row.id}`} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{row.subscriptionName}</p>
                                  <p>{row.date}</p>
                                </div>
                                <span className="font-semibold">{currencyFormatter.format(row.amount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">Hover a month for category breakdown. Click a month to lock the drilldown panel.</p>
        )}
      </div>
    </div>
  )
}
