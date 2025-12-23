import { flashcardCollections } from '../../utils/flashcard-config'

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

  async generateQuestionByDeepSeek(sourceText) {
    if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI || !wx.cloud.extend.AI.createModel) {
      throw new Error('AI能力不可用')
    }

    const model = wx.cloud.extend.AI.createModel('deepseek')
    const systemPrompt = '你是学习卡片助手。请根据用户提供的内容，生成一个用于记忆卡片的“问题”。要求：问题必须能从内容中直接回答；尽量简短具体；只输出问题本身，不要解释，不要多条。'
    const userInput = String(sourceText || '').trim()
    if (!userInput) {
      throw new Error('内容为空')
    }

    const res = await model.streamText({
      data: {
        model: 'deepseek-r1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ]
      }
    })

    if (!res || !res.textStream || typeof res.textStream[Symbol.asyncIterator] !== 'function') {
      throw new Error('AI返回格式异常')
    }

    let out = ''
    for await (let str of res.textStream) {
      out += str
    }
    let question = String(out || '').trim()
    const firstLine = question
      .split('\n')
      .map((line) => String(line || '').trim())
      .find((line) => !!line) || ''
    question = firstLine
      .replace(/^([Qq]|问题)\s*[:：]\s*/, '')
      .replace(/^\d+[.、]\s*/, '')
      .replace(/^[\-*]\s*/, '')
      .replace(/^["'“”]+/, '')
      .replace(/["'“”]+$/, '')
      .trim()

    if (!question) {
      throw new Error('生成结果为空')
    }
    return question
  },

  parseCardsFromDeepSeekOutput(rawText) {
    const raw = String(rawText || '').trim()
    const noFence = raw.replace(/```[a-zA-Z]*\n?/g, '').trim()

    let jsonText = noFence
    const firstArr = noFence.indexOf('[')
    const lastArr = noFence.lastIndexOf(']')
    if (firstArr >= 0 && lastArr > firstArr) {
      jsonText = noFence.slice(firstArr, lastArr + 1)
    } else {
      const firstObj = noFence.indexOf('{')
      const lastObj = noFence.lastIndexOf('}')
      if (firstObj >= 0 && lastObj > firstObj) {
        jsonText = noFence.slice(firstObj, lastObj + 1)
      }
    }

    let parsed = null
    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      parsed = null
    }

    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.cards) ? parsed.cards : [])

    return arr
      .map((it) => {
        const qRaw = it && (it.question ?? it.q)
        const aRaw = it && (it.answer ?? it.a)
        const question = qRaw == null ? '' : String(qRaw).trim()
        const answer = Array.isArray(aRaw)
          ? aRaw.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).join('\n')
          : (aRaw == null ? '' : String(aRaw).trim())
        const tagsRaw = it && (it.tags ?? it.tagList)
        const tags = Array.isArray(tagsRaw)
          ? tagsRaw.map((t) => String(t == null ? '' : t).trim()).filter(Boolean)
          : []
        return {
          question,
          answer,
          tags
        }
      })
      .filter((it) => it.question && it.answer)
  },

  async generateCardsByDeepSeek(sourceText) {
    if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI || !wx.cloud.extend.AI.createModel) {
      throw new Error('AI能力不可用')
    }

    const model = wx.cloud.extend.AI.createModel('deepseek')
    const systemPrompt = '你是学习卡片助手。请根据用户提供的材料生成多张用于记忆的卡片。输出要求：只输出严格的 JSON 数组，不要任何解释或额外文字；数组每一项必须包含 question 与 answer 字段（字符串）；可选包含 tags 字段（字符串数组，0-5个）；question 要简短具体、可直接从材料中回答；answer 给出对应要点（可分点）；卡片数量由你根据材料复杂度决定，建议 3-12 张，最多 20 张。'
    const userInput = String(sourceText || '').trim()
    if (!userInput) {
      throw new Error('内容为空')
    }

    const res = await model.streamText({
      data: {
        model: 'deepseek-r1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ]
      }
    })

    if (!res || !res.textStream || typeof res.textStream[Symbol.asyncIterator] !== 'function') {
      throw new Error('AI返回格式异常')
    }

    let out = ''
    for await (let str of res.textStream) {
      out += str
    }

    const cards = this.parseCardsFromDeepSeekOutput(out)
    if (!cards.length) {
      throw new Error('未生成到卡片')
    }
    return cards
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
    if (!wx.cloud || !wx.cloud.callFunction) {
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
          content: `将识别 ${selectedCount} 张图片并生成多张卡片，可能需要较长时间，是否继续？`,
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

      const blocks = []
      for (let i = 0; i < sourceImages.length; i += 1) {
        wx.showLoading({ title: `识别中 ${i + 1}/${sourceImages.length}` })
        const fileID = sourceImages[i]
        const ocrRes = await wx.cloud.callFunction({
          name: 'analyzeImage',
          data: { fileID }
        })
        const ocrResult = ocrRes && ocrRes.result ? ocrRes.result : null
        if (!ocrResult || ocrResult.ok !== true) {
          const baseMsg = (ocrResult && ocrResult.error) || '识别失败'
          const extra = []
          if (ocrResult && ocrResult.codeVersion) extra.push(`codeVersion=${ocrResult.codeVersion}`)
          if (ocrResult && ocrResult.imageSource) extra.push(`imageSource=${ocrResult.imageSource}`)
          if (ocrResult && typeof ocrResult.usedFallback === 'boolean') {
            extra.push(`usedFallback=${ocrResult.usedFallback}`)
          }
          throw new Error(extra.length ? `${baseMsg} (${extra.join(', ')})` : baseMsg)
        }
        const text = this.normalizeOcrText(ocrResult && ocrResult.text)
        if (text) {
          blocks.push(`【图片${i + 1}】\n${text}`)
        }
      }

      const mergedText = blocks.join('\n\n')
      if (!mergedText) {
        wx.hideLoading()
        wx.showToast({ title: '未识别到文字', icon: 'none' })
        return
      }

      wx.showLoading({ title: '生成卡片中' })
      const cards = await this.generateCardsByDeepSeek(mergedText)

      if (!wx.cloud || !wx.cloud.database) {
        throw new Error('云数据库不可用')
      }

      const db = wx.cloud.database()
      const createdAt = db.serverDate()
      for (let i = 0; i < cards.length; i += 1) {
        wx.showLoading({ title: `保存中 ${i + 1}/${cards.length}` })
        const item = cards[i] || {}
        const question = (item.question || '').trim()
        const answer = (item.answer || '').trim()
        if (!question || !answer) continue

        const data = {
          question,
          answer,
          answerSections: [{ type: 'text', title: '答案', content: answer }],
          tags: Array.isArray(item.tags) ? item.tags : [],
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
        await db.collection(flashcardCollections.cards).add({ data })
      }

      wx.hideLoading()
      const goBack = await new Promise((resolve) => {
        wx.showModal({
          title: '生成完成',
          content: `已生成 ${cards.length} 张卡片`,
          confirmText: '返回卡包',
          cancelText: '继续编辑',
          success: (res) => resolve(!!(res && res.confirm)),
          fail: () => resolve(true)
        })
      })

      if (goBack) {
        wx.navigateBack({ delta: 1 })
      } else {
        this.setData({ question: '', answer: '' })
      }
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
