const DEFAULT_LOCALE = 'zh'

function normalizeLocale(raw) {
  const s = typeof raw === 'string' ? raw.trim() : ''
  const lower = s.toLowerCase()
  if (!lower) return DEFAULT_LOCALE
  if (lower.startsWith('en')) return 'en'
  if (lower.startsWith('zh')) return 'zh'
  return DEFAULT_LOCALE
}

export function getLocale() {
  try {
    const info = wx && typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null
    const lang = info && typeof info.language === 'string' ? info.language : ''
    return normalizeLocale(lang)
  } catch (e) {
    return DEFAULT_LOCALE
  }
}

const DICT = {
  review: {
    zh: {
      summaryTitle: '学习完成',
      understood: '已掌握',
      needReview: '需要复习',
      cardsToReview: '需要复习的卡片',
      perfect: '太棒了！你掌握了所有卡片！',
      restart: '重新开始',
      backToHome: '返回首页',
      loading: '正在加载复习...',
      cardCounter: '卡片',
      tapToReveal: '点击查看答案',
      notUnderstand: '没懂',
      understand: '懂了',
      showAnswer: '显示答案',
      noCards: '本次没有卡片',
      hintShow: '提示',
      hintHide: '收起提示',
      onboarding: '点卡片翻面；左右滑动切换；翻面后选择「懂了/没懂」。',
      close: '关闭',

      cloudUnavailable: '云能力不可用',
      loadQueueFailed: '加载复习任务失败',
      submitRetry: '提交失败，将自动重试',
      relearn1: '错题再练',
      relearnN: '再练第{n}轮'
    },
    en: {
      summaryTitle: 'Study Session Complete',
      understood: 'Understood',
      needReview: 'Need Review',
      cardsToReview: 'Cards to Review',
      perfect: 'Perfect! You understood all cards!',
      restart: 'Restart',
      backToHome: 'Back to Home',
      loading: 'Loading review session...',
      cardCounter: 'Card',
      tapToReveal: 'Tap to reveal answer',
      notUnderstand: 'Not Understand',
      understand: 'Understand',
      showAnswer: 'Show Answer',
      noCards: 'No cards found for this session.',
      hintShow: 'Hint',
      hintHide: 'Hide hint',
      onboarding: 'Tap to flip; swipe left/right to switch; after flipping choose Understand/Not Understand.',
      close: 'Close',

      cloudUnavailable: 'Cloud capability unavailable',
      loadQueueFailed: 'Failed to load review session',
      submitRetry: 'Submit failed, will retry automatically',
      relearn1: 'Relearn wrong cards',
      relearnN: 'Relearn round {n}'
    }
  }
}

export function getI18n(namespace, locale) {
  const ns = namespace && DICT[namespace] ? DICT[namespace] : null
  const loc = normalizeLocale(locale || getLocale())
  if (!ns) return { _locale: loc }
  const base = ns[DEFAULT_LOCALE] || {}
  const cur = ns[loc] || {}
  return { _locale: loc, ...base, ...cur }
}

