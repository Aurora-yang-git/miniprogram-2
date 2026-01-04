import { loadMyStats, updateProfile } from '../../services/userStats'
import { countUserCards } from '../../services/cards'
import { callOkFunction } from '../../services/cloud'
import { clearAuthCache } from '../../services/auth'

function formatNumber(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '0'
  return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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

    version: '1.0.0',

    notifications: true,

    points: 0,
    pointsText: '0',
    globalRank: '-',

    isLoading: false,

    streak: 0,
    cardCount: 0,

    cardsStudiedToday: 0,
    dailyGoal: 20
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    this.hydrateNotifications()
    this.refreshAll(true)
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 4, theme: ui.theme })

    this.refreshAll(false)
  },

  hydrateNotifications() {
    try {
      const enabled = wx.getStorageSync && wx.getStorageSync('reminderEnabled')
      if (typeof enabled === 'boolean') this.setData({ notifications: enabled })
    } catch (e) {
      // ignore
    }
  },

  async refreshAll(showLoading) {
    if (!wx.cloud || !wx.cloud.database) {
      this.setData({
        points: 0,
        pointsText: '0',
        globalRank: '-',
        streak: 0,
        cardCount: 0,
        cardsStudiedToday: 0,
        dailyGoal: 20
      })
      return
    }

    try {
      if (showLoading) this.setData({ isLoading: true })
      const my = await loadMyStats()
      const xp = my && typeof my.xp === 'number' ? my.xp : 0
      const streak = my && typeof my.streak === 'number' ? my.streak : 0
      const cardsStudiedToday = my && typeof my.cardsStudiedToday === 'number' ? my.cardsStudiedToday : 0
      const dailyGoal = my && typeof my.dailyGoal === 'number' && my.dailyGoal > 0 ? my.dailyGoal : 20
      const cardCount = await countUserCards()

      this.setData({
        points: xp,
        pointsText: formatNumber(xp),
        streak,
        cardCount,
        cardsStudiedToday,
        dailyGoal
      })

      await this.loadGlobalRank()
      if (showLoading) this.setData({ isLoading: false })
    } catch (e) {
      console.error('refreshAll failed', e)
      if (showLoading) this.setData({ isLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadGlobalRank() {
    try {
      if (!wx.cloud || !wx.cloud.callFunction) return
      const ret = await callOkFunction('getGlobalRank', {})
      const me = ret && ret.me ? ret.me : null
      const rank = me && typeof me.rank === 'number' ? me.rank : '-'
      this.setData({ globalRank: rank })
    } catch (e) {
      console.error('loadGlobalRank failed', e)
    }
  },

  onRequestUserProfile() {
    if (!wx.getUserProfile) {
      wx.showToast({ title: '当前版本不支持获取头像昵称', icon: 'none' })
      return
    }

    wx.getUserProfile({
      desc: '用于展示昵称与排行榜信息',
      success: async (res) => {
        const info = res && res.userInfo ? res.userInfo : {}
        const nickName = typeof info.nickName === 'string' ? info.nickName : ''
        const avatarUrl = typeof info.avatarUrl === 'string' ? info.avatarUrl : ''
        try {
          wx.setStorageSync && wx.setStorageSync('userInfo', { nickName, avatarUrl })
        } catch (e) {
          // ignore
        }

        try {
          if (wx.cloud && wx.cloud.database) {
            await updateProfile({ nickname: nickName, avatarUrl })
          }
        } catch (e) {
          console.error('updateProfile failed', e)
        }

        wx.showToast({ title: 'Profile updated', icon: 'success' })
        this.refreshAll(false)
      },
      fail: () => {
        wx.showToast({ title: 'Cancelled', icon: 'none' })
      }
    })
  },

  onToggleNotifications() {
    const next = !this.data.notifications
    this.setData({ notifications: next })
    try {
      wx.setStorageSync && wx.setStorageSync('reminderEnabled', next)
    } catch (e) {
      // ignore
    }
  },

  onPrivacyPolicy() {
    wx.showModal({
      title: 'Privacy Policy',
      content: 'This is a demo privacy policy placeholder.',
      showCancel: false
    })
  },

  onExportData() {
    wx.showToast({ title: 'Coming soon', icon: 'none' })
  },

  onSignOut() {
    try {
      wx.clearStorageSync && wx.clearStorageSync()
    } catch (e) {
      // ignore
    }
    try {
      clearAuthCache()
    } catch (e) {
      // ignore
    }
    wx.showToast({ title: 'Signed out', icon: 'success' })
    wx.switchTab({ url: '/pages/home/index' })
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
