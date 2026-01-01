import { MOCK_CARDS, MOCK_DECKS } from '../../utils/mock-data';

Page({
  data: {
    deckId: '',
    deckTitle: '',
    cards: [],
    displayCards: [],
    keyword: '',
    currentCard: null,
    detailVisible: false
  },

  onLoad(options) {
    const deckId = options && options.deckId ? options.deckId : ''
    const deck = MOCK_DECKS.find(d => d.id === deckId) || { title: '我的卡包' };
    
    // 模拟从该卡组加载卡片
    // 实际开发中，这里会根据 deckId 从云数据库查询
    this.setData({
      deckId,
      deckTitle: deck.title,
      cards: MOCK_CARDS, // 暂时展示所有 Mock 卡片
      displayCards: MOCK_CARDS
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onSearchChange(e) {
    const keyword = e.detail.value.toLowerCase();
    const filtered = this.data.cards.filter(c => 
      c.question.toLowerCase().includes(keyword) || 
      (c.tags && c.tags.some(t => t.toLowerCase().includes(keyword)))
    );
    this.setData({ keyword, displayCards: filtered });
  },

  onCardTap(e) {
    const { id } = e.currentTarget.dataset;
    const card = this.data.cards.find(c => c.id === id);
    if (card) {
      this.setData({
        currentCard: card,
        detailVisible: true
      });
    }
  },

  onPopupClose(e) {
    this.setData({ detailVisible: e.detail.visible });
  },

  onMemoryAction(e) {
    const { level } = e.currentTarget.dataset;
    wx.showToast({
      title: level === 'remember' ? '记得 +1' : '要加油哦',
      icon: 'none'
    });
    this.setData({ detailVisible: false });
  },

  onAddCard() {
    wx.navigateTo({
      url: '/pages/editor/index',
      fail: (err) => {
        console.error('navigateTo editor failed', err)
        wx.showToast({ title: '打开编辑页失败', icon: 'none' })
      }
    })
  }
});

