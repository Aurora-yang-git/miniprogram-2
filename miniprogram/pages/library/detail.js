import { listCardsByDeckTitle, normalizeDeckTitle, createCard, updateCard, deleteCard } from '../../services/cards'

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

function computeDeckMeta(deckTitle, rawCards, now = Date.now()) {
  const list = Array.isArray(rawCards) ? rawCards : []
  const totalCards = list.length
  const dueCount = list.filter((c) => {
    const next = typeof c.nextReviewAt === 'number' ? c.nextReviewAt : null
    return next === null || next <= now
  }).length
  const progress = totalCards
    ? Math.max(0, Math.min(100, 100 - Math.round((dueCount / totalCards) * 100)))
    : 0

  const tagCounts = new Map()
  list.forEach((c) => {
    const tags = Array.isArray(c && c.tags) ? c.tags : []
    tags.forEach((t) => {
      const key = String(t || '').trim()
      if (!key) return
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1)
    })
  })
  const tags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((it) => it[0])

  return {
    id: deckTitle,
    title: deckTitle,
    tags,
    dueCount,
    progress
  }
}

function parseClipboardToQA(text) {
  const raw = String(text || '').trim()
  if (!raw) return { question: '', answer: '' }

  const lines = raw.split('\n')
  let q = ''
  let a = ''
  let isAnswer = false

  lines.forEach((line) => {
    const s = String(line || '').trim()
    if (!s) return
    const lower = s.toLowerCase()
    if (lower.startsWith('q:') || lower.startsWith('question:')) {
      q = s.replace(/^(q:|question:)/i, '').trim()
      isAnswer = false
      return
    }
    if (lower.startsWith('a:') || lower.startsWith('answer:')) {
      a = s.replace(/^(a:|answer:)/i, '').trim()
      isAnswer = true
      return
    }
    if (isAnswer) {
      a += (a ? '\n' : '') + s
      return
    }
    if (!q) q = s
  })

  // fallback: split by empty line
  if (!a) {
    const parts = raw.split(/\n\s*\n/)
    if (parts.length >= 2) {
      q = q || String(parts[0] || '').trim()
      a = String(parts.slice(1).join('\n\n') || '').trim()
    }
  }

  return { question: q, answer: a }
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    isLoadingDeck: false,
    isSaving: false,
    deletingId: '',

    deckTitle: 'Inbox',
    deck: {
      id: '',
      title: 'Deck',
      tags: [],
      dueCount: 0,
      progress: 0
    },
    deckCards: [],

    modalVisible: false,
    modalMode: 'manual', // manual | scan | upload | paste
    modalQuestion: '',
    modalAnswer: '',
    editingCardId: ''
  },

  async onLoad(options) {
    const ui = getAppUiState()
    const rawTitle = options && options.deckTitle ? String(options.deckTitle) : ''
    let decoded = rawTitle
    try {
      decoded = decodeURIComponent(rawTitle)
    } catch (e) {
      decoded = rawTitle
    }
    const deckTitle = normalizeDeckTitle(decoded)

    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx,
      deckTitle,
      deck: { ...this.data.deck, id: deckTitle, title: deckTitle },
      deckCards: []
    })

    await this.loadDeck()
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
  },

  noop() {},

  async loadDeck() {
    if (!wx.cloud || !wx.cloud.database) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      this.setData({
        isLoadingDeck: false,
        deckCards: [],
        deck: { ...this.data.deck, dueCount: 0, progress: 0, tags: [] }
      })
      return
    }

    try {
      this.setData({ isLoadingDeck: true })
      const rawCards = await listCardsByDeckTitle(this.data.deckTitle)
      const deckCards = (Array.isArray(rawCards) ? rawCards : []).map((c) => ({
        id: c && c._id ? c._id : (c && c.id ? c.id : ''),
        question: typeof c.question === 'string' ? c.question : '',
        answer: getAnswerText(c),
        tags: Array.isArray(c.tags) ? c.tags : []
      })).filter((c) => !!c.id)

      const deck = computeDeckMeta(this.data.deckTitle, rawCards)
      this.setData({ deckCards, deck, isLoadingDeck: false })
    } catch (e) {
      console.error('loadDeck failed', e)
      this.setData({ isLoadingDeck: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onBack() {
    wx.navigateBack({ delta: 1 })
  },

  onStartStudy() {
    wx.navigateTo({ url: `/pages/review/index?mode=study&deckTitle=${encodeURIComponent(this.data.deckTitle)}` })
  },

  onStartReview() {
    wx.navigateTo({ url: `/pages/review/index?mode=review&deckTitle=${encodeURIComponent(this.data.deckTitle)}` })
  },

  onOpenAddModal() {
    this.setData({
      modalVisible: true,
      modalMode: 'manual',
      modalQuestion: '',
      modalAnswer: '',
      editingCardId: ''
    })
  },

  onEditCard(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!id) return
    const card = (Array.isArray(this.data.deckCards) ? this.data.deckCards : []).find((c) => c && c.id === id)
    if (!card) return
    this.setData({
      modalVisible: true,
      modalMode: 'manual',
      modalQuestion: String(card.question || ''),
      modalAnswer: String(card.answer || ''),
      editingCardId: id
    })
  },

  onDeleteCard(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!id) return
    wx.showModal({
      title: 'Delete card?',
      content: 'Are you sure you want to delete this card?',
      confirmText: 'Delete',
      confirmColor: '#dc2626',
      success: async (res) => {
        if (!res.confirm) return
        try {
          this.setData({ deletingId: id })
          await deleteCard(id)
          this.setData({ deletingId: '' })
          await this.loadDeck()
        } catch (err) {
          console.error('deleteCard failed', err)
          this.setData({ deletingId: '' })
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  onCloseModal() {
      this.setData({
      modalVisible: false,
      modalMode: 'manual',
      modalQuestion: '',
      modalAnswer: '',
      editingCardId: ''
    })
  },

  onChangeModalMode(e) {
    const mode = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.mode : ''
    if (mode !== 'manual' && mode !== 'scan' && mode !== 'upload' && mode !== 'paste') return
    this.setData({ modalMode: mode })
    if (mode === 'paste') {
      this.fillFromClipboard()
    }
  },

  async fillFromClipboard() {
    if (!wx.getClipboardData) return
    try {
      const res = await new Promise((resolve, reject) => {
        wx.getClipboardData({ success: resolve, fail: reject })
      })
      const text = res && res.data ? res.data : ''
      const parsed = parseClipboardToQA(text)
      if (parsed.question) this.setData({ modalQuestion: parsed.question })
      if (parsed.answer) this.setData({ modalAnswer: parsed.answer })
    } catch (e) {
      console.error('getClipboardData failed', e)
    }
  },

  onModalQuestionInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ modalQuestion: value })
  },

  onModalAnswerInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ modalAnswer: value })
  },

  async saveCard(continueAdding) {
    const question = String(this.data.modalQuestion || '').trim()
    const answer = String(this.data.modalAnswer || '').trim()
    if (!question || !answer) {
      wx.showToast({ title: 'Please fill in both question and answer', icon: 'none' })
      return
    }

    const editingId = this.data.editingCardId

    if (this.data.isSaving) return
    this.setData({ isSaving: true })
    try {
      if (editingId) {
        await updateCard(editingId, { question, answer })
      } else {
        await createCard({ deckTitle: this.data.deckTitle, question, answer, tags: [] })
      }
      this.setData({ isSaving: false })
      await this.loadDeck()

      if (continueAdding && !editingId) {
        this.setData({ modalQuestion: '', modalAnswer: '' })
        return
      }
      this.onCloseModal()
    } catch (e) {
      console.error('saveCard failed', e)
      this.setData({ isSaving: false })
      wx.showToast({ title: '保存失败', icon: 'none' })
      }
  },

  onSaveAndAdd() {
    this.saveCard(true)
  },

  onSaveClose() {
    this.saveCard(false)
  },

  onToggleTheme() {
    const app = getApp()
    const next = app && typeof app.toggleTheme === 'function'
      ? app.toggleTheme()
      : (this.data.theme === 'dark' ? 'light' : 'dark')
    this.setData({ theme: next })
  }
})
