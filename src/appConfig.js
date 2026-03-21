export const localStorageStateKey = 'subscription-tracker.state.v1'

export const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

export const categoryOptions = ['Streaming', 'Productivity', 'Utilities', 'Education', 'Gaming', 'News', 'Other']
export const billingOptions = ['Monthly', 'Yearly', 'Quarterly', 'Weekly']

export const defaultAppSettings = {
  themePreference: 'system',
  analyticsDefaultRangeMonths: 6,
  defaultReminderDays: 7,
  backupsEnabled: false,
  openclawSyncEnabled: false,
}

export const initialFormState = {
  name: '',
  amount: '',
  billingCycle: 'Monthly',
  category: 'Streaming',
  categoryDetail: '',
  nextPayment: '',
  currentPayment: '',
  link: '',
  notes: '',
  status: 'Active',
}

export const statusOptions = ['Active', 'Paused', 'Cancelled']

export const statusStyles = {
  Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  Paused: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  Cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

export const themeOptions = ['light', 'dark', 'system']
export const analyticsRangeOptions = [6, 12, 24]
