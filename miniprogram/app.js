// app.js
import { ensureUserStats } from './services/userStats'

const THEME_MODE_KEY = 'themeMode' // system | light | dark

App({
  globalData: {
    theme: 'light',
    themeMode: 'system',
    statusBarRpx: 0,
    safeBottomRpx: 0
  },

  applyNativeTabBarStyle(theme) {
    try {
      if (!wx.setTabBarStyle) return
      const t = theme === 'dark' ? 'dark' : 'light'
      const style = t === 'dark'
        ? { backgroundColor: '#171717', borderStyle: 'black', color: '#a3a3a3', selectedColor: '#2563eb' }
        : { backgroundColor: '#ffffff', borderStyle: 'white', color: '#737373', selectedColor: '#2563eb' }
      wx.setTabBarStyle(style)
    } catch (e) {
      // May fail early during launch; retry once shortly after.
      try {
        if (this._tabbarStyleTimer) clearTimeout(this._tabbarStyleTimer)
      } catch (err) {
        // ignore
      }
      try {
        const t = theme === 'dark' ? 'dark' : 'light'
        const style = t === 'dark'
          ? { backgroundColor: '#171717', borderStyle: 'black', color: '#a3a3a3', selectedColor: '#2563eb' }
          : { backgroundColor: '#ffffff', borderStyle: 'white', color: '#737373', selectedColor: '#2563eb' }
        this._tabbarStyleTimer = setTimeout(() => {
          try {
            if (wx.setTabBarStyle) wx.setTabBarStyle(style)
          } catch (e2) {
            // ignore
          }
        }, 200)
      } catch (err2) {
        // ignore
      }
    }
  },

  applyTheme(nextTheme) {
    const t = nextTheme === 'dark' ? 'dark' : 'light'
    this.globalData.theme = t

    // Broadcast to current pages so UI updates immediately.
    try {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (Array.isArray(pages)) {
        pages.forEach((p) => {
          try {
            if (p && typeof p.setData === 'function') p.setData({ theme: t })
          } catch (e) {
            // ignore per page
          }
        })
      }
    } catch (e) {
      // ignore
    }

    // Native tabBar style should follow current theme.
    this.applyNativeTabBarStyle(t)
  },

  getThemeMode() {
    const m = this.globalData && typeof this.globalData.themeMode === 'string' ? this.globalData.themeMode : 'system'
    return m === 'light' || m === 'dark' || m === 'system' ? m : 'system'
  },

  computeSystemTheme() {
    try {
      const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null
      const sysTheme = sys && typeof sys.theme === 'string' ? sys.theme : ''
      return sysTheme === 'dark' ? 'dark' : 'light'
    } catch (e) {
      return 'light'
    }
  },

  getTheme() {
    return this.globalData && this.globalData.theme === 'dark' ? 'dark' : 'light'
  },

  // Set an override theme (light/dark)
  setTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light'
    this.globalData.themeMode = next
    try {
      wx.setStorageSync && wx.setStorageSync(THEME_MODE_KEY, next)
    } catch (e) {
      // ignore
    }
    this.applyTheme(next)
    return next
  },

  // Set theme mode: system | light | dark
  setThemeMode(mode) {
    const m = mode === 'light' || mode === 'dark' ? mode : (mode === 'system' ? 'system' : 'system')
    this.globalData.themeMode = m
    const nextTheme = m === 'system' ? this.computeSystemTheme() : m
    try {
      wx.setStorageSync && wx.setStorageSync(THEME_MODE_KEY, m)
    } catch (e) {
      // ignore
    }
    this.applyTheme(nextTheme)
    return nextTheme
  },

  toggleTheme() {
    // keep for compatibility; toggles override only
    const next = this.getTheme() === 'dark' ? 'light' : 'dark'
    return this.setTheme(next)
  },

  ensureSystemMetrics() {
    try {
      const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null
      const screenWidth = sys && typeof sys.screenWidth === 'number' ? sys.screenWidth : 0
      const screenHeight = sys && typeof sys.screenHeight === 'number' ? sys.screenHeight : 0
      const statusBarHeight = sys && typeof sys.statusBarHeight === 'number' ? sys.statusBarHeight : 0

      const pxToRpx = (px) => (screenWidth ? Math.round((px * 750) / screenWidth) : 0)

      const statusBarRpx = pxToRpx(statusBarHeight)

      const safeArea = sys && sys.safeArea ? sys.safeArea : null
      const safeBottomPx =
        safeArea && typeof safeArea.bottom === 'number' && screenHeight
          ? Math.max(0, screenHeight - safeArea.bottom)
          : 0
      const safeBottomRpx = pxToRpx(safeBottomPx)

      this.globalData.statusBarRpx = statusBarRpx
      this.globalData.safeBottomRpx = safeBottomRpx
    } catch (e) {
      // ignore
    }
  },

  // 全局转发配置
  onShareAppMessage() {
    return {
      title: '分享小程序', // 转发标题
      path: '/pages/home/index' // 转发路径，默认首页
    }
  },

  onShow() {
    // When user hasn't overridden theme, always follow current system theme.
    try {
      const mode = this.getThemeMode()
      const next = mode === 'system' ? this.computeSystemTheme() : this.getTheme()
      this.applyTheme(next)
    } catch (e) {
      // ignore
    }
  },

  onLaunch: function () {
    this.ensureSystemMetrics()

    // Theme init: themeMode(storage) -> legacy theme(storage) -> system
    let themeMode = 'system'
    try {
      const cachedMode = wx.getStorageSync && wx.getStorageSync(THEME_MODE_KEY)
      if (cachedMode === 'system' || cachedMode === 'dark' || cachedMode === 'light') themeMode = cachedMode
    } catch (e) {
      // ignore
    }
    if (themeMode === 'system') {
      try {
        const legacy = wx.getStorageSync && wx.getStorageSync('theme')
        if (legacy === 'dark' || legacy === 'light') themeMode = legacy
      } catch (e) {
        // ignore
      }
    }
    this.globalData.themeMode = themeMode
    const initialTheme = themeMode === 'system' ? this.computeSystemTheme() : themeMode
    this.applyTheme(initialTheme)

    // Listen to system theme changes when in system mode.
    try {
      if (typeof wx.onThemeChange === 'function') {
        wx.onThemeChange(({ theme }) => {
          if (this.getThemeMode() !== 'system') return
          this.applyTheme(theme === 'dark' ? 'dark' : 'light')
        })
      }
    } catch (e) {
      // ignore
    }

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      try {
        const maybePromise = wx.cloud.init({
          env: 'eduction-cloud1-8g0geqlyf50302db',
          traceUser: true,
        })

        const afterInit = () => {
          console.log('云环境初始化成功')
          // 确保每个打开过小程序的用户都有 user_stats 记录（用于全局排行榜）
          ensureUserStats().catch((e) => {
            console.warn('ensureUserStats failed', e)
          })
        }

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(afterInit).catch((err) => {
            console.error('云环境初始化失败：', err)
          })
        } else {
          afterInit()
        }
      } catch (err) {
        console.error('云环境初始化失败：', err)
      }
    }
  }
})
