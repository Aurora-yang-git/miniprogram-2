import { flashcardCollections } from '../../utils/flashcard-config'

Page({
  data: {
    queue: [],
    currentIndex: 0,
    currentCard: null,
    reveal: false
  },

  onShow() {
    return this._onShow()
  },

  async _onShow() {
    await this.fetchReviewQueue()
  },

  normalizeCardForReview(card) {
    const answerSections = Array.isArray(card.answerSections) && card.answerSections.length
      ? card.answerSections
      : (typeof card.answer === 'string' && card.answer.trim())
        ? [{ title: '答案', type: 'text', content: card.answer }]
        : []

    const sourceImages = (() => {
      const ids = []
      if (Array.isArray(card.sourceImages)) {
        card.sourceImages.forEach((id) => {
          if (typeof id === 'string' && id.trim()) ids.push(id)
        })
      }
      if (typeof card.sourceImage === 'string' && card.sourceImage.trim()) {
        ids.push(card.sourceImage)
      }
      return Array.from(new Set(ids))
    })()

    return {
      ...card,
      id: card.id || card._id,
      question: typeof card.question === 'string' ? card.question : '',
      answer: typeof card.answer === 'string' ? card.answer : '',
      tags: Array.isArray(card.tags) ? card.tags : [],
      answerSections,
      sourceImages
    }
  },

  async loadCurrentCardImageUrls() {
    const current = this.data.currentCard
    if (!current) return

    const cardId = current.id || current._id
    const sourceImages = Array.isArray(current.sourceImages) ? current.sourceImages : []
    if (!sourceImages.length) return

    const normalized = sourceImages
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => !!id)

    if (!normalized.length) return

    const isCloud = (id) => /^cloud:\/\//.test(id)
    const cloudIds = normalized.filter((id) => isCloud(id))

    let urlMap = {}
    if (cloudIds.length && wx.cloud && wx.cloud.getTempFileURL) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: cloudIds })
        const fileList = res && Array.isArray(res.fileList) ? res.fileList : []
        fileList.forEach((file) => {
          if (!file || !file.fileID || !file.tempFileURL) return
          urlMap[file.fileID] = file.tempFileURL
        })
      } catch (e) {
        console.error('getTempFileURL failed', e)
      }
    }

    const urls = normalized
      .map((id) => (isCloud(id) ? urlMap[id] : id))
      .filter((u) => !!u)

    if (!urls.length) return

    if (this.data.currentCard && (this.data.currentCard.id || this.data.currentCard._id) === cardId) {
      this.setData({
        currentCard: {
          ...this.data.currentCard,
          sourceImageUrls: urls,
          sourceImageUrl: urls[0]
        }
      })
    }
  },

  async fetchReviewQueue() {
    const fallback = () => {
      this.setData({
        queue: [],
        currentIndex: 0,
        currentCard: null,
        reveal: false
      })
    }

    if (!wx.cloud || !wx.cloud.database) {
      fallback()
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
      const res = await db
        .collection(flashcardCollections.cards)
        .where(whereCond)
        .limit(20)
        .get()
      const rawList = Array.isArray(res.data) ? res.data : []
      const due = rawList
        .sort((a, b) => {
          const na = typeof a.nextReviewAt === 'number' ? a.nextReviewAt : 0
          const nb = typeof b.nextReviewAt === 'number' ? b.nextReviewAt : 0
          return na - nb
        })

      const queue = due.map((card) => this.normalizeCardForReview(card))
      this.setData(
        {
          queue,
          currentIndex: 0,
          currentCard: queue[0] || null,
          reveal: false
        },
        () => {
          this.loadCurrentCardImageUrls()
        }
      )
      wx.hideLoading()
    } catch (err) {
      console.error('fetch review queue failed', err)
      wx.hideLoading()
      fallback()
      wx.showToast({ title: '加载复习任务失败', icon: 'none' })
    }
  },

  handleToggleReveal() {
    this.setData({ reveal: !this.data.reveal })
  },

  async handleRemember() {
    await this.submitReview('remember')
  },

  async handleForget() {
    await this.submitReview('forget')
  },

  async submitReview(result) {
    const current = this.data.currentCard
    if (!current || !current.id) return

    if (!wx.cloud || !wx.cloud.callFunction) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitReview',
        data: {
          cardId: current.id,
          result
        }
      })
      const ret = res && res.result ? res.result : null
      if (!ret || ret.ok !== true) {
        throw new Error((ret && ret.error) || '提交失败')
      }

      wx.hideLoading()
      this.nextCard()
    } catch (err) {
      console.error('submit review failed', err)
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  nextCard() {
    const next = this.data.currentIndex + 1
    if (next >= this.data.queue.length) {
      wx.showToast({ title: '今日任务完成', icon: 'none' })
      wx.navigateBack({ delta: 1 })
      return
    }

    this.setData(
      {
        currentIndex: next,
        currentCard: this.data.queue[next] || null,
        reveal: false
      },
      () => {
        this.loadCurrentCardImageUrls()
      }
    )
  }
})
