import { ensureUserStats } from '../../services/userStats'
import { listUserCards, computeDecksFromCards, extractFiltersFromDecks } from '../../services/cards'

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

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    isLoadingDecks: false,

    searchQuery: '',
    activeFilter: 'All',
    filters: ['All'],

    decks: [],
    filteredDecks: [],

    menuDeckId: ''
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx
    })
    this.bootstrap()
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, safeBottomRpx: ui.safeBottomRpx, statusBarRpx: ui.statusBarRpx })

    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 0, theme: ui.theme })

    // refresh decks after create/review
    this.loadDecks()
  },

  async bootstrap() {
    try {
      if (wx.cloud && wx.cloud.database) {
        await ensureUserStats()
      }
    } catch (e) {
      // ignore
    }
    await this.loadDecks()
  },

  async loadDecks() {
    if (!wx.cloud || !wx.cloud.database) {
      this.setData({ decks: [], filteredDecks: [] })
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    try {
      this.setData({ isLoadingDecks: true })
      const cards = await listUserCards()
      const decks = computeDecksFromCards(cards)
      const filters = extractFiltersFromDecks(decks)
      const currentActive = String(this.data.activeFilter || 'All')
      const nextActive = filters.includes(currentActive) ? currentActive : 'All'
      this.setData({ decks, filters, activeFilter: nextActive })
      this.applyFilters()
      this.setData({ isLoadingDecks: false })
    } catch (e) {
      console.error('loadDecks failed', e)
      this.setData({ isLoadingDecks: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      // Keep previous list to avoid UX feeling like decks disappeared
    }
  },

  applyFilters() {
    const decks = Array.isArray(this.data.decks) ? this.data.decks : []
    const q = String(this.data.searchQuery || '').trim().toLowerCase()
    const activeFilter = String(this.data.activeFilter || 'All')
    const filtered = decks.filter((deck) => {
      const title = String(deck && deck.title ? deck.title : '')
      const tags = Array.isArray(deck && deck.tags) ? deck.tags : []
      const matchesSearch = !q || title.toLowerCase().includes(q)
      const matchesFilter = activeFilter === 'All' || tags.includes(activeFilter)
      return matchesSearch && matchesFilter
    })
    this.setData({ filteredDecks: filtered })
  },

  onSearchInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ searchQuery: value })
    this.applyFilters()
  },

  onClearSearch() {
    this.setData({ searchQuery: '' })
    this.applyFilters()
  },

  onFilterTap(e) {
    const filter = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.filter : ''
    if (!filter) return
    this.setData({ activeFilter: filter })
    this.applyFilters()
  },

  onClearFilters() {
    this.setData({ searchQuery: '', activeFilter: 'All' })
    this.applyFilters()
  },

  onGoCreate() {
    wx.switchTab({ url: '/pages/library/index' })
  },

  onQuickAction(e) {
    const action = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.action : ''
    if (action === 'feynman') {
      wx.navigateTo({ url: '/pages/feynman/index' })
      return
    }

    const mode = action === 'upload' ? 'upload' : action === 'text' ? 'text' : 'scan'
    try {
      wx.setStorageSync && wx.setStorageSync('createMode', mode)
    } catch (err) {
      // ignore
    }
    wx.switchTab({ url: '/pages/library/index' })
  },

  onViewDeck(e) {
    const deckTitle = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!deckTitle) return
    wx.navigateTo({ url: `/pages/library/detail?deckTitle=${encodeURIComponent(deckTitle)}` })
  },

  onToggleDeckMenu(e) {
    const deckId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!deckId) return
    this.setData({ menuDeckId: this.data.menuDeckId === deckId ? '' : deckId })
  },

  onCloseDeckMenu() {
    this.setData({ menuDeckId: '' })
  },

  onMenuAction(e) {
    const ds = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset : {}
    const action = ds.action
    const deckTitle = ds.id
    this.setData({ menuDeckId: '' })

    if (!deckTitle) return
    if (action === 'detail' || action === 'add') {
      wx.navigateTo({ url: `/pages/library/detail?deckTitle=${encodeURIComponent(deckTitle)}` })
      return
    }
    if (action === 'study') {
      wx.navigateTo({ url: `/pages/review/index?deckTitle=${encodeURIComponent(deckTitle)}` })
    }
  },

  onToggleTheme() {
    const app = getApp()
    const next = app && typeof app.toggleTheme === 'function'
      ? app.toggleTheme()
      : (this.data.theme === 'dark' ? 'light' : 'dark')

    this.setData({ theme: next })
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ theme: next })
    }
})
