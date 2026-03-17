import { useEffect, useMemo, useRef, useState } from 'react'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { load } from '@tauri-apps/plugin-store'
import {
  addSubscription,
  calculateMetrics,
  deleteSubscription,
  editSubscription,
  fromCsv,
  getTodayDate,
  markPaidToday,
  migrateSubscriptions,
  normalizeSubscription,
  toCsv,
  toJson,
  toPersistedState,
} from './lib/subscriptions'

const localStorageStateKey = 'subscription-tracker.state.v1'
const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const categoryOptions = ['Streaming', 'Productivity', 'Utilities', 'Education', 'Gaming', 'News', 'Other']
const billingOptions = ['Monthly', 'Yearly', 'Quarterly', 'Weekly']
const statusOptions = ['Active', 'Paused', 'Cancelled']

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

const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })

const normalizeLink = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function App() {
  const [subscriptions, setSubscriptions] = useState([])
  const [themePreference, setThemePreference] = useState('system')
  const [isLoaded, setIsLoaded] = useState(false)
  const [storeAccessible, setStoreAccessible] = useState(false)
  const [persistenceError, setPersistenceError] = useState('')

  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [formState, setFormState] = useState(initialFormState)
  const [formError, setFormError] = useState('')
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const storeRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let mounted = true

    const loadState = async () => {
      let hasAnyStoreData = false
      let canUseStore = false

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
            setSubscriptions(migrateSubscriptions(storedSubscriptions))
            hasAnyStoreData = true
          }

          if (typeof storedTheme === 'string') {
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

      if (!hasAnyStoreData) {
        try {
          const raw = window.localStorage.getItem(localStorageStateKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed?.subscriptions)) {
              setSubscriptions(migrateSubscriptions(parsed))
            }
            if (typeof parsed?.themePreference === 'string') {
              setThemePreference(parsed.themePreference)
            }
          }
        } catch {
          // noop
        }
      }

      if (mounted) setIsLoaded(true)
    }

    loadState()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    const persist = async () => {
      const state = toPersistedState(subscriptions, themePreference)
      let localError = null
      let storeError = null

      if (storeAccessible && storeRef.current) {
        try {
          await Promise.all([
            storeRef.current.set('subscriptions', state.subscriptions),
            storeRef.current.set('themePreference', state.themePreference),
          ])
          await storeRef.current.save()
        } catch (error) {
          storeError = error
        }
      }

      try {
        window.localStorage.setItem(localStorageStateKey, JSON.stringify(state))
      } catch (error) {
        localError = error
      }

      if ((storeAccessible && storeError && localError) || (!storeAccessible && localError)) {
        setPersistenceError('Persistence failed: unable to save your data.')
      } else {
        setPersistenceError('')
      }
    }

    persist()
  }, [subscriptions, themePreference, isLoaded, storeAccessible])

  const filteredSubscriptions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return subscriptions.filter((subscription) => {
      const categoryLabel = subscription.category === 'Other' && subscription.categoryDetail
        ? `Other: ${subscription.categoryDetail}`
        : subscription.category
      return !needle || subscription.name.toLowerCase().includes(needle) || categoryLabel.toLowerCase().includes(needle)
    })
  }, [subscriptions, query])

  const metrics = useMemo(() => calculateMetrics(subscriptions), [subscriptions])

  const openCreateModal = () => {
    setEditingId(null)
    setFormState(initialFormState)
    setFormError('')
    setIsFormModalOpen(true)
  }

  const openEditModal = (subscription) => {
    setEditingId(subscription.id)
    setFormState({ ...initialFormState, ...subscription })
    setFormError('')
    setIsFormModalOpen(true)
  }

  const submitForm = (event) => {
    event.preventDefault()
    if (!formState.name.trim()) return setFormError('Please enter a subscription name.')
    if (!formState.amount) return setFormError('Please enter an amount.')
    if (!formState.nextPayment) return setFormError('Please choose a next payment date.')
    if (formState.category === 'Other' && !formState.categoryDetail.trim()) return setFormError('Please enter a custom category.')

    const payload = normalizeSubscription({
      ...formState,
      id: editingId || undefined,
      link: normalizeLink(formState.link || ''),
      statusChangedAt: editingId ? getTodayDate() : '',
    })

    setSubscriptions((prev) => (editingId ? editSubscription(prev, editingId, payload) : addSubscription(prev, payload)))
    setIsFormModalOpen(false)
    setFormState(initialFormState)
    setEditingId(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setSubscriptions((prev) => deleteSubscription(prev, deleteTarget.id))
    setDeleteTarget(null)
  }

  const handleMarkPaidToday = (subscriptionId) => {
    setSubscriptions((prev) => markPaidToday(prev, subscriptionId, getTodayDate()))
  }

  const handleOpenLink = async (subscription) => {
    const url = normalizeLink(subscription.link || '')
    if (!url) return
    if (isTauriRuntime) await openExternal(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  const downloadFile = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()

    let imported = []
    if (file.name.toLowerCase().endsWith('.csv')) {
      imported = fromCsv(text)
    } else {
      const parsed = JSON.parse(text)
      imported = migrateSubscriptions(parsed)
    }

    if (imported.length) {
      setSubscriptions((prev) => [...imported, ...prev])
    }

    event.target.value = ''
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {persistenceError && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{persistenceError}</div>}

        <header className="mb-6 rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Subscription Tracker</h1>
              <p className="text-sm text-slate-500">Track renewals, log payments, and keep costs visible.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-full border px-4 py-2 text-sm" onClick={openCreateModal}>+ Add subscription</button>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => fileInputRef.current?.click()}>Import JSON/CSV</button>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => downloadFile('subscriptions-export.json', toJson(subscriptions), 'application/json')}>Export JSON</button>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => downloadFile('subscriptions-export.csv', toCsv(subscriptions), 'text/csv;charset=utf-8')}>Export CSV</button>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => setThemePreference((v) => (v === 'dark' ? 'light' : 'dark'))}>
                Theme: {themePreference}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept=".json,.csv" onChange={handleImport} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">Total: <b>{metrics.total}</b></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">Active: <b>{metrics.active}</b></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">Categories: <b>{metrics.categories}</b></div>
          </div>
        </header>

        <div className="mb-4">
          <input
            className="w-full rounded-lg border bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Search subscriptions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="grid gap-4">
          {filteredSubscriptions.map((subscription) => (
            <div key={subscription.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{subscription.name}</h3>
                  <p className="text-sm text-slate-500">
                    {subscription.category} • {subscription.billingCycle} • {currencyFormatter.format(subscription.amount)}
                  </p>
                  <p className="text-sm text-slate-500">Next payment: {subscription.nextPayment}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full border px-3 py-1 text-xs" onClick={() => handleMarkPaidToday(subscription.id)}>Mark paid today</button>
                  <button className="rounded-full border px-3 py-1 text-xs" onClick={() => openEditModal(subscription)}>Edit</button>
                  <button className="rounded-full border border-rose-300 px-3 py-1 text-xs text-rose-600" onClick={() => setDeleteTarget(subscription)}>Delete</button>
                  {!!subscription.link && (
                    <button className="rounded-full border px-3 py-1 text-xs" onClick={() => handleOpenLink(subscription)}>Open link</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!filteredSubscriptions.length && <p className="text-sm text-slate-500">No subscriptions found.</p>}
        </div>
      </div>

      {isFormModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitForm} className="w-full max-w-2xl rounded-2xl bg-white p-6 dark:bg-slate-900">
            <h2 className="mb-4 text-xl font-semibold">{editingId ? 'Edit subscription' : 'Add subscription'}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="name" placeholder="Name" className="rounded border p-2" value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} />
              <input name="amount" type="number" min="0" step="0.01" placeholder="Amount" className="rounded border p-2" value={formState.amount} onChange={(e) => setFormState((p) => ({ ...p, amount: e.target.value }))} />
              <select className="rounded border p-2" value={formState.billingCycle} onChange={(e) => setFormState((p) => ({ ...p, billingCycle: e.target.value }))}>
                {billingOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select className="rounded border p-2" value={formState.category} onChange={(e) => setFormState((p) => ({ ...p, category: e.target.value }))}>
                {categoryOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input type="date" className="rounded border p-2" value={formState.nextPayment} onChange={(e) => setFormState((p) => ({ ...p, nextPayment: e.target.value }))} />
              <select className="rounded border p-2" value={formState.status} onChange={(e) => setFormState((p) => ({ ...p, status: e.target.value }))}>
                {statusOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input placeholder="Subscription link" className="rounded border p-2 md:col-span-2" value={formState.link} onChange={(e) => setFormState((p) => ({ ...p, link: e.target.value }))} />
              <textarea placeholder="Notes" className="rounded border p-2 md:col-span-2" value={formState.notes} onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}

            <div className="mt-5 flex gap-2">
              <button type="submit" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Save</button>
              <button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={() => setIsFormModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900">
            <h3 className="text-lg font-semibold">Delete {deleteTarget.name}?</h3>
            <p className="mt-2 text-sm text-slate-500">This action cannot be undone.</p>
            <div className="mt-5 flex gap-2">
              <button className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={confirmDelete}>Delete</button>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
