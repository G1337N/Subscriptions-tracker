import { getCleanPayments } from '../subscriptionLogic.js'

export const getSubmissionPayments = ({ existingSubscription, currentPayment, amount }) => {
  if (!existingSubscription) {
    return []
  }

  return getCleanPayments({
    ...existingSubscription,
    payments: existingSubscription.payments || [],
    currentPayment,
    amount,
  })
}

export const getErrorDetails = (error) => {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message.trim()) return error.message.trim()

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
