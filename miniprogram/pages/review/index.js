import { listCardsByDeckTitle, listDueCards, normalizeDeckTitle } from '../../services/cards'
import { recordReviewEvent } from '../../services/activity'
import { callOkFunction } from '../../services/cloud'
import { toRichTextHtml } from '../../utils/richText'

const PENDING_KEY = 'review_pending_submits'
const CLOCK_SKEW_MS = 5000
const SWIPE_MIN_DISTANCE_PX = 50
const SWIPE_SUPPRESS_TAP_MS = 260
const ONBOARDING_KEY = 'review_onboarding_dismissed_v1'

function readBoolStorage(key) {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(key)
    return v === true || v === 'true' || v === 1 || v === '1'
  } catch (e) {
    return false
  }
}

function writeBoolStorage(key, value) {
  try {
    wx.setStorageSync && wx.setStorageSync(key, value ? true : false)
  } catch (e) {
    // ignore
  }
}

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
    locale: 'zh',
    i18n: {},
    showOnboarding: false,

    mode: 'review', // review | study
    scope: 'deck', // deck | all
    deckTitle: 'Review',
    deckTitleFilter: '',

    isLoadingQueue: false,

    round: 'main', // main | relearn
    currentIndex: 0,
    currentCard: null,
    totalCards: 0,
    isFlipped: false,
    showHint: false,

    // summary
    showSummary: false,
    understoodCount: 0,
    notUnderstoodCount: 0,
    notUnderstoodCards: []
  },

  onLoad(options) {
    this._submitQueue = []
    this._submitKeySet = new Set()
    this._isFlushing = false
    this._lastFailToastAt = 0

    // Non-render state (avoid setData for unbound vars; improves performance + audits score)
    this._queue = []
    this._relearnQueue = []
    this._relearnRound = 0
    this._cardResults = []
    this._sessionXp = 0

    // Gesture state (non-render)
    this._touchStartX = 0
    this._touchStartY = 0
    this._touchLastX = 0
    this._touchLastY = 0
    this._suppressTapUntil = 0

    // i18n + onboarding (first paint)
    try {
      const app = getApp()
      const i18n = app && typeof app.getI18n === 'function' ? app.getI18n('review') : {}
      const locale = i18n && typeof i18n._locale === 'string' ? i18n._locale : 'zh'
      const dismissed = readBoolStorage(ONBOARDING_KEY)
      this.setData({ i18n, locale, showOnboarding: !dismissed })
    } catch (e) {
      // ignore
    }

    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const optMode = options && options.mode ? String(options.mode) : ''
    const mode = optMode === 'study' ? 'study' : 'review'
    const optScope = options && options.scope ? String(options.scope) : ''
    const scope = optScope === 'all' ? 'all' : 'deck'

    let deckTitle = scope === 'all' ? 'All Review' : 'Review'
    let deckTitleFilter = ''

    const rawTitle = options && options.deckTitle ? String(options.deckTitle) : ''
    if (rawTitle) {
      let decoded = rawTitle
      try {
        decoded = decodeURIComponent(rawTitle)
      } catch (e) {
        decoded = rawTitle
      }
      deckTitle = normalizeDeckTitle(decoded)
      deckTitleFilter = deckTitle
    }

    this.setData({
      mode,
      scope,
      deckTitle,
      deckTitleFilter
    })
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    // Refresh locale on show (in case user changed system language)
    try {
      const app = getApp()
      if (app && typeof app.refreshLocale === 'function') app.refreshLocale()
      const i18n = app && typeof app.getI18n === 'function' ? app.getI18n('review') : {}
      const locale = i18n && typeof i18n._locale === 'string' ? i18n._locale : this.data.locale
      this.setData({ i18n, locale })
    } catch (e) {
      // ignore
    }

    this.restorePendingSubmits()
    this.fetchReviewQueue()
  },

  onDismissOnboarding() {
    writeBoolStorage(ONBOARDING_KEY, true)
    this.setData({ showOnboarding: false })
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
      hint: typeof card.hint === 'string' ? card.hint : '',
      tags: Array.isArray(card.tags) ? card.tags : [],
      topic: typeof card.topic === 'string' ? card.topic : '',
      cardTags: Array.isArray(card.cardTags) ? card.cardTags : [],
      answerSections,
      sourceImages
    }
    normalized.answer = getAnswerText(normalized)
    normalized.questionRich = toRichTextHtml(normalized.question)
    normalized.answerRich = toRichTextHtml(normalized.answer)
    normalized.hintRich = toRichTextHtml(normalized.hint)
    normalized.topicBadge = normalized.topic || (Array.isArray(normalized.cardTags) && normalized.cardTags.length ? String(normalized.cardTags[0] || '').trim() : '')
    return normalized
  },

  async fetchReviewQueue() {
    const fallback = () => {
      this._queue = []
      this._relearnQueue = []
      this._relearnRound = 0
      this._cardResults = []
      this._sessionXp = 0
      this._fillQueueSeq = (this._fillQueueSeq || 0) + 1
      this.setData({
        isLoadingQueue: false,
        currentIndex: 0,
        currentCard: null,
        totalCards: 0,
        isFlipped: false,
        showHint: false,
        showSummary: false,
        understoodCount: 0,
        notUnderstoodCount: 0,
        notUnderstoodCards: []
      })
    }

    if (!wx.cloud || !wx.cloud.database) {
      fallback()
      const t = this.data && this.data.i18n ? this.data.i18n : {}
      wx.showToast({ title: t.cloudUnavailable || '云能力不可用', icon: 'none' })
      return
    }

    this.setData({
      isLoadingQueue: true,
      showSummary: false,
      currentCard: null,
      currentIndex: 0,
      totalCards: 0,
      isFlipped: false,
      showHint: false
    })
    try {
      const mode = this.data.mode
      const scope = this.data.scope
      const deckTitle = this.data.deckTitleFilter || ''

      // Fast path: load a small first batch via cloudfunction (server-side DB has larger page size than client).
      const firstLimit = 20
      const first = await callOkFunction('getReviewQueue', {
        mode,
        scope,
        deckTitle,
        limit: firstLimit,
        skip: 0
      })
      const firstCards = Array.isArray(first && first.cards) ? first.cards : []
      const queue = firstCards.map((card) => this.normalizeCardForReview(card))
      this._queue = queue
      this._relearnQueue = []
      this._relearnRound = 0
      this._cardResults = []
      this._sessionXp = 0

      // Start background fill (append remaining queue without blocking first render).
      const fillSeq = (this._fillQueueSeq = (this._fillQueueSeq || 0) + 1)
      this.fillQueueInBackground({
        fillSeq,
        mode,
        scope,
        deckTitle,
        startSkip: first && typeof first.nextSkip === 'number' ? first.nextSkip : queue.length
      }).catch(() => {})

      this.setData({
        isLoadingQueue: false,
        round: 'main',
        currentIndex: 0,
        currentCard: queue[0] || null,
        totalCards: queue.length,
        isFlipped: false,
        showHint: false,
        showSummary: false,
        understoodCount: 0,
        notUnderstoodCount: 0,
        notUnderstoodCards: []
      })
    } catch (err) {
      console.error('fetch review queue failed', err)
      fallback()
      const t = this.data && this.data.i18n ? this.data.i18n : {}
      wx.showToast({ title: t.loadQueueFailed || '加载复习任务失败', icon: 'none' })
    }
  },

  async fillQueueInBackground({ fillSeq, mode, scope, deckTitle, startSkip }) {
    const seq = typeof fillSeq === 'number' ? fillSeq : 0
    let skip = typeof startSkip === 'number' && startSkip >= 0 ? startSkip : 0
    const pageLimit = 50
    const maxTotal = 1000

    const seen = new Set((Array.isArray(this._queue) ? this._queue : []).map((c) => String(c && c.id ? c.id : '')))

    while (seq && this._fillQueueSeq === seq) {
      // eslint-disable-next-line no-await-in-loop
      const ret = await callOkFunction('getReviewQueue', { mode, scope, deckTitle, limit: pageLimit, skip })
      const cards = Array.isArray(ret && ret.cards) ? ret.cards : []
      if (!cards.length) break

      const normalized = cards.map((c) => this.normalizeCardForReview(c))
      const append = []
      normalized.forEach((c) => {
        const id = c && c.id ? String(c.id) : ''
        if (!id) return
        if (seen.has(id)) return
        seen.add(id)
        append.push(c)
      })

      if (append.length) {
        this._queue = (Array.isArray(this._queue) ? this._queue : []).concat(append)
        if (this.data && this.data.round === 'main') {
          this.setData({ totalCards: this._queue.length })
        }
      }

      skip = ret && typeof ret.nextSkip === 'number' ? ret.nextSkip : skip + cards.length
      const hasMore = Boolean(ret && ret.hasMore)
      if (!hasMore) break
      if (this._queue.length >= maxTotal) break

      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50))
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
    this.setData({ isFlipped: true, showHint: false })
  },

  onFlipCard() {
    if (!this.data.currentCard) return
    if (this._suppressTapUntil && Date.now() < this._suppressTapUntil) return
    this.setData({ isFlipped: !this.data.isFlipped, showHint: false })
  },

  onCardTouchStart(e) {
    try {
      const t = e && e.touches && e.touches[0] ? e.touches[0] : null
      if (!t) return
      this._touchStartX = typeof t.clientX === 'number' ? t.clientX : 0
      this._touchStartY = typeof t.clientY === 'number' ? t.clientY : 0
      this._touchLastX = this._touchStartX
      this._touchLastY = this._touchStartY
    } catch (err) {
      // ignore
    }
  },

  onCardTouchMove(e) {
    try {
      const t = e && e.touches && e.touches[0] ? e.touches[0] : null
      if (!t) return
      this._touchLastX = typeof t.clientX === 'number' ? t.clientX : this._touchLastX
      this._touchLastY = typeof t.clientY === 'number' ? t.clientY : this._touchLastY
    } catch (err) {
      // ignore
    }
  },

  onCardTouchEnd() {
    const startX = typeof this._touchStartX === 'number' ? this._touchStartX : 0
    const startY = typeof this._touchStartY === 'number' ? this._touchStartY : 0
    const endX = typeof this._touchLastX === 'number' ? this._touchLastX : 0
    const endY = typeof this._touchLastY === 'number' ? this._touchLastY : 0

    const dx = startX - endX
    const dy = startY - endY
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    // Only treat as swipe when horizontal intent is clear (avoid fighting vertical scroll).
    if (!(absX > absY && absX > SWIPE_MIN_DISTANCE_PX)) return

    // Suppress the tap that often fires after a swipe.
    this._suppressTapUntil = Date.now() + SWIPE_SUPPRESS_TAP_MS

    if (dx > 0) {
      this.goNextBySwipe()
      return
    }
    this.goPrevBySwipe()
  },

  goNextBySwipe() {
    const queue = Array.isArray(this._queue) ? this._queue : []
    const len = queue.length
    if (!len) return
    const idx = typeof this.data.currentIndex === 'number' ? this.data.currentIndex : 0
    if (idx >= len - 1) return
    const next = idx + 1
    this.setData({
      currentIndex: next,
      currentCard: queue[next] || null,
      isFlipped: false,
      showHint: false
    })
  },

  goPrevBySwipe() {
    const queue = Array.isArray(this._queue) ? this._queue : []
    const len = queue.length
    if (!len) return
    const idx = typeof this.data.currentIndex === 'number' ? this.data.currentIndex : 0
    if (idx <= 0) return
    const prev = idx - 1
    this.setData({
      currentIndex: prev,
      currentCard: queue[prev] || null,
      isFlipped: false,
      showHint: false
    })
  },

  onToggleHint() {
    const c = this.data.currentCard
    if (!c || !c.hint) return
    if (this.data.isFlipped) return
    this.setData({ showHint: !this.data.showHint })
  },

  onStopPropagation() {
    // used with catch:tap to prevent flipping the card
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
    if (!isRelearn) this.pushResult(understood)
    if (!understood) this.enqueueRelearn(current)
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
    const list = Array.isArray(this._relearnQueue) ? this._relearnQueue : []
    if (list.some((c) => c && String(c.id || c._id || '') === id)) return
    list.push({ ...card })
    this._relearnQueue = list
  },

  pushResult(understood) {
    const current = this.data.currentCard
    if (!current || !current.id) return
    const next = Array.isArray(this._cardResults) ? this._cardResults : []
    next.push({
      cardId: current.id,
      understood: !!understood,
      question: String(current.question || ''),
      answer: String(current.answer || '')
    })
    this._cardResults = next
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
        data: { cardId, result, attemptTs }
      })
      const ret = res && res.result ? res.result : null
      if (!ret || ret.ok !== true) throw new Error((ret && ret.error) || 'submitReview failed')
      const xpDelta = typeof ret.xpDelta === 'number' ? ret.xpDelta : 0
      if (xpDelta) this._sessionXp += xpDelta

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
        const t = this.data && this.data.i18n ? this.data.i18n : {}
        wx.showToast({ title: t.submitRetry || '提交失败，将自动重试', icon: 'none' })
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
    const results = Array.isArray(this._cardResults) ? this._cardResults : []
    const notUnderstoodCards = results
      .filter((r) => r && r.understood === false)
      .map((r) => ({
        cardId: r.cardId,
        question: r.question,
        answer: r.answer,
        questionRich: toRichTextHtml(`Q: ${String(r.question || '')}`),
        answerRich: toRichTextHtml(`A: ${String(r.answer || '')}`)
      }))

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
    const queueLen = Array.isArray(this._queue) ? this._queue.length : 0
    if (next >= queueLen) {
      this.setData({ isFlipped: false, showHint: false })
      const relearn = Array.isArray(this._relearnQueue) ? this._relearnQueue : []
      if (relearn.length) {
        const queue = relearn.slice()
        const nextRound = (typeof this._relearnRound === 'number' ? this._relearnRound : 0) + 1
        this._queue = queue
        this._relearnQueue = []
        this._relearnRound = nextRound
        this.setData({
          round: 'relearn',
          currentIndex: 0,
          currentCard: queue[0] || null,
          totalCards: queue.length,
          isFlipped: false,
          showHint: false
        })
        const t = this.data && this.data.i18n ? this.data.i18n : {}
        const msg = nextRound === 1
          ? (t.relearn1 || '错题再练')
          : String(t.relearnN || `再练第{n}轮`).replace('{n}', String(nextRound))
        wx.showToast({ title: msg, icon: 'none' })
        return
      }

      this.buildSummary()
      return
    }

    const queue = Array.isArray(this._queue) ? this._queue : []
    this.setData({
      currentIndex: next,
      currentCard: queue[next] || null,
      isFlipped: false,
      showHint: false
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
