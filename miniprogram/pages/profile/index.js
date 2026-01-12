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
    dailyGoal: 20,

    username: '',
    isEditingUsername: false,
    tempUsername: '',

    // Dev-only tools (hidden in release)
    showDevTools: false
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    // Show dev tools only in develop/trial builds
    try {
      const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
      const env = info && info.miniProgram && info.miniProgram.envVersion ? info.miniProgram.envVersion : ''
      this.setData({ showDevTools: env === 'develop' || env === 'trial' })
    } catch (e) {
      this.setData({ showDevTools: false })
    }

    this.hydrateNotifications()
    this.refreshAll(true)
  },

  noop() {},

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 4, theme: ui.theme })

    // 未授权用户进入 Settings 时提示去授权（昵称/头像用于排行榜展示）
    this._authPromptedThisShow = false
    this.maybePromptLogin()

    this.refreshAll(false)
  },

  onDarkModeChange(e) {
    const value = e && e.detail ? e.detail.value : false
    const next = value ? 'dark' : 'light'
    try {
      const app = getApp()
      if (app && typeof app.setTheme === 'function') {
        app.setTheme(next)
      }
    } catch (err) {
      // ignore
    }
    const ui = getAppUiState()
    this.setData({ theme: ui.theme })
  },

  isProfileAuthorized() {
    try {
      const info = wx.getStorageSync && wx.getStorageSync('userInfo')
      if (!info || typeof info !== 'object') return false
      const nickName = typeof info.nickName === 'string' ? info.nickName : ''
      const avatarUrl = typeof info.avatarUrl === 'string' ? info.avatarUrl : ''
      return !!(nickName || avatarUrl)
    } catch (e) {
      return false
    }
  },

  maybePromptLogin() {
    if (this._authPromptedThisShow) return
    if (this.isProfileAuthorized()) return
    this._authPromptedThisShow = true

    wx.showModal({
      title: '微信授权',
      content: '是否授权获取微信昵称和头像？用于排行榜展示。',
      confirmText: '去授权',
      cancelText: '暂不',
      success: (res) => {
        if (res && res.confirm) {
          this.onRequestUserProfile()
        }
      }
    })
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
      const stats = my && my.stats ? my.stats : null
      const xp = my && typeof my.xp === 'number' ? my.xp : 0
      const streak = my && typeof my.streak === 'number' ? my.streak : 0
      const cardsStudiedToday = my && typeof my.cardsStudiedToday === 'number' ? my.cardsStudiedToday : 0
      const dailyGoal = my && typeof my.dailyGoal === 'number' && my.dailyGoal > 0 ? my.dailyGoal : 20
      const cardCount = await countUserCards()
      const username = stats && typeof stats.nickname === 'string' ? stats.nickname : ''

      this.setData({
        points: xp,
        pointsText: formatNumber(xp),
        streak,
        cardCount,
        cardsStudiedToday,
        dailyGoal,
        username
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
      const rankText =
        me && typeof me.rankText === 'string' && me.rankText
          ? me.rankText
          : me && typeof me.rank === 'number'
            ? String(me.rank)
            : '-'
      this.setData({ globalRank: rankText })
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
            // Only set nickname from WeChat if user hasn't set a custom username yet.
            let shouldSetNickname = false
            try {
              const my = await loadMyStats()
              const current = my && my.stats && typeof my.stats.nickname === 'string' ? my.stats.nickname : ''
              shouldSetNickname = !current
            } catch (e) {
              shouldSetNickname = false
            }
            await updateProfile(shouldSetNickname ? { nickname: nickName, avatarUrl } : { avatarUrl })
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

  onOpenEditUsername() {
    this.setData({ isEditingUsername: true, tempUsername: this.data.username || '' })
  },

  onCancelEditUsername() {
    this.setData({ isEditingUsername: false, tempUsername: this.data.username || '' })
  },

  onTempUsernameInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ tempUsername: value })
  },

  async onSaveUsername() {
    const next = String(this.data.tempUsername || '').trim()
    if (!next) return
    if (next.length > 20) {
      wx.showToast({ title: '用户名最多 20 字', icon: 'none' })
      return
    }
    this.setData({ username: next, isEditingUsername: false })

    try {
      if (wx.cloud && wx.cloud.database) {
        await updateProfile({ nickname: next })
      }
      wx.showToast({ title: 'Username updated', icon: 'success' })
      this.refreshAll(false)
    } catch (e) {
      console.error('save username failed', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
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

  onGoAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' })
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
