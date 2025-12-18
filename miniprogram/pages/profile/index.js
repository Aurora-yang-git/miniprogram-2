import { flashcardCollections } from '../../utils/flashcard-config'

Page({
  data: {
    nickname: 'Aurora',
    studyDays: 1,
    xp: 0,
    streak: 0,
    avatarText: 'A'
  },

  onLoad() {
    return this._onLoad()
  },

  async _onLoad() {
    const nickname = this.data.nickname || ''
    this.setData({
      avatarText: nickname ? nickname.slice(0, 1) : ''
    })

    await this.ensureUserStats()
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

      const db = wx.cloud.database()
      const queryRes = await db.collection(flashcardCollections.userStats).where({ _openid: openid }).limit(1).get()
      const current = (queryRes && Array.isArray(queryRes.data) && queryRes.data[0]) ? queryRes.data[0] : null

      if (current) {
        const xp = typeof current.xp === 'number' ? current.xp : 0
        const streak = typeof current.streak === 'number' ? current.streak : 0
        this.setData({ xp, streak, studyDays: streak })
        return
      }

      const createdAt = db.serverDate()
      const base = {
        xp: 0,
        streak: 0,
        createdAt,
        updatedAt: createdAt
      }
      await db.collection(flashcardCollections.userStats).add({ data: base })
      this.setData({ xp: 0, streak: 0, studyDays: 0 })
    } catch (err) {
      console.error('ensureUserStats failed', err)
      wx.showToast({ title: '加载用户数据失败', icon: 'none' })
    }
  },

  handleEditProfile() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  }
})
