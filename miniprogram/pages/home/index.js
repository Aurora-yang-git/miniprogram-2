import { listUserCards, computeDecksFromCards, extractFiltersFromDecks, deleteDeckByTitle } from '../../services/cards'
import { ensureDefaultDecks, isDefaultDeckTitle, optOutDefaultDeck } from '../../services/defaultDecks'
import { resumePendingCreateJob } from '../../services/pendingCreate'

const HOME_CACHE_KEY = 'home_decks_cache_v1'
const HOME_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function readHomeCache() {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(HOME_CACHE_KEY)
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (!obj || typeof obj !== 'object') return null
    const ts = typeof obj.ts === 'number' ? obj.ts : 0
    if (!ts || Date.now() - ts > HOME_CACHE_TTL_MS) return null
    const decks = Array.isArray(obj.decks) ? obj.decks : []
    const filters = Array.isArray(obj.filters) ? obj.filters : []
    return { ts, decks, filters }
  } catch (e) {
    return null
  }
}

function writeHomeCache(payload) {
  try {
    wx.setStorageSync && wx.setStorageSync(HOME_CACHE_KEY, payload)
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
    this._loadDecksSeq = 0
    this._isResumingPendingCreate = false

    const ui = getAppUiState()
    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx
    })
  },

  async onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, safeBottomRpx: ui.safeBottomRpx, statusBarRpx: ui.statusBarRpx })

    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 0, theme: ui.theme })

    // Fast path: render cached decks immediately, refresh silently in background.
    const hasCache = this.hydrateDeckCache()

    // Ensure built-in decks are complete and properly titled (ACT/CSP).
    try {
      if (wx.cloud && wx.cloud.database) {
        if (hasCache) ensureDefaultDecks().catch(() => {})
        else await ensureDefaultDecks()
      }
    } catch (e) {
      // ignore
    }

    this.loadDecks({ silent: hasCache })

    // If user backgrounded during Create Step3, resume saving in the background,
    // then refresh decks so the new cards/deck appear without re-entering Home.
    this.resumePendingCreateAndRefresh()
  },

  hydrateDeckCache() {
    const cached = readHomeCache()
    if (!cached) return false
    const decks = Array.isArray(cached.decks) ? cached.decks : []
    const filters = Array.isArray(cached.filters) && cached.filters.length ? cached.filters : extractFiltersFromDecks(decks)
    const currentActive = String(this.data.activeFilter || 'All')
    const nextActive = filters.includes(currentActive) ? currentActive : 'All'
    const q = String(this.data.searchQuery || '').trim().toLowerCase()
    const filteredDecks = decks.filter((deck) => {
      const title = String(deck && deck.title ? deck.title : '')
      const tags = Array.isArray(deck && deck.tags) ? deck.tags : []
      const matchesSearch = !q || title.toLowerCase().includes(q)
      const matchesFilter = nextActive === 'All' || tags.includes(nextActive)
      return matchesSearch && matchesFilter
    })
    this.setData({ decks, filters, activeFilter: nextActive, filteredDecks })
    return true
  },

  async resumePendingCreateAndRefresh() {
    if (this._isResumingPendingCreate) return
    this._isResumingPendingCreate = true
    try {
      const ret = await resumePendingCreateJob()
      if (ret && ret.ok === true) {
        await this.loadDecks({ silent: true })
      }
    } catch (e) {
      // ignore
    } finally {
      this._isResumingPendingCreate = false
    }
  },

  async loadDecks({ silent = false } = {}) {
    const seq = (this._loadDecksSeq = (this._loadDecksSeq || 0) + 1)

    if (!wx.cloud || !wx.cloud.database) {
      if (seq !== this._loadDecksSeq) return
      this.setData({ decks: [], filteredDecks: [], isLoadingDecks: false })
      if (seq === this._loadDecksSeq) wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    try {
      const hasAnyDecks = Array.isArray(this.data.decks) && this.data.decks.length > 0
      if (!silent && !hasAnyDecks) this.setData({ isLoadingDecks: true })
      const cards = await listUserCards()
      if (seq !== this._loadDecksSeq) return
      const decks = computeDecksFromCards(cards)
      const filters = extractFiltersFromDecks(decks)
      const currentActive = String(this.data.activeFilter || 'All')
      const nextActive = filters.includes(currentActive) ? currentActive : 'All'
      const q = String(this.data.searchQuery || '').trim().toLowerCase()
      const filteredDecks = decks.filter((deck) => {
        const title = String(deck && deck.title ? deck.title : '')
        const tags = Array.isArray(deck && deck.tags) ? deck.tags : []
        const matchesSearch = !q || title.toLowerCase().includes(q)
        const matchesFilter = nextActive === 'All' || tags.includes(nextActive)
        return matchesSearch && matchesFilter
      })
      if (seq === this._loadDecksSeq) {
        this.setData({
          decks,
          filters,
          activeFilter: nextActive,
          filteredDecks,
          isLoadingDecks: false
        })
        writeHomeCache({ v: 1, ts: Date.now(), decks, filters })
      }
    } catch (e) {
      if (seq !== this._loadDecksSeq) return
      console.error('loadDecks failed', e)
      this.setData({ isLoadingDecks: false })
      if (seq === this._loadDecksSeq) wx.showToast({ title: '加载失败', icon: 'none' })
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
    if (action === 'reviewAll') {
      wx.navigateTo({ url: '/pages/review/index?mode=review&scope=all' })
      return
    }
    if (action !== 'scan') return
    const mode = 'scan'
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
      wx.navigateTo({ url: `/pages/review/index?mode=study&deckTitle=${encodeURIComponent(deckTitle)}` })
      return
    }
    if (action === 'review') {
      wx.navigateTo({ url: `/pages/review/index?mode=review&deckTitle=${encodeURIComponent(deckTitle)}` })
      return
    }
    if (action === 'delete') {
      wx.showModal({
        title: 'Delete deck?',
        content: 'This will delete all cards in this deck.',
        confirmText: 'Delete',
        confirmColor: '#dc2626',
        success: async (res) => {
          if (!res.confirm) return
          try {
            if (isDefaultDeckTitle(deckTitle)) {
              await optOutDefaultDeck(deckTitle)
            }
            await deleteDeckByTitle(deckTitle)
            wx.showToast({ title: 'Deleted', icon: 'success' })
            await this.loadDecks()
          } catch (err) {
            console.error('deleteDeckByTitle failed', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      })
      return
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
