import { MOCK_CARDS } from '../../utils/mock-data'

Page({
  data: {
    studiedToday: 0,
    dailyGoal: 20,
    progressPercent: 0,
    streakDays: 1,
    pendingReviewCount: 0
  },

  onLoad() {
    this.loadCards()
  },

  loadCards() {
    const list = MOCK_CARDS
    const pendingReview = list.filter(card => card.status === 1).length
    const studiedToday = list.filter(card => card.status === 2).length
    const dailyGoal = this.data.dailyGoal

    this.setData({
      pendingReviewCount: pendingReview,
      studiedToday,
      progressPercent: dailyGoal ? Math.min(100, Math.round((studiedToday / dailyGoal) * 100)) : 0
    })
  },

  handleStartReview() {
    wx.navigateTo({ url: '/pages/review/index' })
  },

})
