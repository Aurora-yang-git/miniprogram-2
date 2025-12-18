import { MOCK_CARDS } from '../../utils/mock-data'

Page({
  data: {
    queue: [],
    currentIndex: 0,
    currentCard: null,
    reveal: false
  },

  onLoad() {
    const queue = MOCK_CARDS.filter(card => card.status === 1 || card.status === 0)
    this.setData({
      queue,
      currentIndex: 0,
      currentCard: queue[0] || null,
      reveal: false
    })
  },

  handleToggleReveal() {
    this.setData({ reveal: !this.data.reveal })
  },

  handleRemember() {
    this.nextCard('remember')
  },

  handleForget() {
    this.nextCard('forget')
  },

  nextCard() {
    const next = this.data.currentIndex + 1
    if (next >= this.data.queue.length) {
      wx.showToast({ title: '今日任务完成', icon: 'none' })
      wx.navigateBack({ delta: 1 })
      return
    }

    this.setData({
      currentIndex: next,
      currentCard: this.data.queue[next] || null,
      reveal: false
    })
  }
})
