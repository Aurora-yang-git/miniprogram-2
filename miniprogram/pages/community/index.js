import { listCommunityDecks } from '../../services/community'
import { formatRelativeTime } from '../../services/time'

const COMMUNITY_CACHE_PREFIX = 'community_decks_cache_v1_'
const COMMUNITY_CACHE_TTL_MS = 10 * 60 * 1000

function readCommunityCache(sortBy) {
  try {
    const key = `${COMMUNITY_CACHE_PREFIX}${sortBy}`
    const v = wx.getStorageSync && wx.getStorageSync(key)
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (!obj || typeof obj !== 'object') return null
    const ts = typeof obj.ts === 'number' ? obj.ts : 0
    if (!ts || Date.now() - ts > COMMUNITY_CACHE_TTL_MS) return null
    const decks = Array.isArray(obj.decks) ? obj.decks : []
    return { ts, decks }
  } catch (e) {
    return null
  }
}

function writeCommunityCache(sortBy, decks) {
  try {
    const key = `${COMMUNITY_CACHE_PREFIX}${sortBy}`
    wx.setStorageSync && wx.setStorageSync(key, { v: 1, ts: Date.now(), decks })
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

function toMs(val) {
  if (!val) return 0
  if (typeof val === 'number') return val
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'string') {
    const t = Date.parse(val)
    return Number.isFinite(t) ? t : 0
  }
  if (typeof val === 'object' && val.$date) {
    const t = Date.parse(val.$date)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function normalizeDeckForUi(deck, now = Date.now()) {
  const createdAtMs = toMs(deck && (deck.createdAt || deck.updatedAt))
  return {
    ...deck,
    uploadTime: createdAtMs ? formatRelativeTime(createdAtMs, now) : ''
  }
}

function filterDecks(list, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return Array.isArray(list) ? list : []
  const decks = Array.isArray(list) ? list : []
  return decks.filter((d) => {
    const title = String(d && d.title ? d.title : '').toLowerCase()
    const desc = String(d && d.description ? d.description : '').toLowerCase()
    const tags = Array.isArray(d && d.tags) ? d.tags : []
    return (
      title.includes(q) ||
      desc.includes(q) ||
      tags.some((t) => String(t || '').toLowerCase().includes(q))
    )
  })
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    activeTab: 'hot', // hot | new | downloaded
    searchQuery: '',

    isLoading: false,
    allDecks: [],
    decks: []
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    // Fast path: render cached list instantly, refresh silently in background.
    const hasCache = this.hydrateDeckCache()
    this.loadDecks({ silent: hasCache }).catch(() => {})
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
  },

  async onPullDownRefresh() {
    try {
      await this.loadDecks({ force: true })
    } catch (e) {
      // ignore
    } finally {
      wx.stopPullDownRefresh && wx.stopPullDownRefresh()
    }
  },

  hydrateDeckCache() {
    const sortBy = this.data.activeTab
    const cached = readCommunityCache(sortBy)
    if (!cached) return false
    const list = Array.isArray(cached.decks) ? cached.decks : []
    const filtered = filterDecks(list, this.data.searchQuery)
    this.setData({ allDecks: list, decks: filtered, isLoading: false })
    return true
  },

  async loadDecks({ force = false, silent = false } = {}) {
    if (this._loading && !force) return
    this._loading = true
    if (!silent) this.setData({ isLoading: true })
    try {
      const sortBy = this.data.activeTab
      const list = await listCommunityDecks({ sortBy, limit: 30 })
      const now = Date.now()
      const uiList = list.map((d) => normalizeDeckForUi(d, now))
      const filtered = filterDecks(uiList, this.data.searchQuery)
      this.setData({ allDecks: uiList, decks: filtered, isLoading: false })
      writeCommunityCache(sortBy, uiList)
    } catch (e) {
      console.error('load community decks failed', e)
      // If we already rendered cached content, keep it and avoid disruptive UX.
      if (!silent) {
        this.setData({ isLoading: false, allDecks: [], decks: [] })
        wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
      } else {
        this.setData({ isLoading: false })
      }
    } finally {
      this._loading = false
    }
  },

  switchTab(e) {
    const tab = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.tab : ''
    if (tab !== 'hot' && tab !== 'new' && tab !== 'downloaded') return
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    const hasCache = this.hydrateDeckCache()
    this.loadDecks({ silent: hasCache }).catch(() => {})
  },

  onSearchInput(e) {
    const query = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    const all = Array.isArray(this.data.allDecks) ? this.data.allDecks : []
    this.setData({
      searchQuery: query,
      decks: filterDecks(all, query)
    })
  },

  onClearSearch() {
    const all = Array.isArray(this.data.allDecks) ? this.data.allDecks : []
    this.setData({ searchQuery: '', decks: all })
  },

  goToDetail(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!id) return
    wx.navigateTo({ url: `/pages/community/detail?id=${encodeURIComponent(id)}` })
  },

  goBack() {
    wx.navigateBack()
  }
})


