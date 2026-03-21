import { homeDir, join } from '@tauri-apps/api/path'
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs'

const EXPORT_VERSION = '1.0'
const APP_VERSION = '0.1.0'

const getCategoryValue = (subscription) => {
  if (subscription.category !== 'Other') return subscription.category || 'Uncategorized'
  const detail = String(subscription.categoryDetail || '').trim()
  return detail ? `Other: ${detail}` : 'Other'
}

const toExportSubscription = (subscription) => ({
  id: subscription.id,
  name: subscription.name || '',
  amount: Number(subscription.amount || 0),
  currency: subscription.currency || 'USD',
  billingCycle: (subscription.billingCycle || 'Monthly').toLowerCase(),
  nextRenewal: subscription.nextPayment || '',
  category: getCategoryValue(subscription),
  url: subscription.link || '',
  notes: subscription.notes || '',
  isActive: subscription.status === 'Active',
  notifyDaysBefore: null,
})

export async function exportSubscriptions(subscriptions) {
  const home = await homeDir()
  const subscriptionsDir = await join(home, 'subscriptions')
  const exportPath = await join(subscriptionsDir, 'subscriptions.json')
  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    subscriptions: subscriptions.map(toExportSubscription),
    appVersion: APP_VERSION,
  }

  await mkdir(subscriptionsDir, { recursive: true })
  await writeTextFile(exportPath, JSON.stringify(payload, null, 2))

  console.info(`Exported ${subscriptions.length} subscriptions to ${exportPath}`)
  return exportPath
}
