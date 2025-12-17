import { MOCK_CARDS } from '../../utils/mock-data'

Page({
  data: {
    cardList: [],
    displayCards: [],
    currentCard: null,
    detailVisible: false,
    activeTab: 'all',
    keyword: ''
  },

  onLoad() {
    this.fetchCardList()
  },

  fetchCardList() {
    const list = MOCK_CARDS
    this.setData({
      cardList: list,
      displayCards: this.applyFilters({ tab: this.data.activeTab, keyword: this.data.keyword }, list)
    })
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

  onCardTap(event) {
    const { id } = event.currentTarget.dataset
    const targetCard = this.data.cardList.find(card => card.id === id) || null
    if (!targetCard) return

    this.setData({
      currentCard: targetCard,
      detailVisible: true
    })
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
