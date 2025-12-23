/**
 * 简易 SM-2（业务裁剪版）
 * - 输入：card, quality('forget'|'remember')
 * - 输出：新的 reviewStatus（纯函数，不修改入参）
 */

const DAY_MS = 24 * 60 * 60 * 1000

export function calculateNextReview(card, quality) {
  const now = Date.now()

  const rawStatus = card && typeof card === 'object' ? card.reviewStatus : null
  const currentInterval = (rawStatus && typeof rawStatus.interval === 'number' && rawStatus.interval >= 0)
    ? rawStatus.interval
    : 0

  if (quality === 'forget') {
    const interval = 0
    return {
      state: 1,
      interval,
      nextReviewTime: now + interval * DAY_MS
    }
  }

  if (quality === 'remember') {
    const interval = currentInterval === 0 ? 1 : Math.ceil(currentInterval * 1.5)
    return {
      state: 2,
      interval,
      nextReviewTime: now + interval * DAY_MS
    }
  }

  // 非法输入：保持原状（但仍保证字段完整）
  return {
    state: (rawStatus && (rawStatus.state === 0 || rawStatus.state === 1 || rawStatus.state === 2)) ? rawStatus.state : 0,
    interval: currentInterval,
    nextReviewTime: (rawStatus && typeof rawStatus.nextReviewTime === 'number') ? rawStatus.nextReviewTime : now
  }
}


