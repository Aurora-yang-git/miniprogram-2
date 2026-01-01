import { MOCK_DECKS } from '../../utils/mock-data';

Page({
  data: {
    decks: []
  },

  onShow() {
    this.loadDecks();
  },

  loadDecks() {
    // 实际开发中这里调用 API 从云数据库获取
    this.setData({ decks: MOCK_DECKS });
  },

  // 点击进入卡组详情
  onEnterDeck(e) {
    const deckId = e.currentTarget.dataset.id;
    if (!deckId) {
      wx.showToast({ title: '卡组信息缺失', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/library/detail?deckId=${deckId}`,
      fail: (err) => {
        console.error('navigateTo deck detail failed', err)
        wx.showToast({ title: '打开卡组失败', icon: 'none' })
      }
    })
  },

  // 新建卡组
  onCreateDeck() {
    wx.showModal({
      title: '新建卡组',
      editable: true,
      placeholderText: '请输入卡组名称 (如: 考研政治)',
      success: (res) => {
        if (res.confirm && res.content) {
          const newDeck = {
            id: `deck_${Date.now()}`,
            title: res.content,
            count: 0,
            theme: 'blue', // 默认颜色
            icon: 'book',
            lastReview: '刚刚'
          };
          this.setData({
            decks: [newDeck, ...this.data.decks]
          });
          wx.showToast({ title: '创建成功', icon: 'success' });
        }
      }
    });
  }
});
