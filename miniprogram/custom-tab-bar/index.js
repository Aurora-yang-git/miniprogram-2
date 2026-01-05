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

const getColors = (theme) => {
  const t = theme === 'dark' ? 'dark' : 'light'
  if (t === 'dark') {
    return { active: '#2563eb', inactive: '#a3a3a3', bg: '#171717', border: '#262626' }
  }
  return { active: '#2563eb', inactive: '#737373', bg: '#ffffff', border: '#e5e5e5' }
}

Component({
  data: {
    selected: 0,
    theme: 'light',
    safeBottomRpx: 0,
    colors: { active: '#2563eb', inactive: '#737373', bg: '#ffffff', border: '#e5e5e5' },
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
      const theme = getAppTheme()
      this.setData({ theme, safeBottomRpx: getSafeBottomRpx(), colors: getColors(theme) })
      this.syncSelectedByRoute()
    }
  },

  pageLifetimes: {
    show() {
      const theme = getAppTheme()
      this.setData({ theme, colors: getColors(theme) })
      this.syncSelectedByRoute()
    }
  },

  observers: {
    theme(theme) {
      this.setData({ colors: getColors(theme) })
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



