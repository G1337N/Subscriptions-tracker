import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getDaysLeft,
  getDueWindowSubscriptions,
  getMonthlyActualSpend,
  getTotalLoggedSpend,
  renewSubscription,
} from '../src/subscriptionLogic.js'

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

test('getDueWindowSubscriptions returns only active items due within the selected window', () => {
  const subscriptions = [
    { id: 's1', status: 'Active', nextPayment: '2026-03-18' },
    { id: 's2', status: 'Active', nextPayment: '2026-03-24' },
    { id: 's3', status: 'Active', nextPayment: '2026-04-05' },
    { id: 's4', status: 'Paused', nextPayment: '2026-03-19' },
  ]

  const dueIn7 = getDueWindowSubscriptions(subscriptions, 7, '2026-03-18')
  const dueIn30 = getDueWindowSubscriptions(subscriptions, 30, '2026-03-18')

  assert.deepEqual(
    dueIn7.map((item) => item.id),
    ['s1', 's2'],
  )
  assert.deepEqual(
    dueIn30.map((item) => item.id),
    ['s1', 's2', 's3'],
  )
})

test('getMonthlyActualSpend aggregates logged payments into the last 6 months with gaps as zero', () => {
  const subscriptions = [
    {
      id: 's1',
      payments: [
        { id: 'p1', date: '2026-01-10', amount: 10 },
        { id: 'p2', date: '2026-02-10', amount: 20 },
      ],
    },
    {
      id: 's2',
      payments: [
        { id: 'p3', date: '2026-02-04', amount: 30 },
        { id: 'p4', date: '2026-03-01', amount: 40 },
      ],
    },
  ]

  const series = getMonthlyActualSpend(subscriptions, { months: 6, todayValue: '2026-03-18' })

  assert.deepEqual(
    series.map((item) => item.monthKey),
    ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'],
  )
  assert.deepEqual(
    series.map((item) => item.total),
    [0, 0, 0, 10, 50, 40],
  )
})
