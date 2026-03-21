import AnalyticsPanel from './AnalyticsPanel'

export default function DashboardHeader({
  analyticsRangeMonths,
  analyticsRangeOptions,
  currencyFormatter,
  effectiveTheme,
  expandedMonthCategories,
  handleCategoryToggle,
  handleExportMonthlySpend,
  handleMonthClick,
  handleThemeToggle,
  highestMonthlyActualSpend,
  lockedMonthKey,
  metrics,
  monthlyActualSpend,
  onOpenSettings,
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
    <header className="flex flex-col gap-4 rounded-2xl bg-white px-8 py-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Subscription Tracker</p>
          <h1 className="text-3xl font-semibold">Keep every renewal in one calm dashboard.</h1>
          <p className="text-slate-500 dark:text-slate-400">Track costs, next billing dates, and total spend across your subscriptions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={handleThemeToggle}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            {effectiveTheme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">Theme default: system preference. Analytics and backup preferences are now configurable from Settings.</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Monthly spend</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{currencyFormatter.format(metrics.totalMonthly)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Actual spend logged</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{currencyFormatter.format(metrics.totalLoggedSpend)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active subscriptions</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.activeCount}</p>
        </div>
      </div>

      <AnalyticsPanel
        analyticsRangeMonths={analyticsRangeMonths}
        analyticsRangeOptions={analyticsRangeOptions}
        currencyFormatter={currencyFormatter}
        expandedMonthCategories={expandedMonthCategories}
        handleCategoryToggle={handleCategoryToggle}
        handleExportMonthlySpend={handleExportMonthlySpend}
        handleMonthClick={handleMonthClick}
        highestMonthlyActualSpend={highestMonthlyActualSpend}
        lockedMonthKey={lockedMonthKey}
        monthlyActualSpend={monthlyActualSpend}
        selectedMonthCategoryColors={selectedMonthCategoryColors}
        selectedMonthDetails={selectedMonthDetails}
        selectedMonthEntriesByCategory={selectedMonthEntriesByCategory}
        selectedMonthKey={selectedMonthKey}
        setAnalyticsRangeMonths={setAnalyticsRangeMonths}
        setExpandedMonthCategories={setExpandedMonthCategories}
        setHoveredMonthKey={setHoveredMonthKey}
        setLockedMonthKey={setLockedMonthKey}
        setPaymentEntriesModalMonthKey={setPaymentEntriesModalMonthKey}
      />
    </header>
  )
}
