const pad2 = (value) => String(value).padStart(2, '0')

export const formatDateLocal = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const normalizeDate = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  return formatDateLocal(new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000))
}

export const getTodayDate = () => formatDateLocal(new Date())

export const addBillingCycle = (dateValue, cycle) => {
  const normalized = normalizeDate(dateValue)
  if (!normalized) return ''

  const [year, month, day] = normalized.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (cycle === 'Yearly') date.setUTCFullYear(date.getUTCFullYear() + 1)
  else if (cycle === 'Quarterly') date.setUTCMonth(date.getUTCMonth() + 3)
  else if (cycle === 'Weekly') date.setUTCDate(date.getUTCDate() + 7)
  else date.setUTCMonth(date.getUTCMonth() + 1)

  return date.toISOString().slice(0, 10)
}

export const parseAmount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizePayment = (payment, fallbackAmount = 0) => ({
  id: payment?.id || `pay-${Date.now()}-${Math.random()}`,
  date: normalizeDate(payment?.date),
  amount: parseAmount(payment?.amount ?? fallbackAmount),
  note: String(payment?.note || '').trim(),
})

export const normalizeSubscription = (subscription = {}) => {
  const payments = Array.isArray(subscription.payments)
    ? subscription.payments
        .map((payment) => normalizePayment(payment, subscription.amount))
        .filter((payment) => payment.date)
    : []

  if (!payments.length && subscription.currentPayment) {
    const date = normalizeDate(subscription.currentPayment)
    if (date) {
      payments.push({ id: `legacy-${subscription.id || 'sub'}`, date, amount: parseAmount(subscription.amount), note: 'Migrated' })
    }
  }

  return {
    id: subscription.id || `sub-${Date.now()}-${Math.random()}`,
    name: String(subscription.name || '').trim(),
    amount: parseAmount(subscription.amount),
    billingCycle: ['Monthly', 'Yearly', 'Quarterly', 'Weekly'].includes(subscription.billingCycle) ? subscription.billingCycle : 'Monthly',
    category: String(subscription.category || 'Other').trim() || 'Other',
    categoryDetail: String(subscription.categoryDetail || '').trim(),
    nextPayment: normalizeDate(subscription.nextPayment),
    currentPayment: normalizeDate(subscription.currentPayment),
    link: String(subscription.link || '').trim(),
    notes: String(subscription.notes || '').trim(),
    status: ['Active', 'Paused', 'Cancelled'].includes(subscription.status) ? subscription.status : 'Active',
    statusChangedAt: normalizeDate(subscription.statusChangedAt),
    payments,
  }
}

export const migrateSubscriptions = (parsed) => {
  const input = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.subscriptions)
      ? parsed.subscriptions
      : []

  return input.map(normalizeSubscription).filter((subscription) => subscription.name && subscription.nextPayment)
}

export const addSubscription = (subscriptions, payload) => [normalizeSubscription(payload), ...subscriptions]

export const editSubscription = (subscriptions, id, payload) =>
  subscriptions.map((item) => (item.id === id ? normalizeSubscription({ ...item, ...payload, id }) : item))

export const deleteSubscription = (subscriptions, id) => subscriptions.filter((item) => item.id !== id)

export const markPaidToday = (subscriptions, id, today = getTodayDate()) =>
  subscriptions.map((item) => {
    if (item.id !== id) return item

    const anchorDate = item.nextPayment > today ? item.nextPayment : today
    const nextPayment = addBillingCycle(anchorDate, item.billingCycle)
    const lastAmount = item.payments?.[0]?.amount ?? item.amount

    return {
      ...item,
      currentPayment: today,
      nextPayment,
      status: 'Active',
      statusChangedAt: today,
      payments: [{ id: `pay-${Date.now()}`, date: today, amount: lastAmount, note: 'Marked paid today' }, ...(item.payments || [])].slice(0, 50),
    }
  })

export const calculateMetrics = (subscriptions) => ({
  total: subscriptions.length,
  active: subscriptions.filter((subscription) => subscription.status === 'Active').length,
  categories: new Set(subscriptions.map((subscription) => subscription.category)).size,
})

export const toPersistedState = (subscriptions, themePreference = 'system') => ({
  version: 2,
  subscriptions: subscriptions.map(normalizeSubscription),
  themePreference,
})

export const toJson = (subscriptions) => JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), subscriptions }, null, 2)

const escapeCsv = (value) => {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`
  return str
}

export const toCsv = (subscriptions) => {
  const header = ['name', 'amount', 'billingCycle', 'category', 'nextPayment', 'status', 'link']
  const rows = subscriptions.map((subscription) =>
    [
      subscription.name,
      subscription.amount,
      subscription.billingCycle,
      subscription.category,
      subscription.nextPayment,
      subscription.status,
      subscription.link,
    ]
      .map(escapeCsv)
      .join(','),
  )

  return [header.join(','), ...rows].join('\n')
}

export const fromCsv = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const header = lines[0].split(',').map((item) => item.trim())
  const idx = Object.fromEntries(header.map((item, index) => [item, index]))

  return lines
    .slice(1)
    .map((line) => {
      const cols = line.match(/("(?:[^"]|"")*"|[^,]+)/g)?.map((col) => col.replace(/^"|"$/g, '').replaceAll('""', '"')) || []
      return normalizeSubscription({
        name: cols[idx.name],
        amount: cols[idx.amount],
        billingCycle: cols[idx.billingCycle],
        category: cols[idx.category],
        nextPayment: cols[idx.nextPayment],
        status: cols[idx.status],
        link: cols[idx.link],
      })
    })
    .filter((subscription) => subscription.name && subscription.nextPayment)
}
