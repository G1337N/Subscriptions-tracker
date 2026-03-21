import { invoke } from '@tauri-apps/api/core'

export const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const centsToAmount = (value) => (Number(value || 0) / 100)
export const amountToCents = (value) => Math.round(Number(value || 0) * 100)

export const normalizePayment = (payment) => ({
  id: payment.id,
  date: payment.date,
  amount: centsToAmount(payment.amountCents),
})

export const normalizeSubscription = (subscription) => ({
  id: subscription.id,
  name: subscription.name || '',
  amount: centsToAmount(subscription.amountCents),
  billingCycle: subscription.billingCycle || 'Monthly',
  category: subscription.category || 'Other',
  categoryDetail: subscription.categoryDetail || '',
  nextPayment: subscription.nextPaymentDate || '',
  currentPayment: subscription.currentPaymentDate || '',
  link: subscription.link || '',
  notes: subscription.notes || '',
  status: subscription.status || 'Active',
  statusChangedAt: subscription.statusChangedAt || '',
  payments: Array.isArray(subscription.payments) ? subscription.payments.map(normalizePayment) : [],
})

export const normalizeSettings = (settings) => ({
  themePreference: settings?.themePreference || 'system',
  analyticsDefaultRangeMonths: Number(settings?.analyticsDefaultRangeMonths || 6),
  defaultReminderDays: Number(settings?.defaultReminderDays || 7),
  backupsEnabled: Boolean(settings?.backupsEnabled),
  openclawSyncEnabled: Boolean(settings?.openclawSyncEnabled),
})

export const serializePayment = (payment, index) => ({
  id: payment.id || `payment-${index + 1}`,
  date: payment.date,
  amountCents: amountToCents(payment.amount),
})

export const serializeSubscription = (subscription) => ({
  id: subscription.id,
  name: subscription.name || '',
  amountCents: amountToCents(subscription.amount),
  currency: 'USD',
  billingCycle: subscription.billingCycle || 'Monthly',
  category: subscription.category || 'Other',
  categoryDetail: subscription.categoryDetail || '',
  status: subscription.status || 'Active',
  notes: subscription.notes || '',
  link: subscription.link || '',
  nextPaymentDate: subscription.nextPayment || null,
  currentPaymentDate: subscription.currentPayment || null,
  statusChangedAt: subscription.statusChangedAt || null,
  payments: Array.isArray(subscription.payments) ? subscription.payments.map(serializePayment) : [],
})

export const serializeSettings = (settings) => ({
  themePreference: settings.themePreference,
  analyticsDefaultRangeMonths: Number(settings.analyticsDefaultRangeMonths),
  defaultReminderDays: Number(settings.defaultReminderDays),
  backupsEnabled: Boolean(settings.backupsEnabled),
  openclawSyncEnabled: Boolean(settings.openclawSyncEnabled),
})

export const listSubscriptions = async () => {
  const result = await invoke('list_subscriptions_command')
  return Array.isArray(result) ? result.map(normalizeSubscription) : []
}

export const createSubscription = async (subscription) => {
  const result = await invoke('create_subscription_command', { input: serializeSubscription(subscription) })
  return normalizeSubscription(result)
}

export const updateSubscription = async (id, subscription) => {
  const result = await invoke('update_subscription_command', { id, input: serializeSubscription(subscription) })
  return normalizeSubscription(result)
}

export const deleteSubscription = async (id) => invoke('delete_subscription_command', { id })

export const importLegacyStore = async () => invoke('import_legacy_store_command')

export const getSettings = async () => normalizeSettings(await invoke('get_settings_command'))

export const updateSettings = async (input) => normalizeSettings(await invoke('update_settings_command', { input: serializeSettings(input) }))

export const exportFullBackup = async () => invoke('export_full_backup_command')

export const syncOpenClawReminders = async () => invoke('sync_openclaw_reminders_command')
