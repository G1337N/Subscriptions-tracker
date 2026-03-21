import test from 'node:test'
import assert from 'node:assert/strict'
import {
  amountToCents,
  centsToAmount,
  normalizePayment,
  normalizeSubscription,
  serializePayment,
  serializeSubscription,
} from '../src/tauriApi.js'
import { getSubmissionPayments } from '../src/lib/subscriptionSubmission.js'

test('amount and cents helpers round predictably for currency values', () => {
  assert.equal(amountToCents(15.99), 1599)
  assert.equal(amountToCents('0'), 0)
  assert.equal(centsToAmount(1599), 15.99)
  assert.equal(centsToAmount(null), 0)
})

test('normalizeSubscription maps backend payloads into frontend shape', () => {
  const normalized = normalizeSubscription({
    id: 'netflix',
    name: 'Netflix',
    amountCents: 1599,
    billingCycle: 'Monthly',
    category: 'Streaming',
    categoryDetail: '',
    nextPaymentDate: '2026-04-01',
    currentPaymentDate: '2026-03-01',
    link: 'https://example.com',
    notes: '4k plan',
    status: 'Active',
    statusChangedAt: '2026-03-01',
    payments: [{ id: 'p1', date: '2026-03-01', amountCents: 1599 }],
  })

  assert.deepEqual(normalized, {
    id: 'netflix',
    name: 'Netflix',
    amount: 15.99,
    billingCycle: 'Monthly',
    category: 'Streaming',
    categoryDetail: '',
    nextPayment: '2026-04-01',
    currentPayment: '2026-03-01',
    link: 'https://example.com',
    notes: '4k plan',
    status: 'Active',
    statusChangedAt: '2026-03-01',
    payments: [{ id: 'p1', date: '2026-03-01', amount: 15.99 }],
  })
})

test('serializeSubscription maps frontend state into backend payload shape', () => {
  const serialized = serializeSubscription({
    id: 'spotify',
    name: 'Spotify',
    amount: 9.99,
    billingCycle: 'Monthly',
    category: 'Streaming',
    categoryDetail: '',
    nextPayment: '2026-04-10',
    currentPayment: '2026-03-10',
    link: 'https://spotify.com',
    notes: 'family',
    status: 'Paused',
    statusChangedAt: '2026-03-11',
    payments: [
      { id: 'manual-1', date: '2026-03-10', amount: 9.99 },
      { date: '2026-02-10', amount: 9.99 },
    ],
  })

  assert.deepEqual(serialized, {
    id: 'spotify',
    name: 'Spotify',
    amountCents: 999,
    currency: 'USD',
    billingCycle: 'Monthly',
    category: 'Streaming',
    categoryDetail: '',
    status: 'Paused',
    notes: 'family',
    link: 'https://spotify.com',
    nextPaymentDate: '2026-04-10',
    currentPaymentDate: '2026-03-10',
    statusChangedAt: '2026-03-11',
    payments: [
      { id: 'manual-1', date: '2026-03-10', amountCents: 999 },
      { id: 'payment-2', date: '2026-02-10', amountCents: 999 },
    ],
  })
})

test('payment helpers preserve ids and default generated ids', () => {
  assert.deepEqual(normalizePayment({ id: 'p1', date: '2026-03-01', amountCents: 1200 }), {
    id: 'p1',
    date: '2026-03-01',
    amount: 12,
  })

  assert.deepEqual(serializePayment({ date: '2026-03-01', amount: 12 }, 0), {
    id: 'payment-1',
    date: '2026-03-01',
    amountCents: 1200,
  })
})

test('create path does not synthesize a payment row for current payment dates like 2026-03-16', () => {
  assert.deepEqual(
    getSubmissionPayments({
      existingSubscription: null,
      currentPayment: '2026-03-16',
      amount: 9.99,
    }),
    [],
  )
})

test('edit path preserves stored payments when current payment moves to 2026-03-16', () => {
  assert.deepEqual(
    getSubmissionPayments({
      existingSubscription: {
        id: 'spotify',
        amount: 9.99,
        currentPayment: '2026-03-05',
        nextPayment: '2026-04-16',
        payments: [{ id: 'legacy-spotify-2026-03-05', date: '2026-03-05', amount: 9.99 }],
      },
      currentPayment: '2026-03-16',
      amount: 9.99,
    }),
    [{ id: 'legacy-spotify-2026-03-05', date: '2026-03-05', amount: 9.99 }],
  )
})
