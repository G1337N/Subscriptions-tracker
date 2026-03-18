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

const defaultCategoryLabel = (subscription) => {
  if (subscription.category !== 'Other') return subscription.category || 'Uncategorized'
  const detail = String(subscription.categoryDetail || '').trim()
  return detail ? `Other: ${detail}` : 'Other'
}

export const sortSubscriptions = (items, sortKey, options = {}) => {
  const resolveCategoryLabel = typeof options.categoryLabelResolver === 'function'
    ? options.categoryLabelResolver
    : defaultCategoryLabel

  const sorted = [...items]

  switch (sortKey) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'amount':
      return sorted.sort((a, b) => a.amount - b.amount)
    case 'category':
      return sorted.sort((a, b) => {
        const categoryComparison = resolveCategoryLabel(a).localeCompare(resolveCategoryLabel(b))
        if (categoryComparison !== 0) return categoryComparison
        return a.name.localeCompare(b.name)
      })
    case 'nextPayment':
      return sorted.sort((a, b) => new Date(a.nextPayment) - new Date(b.nextPayment))
    default:
      return sorted.sort((a, b) => new Date(a.nextPayment) - new Date(b.nextPayment))
  }
}

export const categoryColorPalette = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6']

const toPositiveHash = (value) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export const getDistinctCategoryColors = (categoryLabels, palette = categoryColorPalette) => {
  const normalizedLabels = [...new Set((Array.isArray(categoryLabels) ? categoryLabels : []).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const activePalette = Array.isArray(palette) && palette.length > 0 ? palette : categoryColorPalette

  if (normalizedLabels.length === 0) return {}

  const usedIndexes = new Set()
  const colorMap = {}
  const paletteSize = activePalette.length
  const globalSeed = toPositiveHash(normalizedLabels.join('|'))
  const step = paletteSize > 1 ? (paletteSize % 2 === 0 ? paletteSize - 1 : paletteSize - 2) : 1

  normalizedLabels.forEach((label, index) => {
    const preferredIndex = (globalSeed + index * step + toPositiveHash(label)) % paletteSize

    let paletteIndex = preferredIndex
    if (usedIndexes.size < paletteSize) {
      while (usedIndexes.has(paletteIndex)) {
        paletteIndex = (paletteIndex + 1) % paletteSize
      }
      usedIndexes.add(paletteIndex)
    }

    colorMap[label] = activePalette[paletteIndex]
  })

  return colorMap
}

export const getMonthlyPaymentEntries = (subscriptions, monthKey, options = {}) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return []

  const resolveCategoryLabel = typeof options.categoryLabelResolver === 'function'
    ? options.categoryLabelResolver
    : defaultCategoryLabel

  const entries = []

  subscriptions.forEach((subscription) => {
    const category = resolveCategoryLabel(subscription)

    getCleanPayments(subscription).forEach((payment) => {
      if (!payment.date.startsWith(`${monthKey}-`)) return

      entries.push({
        id: payment.id,
        subscriptionId: subscription.id,
        subscriptionName: subscription.name || 'Unnamed subscription',
        category,
        amount: parseAmount(payment.amount),
        date: payment.date,
      })
    })
  })

  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.subscriptionName !== b.subscriptionName) return a.subscriptionName.localeCompare(b.subscriptionName)
    return a.amount - b.amount
  })
}

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? '')
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export const getMonthlyActualSpend = (subscriptions, options = {}) => {
  const months = Number.isFinite(options.months) ? Math.max(1, Math.floor(options.months)) : 6
  const todayValue = toDateValue(options.todayValue) || formatDateLocal(new Date())
  const today = new Date(`${todayValue}T00:00:00`)

  if (Number.isNaN(today.getTime())) {
    return []
  }

  const resolveCategoryLabel = typeof options.categoryLabelResolver === 'function'
    ? options.categoryLabelResolver
    : defaultCategoryLabel

  const monthSeries = []
  const monthsMap = new Map()

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1)
    const monthKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

    const monthEntry = {
      monthKey,
      label: date.toLocaleString(undefined, { month: 'short' }),
      total: 0,
      categories: [],
      monthStart: formatDateLocal(new Date(date.getFullYear(), date.getMonth(), 1)),
      monthEnd: formatDateLocal(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    }

    monthsMap.set(monthKey, {
      ...monthEntry,
      categoryTotals: new Map(),
    })
    monthSeries.push(monthKey)
  }

  subscriptions.forEach((subscription) => {
    const categoryLabel = resolveCategoryLabel(subscription)

    getCleanPayments(subscription).forEach((payment) => {
      const monthKey = payment.date.slice(0, 7)
      const monthEntry = monthsMap.get(monthKey)
      if (!monthEntry) return

      const amount = parseAmount(payment.amount)
      monthEntry.total += amount
      monthEntry.categoryTotals.set(categoryLabel, (monthEntry.categoryTotals.get(categoryLabel) || 0) + amount)
    })
  })

  return monthSeries.map((monthKey) => {
    const monthEntry = monthsMap.get(monthKey)
    const categories = [...monthEntry.categoryTotals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))

    return {
      monthKey: monthEntry.monthKey,
      label: monthEntry.label,
      total: monthEntry.total,
      categories,
      monthStart: monthEntry.monthStart,
      monthEnd: monthEntry.monthEnd,
    }
  })
}

export const getMonthlySpendCsv = (monthlySeries) => {
  const header = ['Month', 'Month Start', 'Month End', 'Total', 'Category', 'Category Amount']
  const rows = [header.join(',')]

  monthlySeries.forEach((month) => {
    const baseColumns = [
      month.monthKey,
      month.monthStart || `${month.monthKey}-01`,
      month.monthEnd || '',
      parseAmount(month.total).toFixed(2),
    ]

    if (!Array.isArray(month.categories) || month.categories.length === 0) {
      rows.push(baseColumns.map(escapeCsvValue).join(','))
      return
    }

    month.categories.forEach((categoryRow, index) => {
      const columns = [
        ...(index === 0 ? baseColumns : ['', '', '', '']),
        categoryRow.category,
        parseAmount(categoryRow.total).toFixed(2),
      ]
      rows.push(columns.map(escapeCsvValue).join(','))
    })
  })

  return rows.join('\n')
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
