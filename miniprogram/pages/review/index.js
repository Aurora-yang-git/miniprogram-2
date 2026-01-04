import { listDueCards, normalizeDeckTitle } from '../../services/cards'
import { recordReviewEvent } from '../../services/activity'

const PENDING_KEY = 'review_pending_submits'
const CLOCK_SKEW_MS = 5000

function getAppUiState() {
  try {
    const app = getApp()
    const gd = app && app.globalData ? app.globalData : {}
    return {
      theme: app && typeof app.getTheme === 'function' ? app.getTheme() : 'light',
      statusBarRpx: typeof gd.statusBarRpx === 'number' ? gd.statusBarRpx : 0,
      safeBottomRpx: typeof gd.safeBottomRpx === 'number' ? gd.safeBottomRpx : 0
    }
  } catch (e) {
    return { theme: 'light', statusBarRpx: 0, safeBottomRpx: 0 }
  }
}

function getAnswerText(card) {
  if (!card) return ''
  if (typeof card.answer === 'string' && card.answer.trim()) return card.answer
  const sections = Array.isArray(card.answerSections) ? card.answerSections : []
  return sections
    .map((s) => (s && (s.content || s.latex) ? String(s.content || s.latex).trim() : ''))
    .filter(Boolean)
    .join('\n')
}

function makePendingKey(item) {
  const cardId = item && item.cardId ? String(item.cardId) : ''
  const result = item && item.result ? String(item.result) : ''
  const attemptTs = item && typeof item.attemptTs === 'number' ? item.attemptTs : 0
  return `${cardId}|${result}|${attemptTs}`
}

function readPendingFromStorage() {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(PENDING_KEY)
    if (Array.isArray(v)) return v
    if (typeof v === 'string') {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    }
    return []
  } catch (e) {
    return []
  }
}

function writePendingToStorage(list) {
  try {
    wx.setStorageSync && wx.setStorageSync(PENDING_KEY, Array.isArray(list) ? list : [])
  } catch (e) {
    // ignore
  }
}

async function getCardLastReviewedAt(cardId) {
  if (!cardId) return 0
  if (!wx.cloud || !wx.cloud.database) return 0
  try {
    const db = wx.cloud.database()
    const res = await db.collection('cards').doc(cardId).get()
    const card = res && res.data ? res.data : null
    const last = card && typeof card.lastReviewedAt === 'number' ? card.lastReviewedAt : 0
    return last
  } catch (e) {
    return 0
  }
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    deckTitle: 'Study Mode',
    deckTitleFilter: '',

    isLoadingQueue: false,

    round: 'main', // main | relearn
    relearnQueue: [],

    queue: [],
    currentIndex: 0,
    currentCard: null,
    totalCards: 0,
    isFlipped: false,
    sessionXp: 0,
    submitting: false,

    // summary
    showSummary: false,
    cardResults: [],
    understoodCount: 0,
    notUnderstoodCount: 0,
    notUnderstoodCards: []
  },

  onLoad(options) {
    this._submitQueue = []
    this._submitKeySet = new Set()
    this._isFlushing = false
    this._lastFailToastAt = 0

    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const rawTitle = options && options.deckTitle ? String(options.deckTitle) : ''
    if (rawTitle) {
      let decoded = rawTitle
      try {
        decoded = decodeURIComponent(rawTitle)
      } catch (e) {
        decoded = rawTitle
      }
      const deckTitle = normalizeDeckTitle(decoded)
      this.setData({ deckTitle, deckTitleFilter: deckTitle })
    }
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
    this.restorePendingSubmits()
    this.fetchReviewQueue()
  },

  normalizeCardForReview(card) {
    const answerSections = Array.isArray(card.answerSections) && card.answerSections.length
      ? card.answerSections
      : (typeof card.answer === 'string' && card.answer.trim())
        ? [{ title: 'Answer', type: 'text', content: card.answer }]
        : []

    const sourceImages = (() => {
      const ids = []
      if (Array.isArray(card.sourceImages)) {
        card.sourceImages.forEach((id) => {
          if (typeof id === 'string' && id.trim()) ids.push(id)
        })
      }
      if (typeof card.sourceImage === 'string' && card.sourceImage.trim()) {
        ids.push(card.sourceImage)
      }
      return Array.from(new Set(ids))
    })()

    const normalized = {
      ...card,
      id: card.id || card._id,
      question: typeof card.question === 'string' ? card.question : '',
      answer: typeof card.answer === 'string' ? card.answer : '',
      tags: Array.isArray(card.tags) ? card.tags : [],
      answerSections,
      sourceImages
    }
    normalized.answer = getAnswerText(normalized)
    return normalized
  },

  async fetchReviewQueue() {
    const fallback = () => {
      this.setData({
        isLoadingQueue: false,
        queue: [],
        currentIndex: 0,
        currentCard: null,
        totalCards: 0,
        isFlipped: false,
        sessionXp: 0,
        submitting: false,
        showSummary: false,
        cardResults: [],
        understoodCount: 0,
        notUnderstoodCount: 0,
        notUnderstoodCards: []
      })
    }

    if (!wx.cloud || !wx.cloud.database) {
      fallback()
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    this.setData({
      isLoadingQueue: true,
      showSummary: false,
      currentCard: null,
      queue: [],
      currentIndex: 0,
      totalCards: 0,
      isFlipped: false
    })
    try {
      const rawList = await listDueCards({
        deckTitle: this.data.deckTitleFilter || undefined,
        limit: 20
      })
      const queue = (Array.isArray(rawList) ? rawList : []).map((card) => this.normalizeCardForReview(card))
      this.setData({
        isLoadingQueue: false,
        round: 'main',
        relearnQueue: [],
        queue,
        currentIndex: 0,
        currentCard: queue[0] || null,
        totalCards: queue.length,
        isFlipped: false,
        sessionXp: 0,
        submitting: false,
        showSummary: false,
        cardResults: [],
        understoodCount: 0,
        notUnderstoodCount: 0,
        notUnderstoodCards: []
      })
    } catch (err) {
      console.error('fetch review queue failed', err)
      fallback()
      wx.showToast({ title: '加载复习任务失败', icon: 'none' })
    }
  },

  onExitReview() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onRestart() {
    this.fetchReviewQueue()
  },

  onShowAnswer() {
    if (!this.data.currentCard) return
    if (this.data.isFlipped) return
    this.setData({ isFlipped: true })
  },

  onFlipCard() {
    if (!this.data.currentCard) return
    this.setData({ isFlipped: !this.data.isFlipped })
  },

  async onResult(event) {
    const type = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.type
    const current = this.data.currentCard
    if (!current) return
    if (!this.data.isFlipped) return

    const result = type === 'forget' ? 'forget' : 'remember'
    const understood = result === 'remember'
    const attemptTs = Date.now()
    const isRelearn = this.data.round === 'relearn'

    // Optimistic UI: immediately move to next card
    if (!isRelearn) {
      this.pushResult(understood)
      if (!understood) this.enqueueRelearn(current)
    }
    this.nextCard()

    // Background submit
    if (!isRelearn && current && current.id) {
      this.enqueueSubmit({
        cardId: String(current.id),
        result,
        attemptTs,
        fromStorage: false
      })
    }
  },

  enqueueRelearn(card) {
    const id = card && card.id ? String(card.id) : ''
    if (!id) return
    const list = Array.isArray(this.data.relearnQueue) ? this.data.relearnQueue.slice() : []
    if (list.some((c) => c && String(c.id || c._id || '') === id)) return
    list.push({ ...card })
    this.setData({ relearnQueue: list })
  },

  pushResult(understood) {
    const current = this.data.currentCard
    if (!current || !current.id) return
    const next = Array.isArray(this.data.cardResults) ? this.data.cardResults.slice() : []
    next.push({
      cardId: current.id,
      understood: !!understood,
      question: String(current.question || ''),
      answer: String(current.answer || '')
    })
    this.setData({ cardResults: next })
  },

  enqueueSubmit(item) {
    if (!item || !item.cardId || !item.result || !item.attemptTs) return
    const key = makePendingKey(item)
    if (this._submitKeySet && this._submitKeySet.has(key)) return
    if (this._submitKeySet) this._submitKeySet.add(key)
    if (!Array.isArray(this._submitQueue)) this._submitQueue = []
    this._submitQueue.push({ ...item, _key: key })
    this.flushSubmitQueue()
  },

  restorePendingSubmits() {
    const pending = readPendingFromStorage()
    if (!pending.length) return
    pending.forEach((it) => {
      if (!it || !it.cardId || !it.result || typeof it.attemptTs !== 'number') return
      this.enqueueSubmit({ ...it, fromStorage: true })
    })
  },

  async flushSubmitQueue() {
    if (this._isFlushing) return
    if (!Array.isArray(this._submitQueue) || !this._submitQueue.length) return
    if (!wx.cloud || !wx.cloud.callFunction) return

    this._isFlushing = true
    try {
      while (Array.isArray(this._submitQueue) && this._submitQueue.length) {
        const item = this._submitQueue.shift()
        if (!item) continue
        // eslint-disable-next-line no-await-in-loop
        await this.submitOne(item)
        if (this._submitKeySet && item._key) this._submitKeySet.delete(item._key)
      }
    } finally {
      this._isFlushing = false
    }
  },

  async submitOne(item) {
    const cardId = item && item.cardId ? String(item.cardId) : ''
    const result = item && item.result ? String(item.result) : ''
    const attemptTs = item && typeof item.attemptTs === 'number' ? item.attemptTs : 0
    if (!cardId || !result || !attemptTs) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitReview',
        data: { cardId, result }
      })
      const ret = res && res.result ? res.result : null
      if (!ret || ret.ok !== true) throw new Error((ret && ret.error) || 'submitReview failed')
      const xpDelta = typeof ret.xpDelta === 'number' ? ret.xpDelta : 0
      if (xpDelta) {
        this.setData({ sessionXp: (this.data.sessionXp || 0) + xpDelta })
      }

      await recordReviewEvent({ cardId, result, attemptTs })

      if (item.fromStorage) {
        this.removePendingFromStorage(item)
      }
    } catch (e) {
      console.error('submitReview background failed', e)
      const lastReviewedAt = await getCardLastReviewedAt(cardId)
      // If server already applied the review (response lost), don't retry to avoid double XP.
      if (lastReviewedAt && lastReviewedAt >= attemptTs - CLOCK_SKEW_MS) {
        await recordReviewEvent({ cardId, result, attemptTs })
        if (item.fromStorage) this.removePendingFromStorage(item)
        return
      }

      this.addPendingToStorage(item)
      const now = Date.now()
      if (!this._lastFailToastAt || now - this._lastFailToastAt > 5000) {
        this._lastFailToastAt = now
        wx.showToast({ title: '提交失败，将自动重试', icon: 'none' })
      }
    }
  },

  addPendingToStorage(item) {
    const list = readPendingFromStorage()
    const key = makePendingKey(item)
    if (list.some((x) => makePendingKey(x) === key)) return
    const next = list.concat([{ cardId: item.cardId, result: item.result, attemptTs: item.attemptTs }])
    writePendingToStorage(next.slice(-200))
  },

  removePendingFromStorage(item) {
    const list = readPendingFromStorage()
    if (!list.length) return
    const key = makePendingKey(item)
    const next = list.filter((x) => makePendingKey(x) !== key)
    writePendingToStorage(next)
  },

  buildSummary() {
    const results = Array.isArray(this.data.cardResults) ? this.data.cardResults : []
    const notUnderstoodCards = results
      .filter((r) => r && r.understood === false)
      .map((r) => ({ cardId: r.cardId, question: r.question, answer: r.answer }))

    const understoodCount = results.filter((r) => r && r.understood === true).length
    const notUnderstoodCount = notUnderstoodCards.length
    this.setData({
      showSummary: true,
      understoodCount,
      notUnderstoodCount,
      notUnderstoodCards
    })
  },

  nextCard() {
    const next = this.data.currentIndex + 1
    if (next >= (Array.isArray(this.data.queue) ? this.data.queue.length : 0)) {
      this.setData({ isFlipped: false })
      const isMain = this.data.round === 'main'
      const relearn = Array.isArray(this.data.relearnQueue) ? this.data.relearnQueue : []
      if (isMain && relearn.length) {
        const queue = relearn.slice()
        this.setData({
          round: 'relearn',
          relearnQueue: [],
          queue,
          currentIndex: 0,
          currentCard: queue[0] || null,
          totalCards: queue.length,
          isFlipped: false
        })
        wx.showToast({ title: '错题再练', icon: 'none' })
        return
      }

      this.buildSummary()
      return
    }

    const queue = Array.isArray(this.data.queue) ? this.data.queue : []
    this.setData({
      currentIndex: next,
      currentCard: queue[next] || null,
      isFlipped: false
    })
  },

  onToggleTheme() {
    const app = getApp()
    const next = app && typeof app.toggleTheme === 'function'
      ? app.toggleTheme()
      : (this.data.theme === 'dark' ? 'light' : 'dark')
    this.setData({ theme: next })
  }
})
