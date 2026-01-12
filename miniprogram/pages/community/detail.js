import { getCommunityDeck, toggleCommunityDeckLike, collectCommunityDeck } from '../../services/community'
import { formatRelativeTime } from '../../services/time'

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
    uploadTime: createdAtMs ? formatRelativeTime(createdAtMs, now) : '',
    cards: Array.isArray(deck && deck.cards) ? deck.cards : []
  }
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    deckId: '',
    deck: null,
    isLiked: false,
    isCollected: false,
    showAllCards: false,

    isLoading: false,
    likeLoading: false,
    collectLoading: false
  },

  onLoad(options) {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const id = options && options.id ? String(options.id) : ''
    if (!id) return
    this.setData({ deckId: id })
    this.loadDeckDetail(id).catch(() => {})
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
  },

  async loadDeckDetail(deckId) {
    const id = String(deckId || '').trim()
    if (!id) return
    this.setData({ isLoading: true })
    try {
      const res = await getCommunityDeck(id)
      const deck = res && res.deck ? normalizeDeckForUi(res.deck) : null
      const isLiked = Boolean(res && res.isLiked)
      const isCollected = Boolean(res && res.isCollected)
      this.setData({ deck, isLiked, isCollected, isLoading: false })
    } catch (e) {
      console.error('load community deck failed', e)
      this.setData({ deck: null, isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  toggleShowAll() {
    this.setData({ showAllCards: !this.data.showAllCards })
  },

  async toggleLike() {
    if (this.data.likeLoading) return
    const id = this.data.deckId
    if (!id) return
    const deck = this.data.deck
    if (!deck) return
    this.setData({ likeLoading: true })
    try {
      const res = await toggleCommunityDeckLike(id)
      const liked = Boolean(res && res.liked)
      const nextCount = Math.max(0, Number(deck.likeCount || 0) + (liked ? 1 : -1))
      this.setData({
        isLiked: liked,
        deck: { ...deck, likeCount: nextCount }
      })
      if (liked) wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      wx.showToast({ title: liked ? 'Liked!' : 'Unliked', icon: liked ? 'success' : 'none' })
    } catch (e) {
      console.error('toggle like failed', e)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      this.setData({ likeLoading: false })
    }
  },

  async collectDeck() {
    if (this.data.collectLoading) return
    const id = this.data.deckId
    const deck = this.data.deck
    if (!id || !deck) return

    const cardCount = Array.isArray(deck.cards) ? deck.cards.length : (Number(deck.cardCount || 0) || 0)
    const already = Boolean(this.data.isCollected)
    const res = await new Promise((resolve) => {
      wx.showModal({
        title: already ? 'Re-sync Deck' : 'Collect Deck',
        content: already
          ? 'Already collected. Re-sync to ensure cards are in your library?'
          : `Add ${cardCount} cards to your collection?`,
        confirmText: already ? 'Re-sync' : 'Collect',
        success: (r) => resolve(r)
      })
    })
    if (!res || !res.confirm) return

    this.setData({ collectLoading: true })
    wx.showLoading({ title: 'Collecting...' })
    try {
      const ret = await collectCommunityDeck(id)
      const existed = Boolean(ret && ret.existed)
      const added = typeof (ret && ret.added) === 'number' ? ret.added : 0
      const total = typeof (ret && ret.total) === 'number' ? ret.total : cardCount

      // optimistic bump downloadCount when first collected
      const nextDownloads = existed ? Number(deck.downloadCount || 0) : Number(deck.downloadCount || 0) + 1
      this.setData({
        isCollected: true,
        deck: { ...deck, downloadCount: nextDownloads }
      })

      wx.hideLoading()
      wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
      if (existed) {
        wx.showToast({ title: added > 0 ? `Synced ${added} cards` : 'Already collected', icon: 'success' })
      } else {
        wx.showToast({ title: `Collected ${total} cards!`, icon: 'success' })
      }
    } catch (e) {
      wx.hideLoading()
      const msg = e && e.message ? String(e.message) : 'collect failed'
      console.error('collect failed', msg)
      wx.showToast({ title: msg.includes('too large') ? '该卡包太大，暂不支持一键收藏' : '收藏失败', icon: 'none' })
    } finally {
      this.setData({ collectLoading: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})


