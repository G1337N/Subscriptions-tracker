import { useEffect, useMemo, useState } from 'react'
import { Store } from '@tauri-apps/plugin-store'

const store = new Store('subscriptions.json')

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

const normalizeSubscription = (subscription) => ({
  ...subscription,
  currentPayment: subscription.currentPayment || '',
  link: subscription.link || '',
  statusChangedAt: subscription.statusChangedAt || '',
})

const getTodayDate = () => new Date().toISOString().slice(0, 10)

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
      try {
        const [storedSubscriptions, storedTheme] = await Promise.all([
          store.get('subscriptions'),
          store.get('themePreference'),
        ])

        if (mounted) {
          if (Array.isArray(storedSubscriptions)) {
            setSubscriptions(storedSubscriptions.map(normalizeSubscription))
          } else {
            setSubscriptions([])
          }

          if (typeof storedTheme === 'string' && themeOptions.includes(storedTheme)) {
            setThemePreference(storedTheme)
          }

          setIsLoaded(true)
        }
      } catch {
        if (mounted) {
          setSubscriptions([])
          setIsLoaded(true)
        }
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
      await Promise.all([
        store.set('subscriptions', subscriptions),
        store.set('themePreference', themePreference),
      ])
      await store.save()
    }

    persist()
  }, [subscriptions, themePreference, isLoaded])

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = subscriptions.filter((subscription) => {
      const matchesQuery =
        !normalizedQuery ||
        subscription.name.toLowerCase().includes(normalizedQuery) ||
        subscription.category.toLowerCase().includes(normalizedQuery)
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

    const totalYearly = totalMonthly * 12
    const activeCount = subscriptions.filter((subscription) => subscription.status === 'Active').length

    return {
      totalMonthly,
      totalYearly,
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

    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
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

    const normalizedLink = normalizeLink(formState.link)

    const newEntry = {
      id: editingId ?? `sub-${Date.now()}`,
      name: formState.name.trim(),
      amount: parseAmount(formState.amount),
      billingCycle: formState.billingCycle,
      category: formState.category,
      nextPayment: formState.nextPayment,
      currentPayment: formState.currentPayment,
      link: normalizedLink,
      notes: formState.notes.trim(),
      status: formState.status,
      statusChangedAt: editingId ? getTodayDate() : '',
    }

    setSubscriptions((prev) => {
      if (editingId) {
        const existing = prev.find((subscription) => subscription.id === editingId)
        return prev.map((subscription) =>
          subscription.id === editingId
            ? {
                ...newEntry,
                statusChangedAt:
                  existing && existing.status !== formState.status ? getTodayDate() : existing?.statusChangedAt || '',
              }
            : subscription,
        )
      }
      return [newEntry, ...prev]
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
              <p className="text-sm text-slate-500 dark:text-slate-400">Annual spend</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{currencyFormatter.format(metrics.totalYearly)}</p>
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
                      <span>{subscription.category}</span>
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Next payment</label>
                    <input
                      name="nextPayment"
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.nextPayment}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Current payment</label>
                    <input
                      name="currentPayment"
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/40"
                      value={formState.currentPayment}
                      onChange={handleChange}
                    />
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
