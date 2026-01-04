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

function stepToIndex(step) {
  if (step === 'explain') return 1
  if (step === 'feedback') return 2
  return 0
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    step: 'upload',
    stepLabels: ['Upload', 'Explain', 'Feedback'],
    currentStepIndex: 0,

    isLoading: false,
    explanation: ''
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })
  },

  onUnload() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  },

  onBackOrExit() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this.setData({ isLoading: false })

    const step = String(this.data.step || 'upload')
    if (step === 'feedback') {
      this.setData({ step: 'explain', currentStepIndex: stepToIndex('explain') })
      return
    }
    if (step === 'explain') {
      this.setData({ step: 'upload', currentStepIndex: stepToIndex('upload') })
      return
    }

    // upload: exit page
    try {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/home/index' })
        }
      })
    } catch (e) {
      wx.switchTab({ url: '/pages/home/index' })
    }
  },

  onContinue() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })
    this._timer = setTimeout(() => {
      this._timer = null
      this.setData({ isLoading: false, step: 'explain', currentStepIndex: stepToIndex('explain') })
    }, 1500)
  },

  onExplanationInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ explanation: value })
  },

  onGetFeedback() {
    if (this.data.isLoading) return
    const text = String(this.data.explanation || '').trim()
    if (!text) return
    this.setData({ isLoading: true })
    this._timer = setTimeout(() => {
      this._timer = null
      this.setData({ isLoading: false, step: 'feedback', currentStepIndex: stepToIndex('feedback') })
    }, 2000)
  },

  onRestart() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this.setData({ step: 'upload', currentStepIndex: 0, isLoading: false, explanation: '' })
  },

  onToggleTheme() {
    const app = getApp()
    const next = app && typeof app.toggleTheme === 'function'
      ? app.toggleTheme()
      : (this.data.theme === 'dark' ? 'light' : 'dark')
    this.setData({ theme: next })
  }
})


