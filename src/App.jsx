import { useEffect, useMemo, useRef, useState } from 'react'
import { load } from '@tauri-apps/plugin-store'

const localStorageStateKey = 'subscription-tracker.state.v1'
const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

const categoryOptions = ['Streaming', 'Productivity', 'Utilities', 'Education', 'Gaming', 'News', 'Other']
const billingOptions = ['Monthly', 'Yearly', 'Quarterly', 'Weekly']

const initialFormState = {
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

const statusOptions = ['Active', 'Paused', 'Cancelled']

const statusStyles = {
  Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  Paused: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  Cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

const themeOptions = ['light', 'dark', 'system']

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const toDateValue = (value) => {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

const normalizeAmount = (value) => {
  if (value === '') return ''
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) return ''
  return Math.max(numberValue, 0)
}

const parseAmount = (value) => {
  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? 0 : numberValue
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

const sortSubscriptions = (items, sortKey) => {
  const sorted = [...items]
  switch (sortKey) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'amount':
      return sorted.sort((a, b) => a.amount - b.amount)
    case 'nextPayment':
      return sorted.sort((a, b) => new Date(a.nextPayment) - new Date(b.nextPayment))
    default:
      return sorted.sort((a, b) => new Date(a.nextPayment) - new Date(b.nextPayment))
  }
}

const getDueLabel = (dateValue) => {
  if (!dateValue) return 'No date'
  const today = new Date()
  const paymentDate = new Date(dateValue)
  const diffDays = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24))
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

const getCategoryLabel = (category, categoryDetail) => {
  if (category !== 'Other') return category
  const detail = categoryDetail.trim()
  return detail ? `Other: ${detail}` : 'Other'
}

const normalizePayment = (payment) => ({
  id: payment.id || `payment-${Date.now()}-${Math.random()}`,
  date: toDateValue(payment.date),
  amount: parseAmount(payment.amount),
})

const normalizeSubscription = (subscription) => {
  const currentPayment = subscription.currentPayment || ''
  const storedPayments = Array.isArray(subscription.payments)
    ? subscription.payments.map(normalizePayment).filter((payment) => payment.date)
    : []

  const payments =
    storedPayments.length > 0
      ? storedPayments
      : currentPayment
        ? [
            {
              id: `legacy-${subscription.id || 'sub'}-${currentPayment}`,
              date: toDateValue(currentPayment),
              amount: parseAmount(subscription.amount),
            },
          ]
        : []

  return {
    ...subscription,
    currentPayment,
    link: subscription.link || '',
    categoryDetail: subscription.categoryDetail || '',
    statusChangedAt: subscription.statusChangedAt || '',
    payments,
  }
}

const getTodayDate = () => new Date().toISOString().slice(0, 10)

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekDayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const startOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const DatePicker = ({ name, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedDate = value ? startOfDay(`${value}T00:00:00`) : null
  const [viewDate, setViewDate] = useState(selectedDate || startOfDay(new Date()))

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayIndex + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) return null
    return dayNumber
  })

  const selectDate = (dayNumber) => {
    const date = new Date(year, month, dayNumber)
    const nextValue = date.toISOString().slice(0, 10)
    onChange({ target: { name, value: nextValue } })
    setViewDate(date)
    setIsOpen(false)
  }

  const togglePicker = () => {
    if (!isOpen) {
      setViewDate(selectedDate || startOfDay(new Date()))
    }
    setIsOpen((open) => !open)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
        onClick={togglePicker}
      >
        {value || placeholder}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-[18rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-1 text-xs font-semibold">
            <button type="button" className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              ←
            </button>
            <span className="text-sm">{monthLabels[month]} {year}</span>
            <button type="button" className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              →
            </button>
          </div>

          <div className="mb-2 flex items-center justify-center gap-2 text-xs">
            <button type="button" className="rounded border border-slate-200 px-2 py-1 hover:border-brand-300 dark:border-slate-700" onClick={() => setViewDate(new Date(year - 5, month, 1))}>-5Y</button>
            <button type="button" className="rounded border border-slate-200 px-2 py-1 hover:border-brand-300 dark:border-slate-700" onClick={() => setViewDate(new Date(year + 5, month, 1))}>+5Y</button>
          </div>

          <div className="mb-3 grid grid-cols-4 gap-1 text-xs">
            {monthLabels.map((label, monthIndex) => (
              <button
                key={label}
                type="button"
                className={`rounded px-1 py-1.5 ${monthIndex === month ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                onClick={() => setViewDate(new Date(year, monthIndex, 1))}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400">
            {weekDayLabels.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 text-sm">
            {dayCells.map((dayNumber, index) => {
              if (!dayNumber) return <span key={`empty-${index}`} className="h-8" />

              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === year &&
                selectedDate.getMonth() === month &&
                selectedDate.getDate() === dayNumber

              return (
                <button
                  key={`${year}-${month}-${dayNumber}`}
                  type="button"
                  className={`h-8 rounded ${isSelected ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  onClick={() => selectDate(dayNumber)}
                >
                  {dayNumber}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

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
  payments: Array.isArray(subscription.payments)
    ? subscription.payments.map(normalizePayment).filter((payment) => payment.date)
    : [],
})

const toPersistedState = (subscriptions, themePreference) => ({
  version: 1,
  subscriptions: subscriptions.map(toPersistedSubscription),
  themePreference: themeOptions.includes(themePreference) ? themePreference : 'system',
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

const syncPayments = (existingSubscription, currentPayment, amount) => {
  const existingPayments = Array.isArray(existingSubscription?.payments) ? [...existingSubscription.payments] : []
  if (!currentPayment) return existingPayments

  const normalizedDate = toDateValue(currentPayment)
  const existingIndex = existingPayments.findIndex((payment) => toDateValue(payment.date) === normalizedDate)

  if (existingIndex >= 0) {
    existingPayments[existingIndex] = {
      ...existingPayments[existingIndex],
      date: normalizedDate,
      amount,
    }
    return existingPayments
  }

  existingPayments.push({
    id: `payment-${Date.now()}`,
    date: normalizedDate,
    amount,
  })

  return existingPayments
}

export default function App() {
  const [subscriptions, setSubscriptions] = useState([])
  const [formState, setFormState] = useState(initialFormState)
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sortKey, setSortKey] = useState('nextPayment')
  const [errorMessage, setErrorMessage] = useState('')
  const [themePreference, setThemePreference] = useState('system')
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [isLoaded, setIsLoaded] = useState(false)
  const [storeAccessible, setStoreAccessible] = useState(false)
  const [persistenceError, setPersistenceError] = useState('')
  const storeRef = useRef(null)

  const effectiveTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', effectiveTheme === 'dark')
    root.style.colorScheme = effectiveTheme === 'dark' ? 'dark' : 'light'
  }, [effectiveTheme])

  useEffect(() => {
    let mounted = true

    const loadSubscriptions = async () => {
      let canUseStore = false
      let hasAnyStoreData = false

      if (isTauriRuntime) {
        try {
          const appStore = await load('subscriptions.json')
          storeRef.current = appStore
          canUseStore = true

          const [storedSubscriptions, storedTheme] = await Promise.all([
            appStore.get('subscriptions'),
            appStore.get('themePreference'),
          ])

          if (!mounted) return

          if (Array.isArray(storedSubscriptions)) {
            setSubscriptions(storedSubscriptions.map(normalizeSubscription))
            hasAnyStoreData = true
          }

          if (typeof storedTheme === 'string' && themeOptions.includes(storedTheme)) {
            setThemePreference(storedTheme)
            hasAnyStoreData = true
          }
        } catch {
          canUseStore = false
        }
      }

      if (mounted) {
        setStoreAccessible(canUseStore)
      }

      const localState = parseLocalState()

      if (!hasAnyStoreData && localState && mounted) {
        if (Array.isArray(localState.subscriptions)) {
          setSubscriptions(localState.subscriptions.map(normalizeSubscription))
        }
        if (typeof localState.themePreference === 'string' && themeOptions.includes(localState.themePreference)) {
          setThemePreference(localState.themePreference)
        }
      }

      if (mounted) {
        setIsLoaded(true)
      }
    }

    loadSubscriptions()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    const persist = async () => {
      const persistedState = toPersistedState(subscriptions, themePreference)
      let storeError = null
      let localStorageError = null

      if (storeAccessible && storeRef.current) {
        try {
          await Promise.all([
            storeRef.current.set('subscriptions', persistedState.subscriptions),
            storeRef.current.set('themePreference', persistedState.themePreference),
          ])
          await storeRef.current.save()
        } catch (error) {
          storeError = error
        }
      }

      try {
        window.localStorage.setItem(localStorageStateKey, JSON.stringify(persistedState))
      } catch (error) {
        localStorageError = error
      }

      if ((storeAccessible && storeError && localStorageError) || (!storeAccessible && localStorageError)) {
        setPersistenceError('Persistence failed: unable to save your data.')
        return
      }

      setPersistenceError('')
    }

    persist()
  }, [subscriptions, themePreference, isLoaded, storeAccessible])

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = subscriptions.filter((subscription) => {
      const categoryLabel = getCategoryLabel(subscription.category, subscription.categoryDetail).toLowerCase()
      const matchesQuery = !normalizedQuery || subscription.name.toLowerCase().includes(normalizedQuery) || categoryLabel.includes(normalizedQuery)
      const matchesStatus = statusFilter === 'All' || subscription.status === statusFilter
      const matchesCategory = categoryFilter === 'All' || subscription.category === categoryFilter
      return matchesQuery && matchesStatus && matchesCategory
    })

    return sortSubscriptions(filtered, sortKey)
  }, [subscriptions, query, statusFilter, categoryFilter, sortKey])

  const metrics = useMemo(() => {
    const totalMonthly = subscriptions.reduce((sum, subscription) => {
      const monthlyCost = calculateMonthlyCost(subscription.amount, subscription.billingCycle)
      return sum + monthlyCost
    }, 0)

    const totalLoggedSpend = subscriptions.reduce((sum, subscription) => {
      const paymentTotal = (subscription.payments || []).reduce((paymentSum, payment) => paymentSum + parseAmount(payment.amount), 0)
      return sum + paymentTotal
    }, 0)

    const activeCount = subscriptions.filter((subscription) => subscription.status === 'Active').length

    return {
      totalMonthly,
      totalLoggedSpend,
      activeCount,
    }
  }, [subscriptions])

  const upcomingPayments = useMemo(() => {
    return [...subscriptions]
      .filter((subscription) => subscription.status === 'Active')
      .sort((a, b) => new Date(a.nextPayment) - new Date(b.nextPayment))
      .slice(0, 3)
  }, [subscriptions])

  const resetForm = () => {
    setFormState(initialFormState)
    setEditingId(null)
    setErrorMessage('')
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'amount') {
      setFormState((prev) => ({
        ...prev,
        amount: normalizeAmount(value),
      }))
      return
    }

    if (name === 'category' && value !== 'Other') {
      setFormState((prev) => ({
        ...prev,
        category: value,
        categoryDetail: '',
      }))
      return
    }

    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleDateChange = (event) => {
    handleChange(event)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!formState.name.trim()) {
      setErrorMessage('Please enter a subscription name.')
      return
    }
    if (!formState.amount) {
      setErrorMessage('Please enter the subscription cost.')
      return
    }
    if (!formState.nextPayment) {
      setErrorMessage('Please select a next payment date.')
      return
    }
    if (formState.category === 'Other' && !formState.categoryDetail.trim()) {
      setErrorMessage('Please enter a custom category when choosing Other.')
      return
    }

    const normalizedLinkValue = normalizeLink(formState.link)
    const parsedAmount = parseAmount(formState.amount)

    setSubscriptions((prev) => {
      const existing = editingId ? prev.find((subscription) => subscription.id === editingId) : null
      const nextEntry = {
        id: editingId ?? `sub-${Date.now()}`,
        name: formState.name.trim(),
        amount: parsedAmount,
        billingCycle: formState.billingCycle,
        category: formState.category,
        categoryDetail: formState.category === 'Other' ? formState.categoryDetail.trim() : '',
        nextPayment: formState.nextPayment,
        currentPayment: formState.currentPayment,
        link: normalizedLinkValue,
        notes: formState.notes.trim(),
        status: formState.status,
        statusChangedAt: editingId ? getTodayDate() : '',
        payments: syncPayments(existing, formState.currentPayment, parsedAmount),
      }

      if (editingId) {
        return prev.map((subscription) =>
          subscription.id === editingId
            ? {
                ...nextEntry,
                statusChangedAt:
                  existing && existing.status !== formState.status ? getTodayDate() : existing?.statusChangedAt || '',
              }
            : subscription,
        )
      }

      return [nextEntry, ...prev]
    })

    resetForm()
  }

  const handleEdit = (subscription) => {
    setEditingId(subscription.id)
    setFormState({
      name: subscription.name,
      amount: subscription.amount,
      billingCycle: subscription.billingCycle,
      category: subscription.category,
      categoryDetail: subscription.categoryDetail || '',
      nextPayment: toDateValue(subscription.nextPayment),
      currentPayment: toDateValue(subscription.currentPayment),
      link: subscription.link || '',
      notes: subscription.notes,
      status: subscription.status,
    })
  }

  const handleDelete = (subscriptionId) => {
    if (!confirm('Delete this subscription?')) return
    setSubscriptions((prev) => prev.filter((subscription) => subscription.id !== subscriptionId))
    if (editingId === subscriptionId) {
      resetForm()
    }
  }

  const handleStatusToggle = (subscription) => {
    const nextStatus = subscription.status === 'Active' ? 'Paused' : 'Active'
    const statusDate = prompt(`${nextStatus} date (YYYY-MM-DD):`, getTodayDate())
    if (statusDate === null) return

    setSubscriptions((prev) =>
      prev.map((item) =>
        item.id === subscription.id
          ? {
              ...item,
              status: nextStatus,
              statusChangedAt: statusDate || getTodayDate(),
            }
          : item,
      ),
    )
  }

  const handleThemeToggle = () => {
    setThemePreference((currentPreference) => {
      const currentTheme = currentPreference === 'system' ? systemTheme : currentPreference
      return currentTheme === 'dark' ? 'light' : 'dark'
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {persistenceError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {persistenceError}
          </div>
        )}

        <header className="flex flex-col gap-4 rounded-2xl bg-white px-8 py-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Subscription Tracker</p>
              <h1 className="text-3xl font-semibold">Keep every renewal in one calm dashboard.</h1>
              <p className="text-slate-500 dark:text-slate-400">Track costs, next billing dates, and total spend across your subscriptions.</p>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
            >
              {effectiveTheme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Theme default: system preference (saved after first toggle).</p>
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
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Your subscriptions</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{filteredSubscriptions.length} items</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <input
                    className="w-56 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                    placeholder="Search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <select
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  {['All', ...statusOptions].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  {['All', ...categoryOptions].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value)}
                >
                  <option value="nextPayment">Sort by next payment</option>
                  <option value="name">Sort by name</option>
                  <option value="amount">Sort by cost</option>
                </select>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {filteredSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-100 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800"
                >
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{subscription.name}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[subscription.status]}`}
                      >
                        {subscription.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <span>{getCategoryLabel(subscription.category, subscription.categoryDetail)}</span>
                      <span>•</span>
                      <span>{subscription.billingCycle}</span>
                      <span>•</span>
                      <span>
                        {currencyFormatter.format(subscription.amount)} / {subscription.billingCycle}
                      </span>
                    </div>
                    {subscription.link && (
                      <a
                        className="text-sm text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        href={subscription.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open subscription link
                      </a>
                    )}
                    <p className="text-sm text-slate-500 dark:text-slate-400">{subscription.notes || 'No notes yet.'}</p>
                  </div>
                  <div className="flex flex-col items-start gap-3 text-sm md:items-end">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Next payment</p>
                      <p className="text-base font-semibold">{toDateValue(subscription.nextPayment)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{getDueLabel(subscription.nextPayment)}</p>
                      {subscription.currentPayment && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Current payment: {toDateValue(subscription.currentPayment)}</p>
                      )}
                      {!!subscription.payments?.length && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Logged payments: {subscription.payments.length}</p>
                      )}
                      {subscription.statusChangedAt && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {subscription.status} on {toDateValue(subscription.statusChangedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                        onClick={() => handleStatusToggle(subscription)}
                      >
                        {subscription.status === 'Active' ? 'Pause with date' : 'Activate with date'}
                      </button>
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                        onClick={() => handleEdit(subscription)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-400 dark:border-rose-500/40 dark:text-rose-300"
                        onClick={() => handleDelete(subscription.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit subscription' : 'Add subscription'}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Capture the next renewal in seconds.</p>

              <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Name</label>
                  <input
                    name="name"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                    value={formState.name}
                    onChange={handleChange}
                    placeholder="e.g. Netflix"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Cost</label>
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.amount}
                      onChange={handleChange}
                      placeholder="15.99"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Billing cycle</label>
                    <select
                      name="billingCycle"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.billingCycle}
                      onChange={handleChange}
                    >
                      {billingOptions.map((cycle) => (
                        <option key={cycle} value={cycle}>
                          {cycle}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Category</label>
                    <select
                      name="category"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.category}
                      onChange={handleChange}
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Status</label>
                    <select
                      name="status"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.status}
                      onChange={handleChange}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {formState.category === 'Other' && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Custom category label</label>
                    <input
                      name="categoryDetail"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.categoryDetail}
                      onChange={handleChange}
                      placeholder="e.g. Cloud storage"
                    />
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Next payment</label>
                    <div className="mt-1">
                      <DatePicker
                        name="nextPayment"
                        value={formState.nextPayment}
                        onChange={handleDateChange}
                        placeholder="Select date"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Current payment</label>
                    <div className="mt-1">
                      <DatePicker
                        name="currentPayment"
                        value={formState.currentPayment}
                        onChange={handleDateChange}
                        placeholder="Select date"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Subscription link</label>
                  <input
                    name="link"
                    type="url"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                    value={formState.link}
                    onChange={handleChange}
                    placeholder="https://example.com/manage"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Notes</label>
                  <textarea
                    name="notes"
                    className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                    value={formState.notes}
                    onChange={handleChange}
                    placeholder="Plan details, renewal notes, etc."
                  />
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
                  >
                    {editingId ? 'Save changes' : 'Add subscription'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                      onClick={resetForm}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
              <h2 className="text-xl font-semibold">Upcoming renewals</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your next three active renewals.</p>
              <div className="mt-4 space-y-3">
                {upcomingPayments.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No active subscriptions yet.</p>}
                {upcomingPayments.map((subscription) => (
                  <div key={subscription.id} className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{subscription.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{getDueLabel(subscription.nextPayment)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{currencyFormatter.format(subscription.amount)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{subscription.billingCycle}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
