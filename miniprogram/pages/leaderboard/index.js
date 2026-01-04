import { callOkFunction } from '../../services/cloud'

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
    const ui = getAppUiState()
    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx,
      leaderboard: []
    })
    this.loadLeaderboard()
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 3, theme: ui.theme })

    this.loadLeaderboard()
  },

  async loadLeaderboard() {
    if (!wx.cloud || !wx.cloud.callFunction) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }
    try {
      this.setData({ isLoading: true })
      const ret = await callOkFunction('getGlobalRank', {})
      const top = Array.isArray(ret.top) ? ret.top : []
      const me = ret.me || null
      const meOpenid = me && typeof me.openid === 'string' ? me.openid : ''
      const meRank = me && typeof me.rank === 'number' ? me.rank : 0
      const meXp = me && typeof me.xp === 'number' ? me.xp : 0
      const meNickname = me && typeof me.nickname === 'string' && me.nickname ? me.nickname : 'You'

      const list = top.map((u, idx) => {
        const openid = u && typeof u.openid === 'string' ? u.openid : ''
        const xp = u && typeof u.xp === 'number' ? u.xp : 0
        const nickname = u && typeof u.nickname === 'string' && u.nickname ? u.nickname : 'User'
        const isCurrentUser = !!meOpenid && openid === meOpenid
        return {
          rank: idx + 1,
          username: nickname,
          points: formatNumber(xp),
          streak: '-',
          isCurrentUser
        }
      })

      if (meOpenid && !list.some((it) => it.isCurrentUser)) {
        list.push({
          rank: meRank || '-',
          username: meNickname,
          points: formatNumber(meXp),
          streak: '-',
          isCurrentUser: true
        })
      }

      this.setData({ leaderboard: list, isLoading: false })
    } catch (e) {
      console.error('loadLeaderboard failed', e)
      this.setData({ isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ leaderboard: [] })
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


