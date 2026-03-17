import test from 'node:test'
import assert from 'node:assert/strict'
import { getDaysLeft, getTotalLoggedSpend, renewSubscription } from '../src/subscriptionLogic.js'

test('getTotalLoggedSpend sums only unique logged payments', () => {
  const subscriptions = [
    {
      id: 's1',
      amount: 15,
      currentPayment: '2026-03-01',
      payments: [
        { id: 'p1', date: '2026-03-01', amount: 15 },
        { id: 'dup', date: '2026-03-01', amount: 15 },
      ],
    },
    {
      id: 's2',
      amount: 30,
      currentPayment: '2026-03-01',
      payments: [{ id: 'p2', date: '2026-03-01', amount: 30 }],
    },
  ]

  assert.equal(getTotalLoggedSpend(subscriptions), 45)
})

test('renewSubscription appends renewal payment and updates next expiry', () => {
  const base = {
    id: 's1',
    amount: 15,
    status: 'Paused',
    statusChangedAt: '2026-03-01',
    currentPayment: '2026-03-01',
    nextPayment: '2026-04-01',
    payments: [{ id: 'p1', date: '2026-03-01', amount: 15 }],
  }

  const renewed = renewSubscription(base, {
    amountPaid: 15,
    paymentDate: '2026-04-01',
    newExpiryDate: '2026-05-01',
  })

  assert.equal(renewed.status, 'Active')
  assert.equal(renewed.currentPayment, '2026-04-01')
  assert.equal(renewed.nextPayment, '2026-05-01')
  assert.equal(renewed.payments.length, 2)
})

test('getDaysLeft returns 0 for expired and integer for future', () => {
  assert.equal(getDaysLeft('2026-03-20', '2026-03-17'), 3)
  assert.equal(getDaysLeft('2026-03-01', '2026-03-17'), 0)
})
