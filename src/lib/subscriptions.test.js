import { describe, expect, it } from 'vitest'
import {
  addSubscription,
  calculateMetrics,
  deleteSubscription,
  editSubscription,
  fromCsv,
  markPaidToday,
  migrateSubscriptions,
  normalizeDate,
  toCsv,
  toJson,
} from './subscriptions'

describe('date normalization', () => {
  it('normalizes full ISO timestamps to YYYY-MM-DD', () => {
    expect(normalizeDate('2026-03-17T16:20:11.000Z')).toBe('2026-03-17')
  })

  it('returns empty string for invalid dates', () => {
    expect(normalizeDate('not-a-date')).toBe('')
  })
})

describe('persistence migration', () => {
  it('migrates legacy array payload and keeps valid subscriptions', () => {
    const migrated = migrateSubscriptions([
      {
        id: '1',
        name: 'Netflix',
        nextPayment: '2026-04-01T00:00:00.000Z',
        billingCycle: 'Monthly',
        payments: [{ amount: '12.99', date: '2026-03-01T00:00:00.000Z' }],
      },
      { id: '2', name: '', nextPayment: '' },
    ])

    expect(migrated).toHaveLength(1)
    expect(migrated[0].nextPayment).toBe('2026-04-01')
    expect(migrated[0].payments[0].date).toBe('2026-03-01')
    expect(migrated[0].category).toBe('Other')
  })

  it('migrates versioned object payload', () => {
    const migrated = migrateSubscriptions({
      version: 2,
      subscriptions: [{ name: 'Spotify', nextPayment: '2026-05-20', billingCycle: 'Yearly' }],
    })

    expect(migrated).toHaveLength(1)
    expect(migrated[0].billingCycle).toBe('Yearly')
  })
})

describe('subscriptions integration flow', () => {
  it('covers add/edit/delete/category/metrics flow', () => {
    let subs = []

    subs = addSubscription(subs, {
      name: 'OpenAI',
      amount: 20,
      nextPayment: '2026-04-01',
      billingCycle: 'Monthly',
      category: 'AI',
      link: 'https://openai.com',
    })

    const id = subs[0].id
    subs = editSubscription(subs, id, { name: 'OpenAI Pro', category: 'Work' })
    expect(subs[0].name).toBe('OpenAI Pro')
    expect(subs[0].category).toBe('Work')

    const metrics = calculateMetrics(subs)
    expect(metrics).toEqual({ total: 1, active: 1, categories: 1 })

    subs = deleteSubscription(subs, id)
    expect(subs).toHaveLength(0)
  })

  it('marks paid today and advances recurrence', () => {
    let subs = addSubscription([], {
      name: 'Claude',
      amount: 20,
      nextPayment: '2026-03-10',
      billingCycle: 'Monthly',
      category: 'AI',
      link: '',
    })

    const id = subs[0].id
    subs = markPaidToday(subs, id, '2026-03-17')

    expect(subs[0].nextPayment).toBe('2026-04-17')
    expect(subs[0].payments[0].date).toBe('2026-03-17')
  })

  it('exports/imports JSON and CSV', () => {
    const subs = addSubscription([], {
      name: 'Vercel',
      amount: 20,
      nextPayment: '2026-04-20',
      billingCycle: 'Yearly',
      category: 'Hosting',
      link: 'https://vercel.com',
    })

    const json = toJson(subs)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(2)
    expect(parsed.subscriptions).toHaveLength(1)

    const csv = toCsv(subs)
    const imported = fromCsv(csv)
    expect(imported).toHaveLength(1)
    expect(imported[0].name).toBe('Vercel')
    expect(imported[0].category).toBe('Hosting')
  })
})
