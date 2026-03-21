/* global process */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  getDaysLeft,
  getDateDiffInDays,
  getDistinctCategoryColors,
  getDueWindowSubscriptions,
  getMonthlyActualSpend,
  getMonthlyPaymentEntries,
  getMonthlySpendCsv,
  getTotalLoggedSpend,
  renewSubscription,
  sortSubscriptions,
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

test('getDateDiffInDays preserves local calendar days for date-only strings', () => {
  assert.equal(getDateDiffInDays('2026-03-15', '2026-03-14'), 1)

  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { getDateDiffInDays, sortSubscriptions } from './src/subscriptionLogic.js';
const diff = getDateDiffInDays('2026-03-15', '2026-03-14');
const sorted = sortSubscriptions([{ id: 'a', nextPayment: '2026-03-15' }, { id: 'b', nextPayment: '2026-03-16' }], 'nextPayment').map((item) => item.nextPayment).join(',');
console.log(diff + '|' + sorted);`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, TZ: 'America/New_York' },
      encoding: 'utf8',
    },
  ).trim()

  assert.equal(output, '1|2026-03-15,2026-03-16')
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

test('sortSubscriptions supports category grouping then name', () => {
  const subscriptions = [
    { id: 's1', name: 'Zoom', category: 'Productivity', categoryDetail: '' },
    { id: 's2', name: 'Apple TV+', category: 'Streaming', categoryDetail: '' },
    { id: 's3', name: 'Notion', category: 'Productivity', categoryDetail: '' },
    { id: 's4', name: 'CloudBox', category: 'Other', categoryDetail: 'Storage' },
  ]

  const sorted = sortSubscriptions(subscriptions, 'category', {
    categoryLabelResolver: (subscription) =>
      subscription.category === 'Other' ? `Other: ${subscription.categoryDetail}` : subscription.category,
  })

  assert.deepEqual(sorted.map((item) => item.id), ['s4', 's3', 's1', 's2'])
})

test('getMonthlyActualSpend aggregates logged payments for selected range with category breakdown', () => {
  const subscriptions = [
    {
      id: 's1',
      category: 'Streaming',
      payments: [
        { id: 'p1', date: '2026-01-10', amount: 10 },
        { id: 'p2', date: '2026-02-10', amount: 20 },
      ],
    },
    {
      id: 's2',
      category: 'Productivity',
      payments: [
        { id: 'p3', date: '2026-02-04', amount: 30 },
        { id: 'p4', date: '2026-03-01', amount: 40 },
      ],
    },
  ]

  const series = getMonthlyActualSpend(subscriptions, { months: 12, todayValue: '2026-03-18' })

  assert.equal(series.length, 12)
  assert.deepEqual(
    series.slice(-3).map((item) => item.monthKey),
    ['2026-01', '2026-02', '2026-03'],
  )
  assert.deepEqual(
    series.slice(-3).map((item) => item.total),
    [10, 50, 40],
  )

  const february = series.find((item) => item.monthKey === '2026-02')
  assert.deepEqual(february.categories, [
    { category: 'Productivity', total: 30 },
    { category: 'Streaming', total: 20 },
  ])
})

test('getMonthlySpendCsv shapes monthly totals and category rows for export', () => {
  const csv = getMonthlySpendCsv([
    {
      monthKey: '2026-02',
      monthStart: '2026-02-01',
      monthEnd: '2026-02-28',
      total: 50,
      categories: [
        { category: 'Productivity', total: 30 },
        { category: 'Streaming', total: 20 },
      ],
    },
    {
      monthKey: '2026-03',
      monthStart: '2026-03-01',
      monthEnd: '2026-03-31',
      total: 40,
      categories: [],
    },
  ])

  assert.equal(
    csv,
    [
      'Month,Month Start,Month End,Total,Category,Category Amount',
      '2026-02,2026-02-01,2026-02-28,50.00,Productivity,30.00',
      ',,,,Streaming,20.00',
      '2026-03,2026-03-01,2026-03-31,40.00',
    ].join('\n'),
  )
})

test('getDistinctCategoryColors gives deterministic unique colors for palette-sized sets', () => {
  const categories = ['Streaming', 'Productivity', 'Utilities', 'Gaming']
  const colorsA = getDistinctCategoryColors(categories)
  const colorsB = getDistinctCategoryColors([...categories].reverse())

  assert.deepEqual(colorsA, colorsB)
  assert.equal(Object.keys(colorsA).length, categories.length)
  assert.equal(new Set(Object.values(colorsA)).size, categories.length)
})

test('getMonthlyPaymentEntries returns sorted rows for a given month', () => {
  const subscriptions = [
    {
      id: 's1',
      name: 'Music+',
      category: 'Streaming',
      payments: [
        { id: 'p2', date: '2026-02-11', amount: 12 },
        { id: 'p1', date: '2026-02-05', amount: 10 },
      ],
    },
    {
      id: 's2',
      name: 'Work Suite',
      category: 'Productivity',
      payments: [{ id: 'p3', date: '2026-02-05', amount: 30 }],
    },
    {
      id: 's3',
      name: 'Video',
      category: 'Streaming',
      payments: [{ id: 'p4', date: '2026-03-01', amount: 20 }],
    },
  ]

  const entries = getMonthlyPaymentEntries(subscriptions, '2026-02')

  assert.deepEqual(entries.map((entry) => `${entry.date}:${entry.subscriptionName}:${entry.amount}`), [
    '2026-02-05:Music+:10',
    '2026-02-05:Work Suite:30',
    '2026-02-11:Music+:12',
  ])
})
