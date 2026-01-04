import { loadMyStats, updateDailyGoal } from '../../services/userStats'
import { getWeekMonthStats } from '../../services/activity'

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

    isLoadingStats: false,

    dailyGoal: 20,
    cardsStudiedToday: 0,
    currentStreak: 0,
    progressPercentage: 0,
    remaining: 0,

    isEditingGoal: false,
    tempGoal: 20,
    goalPresets: [10, 20, 30, 50, 100],

    weekTotal: 0,
    monthTotal: 0,
    todayIndex: 6,

    weeklyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weeklyHeights: [0, 0, 0, 0, 0, 0, 0]
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 2, theme: ui.theme })

    this.loadStats()
  },

  noop() {},

  async getOpenid() {
    if (this._openid) return this._openid
    if (!wx.cloud || !wx.cloud.callFunction) throw new Error('cloud unavailable')
    const loginRes = await wx.cloud.callFunction({ name: 'login' })
    const openid = loginRes && loginRes.result && loginRes.result.openid
    if (!openid) throw new Error('login no openid')
    this._openid = openid
    return openid
  },

  async ensureUserStats(openid) {
    const db = wx.cloud.database()
    const res = await db.collection(flashcardCollections.userStats).where({ _openid: openid }).limit(1).get()
    const current = res && Array.isArray(res.data) && res.data[0] ? res.data[0] : null
    if (current) return current

    const createdAt = db.serverDate()
    const base = {
      xp: 0,
      streak: 0,
      studiedToday: 0,
      lastStudyDate: '',
      dailyGoal: 20,
      createdAt,
      updatedAt: createdAt
    }
    const addRes = await db.collection(flashcardCollections.userStats).add({ data: base })
    if (addRes && addRes._id) this._statsId = addRes._id
    return base
  },

  calcProgress(studied, goal) {
    const g = Number(goal) || 0
    const s = Number(studied) || 0
    const pct = g > 0 ? Math.min(100, Math.round((s / g) * 100)) : 0
    const remaining = Math.max(0, g - s)
    this.setData({ progressPercentage: pct, remaining })
  },

  async loadStats() {
    // local goal fallback
    let localGoal = 20
    try {
      const cached = wx.getStorageSync && wx.getStorageSync('dailyGoal')
      if (typeof cached === 'number' && cached > 0) localGoal = cached
    } catch (e) {
      // ignore
    }

    if (!wx.cloud || !wx.cloud.database) {
      this.setData({
        isLoadingStats: false,
        dailyGoal: localGoal,
        tempGoal: localGoal,
        cardsStudiedToday: 0,
        currentStreak: 0,
        weekTotal: 0,
        monthTotal: 0,
        todayIndex: 6,
        weeklyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        weeklyHeights: [0, 0, 0, 0, 0, 0, 0]
      })
      this.calcProgress(0, localGoal)
      return
    }

    try {
      this.setData({ isLoadingStats: true })
      const ret = await loadMyStats()
      const activity = await getWeekMonthStats()
      const dailyGoal = ret && typeof ret.dailyGoal === 'number' && ret.dailyGoal > 0 ? ret.dailyGoal : localGoal
      const cardsStudiedToday = ret && typeof ret.cardsStudiedToday === 'number' ? ret.cardsStudiedToday : 0
      const currentStreak = ret && typeof ret.streak === 'number' ? ret.streak : 0

      this.setData({
        dailyGoal,
        tempGoal: dailyGoal,
        cardsStudiedToday,
        currentStreak,
        weekTotal: activity && typeof activity.weekTotal === 'number' ? activity.weekTotal : 0,
        monthTotal: activity && typeof activity.monthTotal === 'number' ? activity.monthTotal : 0,
        todayIndex: activity && typeof activity.todayIndex === 'number' ? activity.todayIndex : 6,
        weeklyDays: activity && Array.isArray(activity.weeklyDays) ? activity.weeklyDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        weeklyHeights: activity && Array.isArray(activity.weeklyHeights) ? activity.weeklyHeights : [0, 0, 0, 0, 0, 0, 0],
        isLoadingStats: false
      })
      this.calcProgress(cardsStudiedToday, dailyGoal)
    } catch (e) {
      console.error('loadStats failed', e)
      this.setData({
        isLoadingStats: false,
        dailyGoal: localGoal,
        tempGoal: localGoal,
        cardsStudiedToday: 0,
        currentStreak: 0,
        weekTotal: 0,
        monthTotal: 0,
        todayIndex: 6,
        weeklyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        weeklyHeights: [0, 0, 0, 0, 0, 0, 0]
      })
      this.calcProgress(0, localGoal)
    }
  },

  onOpenEdit() {
    this.setData({ isEditingGoal: true, tempGoal: this.data.dailyGoal })
  },

  onCancelEdit() {
    this.setData({ isEditingGoal: false, tempGoal: this.data.dailyGoal })
  },

  onPickPreset(e) {
    const value = Number(e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.value)
    if (!Number.isFinite(value) || value <= 0) return
    this.setData({ tempGoal: value })
  },

  onTempGoalInput(e) {
    const raw = e && e.detail && typeof e.detail.value !== 'undefined' ? e.detail.value : ''
    const num = Math.max(1, parseInt(raw, 10) || 1)
    this.setData({ tempGoal: num })
  },

  async onSaveGoal() {
    const next = Number(this.data.tempGoal)
    if (!Number.isFinite(next) || next <= 0) return

    this.setData({ dailyGoal: next, isEditingGoal: false })
    this.calcProgress(this.data.cardsStudiedToday, next)

    try {
      wx.setStorageSync && wx.setStorageSync('dailyGoal', next)
    } catch (e) {
      // ignore
    }

    try {
      if (wx.cloud && wx.cloud.database) {
        await updateDailyGoal(next)
      }
    } catch (e) {
      console.error('save dailyGoal failed', e)
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


