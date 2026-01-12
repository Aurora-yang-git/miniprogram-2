import { flashcardCollections } from '../../utils/flashcard-config'
import { createJob } from '../../services/createJobs'

Page({
  data: {
    mode: 'manual',
    question: '',
    answer: '',
    images: [],
    activeImageIndex: 0
  },

  onLoad() {

  },

  onPickImage() {
    const current = Array.isArray(this.data.images) ? this.data.images : []
    const remaining = 9 - current.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多选择9张图片', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res && Array.isArray(res.tempFilePaths) ? res.tempFilePaths.filter(Boolean) : []
        if (!paths.length) return
        const currentNow = Array.isArray(this.data.images) ? this.data.images : []
        const allowed = Math.max(0, 9 - currentNow.length)
        const picked = allowed ? paths.slice(0, allowed) : []
        if (!picked.length) return
        const next = currentNow.concat(picked.map((p) => ({ localPath: p, fileID: '', selected: true })))
        this.setData({ images: next, activeImageIndex: Math.max(0, next.length - 1) })
      },
      fail: (err) => {
        console.error('choose image failed', err)
      }
    })
  },

  onRemoveImage() {
    this.setData({ images: [], activeImageIndex: 0 })
  },

  normalizeOcrText(rawText) {
    let text = String(rawText || '')
    text = text.replace(/\r\n/g, '\n').trim()
    if (text.startsWith('```')) {
      const firstLf = text.indexOf('\n')
      text = firstLf >= 0 ? text.slice(firstLf + 1) : ''
    }
    text = text.trim()
    if (text.endsWith('```')) {
      text = text.slice(0, -3)
    }
    text = text.replace(/```/g, '')
    text = text.replace(/\n{3,}/g, '\n\n').trim()
    return text
  },

  onSetActiveImage(event) {
    const idx = Number(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.index)
    const images = Array.isArray(this.data.images) ? this.data.images : []
    if (!Number.isFinite(idx) || idx < 0 || idx >= images.length) return

    const item = images[idx] || null
    if (item && item.selected === false) {
      const next = images.slice()
      next[idx] = { ...item, selected: true }
      this.setData({ images: next, activeImageIndex: idx })
      return
    }
    this.setData({ activeImageIndex: idx })
  },

  onToggleImageSelected(event) {
    const idx = Number(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.index)
    const images = Array.isArray(this.data.images) ? this.data.images : []
    if (!Number.isFinite(idx) || idx < 0 || idx >= images.length) return
    const item = images[idx] || {}
    const currentSelected = item.selected === false ? false : true
    const nextSelected = !currentSelected
    const next = images.slice()
    next[idx] = { ...item, selected: nextSelected }

    let nextActive = typeof this.data.activeImageIndex === 'number' ? this.data.activeImageIndex : 0
    if (!nextSelected && idx === nextActive) {
      const fallback = next.findIndex((it) => it && it.selected !== false)
      if (fallback >= 0) nextActive = fallback
    }
    this.setData({ images: next, activeImageIndex: nextActive })
  },

  onRemoveImageItem(event) {
    const idx = Number(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.index)
    const images = Array.isArray(this.data.images) ? this.data.images : []
    if (!Number.isFinite(idx) || idx < 0 || idx >= images.length) return
    const nextImages = images.filter((_, i) => i !== idx)
    let nextActive = typeof this.data.activeImageIndex === 'number' ? this.data.activeImageIndex : 0
    if (idx === nextActive) nextActive = Math.max(0, nextActive - 1)
    if (idx < nextActive) nextActive = nextActive - 1
    if (!nextImages.length) nextActive = 0
    this.setData({ images: nextImages, activeImageIndex: nextActive })
  },

  async ensureActiveImageUploaded() {
    const images = Array.isArray(this.data.images) ? this.data.images : []
    const idx = typeof this.data.activeImageIndex === 'number' ? this.data.activeImageIndex : 0
    const item = images[idx] || null
    if (!item) return ''
    if (item.selected === false) return ''
    if (item.fileID) return item.fileID
    if (!item.localPath) return ''
    const fileID = await this.uploadImage(item.localPath)
    const next = images.slice()
    next[idx] = { ...item, fileID }
    this.setData({ images: next })
    return fileID
  },

  async ensureSelectedImagesUploaded() {
    const images = Array.isArray(this.data.images) ? this.data.images : []
    if (!images.length) return []
    const next = images.slice()
    let changed = false
    for (let i = 0; i < next.length; i += 1) {
      const item = next[i] || {}
      if (item.selected === false) continue
      if (item.fileID || !item.localPath) continue
      const fileID = await this.uploadImage(item.localPath)
      next[i] = { ...item, fileID }
      changed = true
    }
    if (changed) {
      this.setData({ images: next })
    }
    return next
      .filter((it) => it && it.selected !== false)
      .map((it) => (it && typeof it.fileID === 'string' ? it.fileID : ''))
      .filter((id) => !!id)
  },

  async onGenerateByAI() {
    if (!wx.cloud || !wx.cloud.callFunction || !wx.cloud.uploadFile || !wx.cloud.database) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    try {
      const images = Array.isArray(this.data.images) ? this.data.images : []
      const selectedCount = images.filter((it) => it && it.selected !== false).length
      if (!selectedCount) {
        const hasAny = images.length
        wx.showToast({ title: hasAny ? '请先选中图片' : '请先选择图片', icon: 'none' })
        return
      }

      const proceed = await new Promise((resolve) => {
        wx.showModal({
          title: '批量生成卡片',
          content: `将上传 ${selectedCount} 张图片并在云端后台生成卡片（可退出小程序），是否继续？`,
          confirmText: '继续',
          cancelText: '取消',
          success: (res) => resolve(!!(res && res.confirm)),
          fail: () => resolve(false)
        })
      })
      if (!proceed) {
        wx.showToast({ title: '已取消', icon: 'none' })
        return
      }

      wx.showLoading({ title: '上传中' })
      const sourceImages = await this.ensureSelectedImagesUploaded()
      if (!sourceImages.length) {
        wx.hideLoading()
        wx.showToast({ title: '请先选中图片', icon: 'none' })
        return
      }

      wx.showLoading({ title: '提交中' })

      const jobId = await createJob({
        deckTitle: 'Inbox',
        mode: 'images',
        imageFileIDs: sourceImages,
        rawText: '',
        knowledge: ''
      })

      wx.hideLoading()
      wx.showModal({
        title: '已提交云端生成',
        content: '任务已提交到云端后台生成，你可以退出小程序。稍后在 Create 页查看进度与结果。',
        confirmText: '去查看',
        cancelText: '留在此页',
        success: (res) => {
          if (res && res.confirm) {
            wx.switchTab({ url: '/pages/library/index' })
          }
        }
      })
    } catch (err) {
      console.error('generate by ai failed', err)
      wx.hideLoading()
      const msg = err && err.message ? String(err.message) : '生成失败'
      wx.showToast({ title: msg.length > 18 ? msg.slice(0, 18) + '…' : msg, icon: 'none' })
    }
  },

  async onAnalyzeImage() {
    if (!wx.cloud || !wx.cloud.callFunction) {
      wx.showToast({ title: '云能力不可用', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '识别中' })

      const sourceImage = await this.ensureActiveImageUploaded()
      if (!sourceImage) {
        wx.hideLoading()
        const hasAny = Array.isArray(this.data.images) && this.data.images.length
        wx.showToast({ title: hasAny ? '请先选中图片' : '请先选择图片', icon: 'none' })
        return
      }

      const res = await wx.cloud.callFunction({
        name: 'analyzeImage',
        data: { fileID: sourceImage }
      })
      const result = res && res.result ? res.result : null
      if (!result || result.ok !== true) {
        const baseMsg = (result && result.error) || '识别失败'
        const extra = []
        if (result && result.codeVersion) extra.push(`codeVersion=${result.codeVersion}`)
        if (result && result.imageSource) extra.push(`imageSource=${result.imageSource}`)
        if (result && typeof result.usedFallback === 'boolean') {
          extra.push(`usedFallback=${result.usedFallback}`)
        }
        throw new Error(extra.length ? `${baseMsg} (${extra.join(', ')})` : baseMsg)
      }

      const text = this.normalizeOcrText(result && result.text)
      if (!text) {
        wx.hideLoading()
        wx.showToast({ title: '未识别到文字', icon: 'none' })
        return
      }

      const currentAnswer = (this.data.answer || '').trim()
      const nextAnswer = currentAnswer ? `${currentAnswer}\n\n${text}` : text
      this.setData({ answer: nextAnswer })

      wx.hideLoading()
      wx.showToast({ title: '已回填', icon: 'success' })
    } catch (err) {
      console.error('analyze image failed', err)
      wx.hideLoading()
      const msg = err && err.message ? String(err.message) : '识别失败'
      wx.showToast({ title: msg.length > 18 ? msg.slice(0, 18) + '…' : msg, icon: 'none' })
    }
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

  async saveCard(continueEditing) {
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

      const sourceImages = await this.ensureSelectedImagesUploaded()

      const data = {
        question,
        answer,
        answerSections: [{ type: 'text', title: '答案', content: answer }],
        tags: [],
        isPublic: false,
        srsEF: 2.5,
        srsInterval: 0,
        srsReps: 0,
        lastReviewedAt: 0,
        nextReviewAt: 0,
        createdAt,
        updatedAt: createdAt
      }
      if (sourceImages && sourceImages.length) {
        data.sourceImages = sourceImages
        data.sourceImage = sourceImages[0]
      }
      await db.collection(flashcardCollections.cards).add({
        data
      })

      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      if (continueEditing) {
        this.setData({ question: '', answer: '' })
      } else {
        wx.navigateBack({ delta: 1 })
      }
    } catch (err) {
      console.error('save card failed', err)
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async handleSave() {
    await this.saveCard(false)
  },

  async handleSaveContinue() {
    await this.saveCard(true)
  }
})
