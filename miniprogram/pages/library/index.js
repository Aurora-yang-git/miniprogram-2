import { uploadImage, analyzeImage } from '../../services/ocr'
import { generateCardsByDeepSeek } from '../../services/ai'
import { setPendingCreateJob, resumePendingCreateJob } from '../../services/pendingCreate'

function getAppUiState() {
  try {
    const app = getApp()
    const gd = app && app.globalData ? app.globalData : {}
    return {
      theme: app && typeof app.getTheme === 'function' ? app.getTheme() : 'light',
      statusBarRpx: typeof gd.statusBarRpx === 'number' ? gd.statusBarRpx : 0,
      safeBottomRpx: typeof gd.safeBottomRpx === 'number' ? gd.safeBottomRpx : 0
    }
  } catch (e) {
    return { theme: 'light', statusBarRpx: 0, safeBottomRpx: 0 }
  }
}

function stepToIndex(step) {
  if (step === 'input') return 1
  if (step === 'generate' || step === 'complete') return 2
  return 0
}

Page({
  data: {
    theme: 'light',
    statusBarRpx: 0,
    safeBottomRpx: 0,

    step: 'mode',
    stepLabels: ['Mode', 'Input', 'Generate'],
    currentStepIndex: 0,

    selectedMode: 'scan',
    modes: [
      { id: 'scan', icon: 'scan', label: 'Scan Photo', desc: 'Take a photo of notes or textbook' },
      { id: 'upload', icon: 'upload', label: 'Upload File', desc: 'PDF, images, or documents' },
      { id: 'text', icon: 'file', label: 'Paste Text', desc: 'Copy and paste your content' }
    ],

    deckTitle: '',
    inputText: '',
    knowledge: '',
    isFeynmanEntry: false,

    pickedImages: [],

    step3Phase: 'idle', // idle | ocr | generate | write | done
    step3Title: '',
    step3Subtitle: '',
    ocrDone: 0,
    ocrTotal: 0,
    writeDone: 0,
    writeTotal: 0
  },

  onLoad() {
    this._isGenerating = false

    const ui = getAppUiState()
    this.setData({
      theme: ui.theme,
      statusBarRpx: ui.statusBarRpx,
      safeBottomRpx: ui.safeBottomRpx
    })
  },

  onShow() {
    const ui = getAppUiState()
    this.setData({ theme: ui.theme, statusBarRpx: ui.statusBarRpx, safeBottomRpx: ui.safeBottomRpx })

    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ selected: 1, theme: ui.theme })

    this.hydrateInitialMode()
    this.resumePendingSaves()
  },

  onUnload() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  },

  hydrateInitialMode() {
    try {
      const mode = wx.getStorageSync && wx.getStorageSync('createMode')
      const entry = wx.getStorageSync && wx.getStorageSync('createEntry')
      if (mode === 'scan' || mode === 'upload' || mode === 'text') {
        this.setData({
          selectedMode: mode,
          step: 'input',
          currentStepIndex: stepToIndex('input'),
          pickedImages: [],
          inputText: '',
          knowledge: '',
          isFeynmanEntry: entry === 'feynman',
          step3Phase: 'idle',
          step3Title: '',
          step3Subtitle: '',
          ocrDone: 0,
          ocrTotal: 0,
          writeDone: 0,
          writeTotal: 0
        })
        wx.setStorageSync && wx.setStorageSync('createMode', '')
        wx.setStorageSync && wx.setStorageSync('createEntry', '')
        return
      }
      if (entry === 'feynman') {
        this.setData({
          step: 'input',
          currentStepIndex: stepToIndex('input'),
          selectedMode: 'text',
          pickedImages: [],
          inputText: '',
          knowledge: '',
          isFeynmanEntry: true,
          step3Phase: 'idle',
          step3Title: '',
          step3Subtitle: '',
          ocrDone: 0,
          ocrTotal: 0,
          writeDone: 0,
          writeTotal: 0
        })
        wx.setStorageSync && wx.setStorageSync('createEntry', '')
      }
    } catch (e) {
      // ignore
    }
  },

  async resumePendingSaves() {
    if (this._isResumingSaves) return
    if (this._isGenerating) return
    this._isResumingSaves = true
    this._isGenerating = true
    try {
      const ret = await resumePendingCreateJob({
        onProgress: ({ done, total }) => {
          this.setData({
            step: 'generate',
            currentStepIndex: stepToIndex('generate'),
            step3Phase: 'write',
            step3Title: 'Saving cards...',
            step3Subtitle: 'Resuming previous save',
            writeDone: done,
            writeTotal: total
          })
        }
      })

      if (!ret || ret.ok !== true) return

      // If it completed successfully, show complete step
      this.setData({
        step: 'complete',
        currentStepIndex: stepToIndex('complete'),
        step3Phase: 'done'
      })
    } catch (e) {
      // keep pending job for next time
      console.error('resumePendingSaves failed', e)
    } finally {
      this._isGenerating = false
      this._isResumingSaves = false
    }
  },

  onSelectMode(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (id !== 'scan' && id !== 'upload' && id !== 'text') return
    this.setData({
      selectedMode: id,
      step: 'input',
      currentStepIndex: stepToIndex('input'),
      pickedImages: [],
      inputText: '',
      isFeynmanEntry: false,
      step3Phase: 'idle',
      step3Title: '',
      step3Subtitle: '',
      ocrDone: 0,
      ocrTotal: 0,
      writeDone: 0,
      writeTotal: 0
    })
  },

  onDeckTitleInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ deckTitle: value })
  },

  onInputText(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ inputText: value })
  },

  onKnowledgeInput(e) {
    const value = e && e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ knowledge: value })
  },

  async onPickImage() {
    const mode = this.data.selectedMode
    if (mode !== 'scan' && mode !== 'upload') return
    if (!wx.chooseImage) {
      wx.showToast({ title: '当前版本不支持选择图片', icon: 'none' })
      return
    }

    try {
      const current = Array.isArray(this.data.pickedImages) ? this.data.pickedImages : []
      const remaining = 9 - current.length
      if (remaining <= 0) {
        wx.showToast({ title: '最多选择 9 张图片', icon: 'none' })
        return
      }

      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: remaining,
          sizeType: ['compressed'],
          sourceType: mode === 'scan' ? ['camera', 'album'] : ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const paths = res && Array.isArray(res.tempFilePaths) ? res.tempFilePaths.filter(Boolean) : []
      if (!paths.length) return

      const merged = current.concat(paths).filter(Boolean)
      const unique = Array.from(new Set(merged)).slice(0, 9)
      this.setData({ pickedImages: unique })
    } catch (e) {
      console.error('pick image failed', e)
      wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
  },

  onClearImages() {
    this.setData({ pickedImages: [] })
  },

  async runOcrOnImages(paths) {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : []
    if (!list.length) throw new Error('no images')

    const texts = []
    for (let i = 0; i < list.length; i += 1) {
      const path = list[i]
      try {
        // eslint-disable-next-line no-await-in-loop
        const fileID = await uploadImage(path)
        // eslint-disable-next-line no-await-in-loop
        const ret = await analyzeImage(fileID)
        const text = ret && typeof ret.text === 'string' ? ret.text.trim() : ''
        if (text) texts.push(text)
      } catch (e) {
        console.error('ocr single image failed', e)
      } finally {
        this.setData({ ocrDone: i + 1 })
      }
    }

    const sourceText = texts.join('\n\n')
    if (!sourceText.trim()) throw new Error('empty ocr text')
    return sourceText
  },

  async onGenerate() {
    const title = String(this.data.deckTitle || '').trim()
    if (!title) return
    if (this._isGenerating) return

    let sourceText = ''
    let pendingJobSet = false
    if (this.data.selectedMode === 'text') {
      sourceText = String(this.data.inputText || '').trim()
      if (!sourceText) {
        wx.showToast({ title: '请先粘贴/输入内容', icon: 'none' })
        return
      }
    } else {
      const images = Array.isArray(this.data.pickedImages) ? this.data.pickedImages : []
      if (!images.length) {
        wx.showToast({ title: '请先选择图片', icon: 'none' })
        return
      }
    }

    this._isGenerating = true
    try {
      const ocrTotal = this.data.selectedMode === 'text'
        ? 0
        : (Array.isArray(this.data.pickedImages) ? this.data.pickedImages.length : 0)

          this.setData({
        step: 'generate',
        currentStepIndex: stepToIndex('generate'),
        step3Phase: this.data.selectedMode === 'text' ? 'generate' : 'ocr',
        step3Title: this.data.selectedMode === 'text' ? 'Generating cards...' : 'Extracting text...',
        step3Subtitle: this.data.selectedMode === 'text'
          ? 'AI is analyzing your content and creating knowledge cards'
          : 'Uploading images and running OCR',
        ocrDone: 0,
        ocrTotal,
        writeDone: 0,
        writeTotal: 0
      })

      if (this.data.selectedMode !== 'text') {
        sourceText = await this.runOcrOnImages(this.data.pickedImages)
      }

      this.setData({
        step3Phase: 'generate',
        step3Title: 'Generating cards...',
        step3Subtitle: 'AI is creating knowledge cards from your content'
      })

      const knowledge = String(this.data.knowledge || '').trim()
      const cards = await generateCardsByDeepSeek({ rawText: sourceText, knowledge, learningStyle: '无' })
      const total = Array.isArray(cards) ? cards.length : 0

      this.setData({
        step3Phase: 'write',
        step3Title: 'Saving cards...',
        step3Subtitle: 'Writing generated cards to database',
        writeDone: 0,
        writeTotal: total
      })

      const toSave = (Array.isArray(cards) ? cards : []).map((c) => {
        const hint = c && typeof c.hint === 'string' ? c.hint.trim() : ''
        const answer = hint ? `${c.answer}\n\nHint: ${hint}` : c.answer
        return { question: c.question, answer, tags: c.tags }
      })

      // Persist before writing so it can be resumed after app background/exit.
      setPendingCreateJob({ deckTitle: title, cards: toSave })
      pendingJobSet = true
      await resumePendingCreateJob({
        onProgress: ({ done }) => {
          this.setData({ writeDone: done })
        }
      })

      wx.showToast({ title: `已生成并保存 ${total} 张卡片`, icon: 'success' })
      this.setData({
        step3Phase: 'done',
        step: 'complete',
        currentStepIndex: stepToIndex('complete')
      })
    } catch (e) {
      console.error('generate/write cards failed', e)
      wx.showToast({ title: pendingJobSet ? '保存中断，下次打开会自动继续' : '生成失败，请重试', icon: 'none' })
      this.setData({
        step3Phase: 'idle',
        step3Title: '',
        step3Subtitle: '',
        step: 'input',
        currentStepIndex: stepToIndex('input')
      })
    } finally {
      this._isGenerating = false
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onToggleTheme() {
    const app = getApp()
    const next = app && typeof app.toggleTheme === 'function'
      ? app.toggleTheme()
      : (this.data.theme === 'dark' ? 'light' : 'dark')
    this.setData({ theme: next })
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar && tabBar.setData) tabBar.setData({ theme: next })
  }
})
