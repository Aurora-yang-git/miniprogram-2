import { flashcardCollections } from '../../utils/flashcard-config'

Page({
  data: {
    mode: 'manual',
    question: '',
    answer: '',
    imagePath: '',
    sourceImage: ''
  },

  onLoad() {

  },

  onPickImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res && res.tempFilePaths && res.tempFilePaths[0]
        if (!filePath) return
        this.setData({ imagePath: filePath, sourceImage: '' })
      },
      fail: (err) => {
        console.error('choose image failed', err)
      }
    })
  },

  onRemoveImage() {
    this.setData({ imagePath: '', sourceImage: '' })
  },

  uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud || !wx.cloud.uploadFile) {
        reject(new Error('cloud uploadFile unavailable'))
        return
      }

      const extMatch = /(\.[^./\\]+)$/.exec(filePath)
      const ext = extMatch ? extMatch[1] : '.jpg'
      const rand = Math.random().toString(16).slice(2)
      const cloudPath = `cards/${Date.now()}-${rand}${ext}`

      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      })
    })
  },

  onQuestionChange(event) {
    const { value } = event.detail
    this.setData({ question: value })
  },

  onAnswerChange(event) {
    const { value } = event.detail
    this.setData({ answer: value })
  },

  async handleSave() {
    const question = (this.data.question || '').trim()
    const answer = (this.data.answer || '').trim()

    if (!question) {
      wx.showToast({ title: '请输入问题', icon: 'none' })
      return
    }
    if (!answer) {
      wx.showToast({ title: '请输入答案', icon: 'none' })
      return
    }
    if (!wx.cloud || !wx.cloud.database) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中' })
    try {
      const db = wx.cloud.database()
      const createdAt = db.serverDate()

      let sourceImage = this.data.sourceImage
      if (this.data.imagePath && !sourceImage) {
        sourceImage = await this.uploadImage(this.data.imagePath)
        this.setData({ sourceImage })
      }

      const data = {
        question,
        answer,
        tags: [],
        isPublic: false,
        createdAt,
        updatedAt: createdAt
      }
      if (sourceImage) {
        data.sourceImage = sourceImage
      }
      await db.collection(flashcardCollections.cards).add({
        data
      })

      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      wx.navigateBack({ delta: 1 })
    } catch (err) {
      console.error('save card failed', err)
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
