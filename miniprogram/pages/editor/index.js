Page({
  data: {
    mode: 'manual',
    question: '',
    answer: ''
  },

  onLoad() {

  },

  onQuestionChange(event) {
    const { value } = event.detail
    this.setData({ question: value })
  },

  onAnswerChange(event) {
    const { value } = event.detail
    this.setData({ answer: value })
  },

  handleSave() {
    wx.showToast({ title: '已保存（模拟）', icon: 'none' })
    wx.navigateBack({ delta: 1 })
  }
})
