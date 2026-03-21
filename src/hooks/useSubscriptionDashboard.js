import { useEffect, useMemo, useState } from 'react'
import { parseDateValue } from '../subscriptionLogic'

export function useSubscriptionDashboard({
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
  initialAnalyticsRangeMonths,
  query,
  sortKey,
  sortSubscriptions,
  statusFilter,
  subscriptions,
  todayValue,
}) {
  const [analyticsRangeMonths, setAnalyticsRangeMonths] = useState(initialAnalyticsRangeMonths)
  const [hoveredMonthKey, setHoveredMonthKey] = useState('')
  const [lockedMonthKey, setLockedMonthKey] = useState('')
  const [expandedMonthCategories, setExpandedMonthCategories] = useState({})
  const [paymentEntriesModalMonthKey, setPaymentEntriesModalMonthKey] = useState('')

  useEffect(() => {
    setAnalyticsRangeMonths(initialAnalyticsRangeMonths)
  }, [initialAnalyticsRangeMonths])

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = subscriptions.filter((subscription) => {
      const categoryLabel = getCategoryLabel(subscription.category, subscription.categoryDetail).toLowerCase()
      const matchesQuery = !normalizedQuery || subscription.name.toLowerCase().includes(normalizedQuery) || categoryLabel.includes(normalizedQuery)
      const matchesStatus = statusFilter === 'All' || subscription.status === statusFilter
      const matchesCategory = categoryFilter === 'All' || subscription.category === categoryFilter
      return matchesQuery && matchesStatus && matchesCategory
    })

    const sortOptions = {
      categoryLabelResolver: (subscription) => getCategoryLabel(subscription.category, subscription.categoryDetail),
    }

    if (dueWindowFilter === '7d') {
      return sortSubscriptions(getDueWindowSubscriptions(filtered, 7, todayValue), sortKey, sortOptions)
    }

    if (dueWindowFilter === '30d') {
      return sortSubscriptions(getDueWindowSubscriptions(filtered, 30, todayValue), sortKey, sortOptions)
    }

    return sortSubscriptions(filtered, sortKey, sortOptions)
  }, [subscriptions, query, statusFilter, categoryFilter, dueWindowFilter, sortKey, todayValue, getCategoryLabel, getDueWindowSubscriptions, sortSubscriptions])

  const metrics = useMemo(() => {
    const totalMonthly = subscriptions.reduce((sum, subscription) => {
      const monthlyCost = calculateMonthlyCost(subscription.amount, subscription.billingCycle)
      return sum + monthlyCost
    }, 0)

    const totalLoggedSpend = getTotalLoggedSpend(subscriptions)
    const activeCount = subscriptions.filter((subscription) => subscription.status === 'Active').length

    return {
      totalMonthly,
      totalLoggedSpend,
      activeCount,
    }
  }, [subscriptions, calculateMonthlyCost, getTotalLoggedSpend])

  const monthlyActualSpend = useMemo(
    () => getMonthlyActualSpend(subscriptions, { months: analyticsRangeMonths, todayValue }),
    [subscriptions, analyticsRangeMonths, todayValue, getMonthlyActualSpend],
  )

  const highestMonthlyActualSpend = useMemo(
    () => monthlyActualSpend.reduce((max, month) => Math.max(max, month.total), 0),
    [monthlyActualSpend],
  )

  const selectedMonthKey = lockedMonthKey || hoveredMonthKey

  const selectedMonthDetails = useMemo(
    () => monthlyActualSpend.find((month) => month.monthKey === selectedMonthKey) || null,
    [monthlyActualSpend, selectedMonthKey],
  )

  const selectedMonthCategoryColors = useMemo(() => {
    if (!selectedMonthDetails) return {}
    return getDistinctCategoryColors(selectedMonthDetails.categories.map((entry) => entry.category))
  }, [selectedMonthDetails, getDistinctCategoryColors])

  const selectedMonthPaymentEntries = useMemo(() => {
    if (!selectedMonthKey) return []
    return getMonthlyPaymentEntries(subscriptions, selectedMonthKey, {
      categoryLabelResolver: (subscription) => getCategoryLabel(subscription.category, subscription.categoryDetail),
    })
  }, [subscriptions, selectedMonthKey, getCategoryLabel, getMonthlyPaymentEntries])

  const selectedMonthEntriesByCategory = useMemo(() => {
    return selectedMonthPaymentEntries.reduce((map, entry) => {
      const currentEntries = map[entry.category] || []
      currentEntries.push(entry)
      map[entry.category] = currentEntries
      return map
    }, {})
  }, [selectedMonthPaymentEntries])

  const paymentEntriesModalMonth = useMemo(
    () => monthlyActualSpend.find((month) => month.monthKey === paymentEntriesModalMonthKey) || null,
    [monthlyActualSpend, paymentEntriesModalMonthKey],
  )

  const paymentEntriesModalEntries = useMemo(() => {
    if (!paymentEntriesModalMonthKey) return []
    return getMonthlyPaymentEntries(subscriptions, paymentEntriesModalMonthKey, {
      categoryLabelResolver: (subscription) => getCategoryLabel(subscription.category, subscription.categoryDetail),
    })
  }, [subscriptions, paymentEntriesModalMonthKey, getCategoryLabel, getMonthlyPaymentEntries])

  const upcomingPayments = useMemo(() => {
    return [...subscriptions]
      .filter((subscription) => subscription.status === 'Active')
      .sort((a, b) => parseDateValue(a.nextPayment) - parseDateValue(b.nextPayment))
      .slice(0, 3)
  }, [subscriptions])

  const deletingSubscription = useMemo(
    () => subscriptions.find((subscription) => subscription.id === deletingSubscriptionId) || null,
    [subscriptions, deletingSubscriptionId],
  )

  const handleExportMonthlySpend = () => {
    if (monthlyActualSpend.length === 0) return

    const csv = getMonthlySpendCsv(monthlyActualSpend)
    const fileName = `spend-history-${analyticsRangeMonths}m.csv`
    const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`

    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  const handleMonthClick = (monthKey) => {
    setLockedMonthKey((current) => {
      const nextValue = current === monthKey ? '' : monthKey
      if (!nextValue) {
        setExpandedMonthCategories({})
        setPaymentEntriesModalMonthKey('')
      } else {
        setPaymentEntriesModalMonthKey(nextValue)
      }
      return nextValue
    })
  }

  const handleCategoryToggle = (category) => {
    if (!selectedMonthKey) return

    setExpandedMonthCategories((current) => {
      const monthExpanded = current[selectedMonthKey] || {}
      return {
        ...current,
        [selectedMonthKey]: {
          ...monthExpanded,
          [category]: !monthExpanded[category],
        },
      }
    })
  }

  return {
    analyticsRangeMonths,
    deletingSubscription,
    expandedMonthCategories,
    filteredSubscriptions,
    handleCategoryToggle,
    handleExportMonthlySpend,
    handleMonthClick,
    highestMonthlyActualSpend,
    hoveredMonthKey,
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
  }
}
