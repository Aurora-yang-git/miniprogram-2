import { callOkFunction } from '../../services/cloud'

const LEADERBOARD_CACHE_KEY = 'leaderboard_cache_v1'
const LEADERBOARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function readLeaderboardCache() {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(LEADERBOARD_CACHE_KEY)
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (!obj || typeof obj !== 'object') return null
    const ts = typeof obj.ts === 'number' ? obj.ts : 0
    if (!ts || Date.now() - ts > LEADERBOARD_CACHE_TTL_MS) return null
    const leaderboard = Array.isArray(obj.leaderboard) ? obj.leaderboard : []
    return { ts, leaderboard }
  } catch (e) {
    return null
  }
}

function writeLeaderboardCache(payload) {
  try {
    wx.setStorageSync && wx.setStorageSync(LEADERBOARD_CACHE_KEY, payload)
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

function formatNumber(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '0'
  return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,
    isLoading: false,
    leaderboard: []
  },

  onLoad() {
    this._loadSeq = 0

    const ui = getAppUiState()
    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx,
      leaderboard: []
    })
    this.hydrateLeaderboardCache()
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 3, theme: ui.theme })

    const hasCache = this.hydrateLeaderboardCache()
    this.loadLeaderboard({ silent: hasCache })
  },

  hydrateLeaderboardCache() {
    const cached = readLeaderboardCache()
    if (!cached || !Array.isArray(cached.leaderboard) || !cached.leaderboard.length) return false
    this.setData({ leaderboard: cached.leaderboard })
    return true
  },

  async loadLeaderboard({ silent = false } = {}) {
    const seq = (this._loadSeq = (this._loadSeq || 0) + 1)

    if (!wx.cloud || !wx.cloud.callFunction) {
      if (seq !== this._loadSeq) return
      if (!this.data.leaderboard || !this.data.leaderboard.length) {
        wx.showToast({ title: '云能力不可用', icon: 'none' })
      }
      return
    }
    try {
      const hasAny = Array.isArray(this.data.leaderboard) && this.data.leaderboard.length > 0
      if (!silent && !hasAny) this.setData({ isLoading: true })
      const ret = await callOkFunction('getGlobalRank', {})
      if (seq !== this._loadSeq) return

      const top = Array.isArray(ret.top) ? ret.top : []
      const me = ret && ret.me ? ret.me : null
      const meOpenid = me && typeof me.openid === 'string' ? me.openid : ''
      const meXp = me && typeof me.xp === 'number' ? me.xp : 0
      const meNickname = me && typeof me.nickname === 'string' && me.nickname ? me.nickname : '我'
      const meAvatarUrl = me && typeof me.avatarUrl === 'string' ? me.avatarUrl : ''
      const meRankText =
        me && typeof me.rankText === 'string' && me.rankText
          ? me.rankText
          : me && typeof me.rank === 'number'
            ? String(me.rank)
            : '-'

      const list = top.map((u, idx) => {
        const openid = u && typeof u.openid === 'string' ? u.openid : ''
        const xp = u && typeof u.xp === 'number' ? u.xp : 0
        const nickname = u && typeof u.nickname === 'string' && u.nickname ? u.nickname : '微信用户'
        const avatarUrl = u && typeof u.avatarUrl === 'string' ? u.avatarUrl : ''
        const isCurrentUser = !!meOpenid && openid === meOpenid
        return {
          rank: idx + 1,
          username: nickname,
          avatarUrl,
          points: formatNumber(xp),
          streak: '-',
          isCurrentUser
        }
      })

      if (meOpenid && !list.some((it) => it.isCurrentUser)) {
        list.push({
          rank: meRankText,
          username: meNickname,
          avatarUrl: meAvatarUrl,
          points: formatNumber(meXp),
          streak: '-',
          isCurrentUser: true
        })
      }

      if (seq === this._loadSeq) {
        this.setData({ leaderboard: list, isLoading: false })
        writeLeaderboardCache({ v: 1, ts: Date.now(), leaderboard: list })
      }
    } catch (e) {
      if (seq !== this._loadSeq) return
      console.error('loadLeaderboard failed', e)
      this.setData({ isLoading: false })
      if (!this.data.leaderboard || !this.data.leaderboard.length) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
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


