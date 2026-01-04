const getAppTheme = () => {
  try {
    const app = getApp()
    return app && typeof app.getTheme === 'function' ? app.getTheme() : 'light'
  } catch (e) {
    return 'light'
  }
}

const getSafeBottomRpx = () => {
  try {
    const app = getApp()
    return app && app.globalData && typeof app.globalData.safeBottomRpx === 'number'
      ? app.globalData.safeBottomRpx
      : 0
  } catch (e) {
    return 0
  }
}

Component({
  data: {
    selected: 0,
    theme: 'light',
    safeBottomRpx: 0,
    list: [
      { pagePath: 'pages/home/index', text: 'Home', icon: 'home' },
      { pagePath: 'pages/library/index', text: 'Create', icon: 'add' },
      { pagePath: 'pages/goals/index', text: 'Goals', icon: 'flag' },
      { pagePath: 'pages/leaderboard/index', text: 'Rank', icon: 'chart-bar' },
      { pagePath: 'pages/profile/index', text: 'Settings', icon: 'setting' }
    ]
  },

  lifetimes: {
    attached() {
      this.setData({
        theme: getAppTheme(),
        safeBottomRpx: getSafeBottomRpx()
      })
      this.syncSelectedByRoute()
    }
  },

  pageLifetimes: {
    show() {
      this.setData({ theme: getAppTheme() })
      this.syncSelectedByRoute()
    }
  },

  methods: {
    syncSelectedByRoute() {
      try {
        const pages = getCurrentPages()
        const current = pages && pages.length ? pages[pages.length - 1] : null
        const route = current && typeof current.route === 'string' ? current.route : ''
        if (!route) return
        const idx = this.data.list.findIndex((it) => it.pagePath === route)
        if (idx >= 0 && idx !== this.data.selected) {
          this.setData({ selected: idx })
        }
      } catch (e) {
        // ignore
      }
    },

    onTabItemTap(e) {
      const index = Number(e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index)
      const pagePath = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.path
      if (!pagePath) return
      if (Number.isFinite(index) && index === this.data.selected) return

      wx.switchTab({
        url: `/${pagePath}`,
        success: () => {
          if (Number.isFinite(index)) this.setData({ selected: index })
        }
      })
    }
  }
})



