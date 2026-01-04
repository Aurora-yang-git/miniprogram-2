// app.js
App({
  globalData: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0
  },

  getTheme() {
    return this.globalData && this.globalData.theme === 'dark' ? 'dark' : 'light'
  },

  setTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light'
    this.globalData.theme = next
    try {
      wx.setStorageSync && wx.setStorageSync('theme', next)
    } catch (e) {
      // ignore
    }
    return next
  },

  toggleTheme() {
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

  onLaunch: function () {
    this.ensureSystemMetrics()

    // Theme init: storage -> system -> light
    let theme = 'light'
    try {
      const cached = wx.getStorageSync && wx.getStorageSync('theme')
      if (cached === 'dark' || cached === 'light') theme = cached
    } catch (e) {
      // ignore
    }
    if (theme !== 'dark' && theme !== 'light') {
      try {
        const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null
        const sysTheme = sys && typeof sys.theme === 'string' ? sys.theme : ''
        if (sysTheme === 'dark' || sysTheme === 'light') theme = sysTheme
      } catch (e) {
        // ignore
      }
    }
    this.globalData.theme = theme

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'eduction-cloud1-8g0geqlyf50302db',
        traceUser: true,
      }).then(() => {
        console.log('云环境初始化成功')
      }).catch(err => {
        console.error('云环境初始化失败：', err)
      })
    }
  }
})
