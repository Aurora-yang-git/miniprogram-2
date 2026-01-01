import { flashcardCollections } from '../../utils/flashcard-config'

function beijingDateString(ts) {
  const offset = 8 * 60 * 60 * 1000
  return new Date(ts + offset).toISOString().slice(0, 10)
}

Page({
  data: {
    studiedToday: 0,
    dailyGoal: 20,
    progressPercent: 0,
    streakDays: 0,
    pendingReviewCount: 0,
    totalCards: 0,
    todayXp: 0,
    rankTop: [],
    myRank: 0,
    currentMood: 'happy',
    reviewProgress: 0,
    myStats: {
      streakDays: 0,
      todayScore: 0
    },
    reviewCount: 0
  },

  onShow() {
    this.loadDashboard()
  },

  async getOpenid() {
    if (this._openid) return this._openid
    if (!wx.cloud || !wx.cloud.callFunction) {
      throw new Error('cloud callFunction unavailable')
    }

    const loginRes = await wx.cloud.callFunction({ name: 'login' })
    const openid = loginRes && loginRes.result && loginRes.result.openid
    if (!openid) {
      throw new Error('login no openid')
    }

    this._openid = openid
    return openid
  },

  async ensureUserStats(openid) {
    const db = wx.cloud.database()
    const res = await db.collection(flashcardCollections.userStats).where({ _openid: openid }).limit(1).get()
    const current = (res && Array.isArray(res.data) && res.data[0]) ? res.data[0] : null
    if (current) return current

    const createdAt = db.serverDate()
    const base = {
      xp: 0,
      streak: 0,
      studiedToday: 0,
      lastStudyDate: '',
      createdAt,
      updatedAt: createdAt
    }
    await db.collection(flashcardCollections.userStats).add({ data: base })
    return base
  },

  async loadDashboard() {
    if (!wx.cloud || !wx.cloud.database) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    wx.showLoading({ title: '加载中' })
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const now = Date.now()
      const canExists = _ && typeof _.exists === 'function'
      const whereCond = canExists
        ? _.or([
          { nextReviewAt: _.lte(now) },
          { nextReviewAt: _.exists(false) }
        ])
        : { nextReviewAt: _.lte(now) }
      const countRes = await db
        .collection(flashcardCollections.cards)
        .where(whereCond)
        .count()
      const pendingReviewCount = countRes && typeof countRes.total === 'number' ? countRes.total : 0

      const totalRes = await db.collection(flashcardCollections.cards).count()
      const totalCards = totalRes && typeof totalRes.total === 'number' ? totalRes.total : 0

      const openid = await this.getOpenid()
      const stats = await this.ensureUserStats(openid)

      const today = beijingDateString(now)
      const lastStudyDate = stats && typeof stats.lastStudyDate === 'string' ? stats.lastStudyDate : ''
      const streakDays = stats && typeof stats.streak === 'number' ? stats.streak : 0
      const studiedToday = lastStudyDate === today
        ? (stats && typeof stats.studiedToday === 'number' ? stats.studiedToday : 0)
        : 0
      const todayXp = lastStudyDate === today
        ? (stats && typeof stats.dailyXp === 'number' ? stats.dailyXp : 0)
        : 0

      const dailyGoal = this.data.dailyGoal
      const progressPercent = dailyGoal
        ? Math.min(100, Math.round((studiedToday / dailyGoal) * 100))
        : 0

      this.setData({
        pendingReviewCount,
        reviewCount: pendingReviewCount,
        totalCards,
        studiedToday,
        todayXp,
        progressPercent,
        streakDays,
        reviewProgress: totalCards ? Math.min(100, Math.round((pendingReviewCount / totalCards) * 100)) : 0,
        myStats: {
          streakDays,
          todayScore: todayXp
        }
      })

      this.loadRank()
      wx.hideLoading()
    } catch (err) {
      console.error('load dashboard failed', err)
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  handleStartReview() {
    wx.navigateTo({ url: '/pages/review/index' })
  },

  onStartReview() {
    this.handleStartReview()
  },

  setMood(e) {
    const m = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.m
    if (!m) return
    this.setData({ currentMood: m })
  },

  async loadRank() {
    if (!wx.cloud || !wx.cloud.callFunction) return
    try {
      const res = await wx.cloud.callFunction({ name: 'getGlobalRank' })
      const ret = res && res.result ? res.result : null
      if (!ret || ret.ok !== true) return
      const top = Array.isArray(ret.top) ? ret.top : []
      const withInitial = top.map((u) => {
        const nickname = u && typeof u.nickname === 'string' ? u.nickname : ''
        const initial = nickname ? nickname.slice(0, 1) : 'U'
        return { ...u, initial }
      })
      const me = ret.me || null
      this.setData({
        rankTop: withInitial.slice(0, 50),
        myRank: me && typeof me.rank === 'number' ? me.rank : 0
      })
    } catch (e) {
      console.error('loadRank failed', e)
    }
  }

})
