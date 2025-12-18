Page({
  data: {
    nickname: 'Aurora',
    studyDays: 1,
    avatarText: 'A'
  },

  onLoad() {
    const nickname = this.data.nickname || ''
    this.setData({
      avatarText: nickname ? nickname.slice(0, 1) : ''
    })
  },

  handleEditProfile() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  }
})
