import { flashcardCollections } from '../../utils/flashcard-config'

Page({
  data: {
    cardList: [],
    displayCards: [],
    currentCard: null,
    detailVisible: false,
    activeTab: 'all',
    keyword: ''
  },

  onShow() {
    this.fetchCardList()
  },

  fetchCardList() {
    const fallback = () => {
      const list = []
      this.setData({
        cardList: list,
        displayCards: list
      })
    }

    if (!wx.cloud || !wx.cloud.database) {
      fallback()
      wx.showToast({
        title: '云能力不可用',
        icon: 'none'
      })
      return
    }

    const db = wx.cloud.database()
    db.collection(flashcardCollections.cards)
      .limit(200)
      .get()
      .then((res) => {
        const rawList = Array.isArray(res.data) ? res.data : []
        const normalized = rawList.map((card) => ({
          ...card,
          id: card.id || card._id,
          tags: Array.isArray(card.tags) ? card.tags : [],
          subject: typeof card.subject === 'string' ? card.subject : '',
          unitName: typeof card.unitName === 'string' ? card.unitName : '',
          subtitle: (() => {
            const subject = typeof card.subject === 'string' ? card.subject.trim() : ''
            const unitName = typeof card.unitName === 'string' ? card.unitName.trim() : ''
            const parts = []
            if (subject) parts.push(subject)
            if (unitName) parts.push(unitName)
            return parts.length ? parts.join(' · ') : '未分类'
          })()
        }))
        const list = normalized

        this.setData({
          cardList: list,
          displayCards: this.applyFilters({ tab: this.data.activeTab, keyword: this.data.keyword }, list)
        })
      })
      .catch((err) => {
        console.error('fetch cards failed', err)
        fallback()
        wx.showToast({
          title: '加载卡片失败',
          icon: 'none'
        })
      })
  },

  normalizeCardForDetail(card) {
    const answerSections = Array.isArray(card.answerSections) && card.answerSections.length
      ? card.answerSections
      : (typeof card.answer === 'string' && card.answer.trim())
        ? [{ title: '答案', type: 'text', content: card.answer }]
        : []

    return {
      ...card,
      tags: Array.isArray(card.tags) ? card.tags : [],
      answerSections
    }
  },

  applyFilters({ tab, keyword }, list = this.data.cardList) {
    let filtered = list

    if (tab !== 'all') {
      const matcher = tab === 'micro'
        ? (card) => (/微观/.test(card.subject) || /微观/.test(card.unitName))
        : (card) => (/宏观/.test(card.subject) || /宏观/.test(card.unitName))
      filtered = filtered.filter(card => matcher(card))
    }

    const kw = (keyword || '').trim().toLowerCase()
    if (!kw) return filtered

    return filtered.filter(card => {
      const tagText = Array.isArray(card.tags) ? card.tags.join(' ') : ''
      const haystack = `${card.question || ''} ${card.subject || ''} ${card.unitName || ''} ${tagText}`.toLowerCase()
      return haystack.includes(kw)
    })
  },

  refreshDisplayCards(partial = {}) {
    const nextTab = typeof partial.activeTab === 'string' ? partial.activeTab : this.data.activeTab
    const nextKeyword = typeof partial.keyword === 'string' ? partial.keyword : this.data.keyword

    this.setData({
      ...partial,
      displayCards: this.applyFilters({ tab: nextTab, keyword: nextKeyword })
    })
  },

  onSearchChange(event) {
    const { value } = event.detail
    this.refreshDisplayCards({ keyword: value })
  },

  onSearchClear() {
    this.refreshDisplayCards({ keyword: '' })
  },

  onSearchSubmit(event) {
    const { value } = event.detail
    this.refreshDisplayCards({ keyword: value })
  },

  onTabChange(event) {
    const { value } = event.detail
    this.refreshDisplayCards({ activeTab: value })
  },

  async onCardTap(event) {
    const { id } = event.currentTarget.dataset
    const targetCard = this.data.cardList.find(card => card.id === id) || null
    if (!targetCard) return

    const normalized = this.normalizeCardForDetail(targetCard)
    this.setData({
      currentCard: normalized,
      detailVisible: true
    })

    if (!normalized.sourceImage || !wx.cloud || !wx.cloud.getTempFileURL) return

    try {
      const res = await wx.cloud.getTempFileURL({ fileList: [normalized.sourceImage] })
      const file = res && Array.isArray(res.fileList) ? res.fileList[0] : null
      const url = file && file.tempFileURL
      if (!url) return

      if (this.data.currentCard && this.data.currentCard.id === normalized.id) {
        this.setData({
          currentCard: {
            ...this.data.currentCard,
            sourceImageUrl: url
          }
        })
      }
    } catch (err) {
      console.error('getTempFileURL failed', err)
    }
  },

  onPopupClose(event) {
    const { visible } = event.detail
    this.setData({ detailVisible: visible })
  },

  onAddCard() {
    wx.navigateTo({ url: '/pages/editor/index' })
  },

  onMemoryAction(event) {
    const { level } = event.currentTarget.dataset
    wx.showToast({
      title: `已记录：${level}`,
      icon: 'none'
    })
  }
})
