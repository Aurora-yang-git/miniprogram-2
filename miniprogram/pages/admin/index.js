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

function getEnvVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
    const env = info && info.miniProgram && info.miniProgram.envVersion ? info.miniProgram.envVersion : ''
    return String(env || '')
  } catch (e) {
    return ''
  }
}

function normalizeDeckInput(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const deckTitle = String(d.deckTitle || d.title || '').trim()
  const description = String(d.description || '').trim()
  const tags = Array.isArray(d.tags) ? d.tags.map((t) => String(t || '').trim()).filter(Boolean) : []
  const cardsIn = Array.isArray(d.cards) ? d.cards : []
  const cards = cardsIn
    .map((c) => {
      const cc = c && typeof c === 'object' ? c : {}
      const q = String(cc.q || cc.question || '').trim()
      const a = String(cc.a || cc.answer || '').trim()
      const topic = String(cc.topic || '').trim()
      const hint = String(cc.hint || '').trim()
      return { q, a, topic, hint }
    })
    .filter((c) => c.q || c.a)
  return { deckTitle, description, tags, cards }
}

function extractDecksFromJson(obj) {
  if (Array.isArray(obj)) return obj
  if (obj && typeof obj === 'object' && Array.isArray(obj.decks)) return obj.decks
  if (obj && typeof obj === 'object') return [obj]
  return []
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    envVersion: '',

    strict: true,
    token: '',
    isSyncing: false,
    lastResultText: ''
  },

  onLoad() {
    const ui = getAppUiState()
    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx,
      envVersion: getEnvVersion()
    })
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, safeBottomRpx: ui.safeBottomRpx, statusBarRpx: ui.statusBarRpx })
  },

  onToggleStrict(e) {
    const v = e && e.detail ? Boolean(e.detail.value) : false
    this.setData({ strict: v })
  },

  onTokenInput(e) {
    const v = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ token: v })
  },

  async onChooseAndSync() {
    if (this.data.isSyncing) return
    if (!wx.chooseMessageFile) {
      wx.showToast({ title: '当前版本不支持选择文件', icon: 'none' })
      return
    }

    let picked = null
    try {
      picked = await new Promise((resolve, reject) => {
        wx.chooseMessageFile({
          count: 20,
          type: 'file',
          extension: ['json'],
          success: resolve,
          fail: reject
        })
      })
    } catch (e) {
      return
    }

    const tempFiles = picked && Array.isArray(picked.tempFiles) ? picked.tempFiles : []
    if (!tempFiles.length) return

    const fsm = wx.getFileSystemManager && wx.getFileSystemManager()
    if (!fsm || !fsm.readFile) {
      wx.showToast({ title: '文件系统不可用', icon: 'none' })
      return
    }

    this.setData({ isSyncing: true, lastResultText: '' })
    try {
      const decksOut = []
      for (let i = 0; i < tempFiles.length; i += 1) {
        const f = tempFiles[i]
        const filePath = f && (f.path || f.tempFilePath) ? String(f.path || f.tempFilePath) : ''
        if (!filePath) continue

        // eslint-disable-next-line no-await-in-loop
        const text = await new Promise((resolve, reject) => {
          fsm.readFile({
            filePath,
            encoding: 'utf8',
            success: (res) => resolve(res && typeof res.data === 'string' ? res.data : ''),
            fail: reject
          })
        })

        if (!text) continue
        let obj = null
        try {
          obj = JSON.parse(text)
        } catch (err) {
          throw new Error(`JSON parse failed: ${f && f.name ? f.name : filePath}`)
        }
        const list = extractDecksFromJson(obj)
        list.forEach((d) => decksOut.push(d))
      }

      const normalized = decksOut.map((d) => normalizeDeckInput(d)).filter((d) => d.deckTitle && d.cards.length)
      if (!normalized.length) {
        wx.showToast({ title: '没有可导入的卡包', icon: 'none' })
        this.setData({ isSyncing: false })
        return
      }

      const ret = await callOkFunction('admin', {
        action: 'upsertOfficialDecks',
        strict: this.data.strict,
        token: String(this.data.token || '').trim(),
        decks: normalized,
        seedVersion: Date.now()
      })

      const upserted = Array.isArray(ret && ret.upserted) ? ret.upserted : []
      const removed = typeof ret.removed === 'number' ? ret.removed : 0
      const msg = `OK: upserted=${upserted.length} removed=${removed} strict=${ret && ret.strict ? 'true' : 'false'}`
      this.setData({ lastResultText: msg, isSyncing: false })
      wx.showToast({ title: '同步成功', icon: 'success' })
    } catch (e) {
      const msg = e && e.message ? String(e.message) : '同步失败'
      console.error('sync official decks failed', e)
      this.setData({ isSyncing: false, lastResultText: `ERROR: ${msg}` })
      wx.showToast({ title: msg.slice(0, 20), icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})

// pages/admin/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})