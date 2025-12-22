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
      .limit(20)
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

    return {
      ...card,
      tags: Array.isArray(card.tags) ? card.tags : [],
      answerSections,
      sourceImages
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

    const sourceImages = Array.isArray(normalized.sourceImages) ? normalized.sourceImages : []
    if (!sourceImages.length) return

    const normalizedIds = sourceImages
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => !!id)

    if (!normalizedIds.length) return

    const isCloud = (fid) => /^cloud:\/\//.test(fid)
    const cloudIds = normalizedIds.filter((fid) => isCloud(fid))

    let urlMap = {}
    if (cloudIds.length && wx.cloud && wx.cloud.getTempFileURL) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: cloudIds })
        const fileList = res && Array.isArray(res.fileList) ? res.fileList : []
        fileList.forEach((file) => {
          if (!file || !file.fileID || !file.tempFileURL) return
          urlMap[file.fileID] = file.tempFileURL
        })
      } catch (err) {
        console.error('getTempFileURL failed', err)
      }
    }

    try {
      const urls = normalizedIds
        .map((fid) => (isCloud(fid) ? urlMap[fid] : fid))
        .filter((u) => !!u)
      if (!urls.length) return

      if (this.data.currentCard && this.data.currentCard.id === normalized.id) {
        this.setData({
          currentCard: {
            ...this.data.currentCard,
            sourceImageUrls: urls,
            sourceImageUrl: urls[0]
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

  async onMemoryAction(event) {
    const { level } = event.currentTarget.dataset
    const current = this.data.currentCard
    const cardId = current && (current.id || current._id)
    if (!cardId) return

    const result = level === 'forget' ? 'forget' : 'remember'
    if (!wx.cloud || !wx.cloud.callFunction) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitReview',
        data: {
          cardId,
          result
        }
      })
      const ret = res && res.result ? res.result : null
      if (!ret || ret.ok !== true) {
        throw new Error((ret && ret.error) || '提交失败')
      }

      wx.hideLoading()
      wx.showToast({ title: '已记录', icon: 'success' })

      const currentCard = this.data.currentCard
      if (currentCard && (currentCard.id || currentCard._id) === cardId) {
        const now = Date.now()
        this.setData({
          currentCard: {
            ...currentCard,
            lastReviewedAt: typeof ret.lastReviewedAt === 'number' ? ret.lastReviewedAt : now,
            nextReviewAt: ret.nextReviewAt,
            srsEF: ret.srsEF,
            srsInterval: ret.srsInterval,
            srsReps: ret.srsReps
          }
        })
      }

      this.setData({ detailVisible: false })
    } catch (err) {
      console.error('submitReview failed', err)
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  }
})
