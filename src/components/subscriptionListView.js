export const DEFAULT_VISIBLE_SUBSCRIPTIONS = 10

export const getVisibleSubscriptions = (subscriptions, visibleCount = DEFAULT_VISIBLE_SUBSCRIPTIONS) => {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return []

  const normalizedVisibleCount = Number.isFinite(visibleCount)
    ? Math.max(DEFAULT_VISIBLE_SUBSCRIPTIONS, Math.floor(visibleCount))
    : DEFAULT_VISIBLE_SUBSCRIPTIONS

  return subscriptions.slice(0, normalizedVisibleCount)
}

export const canLoadMoreSubscriptions = (subscriptions, visibleCount = DEFAULT_VISIBLE_SUBSCRIPTIONS) => (
  getVisibleSubscriptions(subscriptions, visibleCount).length < (Array.isArray(subscriptions) ? subscriptions.length : 0)
)
