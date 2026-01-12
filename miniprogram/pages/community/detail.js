import { getCommunityDeck, toggleCommunityDeckLike, enqueueCollectCommunityDeck, getCollectJob, kickCollectJob } from '../../services/community'
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
    collectLoading: false,
    isSyncing: false,
    collectJobId: '',
    collectSyncText: ''
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

    const prevDownloads = Number(deck.downloadCount || 0)
    const nextDownloads = already ? prevDownloads : prevDownloads + 1
    this.setData({
      collectLoading: true,
      isCollected: true,
      isSyncing: true,
      collectJobId: '',
      collectSyncText: 'Starting...',
      deck: { ...deck, downloadCount: nextDownloads }
    })

    try {
      const enq = await enqueueCollectCommunityDeck(id)
      const jobId = enq && enq.jobId ? String(enq.jobId) : ''
      if (!jobId) throw new Error('enqueue failed')
      this.setData({ collectJobId: jobId })

      // Kick worker (fire-and-forget). We still poll even if kick fails (timer trigger will continue).
      kickCollectJob(jobId).catch(() => {})

      await this.pollCollectJob(jobId, { already })
    } catch (e) {
      const msg = e && e.message ? String(e.message) : 'collect failed'
      console.error('collect failed', msg)
      // Revert optimistic UI when this was a first-time collect attempt.
      this.setData({
        isSyncing: false,
        collectJobId: '',
        collectSyncText: '',
        ...(already
          ? {}
          : {
              isCollected: false,
              deck: { ...deck, downloadCount: prevDownloads }
            })
      })
      wx.showToast({ title: msg.includes('too large') ? '该卡包太大，暂不支持一键收藏' : '收藏失败', icon: 'none' })
    } finally {
      this.setData({ collectLoading: false })
    }
  },

  async pollCollectJob(jobId, { already } = {}) {
    const id = String(jobId || '').trim()
    if (!id) return

    let startAdded = null
    const startedAt = Date.now()
    const hardTimeoutMs = 60 * 1000

    while (Date.now() - startedAt < hardTimeoutMs) {
      // eslint-disable-next-line no-await-in-loop
      const res = await getCollectJob(id)
      const job = res && res.job ? res.job : null
      const status = job && job.status ? String(job.status) : 'queued'
      const total = job && typeof job.total === 'number' ? Math.max(0, job.total) : 0
      const added = job && typeof job.added === 'number' ? Math.max(0, job.added) : 0
      const err = job && job.error ? String(job.error) : ''

      if (startAdded == null) startAdded = added

      const text = total > 0 ? `Syncing ${Math.min(added, total)}/${total}` : 'Syncing...'
      this.setData({ isSyncing: true, collectSyncText: text })

      if (status === 'done') {
        const delta = Math.max(0, added - (startAdded || 0))
        this.setData({ isSyncing: false, collectSyncText: '' })
        wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
        wx.showToast({
          title: already ? (delta > 0 ? `Synced ${delta} cards` : 'Already collected') : `Collected ${total || added} cards!`,
          icon: 'success'
        })
        return
      }

      if (status === 'failed') {
        this.setData({ isSyncing: false, collectSyncText: '' })
        throw new Error(err || 'collect failed')
      }

      // Soft-kick occasionally to keep progress moving when user is watching.
      if (Date.now() - startedAt < 15 * 1000) {
        kickCollectJob(id).catch(() => {})
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, Date.now() - startedAt < 5000 ? 800 : 1500))
    }

    // Timeout: keep syncing in background (timer trigger will continue), but don't block UI.
    this.setData({ isSyncing: false, collectSyncText: '' })
    wx.showToast({ title: '已在后台同步', icon: 'none' })
  },

  goBack() {
    wx.navigateBack()
  }
})


