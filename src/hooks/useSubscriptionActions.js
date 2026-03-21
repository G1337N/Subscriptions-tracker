import { useState } from 'react'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { exportSubscriptions } from '../lib/subscriptionExport'
import { getErrorDetails, getSubmissionPayments } from '../lib/subscriptionSubmission'
import {
  createSubscription as createSubscriptionRecord,
  deleteSubscription as deleteSubscriptionRecord,
  isTauriRuntime,
  updateSettings as updateDesktopSettings,
  updateSubscription as updateSubscriptionRecord,
} from '../tauriApi'

export const useSubscriptionActions = ({
  getTodayDate,
  initialFormState,
  normalizeAmount,
  normalizeLink,
  normalizeSubscription,
  parseAmount,
  renewSubscription,
  setAppSettings,
  setPersistenceError,
  setSubscriptions,
  setThemePreference,
  subscriptions,
  systemTheme,
  themePreference,
  getDateDiffInDays,
  toDateValue,
}) => {
  const [formState, setFormState] = useState(initialFormState)
  const [editingId, setEditingId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [linkErrors, setLinkErrors] = useState({})
  const [renewingSubscriptionId, setRenewingSubscriptionId] = useState(null)
  const [renewForm, setRenewForm] = useState({ amountPaid: '', paymentDate: getTodayDate(), newExpiryDate: '' })
  const [renewError, setRenewError] = useState('')
  const [deletingSubscriptionId, setDeletingSubscriptionId] = useState(null)

  const resetForm = () => {
    setFormState(initialFormState)
    setEditingId(null)
    setErrorMessage('')
  }

  const exportIfDesktop = async (nextSubscriptions) => {
    if (!isTauriRuntime) return

    try {
      await exportSubscriptions(nextSubscriptions)
    } catch (error) {
      console.error('Failed to export subscriptions after save:', error)
      setPersistenceError('Saved subscription data, but export to ~/subscriptions/subscriptions.json failed.')
    }
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

  const handleSubmit = async (event) => {
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
    const targetId = editingId ?? `sub-${Date.now()}`
    const existing = editingId ? subscriptions.find((subscription) => subscription.id === editingId) : null

    const nextEntry = {
      id: targetId,
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
      statusChangedAt:
        editingId && existing && existing.status !== formState.status ? getTodayDate() : existing?.statusChangedAt || '',
      payments: getSubmissionPayments({
        existingSubscription: existing,
        currentPayment: formState.currentPayment,
        amount: parsedAmount,
      }),
    }

    try {
      let savedSubscription = nextEntry
      if (isTauriRuntime) {
        savedSubscription = editingId
          ? await updateSubscriptionRecord(editingId, nextEntry)
          : await createSubscriptionRecord(nextEntry)
      }

      const normalizedSavedSubscription = normalizeSubscription(savedSubscription)
      const nextSubscriptions = editingId
        ? subscriptions.map((subscription) => (subscription.id === editingId ? normalizedSavedSubscription : subscription))
        : [normalizedSavedSubscription, ...subscriptions]

      setSubscriptions(nextSubscriptions)
      await exportIfDesktop(nextSubscriptions)

      setPersistenceError('')
      setLinkErrors((prev) => {
        if (!prev[targetId]) return prev
        const next = { ...prev }
        delete next[targetId]
        return next
      })
      resetForm()
    } catch (error) {
      const details = getErrorDetails(error)
      setErrorMessage(details ? `Could not save this subscription: ${details}` : 'Could not save this subscription.')
    }
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
    setDeletingSubscriptionId(subscriptionId)
  }

  const cancelDelete = () => {
    setDeletingSubscriptionId(null)
  }

  const confirmDeleteSubscription = async () => {
    if (!deletingSubscriptionId) return

    try {
      if (isTauriRuntime) {
        await deleteSubscriptionRecord(deletingSubscriptionId)
      }

      const nextSubscriptions = subscriptions.filter((subscription) => subscription.id !== deletingSubscriptionId)
      setSubscriptions(nextSubscriptions)
      await exportIfDesktop(nextSubscriptions)
      setLinkErrors((prev) => {
        if (!prev[deletingSubscriptionId]) return prev
        const next = { ...prev }
        delete next[deletingSubscriptionId]
        return next
      })

      if (editingId === deletingSubscriptionId) {
        resetForm()
      }

      setPersistenceError('')
      setDeletingSubscriptionId(null)
    } catch {
      setPersistenceError('Could not delete this subscription.')
    }
  }

  const handlePause = async (subscription) => {
    if (subscription.status !== 'Active') return

    const nextSubscription = {
      ...subscription,
      status: 'Paused',
      statusChangedAt: getTodayDate(),
    }

    try {
      const savedSubscription = isTauriRuntime
        ? await updateSubscriptionRecord(subscription.id, nextSubscription)
        : nextSubscription

      const normalizedSavedSubscription = normalizeSubscription(savedSubscription)
      const nextSubscriptions = subscriptions.map((item) => (item.id === subscription.id ? normalizedSavedSubscription : item))
      setSubscriptions(nextSubscriptions)
      await exportIfDesktop(nextSubscriptions)
      setPersistenceError('')
    } catch {
      setPersistenceError('Could not pause this subscription.')
    }
  }

  const handleOpenRenew = (subscription) => {
    setRenewingSubscriptionId(subscription.id)
    setRenewError('')
    const defaultRenewalDate = toDateValue(subscription.nextPayment) || getTodayDate()
    setRenewForm({
      amountPaid: String(subscription.amount || ''),
      paymentDate: defaultRenewalDate,
      newExpiryDate: defaultRenewalDate,
    })
  }

  const handleRenewFormChange = (field, value) => {
    setRenewForm((prev) => ({ ...prev, [field]: value }))
  }

  const closeRenewModal = () => {
    setRenewingSubscriptionId(null)
  }

  const handleRenewSubmit = async (event) => {
    event.preventDefault()
    if (!renewForm.amountPaid || !renewForm.paymentDate || !renewForm.newExpiryDate) {
      setRenewError('Please complete all renewal fields.')
      return
    }

    if (getDateDiffInDays(renewForm.newExpiryDate, renewForm.paymentDate) < 0) {
      setRenewError('New expiry date should be on or after the renewal payment date.')
      return
    }

    const targetSubscription = subscriptions.find((item) => item.id === renewingSubscriptionId)
    if (!targetSubscription) {
      setRenewError('Could not find this subscription.')
      return
    }

    const nextSubscription = renewSubscription(targetSubscription, {
      amountPaid: renewForm.amountPaid,
      paymentDate: renewForm.paymentDate,
      newExpiryDate: renewForm.newExpiryDate,
    })

    try {
      const savedSubscription = isTauriRuntime
        ? await updateSubscriptionRecord(renewingSubscriptionId, nextSubscription)
        : nextSubscription

      const normalizedSavedSubscription = normalizeSubscription(savedSubscription)
      const nextSubscriptions = subscriptions.map((item) => (item.id === renewingSubscriptionId ? normalizedSavedSubscription : item))
      setSubscriptions(nextSubscriptions)
      await exportIfDesktop(nextSubscriptions)

      setRenewingSubscriptionId(null)
      setRenewError('')
      setPersistenceError('')
    } catch {
      setRenewError('Could not save this renewal.')
    }
  }

  const handleThemeToggle = async () => {
    const currentTheme = themePreference === 'system' ? systemTheme : themePreference
    const nextThemePreference = currentTheme === 'dark' ? 'light' : 'dark'

    try {
      let nextSettings = { themePreference: nextThemePreference }
      if (isTauriRuntime) {
        nextSettings = await updateDesktopSettings(nextSettings)
      }

      setThemePreference(nextSettings.themePreference)
      setAppSettings((prev) => ({ ...prev, themePreference: nextSettings.themePreference }))
      setPersistenceError('')
    } catch {
      setPersistenceError('Could not save your theme preference.')
    }
  }

  const handleOpenSubscriptionLink = async (subscription, getSafeExternalUrl) => {
    const { url, error } = getSafeExternalUrl(subscription.link)

    if (!url) {
      setLinkErrors((prev) => ({ ...prev, [subscription.id]: error }))
      return
    }

    try {
      if (isTauriRuntime) {
        await openExternal(url)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }

      setLinkErrors((prev) => {
        if (!prev[subscription.id]) return prev
        const next = { ...prev }
        delete next[subscription.id]
        return next
      })
    } catch {
      setLinkErrors((prev) => ({
        ...prev,
        [subscription.id]: 'Could not open this link. Please check the URL and try again.',
      }))
    }
  }

  return {
    deletingSubscriptionId,
    editingId,
    errorMessage,
    formState,
    handleChange,
    handleDateChange,
    handleDelete,
    handleEdit,
    handleOpenRenew,
    handleOpenSubscriptionLink,
    handlePause,
    handleRenewFormChange,
    handleRenewSubmit,
    handleSubmit,
    handleThemeToggle,
    linkErrors,
    renewError,
    renewingSubscriptionId,
    renewForm,
    resetForm,
    setDeletingSubscriptionId,
    setRenewingSubscriptionId,
    confirmDeleteSubscription,
    cancelDelete,
    closeRenewModal,
  }
}
