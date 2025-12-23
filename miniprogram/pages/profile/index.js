import { flashcardCollections } from '../../utils/flashcard-config'

function toTimestamp(v) {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  // 兼容云开发可能的 Date 表达
  if (typeof v === 'object') {
    const dateValue = v.$date || v.date || v.value
    if (typeof dateValue === 'number') return dateValue
    if (typeof dateValue === 'string') {
      const t = Date.parse(dateValue)
      return Number.isFinite(t) ? t : 0
    }
  }
  return 0
}

Page({
  data: {
    userInfo: {
      nickName: '',
      avatarUrl: ''
    },
    uid: '----',
    joinDays: 1,
    version: '1.0.0',

    xp: 0,
    streak: 0,
    totalReviewed: 0,
    cardCount: 0,
    focusHours: '0.0',

    level: 1,
    levelTitle: '新手',

    reminderEnabled: false
  },

  onLoad() {
    return this._onLoad()
  },

  async _onLoad() {
    this.hydrateCachedUserInfo()
    try {
      const enabled = wx.getStorageSync && wx.getStorageSync('reminderEnabled')
      if (typeof enabled === 'boolean') this.setData({ reminderEnabled: enabled })
    } catch (e) {
      // ignore
    }
    await this.ensureUserStats()
    await this.loadCardCount()
  },

  hydrateCachedUserInfo() {
    try {
      const cached = wx.getStorageSync && wx.getStorageSync('userInfo')
      if (cached && typeof cached === 'object') {
        const nickName = typeof cached.nickName === 'string' ? cached.nickName : ''
        const avatarUrl = typeof cached.avatarUrl === 'string' ? cached.avatarUrl : ''
        this.setData({ userInfo: { nickName, avatarUrl } })
      }
    } catch (e) {
      // ignore
    }
  },

  async ensureUserStats() {
    try {
      if (!wx.cloud || !wx.cloud.callFunction || !wx.cloud.database) {
        wx.showToast({ title: '云能力不可用', icon: 'none' })
        return
      }

      const loginRes = await wx.cloud.callFunction({ name: 'login' })
      const openid = loginRes && loginRes.result && loginRes.result.openid
      if (!openid) {
        throw new Error('login no openid')
      }
      this._openid = openid
      this.setData({ uid: String(openid).slice(-6) })

      const db = wx.cloud.database()
      const queryRes = await db.collection(flashcardCollections.userStats).where({ _openid: openid }).limit(1).get()
      const current = (queryRes && Array.isArray(queryRes.data) && queryRes.data[0]) ? queryRes.data[0] : null

      if (current) {
        const xp = typeof current.xp === 'number' ? current.xp : 0
        const streak = typeof current.streak === 'number' ? current.streak : 0
        const totalReviewed = typeof current.totalReviewed === 'number' ? current.totalReviewed : 0

        const createdAtTs = toTimestamp(current.createdAt)
        const now = Date.now()
        const joinDays = createdAtTs ? Math.max(1, Math.floor((now - createdAtTs) / (24 * 60 * 60 * 1000)) + 1) : 1

        const focusHours = totalReviewed ? ((totalReviewed * 2) / 60).toFixed(1) : '0.0'
        const level = Math.max(1, Math.floor(xp / 100) + 1)
        const levelTitle = level >= 10 ? '大师' : level >= 5 ? '学霸' : '新手'

        this._statsId = current._id
        this.setData({ xp, streak, totalReviewed, joinDays, focusHours, level, levelTitle })
        return
      }

      const createdAt = db.serverDate()
      const base = {
        xp: 0,
        streak: 0,
        studiedToday: 0,
        lastStudyDate: '',
        totalReviewed: 0,
        createdAt,
        updatedAt: createdAt
      }
      const addRes = await db.collection(flashcardCollections.userStats).add({ data: base })
      this._statsId = addRes && addRes._id ? addRes._id : ''
      this.setData({
        xp: 0,
        streak: 0,
        totalReviewed: 0,
        joinDays: 1,
        focusHours: '0.0',
        level: 1,
        levelTitle: '新手'
      })
    } catch (err) {
      console.error('ensureUserStats failed', err)
      wx.showToast({ title: '加载用户数据失败', icon: 'none' })
    }
  },

  async loadCardCount() {
    try {
      if (!wx.cloud || !wx.cloud.database) return
      const openid = this._openid
      if (!openid) return

      const db = wx.cloud.database()
      const res = await db.collection(flashcardCollections.cards).where({ _openid: openid }).count()
      const cardCount = res && typeof res.total === 'number' ? res.total : 0
      this.setData({ cardCount })
    } catch (err) {
      console.error('loadCardCount failed', err)
    }
  },

  onRequestUserProfile() {
    if (!wx.getUserProfile) {
      wx.showToast({ title: '当前版本不支持获取头像昵称', icon: 'none' })
      return
    }

    wx.getUserProfile({
      desc: '用于展示头像与昵称',
      success: async (res) => {
        const info = res && res.userInfo ? res.userInfo : {}
        const nickName = typeof info.nickName === 'string' ? info.nickName : ''
        const avatarUrl = typeof info.avatarUrl === 'string' ? info.avatarUrl : ''
        this.setData({ userInfo: { nickName, avatarUrl } })
        try {
          wx.setStorageSync && wx.setStorageSync('userInfo', { nickName, avatarUrl })
        } catch (e) {
          // ignore
        }

        // 预埋：给排行榜等功能存昵称/头像
        try {
          const statsId = this._statsId
          if (statsId && wx.cloud && wx.cloud.database) {
            const db = wx.cloud.database()
            await db.collection(flashcardCollections.userStats).doc(statsId).update({
              data: {
                nickname: nickName,
                avatarUrl,
                updatedAt: db.serverDate()
              }
            })
          }
        } catch (e) {
          console.error('update user profile to db failed', e)
        }
      },
      fail: () => {
        wx.showToast({ title: '已取消授权', icon: 'none' })
      }
    })
  },

  onToggleReminder(e) {
    const value = !!(e && e.detail && (e.detail.value ?? e.detail))
    this.setData({ reminderEnabled: value })
    try {
      wx.setStorageSync && wx.setStorageSync('reminderEnabled', value)
    } catch (err) {
      // ignore
    }
  },

  onExportData() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: `知识卡片 · ${this.data.version}`,
      showCancel: false
    })
  }
})
