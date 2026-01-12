// app.js
import { ensureUserStats } from './services/userStats'

const THEME_MODE_KEY = 'themeMode' // system | light | dark
const SYSTEM_THEME_CACHE_KEY = 'systemThemeCache' // light | dark (system-derived)

App({
  globalData: {
    theme: 'light',
    themeMode: 'system',
    systemTheme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0
  },

  readCachedSystemTheme() {
    try {
      const v = wx.getStorageSync && wx.getStorageSync(SYSTEM_THEME_CACHE_KEY)
      return v === 'dark' ? 'dark' : 'light'
    } catch (e) {
      return 'light'
    }
  },

  writeCachedSystemTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light'
    try {
      wx.setStorageSync && wx.setStorageSync(SYSTEM_THEME_CACHE_KEY, t)
    } catch (e) {
      // ignore
    }
  },

  getSystemInfoAsync() {
    return new Promise((resolve) => {
      try {
        if (typeof wx.getSystemInfoAsync === 'function') {
          wx.getSystemInfoAsync({
            success: (res) => resolve(res),
            fail: () => resolve(null)
          })
          return
        }
        if (typeof wx.getSystemInfo === 'function') {
          wx.getSystemInfo({
            success: (res) => resolve(res),
            fail: () => resolve(null)
          })
          return
        }
      } catch (e) {
        // ignore
      }
      resolve(null)
    })
  },

  refreshSystemInfo() {
    if (this._refreshSystemInfoPromise) return this._refreshSystemInfoPromise

    this._refreshSystemInfoPromise = this.getSystemInfoAsync()
      .then((sys) => {
        if (!sys || typeof sys !== 'object') return null

        // Metrics (rpx) for custom navbar/tabbar layouts
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

        // Broadcast metrics to current pages so layouts can adjust after async init.
        try {
          const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
          if (Array.isArray(pages)) {
            pages.forEach((p) => {
              try {
                if (p && typeof p.setData === 'function') p.setData({ statusBarRpx, safeBottomRpx })
              } catch (e) {
                // ignore per page
              }
            })
          }
        } catch (e) {
          // ignore
        }

        // System theme cache (avoid deprecated getSystemInfoSync)
        const sysTheme = sys && typeof sys.theme === 'string' ? sys.theme : ''
        if (sysTheme === 'dark' || sysTheme === 'light') {
          this.globalData.systemTheme = sysTheme
          this.writeCachedSystemTheme(sysTheme)
          if (this.getThemeMode() === 'system' && this.getTheme() !== sysTheme) {
            this.applyTheme(sysTheme)
          }
        }

        return sys
      })
      .catch(() => null)
      .finally(() => {
        this._refreshSystemInfoPromise = null
      })

    return this._refreshSystemInfoPromise
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
    const t = this.globalData && typeof this.globalData.systemTheme === 'string' ? this.globalData.systemTheme : ''
    if (t === 'dark' || t === 'light') return t
    return this.readCachedSystemTheme()
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
    if (m === 'system') {
      // Refresh in background to pick up current system theme + metrics.
      this.refreshSystemInfo()
    }
    return nextTheme
  },

  toggleTheme() {
    // keep for compatibility; toggles override only
    const next = this.getTheme() === 'dark' ? 'light' : 'dark'
    return this.setTheme(next)
  },

  ensureSystemMetrics() {
    // Async to avoid deprecated sync API and reduce main-thread blocking.
    this.refreshSystemInfo()
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
      if (mode === 'system') this.refreshSystemInfo()
    } catch (e) {
      // ignore
    }
  },

  onLaunch: function () {
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
    // Use cached systemTheme for the first paint; refresh async right after.
    this.globalData.systemTheme = this.readCachedSystemTheme()
    const initialTheme = themeMode === 'system' ? this.computeSystemTheme() : themeMode
    this.applyTheme(initialTheme)
    this.ensureSystemMetrics()

    // Listen to system theme changes when in system mode.
    try {
      if (typeof wx.onThemeChange === 'function') {
        wx.onThemeChange(({ theme }) => {
          if (this.getThemeMode() !== 'system') return
          if (theme === 'dark' || theme === 'light') {
            this.globalData.systemTheme = theme
            this.writeCachedSystemTheme(theme)
          }
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
        // Some WeChat DevTools / base library versions may throw internal unhandled promise errors
        // when CloudBase user tracing is enabled (e.g. initMessager/subscribe).
        // It's safe to enable tracing only in release to avoid noisy DevTools errors and extra overhead.
        let traceUser = false
        try {
          const info = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync() : null
          const envVersion = info && info.miniProgram ? info.miniProgram.envVersion : ''
          traceUser = envVersion === 'release'
        } catch (e) {
          traceUser = false
        }

        const maybePromise = wx.cloud.init({
          env: 'eduction-cloud1-8g0geqlyf50302db',
          traceUser,
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
