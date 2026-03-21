import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canLoadMoreSubscriptions,
  DEFAULT_VISIBLE_SUBSCRIPTIONS,
  getVisibleSubscriptions,
} from './subscriptionListView.js'

const createSubscriptions = (count) => Array.from({ length: count }, (_, index) => ({
  id: `sub-${index + 1}`,
  name: `Subscription ${index + 1}`,
}))

test('shows more than five subscriptions without truncating the first page', () => {
  const subscriptions = createSubscriptions(6)

  const visible = getVisibleSubscriptions(subscriptions)

  assert.equal(visible.length, 6)
  assert.equal(visible.at(-1)?.id, 'sub-6')
  assert.equal(canLoadMoreSubscriptions(subscriptions), false)
})

test('uses incremental loading when the list grows past the default page size', () => {
  const subscriptions = createSubscriptions(DEFAULT_VISIBLE_SUBSCRIPTIONS + 5)

  const visible = getVisibleSubscriptions(subscriptions)

  assert.equal(visible.length, DEFAULT_VISIBLE_SUBSCRIPTIONS)
  assert.equal(canLoadMoreSubscriptions(subscriptions), true)
})
