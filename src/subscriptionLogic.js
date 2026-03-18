const pad2 = (value) => String(value).padStart(2, '0')

export const formatDateLocal = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const toDateValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatDateLocal(date)
}

export const parseAmount = (value) => {
  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? 0 : numberValue
}

const normalizePayment = (payment) => ({
  id: payment.id || `payment-${Date.now()}-${Math.random()}`,
  date: toDateValue(payment.date),
  amount: parseAmount(payment.amount),
})

export const getCleanPayments = (subscription) => {
  const fromStore = Array.isArray(subscription.payments)
    ? subscription.payments.map(normalizePayment).filter((payment) => payment.date)
    : []

  const legacyCurrentPayment = toDateValue(subscription.currentPayment)
  if (fromStore.length === 0 && legacyCurrentPayment) {
    fromStore.push({
      id: `legacy-${subscription.id || 'sub'}-${legacyCurrentPayment}`,
      date: legacyCurrentPayment,
      amount: parseAmount(subscription.amount),
    })
  }

  const unique = new Map()
  fromStore.forEach((payment) => {
    const key = `${payment.date}-${payment.amount}`
    if (!unique.has(key)) {
      unique.set(key, payment)
    }
  })

  return [...unique.values()].sort((a, b) => new Date(a.date) - new Date(b.date))
}

export const getTotalLoggedSpend = (subscriptions) =>
  subscriptions.reduce((sum, subscription) => {
    const paymentTotal = getCleanPayments(subscription).reduce((paymentSum, payment) => paymentSum + parseAmount(payment.amount), 0)
    return sum + paymentTotal
  }, 0)

export const getDaysLeft = (dateValue, todayValue = formatDateLocal(new Date())) => {
  if (!dateValue) return 0
  const today = new Date(`${todayValue}T00:00:00`)
  const target = new Date(`${toDateValue(dateValue)}T00:00:00`)
  if (Number.isNaN(target.getTime()) || Number.isNaN(today.getTime())) return 0
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  return diff < 0 ? 0 : diff
}

export const getDueWindowSubscriptions = (subscriptions, windowDays, todayValue = formatDateLocal(new Date())) => {
  const window = Number(windowDays)
  if (!Number.isFinite(window) || window < 0) return []

  return subscriptions.filter((subscription) => {
    if (subscription.status !== 'Active') return false
    const daysLeft = getDaysLeft(subscription.nextPayment, todayValue)
    return daysLeft <= window
  })
}

export const getMonthlyActualSpend = (subscriptions, options = {}) => {
  const months = Number.isFinite(options.months) ? Math.max(1, Math.floor(options.months)) : 6
  const todayValue = toDateValue(options.todayValue) || formatDateLocal(new Date())
  const today = new Date(`${todayValue}T00:00:00`)

  if (Number.isNaN(today.getTime())) {
    return []
  }

  const labels = []
  const monthTotals = new Map()

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1)
    const monthKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
    labels.push(monthKey)
    monthTotals.set(monthKey, 0)
  }

  subscriptions.forEach((subscription) => {
    getCleanPayments(subscription).forEach((payment) => {
      const monthKey = payment.date.slice(0, 7)
      if (monthTotals.has(monthKey)) {
        monthTotals.set(monthKey, monthTotals.get(monthKey) + parseAmount(payment.amount))
      }
    })
  })

  return labels.map((monthKey) => {
    const [year, month] = monthKey.split('-')
    const labelDate = new Date(Number(year), Number(month) - 1, 1)

    return {
      monthKey,
      label: labelDate.toLocaleString(undefined, { month: 'short' }),
      total: monthTotals.get(monthKey) || 0,
    }
  })
}

export const renewSubscription = (subscription, renewal) => {
  const renewalDate = toDateValue(renewal.paymentDate)
  const expiryDate = toDateValue(renewal.newExpiryDate)
  const amountPaid = parseAmount(renewal.amountPaid)

  const payments = getCleanPayments(subscription)
  payments.push({
    id: `payment-${Date.now()}`,
    date: renewalDate,
    amount: amountPaid,
  })

  return {
    ...subscription,
    amount: amountPaid,
    currentPayment: renewalDate,
    nextPayment: expiryDate,
    status: 'Active',
    statusChangedAt: subscription.status === 'Paused' ? formatDateLocal(new Date()) : subscription.statusChangedAt || '',
    payments: payments.sort((a, b) => new Date(a.date) - new Date(b.date)),
  }
}
