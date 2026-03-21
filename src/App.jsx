import { useEffect, useState } from 'react'
import {
  analyticsRangeOptions,
  billingOptions,
  categoryOptions,
  currencyFormatter,
  defaultAppSettings,
  initialFormState,
  localStorageStateKey,
  statusOptions,
  statusStyles,
  themeOptions,
} from './appConfig'
import DashboardHeader from './components/DashboardHeader'
import DatePicker from './components/DatePicker'
import DeleteSubscriptionModal from './components/DeleteSubscriptionModal'
import PaymentEntriesModal from './components/PaymentEntriesModal'
import RenewSubscriptionModal from './components/RenewSubscriptionModal'
import SettingsModal from './components/SettingsModal'
import SubscriptionForm from './components/SubscriptionForm'
import SubscriptionListPanel from './components/SubscriptionListPanel'
import UpcomingRenewalsCard from './components/UpcomingRenewalsCard'
import { useSubscriptionActions } from './hooks/useSubscriptionActions'
import { useSubscriptionDashboard } from './hooks/useSubscriptionDashboard'
import { useBodyScrollLock, useEscapeKey } from './hooks/useModalEffects'
import { useBrowserPersistence, useSubscriptionBootstrap } from './hooks/useSubscriptionPersistence'
import { useThemePreference } from './hooks/useThemePreference'
import {
  exportFullBackup,
  isTauriRuntime,
  normalizeSettings,
  syncOpenClawReminders,
  updateSettings as updateDesktopSettings,
} from './tauriApi'
import {
  formatDateLocal,
  getCleanPayments,
  getDateDiffInDays,
  getDaysLeft,
  getDueWindowSubscriptions,
  getDistinctCategoryColors,
  getMonthlyActualSpend,
  getMonthlyPaymentEntries,
  getMonthlySpendCsv,
  getTotalLoggedSpend,
  parseAmount,
  renewSubscription,
  sortSubscriptions,
  toDateValue,
} from './subscriptionLogic'

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const normalizeAmount = (value) => {
  if (value === '') return ''
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) return ''
  return Math.max(numberValue, 0)
}

const calculateMonthlyCost = (amount, billingCycle) => {
  switch (billingCycle) {
    case 'Yearly':
      return amount / 12
    case 'Quarterly':
      return amount / 3
    case 'Weekly':
      return amount * 4.33
    default:
      return amount
  }
}

const getDueLabel = (dateValue) => {
  if (!dateValue) return 'No date'
  const diffDays = getDateDiffInDays(dateValue, formatDateLocal(new Date()))
  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays} days`
}

const normalizeLink = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const getSafeExternalUrl = (value) => {
  const normalized = normalizeLink(value || '')
  if (!normalized) {
    return { url: null, error: 'No subscription URL is set yet.' }
  }

  try {
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url: null, error: 'Only HTTP(S) links can be opened.' }
    }
    return { url: parsed.toString(), error: '' }
  } catch {
    return { url: null, error: 'This subscription URL is invalid. Please edit and fix it.' }
  }
}

const getCategoryLabel = (category, categoryDetail) => {
  if (category !== 'Other') return category
  const detail = categoryDetail.trim()
  return detail ? `Other: ${detail}` : 'Other'
}

const normalizeSubscription = (subscription) => ({
  ...subscription,
  currentPayment: subscription.currentPayment || '',
  link: subscription.link || '',
  categoryDetail: subscription.categoryDetail || '',
  statusChangedAt: subscription.statusChangedAt || '',
  payments: getCleanPayments(subscription),
})

const getTodayDate = () => formatDateLocal(new Date())

const toPersistedSubscription = (subscription) => ({
  id: subscription.id,
  name: subscription.name || '',
  amount: parseAmount(subscription.amount),
  billingCycle: subscription.billingCycle || 'Monthly',
  category: subscription.category || 'Other',
  categoryDetail: subscription.categoryDetail || '',
  nextPayment: toDateValue(subscription.nextPayment),
  currentPayment: toDateValue(subscription.currentPayment),
  link: subscription.link || '',
  notes: subscription.notes || '',
  status: statusOptions.includes(subscription.status) ? subscription.status : 'Active',
  statusChangedAt: toDateValue(subscription.statusChangedAt),
  payments: getCleanPayments(subscription),
})

const toPersistedState = (subscriptions, appSettings) => ({
  version: 1,
  subscriptions: subscriptions.map(toPersistedSubscription),
  themePreference: themeOptions.includes(appSettings.themePreference) ? appSettings.themePreference : 'system',
  settings: normalizeSettings(appSettings),
})

const parseLocalState = () => {
  try {
    const raw = window.localStorage.getItem(localStorageStateKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export default function App() {
  const [subscriptions, setSubscriptions] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [dueWindowFilter, setDueWindowFilter] = useState('all')
  const [sortKey, setSortKey] = useState('nextPayment')
  const [themePreference, setThemePreference] = useState('system')
  const [appSettings, setAppSettings] = useState(defaultAppSettings)
  const [isLoaded, setIsLoaded] = useState(false)
  const [persistenceError, setPersistenceError] = useState('')
  const [todayValue, setTodayValue] = useState(getTodayDate)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState(defaultAppSettings)
  const [settingsError, setSettingsError] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const [lastOpenClawSyncKey, setLastOpenClawSyncKey] = useState('')

  const { effectiveTheme, systemTheme } = useThemePreference({
    getSystemTheme,
    themePreference,
  })

  const {
    deletingSubscriptionId,
    editingId,
    errorMessage,
    formState,
    handleChange,
    handleDateChange,
    handleDelete,
    handleEdit,
    handleOpenRenew,
    handleOpenSubscriptionLink,
    handlePause,
    handleRenewFormChange,
    handleRenewSubmit,
    handleSubmit,
    handleThemeToggle,
    linkErrors,
    renewError,
    renewingSubscriptionId,
    renewForm,
    resetForm,
    setDeletingSubscriptionId,
    setRenewingSubscriptionId,
    confirmDeleteSubscription,
  } = useSubscriptionActions({
    getCleanPayments,
    getDateDiffInDays,
    getTodayDate,
    initialFormState,
    normalizeAmount,
    normalizeLink,
    normalizeSubscription,
    parseAmount,
    renewSubscription,
    setAppSettings,
    setPersistenceError,
    setSubscriptions,
    setThemePreference,
    subscriptions,
    systemTheme,
    themePreference,
    toDateValue,
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTodayValue(getTodayDate())
    }, 60 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  useSubscriptionBootstrap({
    defaultAppSettings,
    normalizeSettings,
    normalizeSubscription,
    parseLocalState,
    setAppSettings,
    setSubscriptions,
    setThemePreference,
    themeOptions,
    setPersistenceError,
    setIsLoaded,
  })

  useBrowserPersistence({
    appSettings,
    isLoaded,
    subscriptions,
    localStorageStateKey,
    setPersistenceError,
    toPersistedState,
  })

  const {
    analyticsRangeMonths,
    deletingSubscription,
    expandedMonthCategories,
    filteredSubscriptions,
    handleCategoryToggle,
    handleExportMonthlySpend,
    handleMonthClick,
    highestMonthlyActualSpend,
    lockedMonthKey,
    metrics,
    monthlyActualSpend,
    paymentEntriesModalEntries,
    paymentEntriesModalMonth,
    paymentEntriesModalMonthKey,
    selectedMonthCategoryColors,
    selectedMonthDetails,
    selectedMonthEntriesByCategory,
    selectedMonthKey,
    setAnalyticsRangeMonths,
    setExpandedMonthCategories,
    setHoveredMonthKey,
    setLockedMonthKey,
    setPaymentEntriesModalMonthKey,
    upcomingPayments,
  } = useSubscriptionDashboard({
    calculateMonthlyCost,
    categoryFilter,
    deletingSubscriptionId,
    dueWindowFilter,
    getCategoryLabel,
    getDistinctCategoryColors,
    getDueWindowSubscriptions,
    getMonthlyActualSpend,
    getMonthlyPaymentEntries,
    getMonthlySpendCsv,
    getTotalLoggedSpend,
    initialAnalyticsRangeMonths: appSettings.analyticsDefaultRangeMonths,
    query,
    sortKey,
    sortSubscriptions,
    statusFilter,
    subscriptions,
    todayValue,
  })

  useEffect(() => {
    if (!isLoaded || !isTauriRuntime || !appSettings.openclawSyncEnabled) return

    const syncKey = JSON.stringify(
      subscriptions
        .filter((subscription) => subscription.status === 'Active')
        .map((subscription) => [subscription.id, subscription.nextPayment, subscription.status]),
    )

    if (!syncKey || syncKey === lastOpenClawSyncKey) return

    let cancelled = false

    const runSync = async () => {
      try {
        await syncOpenClawReminders()
        if (!cancelled) {
          setLastOpenClawSyncKey(syncKey)
        }
      } catch {
        if (!cancelled) {
          setSettingsError('Could not sync reminders to OpenClaw.')
        }
      }
    }

    runSync()

    return () => {
      cancelled = true
    }
  }, [appSettings.openclawSyncEnabled, isLoaded, lastOpenClawSyncKey, subscriptions])

  useBodyScrollLock(Boolean(isSettingsOpen || renewingSubscriptionId || deletingSubscriptionId || paymentEntriesModalMonthKey))
  useEscapeKey(Boolean(isSettingsOpen), () => setIsSettingsOpen(false))
  useEscapeKey(Boolean(deletingSubscriptionId), () => setDeletingSubscriptionId())
  useEscapeKey(Boolean(paymentEntriesModalMonthKey), () => setPaymentEntriesModalMonthKey(''))

  const handleOpenSettings = () => {
    setSettingsForm(appSettings)
    setSettingsError('')
    setExportStatus('')
    setIsSettingsOpen(true)
  }

  const handleSettingsChange = (field, value) => {
    setSettingsForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveSettings = async () => {
    const normalizedForm = normalizeSettings(settingsForm)

    try {
      const nextSettings = isTauriRuntime
        ? await updateDesktopSettings(normalizedForm)
        : normalizedForm

      setAppSettings(nextSettings)
      setThemePreference(nextSettings.themePreference)
      setSettingsForm(nextSettings)
      setSettingsError('')
      setExportStatus('Settings saved.')
    } catch {
      setSettingsError('Could not save settings.')
    }
  }

  const handleExportBackup = async () => {
    if (!isTauriRuntime) {
      setSettingsError('Full backup export is only available in the desktop app.')
      return
    }

    try {
      const exportPath = await exportFullBackup()
      setSettingsError('')
      setExportStatus('Backup exported to ' + exportPath)
    } catch {
      setSettingsError('Could not export the full backup.')
    }
  }

  const handleSyncOpenClaw = async () => {
    if (!isTauriRuntime) {
      setSettingsError('OpenClaw sync is only available in the desktop app.')
      return
    }

    try {
      const result = await syncOpenClawReminders()
      setSettingsError('')
      setExportStatus('OpenClaw reminders synced: ' + result.reminderCount + ' items -> ' + result.pendingPath)
      setLastOpenClawSyncKey('manual-' + Date.now())
    } catch {
      setSettingsError('Could not sync reminders to OpenClaw.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {persistenceError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {persistenceError}
          </div>
        )}

        <DashboardHeader
          analyticsRangeMonths={analyticsRangeMonths}
          analyticsRangeOptions={analyticsRangeOptions}
          currencyFormatter={currencyFormatter}
          effectiveTheme={effectiveTheme}
          expandedMonthCategories={expandedMonthCategories}
          handleCategoryToggle={handleCategoryToggle}
          handleExportMonthlySpend={handleExportMonthlySpend}
          handleMonthClick={handleMonthClick}
          handleThemeToggle={handleThemeToggle}
          highestMonthlyActualSpend={highestMonthlyActualSpend}
          lockedMonthKey={lockedMonthKey}
          metrics={metrics}
          monthlyActualSpend={monthlyActualSpend}
          onOpenSettings={handleOpenSettings}
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

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SubscriptionListPanel
            categoryFilter={categoryFilter}
            categoryOptions={categoryOptions}
            currencyFormatter={currencyFormatter}
            dueWindowFilter={dueWindowFilter}
            filteredSubscriptions={filteredSubscriptions}
            getCategoryLabel={getCategoryLabel}
            getCleanPayments={getCleanPayments}
            getDaysLeft={getDaysLeft}
            getDueLabel={getDueLabel}
            handleDelete={handleDelete}
            handleEdit={handleEdit}
            handleOpenRenew={handleOpenRenew}
            handleOpenSubscriptionLink={(subscription) => handleOpenSubscriptionLink(subscription, getSafeExternalUrl)}
            handlePause={handlePause}
            linkErrors={linkErrors}
            query={query}
            setCategoryFilter={setCategoryFilter}
            setDueWindowFilter={setDueWindowFilter}
            setQuery={setQuery}
            setSortKey={setSortKey}
            setStatusFilter={setStatusFilter}
            sortKey={sortKey}
            statusFilter={statusFilter}
            statusOptions={statusOptions}
            statusStyles={statusStyles}
            toDateValue={toDateValue}
            todayValue={todayValue}
          />

          <aside className="flex flex-col gap-6">
            <SubscriptionForm
              DatePickerComponent={DatePicker}
              billingOptions={billingOptions}
              categoryOptions={categoryOptions}
              editingId={editingId}
              errorMessage={errorMessage}
              formState={formState}
              handleChange={handleChange}
              handleDateChange={handleDateChange}
              handleSubmit={handleSubmit}
              resetForm={resetForm}
              statusOptions={statusOptions}
            />

            <UpcomingRenewalsCard
              currencyFormatter={currencyFormatter}
              getDueLabel={getDueLabel}
              upcomingPayments={upcomingPayments}
            />
          </aside>
        </section>

        <DeleteSubscriptionModal
          deletingSubscription={deletingSubscription}
          onCancel={setDeletingSubscriptionId}
          onConfirm={confirmDeleteSubscription}
        />

        <PaymentEntriesModal
          currencyFormatter={currencyFormatter}
          onClose={() => setPaymentEntriesModalMonthKey('')}
          paymentEntriesModalEntries={paymentEntriesModalEntries}
          paymentEntriesModalMonth={paymentEntriesModalMonth}
        />

        <RenewSubscriptionModal
          DatePickerComponent={DatePicker}
          onCancel={setRenewingSubscriptionId}
          onChange={handleRenewFormChange}
          onSubmit={handleRenewSubmit}
          renewError={renewError}
          renewForm={renewForm}
          visible={Boolean(renewingSubscriptionId)}
        />

        <SettingsModal
          exportStatus={exportStatus}
          isDesktopRuntime={isTauriRuntime}
          onCancel={() => setIsSettingsOpen(false)}
          onChange={handleSettingsChange}
          onExportBackup={handleExportBackup}
          onSave={handleSaveSettings}
          onSyncOpenClaw={handleSyncOpenClaw}
          settingsError={settingsError}
          settingsForm={settingsForm}
          visible={isSettingsOpen}
        />
      </div>
    </div>
  )
}
