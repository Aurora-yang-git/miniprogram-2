import { uploadImage } from '../../services/ocr'
import { createJob, listMyJobs, getJob, startJob } from '../../services/createJobs'
import { formatRelativeTime } from '../../services/time'

const JOBS_CACHE_KEY = 'create_jobs_cache_v1'
const JOBS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function toMs(val) {
  if (!val) return 0
  if (typeof val === 'number') return val
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'string') {
    const t = Date.parse(val)
    return Number.isFinite(t) ? t : 0
  }
  if (typeof val === 'object' && val.$date) {
    const t = Date.parse(val.$date)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function readJobsCache() {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(JOBS_CACHE_KEY)
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (!obj || typeof obj !== 'object') return null
    const ts = typeof obj.ts === 'number' ? obj.ts : 0
    if (!ts || Date.now() - ts > JOBS_CACHE_TTL_MS) return null
    const jobs = Array.isArray(obj.jobs) ? obj.jobs : []
    return { ts, jobs }
  } catch (e) {
    return null
  }
}

function writeJobsCache(payload) {
  try {
    wx.setStorageSync && wx.setStorageSync(JOBS_CACHE_KEY, payload)
  } catch (e) {
    // ignore
  }
}

function statusText(status) {
  if (status === 'done') return 'Done'
  if (status === 'failed') return 'Failed'
  if (status === 'running') return 'Running'
  return 'Queued'
}

function normalizeJobForUi(job) {
  const createdAt = toMs(job && job.createdAt)
  const updatedAt = toMs(job && job.updatedAt)
  const now = Date.now()
  return {
    ...job,
    createdAtMs: createdAt,
    updatedAtMs: updatedAt,
    createdText: createdAt ? formatRelativeTime(createdAt, now) : '',
    updatedText: updatedAt ? formatRelativeTime(updatedAt, now) : '',
    statusLabel: statusText(job && job.status)
  }
}

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
    uploadDone: 0,
    uploadTotal: 0,
    ocrDone: 0,
    ocrTotal: 0,
    writeDone: 0,
    writeTotal: 0,

    currentJobId: '',
    currentJob: null,

    isLoadingJobs: false,
    jobs: [],
    hasJobsCache: false
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
    this.hydrateJobsCache()
    this.loadJobs({ silent: this.data.hasJobsCache })
  },

  onUnload() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this.stopJobPolling()
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

  hydrateJobsCache() {
    const cached = readJobsCache()
    if (!cached) {
      this.setData({ hasJobsCache: false })
      return false
    }
    const jobs = (Array.isArray(cached.jobs) ? cached.jobs : []).map((j) => normalizeJobForUi(j))
    this.setData({ jobs, hasJobsCache: true, isLoadingJobs: false })
    return true
  },

  async loadJobs({ silent = false } = {}) {
    if (!wx.cloud || !wx.cloud.database) return
    try {
      const hasAny = Array.isArray(this.data.jobs) && this.data.jobs.length > 0
      if (!silent && !hasAny) this.setData({ isLoadingJobs: true })
      const list = await listMyJobs({ limit: 20 })
      const jobs = list.map((j) => normalizeJobForUi(j))
      this.setData({ jobs, isLoadingJobs: false, hasJobsCache: true })
      writeJobsCache({ v: 1, ts: Date.now(), jobs: list })
    } catch (e) {
      console.error('loadJobs failed', e)
      this.setData({ isLoadingJobs: false })
    }
  },

  stopJobPolling() {
    if (this._jobPollTimer) {
      clearTimeout(this._jobPollTimer)
      this._jobPollTimer = null
    }
    this._pollingJobId = ''
  },

  startJobPolling(jobId) {
    const id = String(jobId || '')
    if (!id) return
    this.stopJobPolling()
    this._pollingJobId = id

    const tick = async () => {
      if (this._pollingJobId !== id) return
      try {
        const job = await getJob(id)
        const uiJob = normalizeJobForUi(job)
        this.setData({ currentJobId: id, currentJob: uiJob })

        // Sync progress UI to job status
        const status = uiJob.status
        const phase = uiJob.phase
        const nextPhase = status === 'queued'
          ? 'queued'
          : (status === 'failed' ? 'failed' : (phase || 'generate'))

        this.setData({
          step: 'generate',
          currentStepIndex: stepToIndex('generate'),
          step3Phase: nextPhase,
          step3Title: status === 'done'
            ? 'Completed'
            : (status === 'failed'
              ? 'Failed'
              : (status === 'queued' ? 'Queued in cloud' : 'Running in cloud')),
          step3Subtitle: status === 'done'
            ? `Saved ${uiJob.resultCount || uiJob.writeTotal || 0} cards`
            : (status === 'failed'
              ? (uiJob.error || 'Job failed')
              : 'You can leave the app. This runs in the cloud.'),
          ocrDone: uiJob.ocrDone || 0,
          ocrTotal: uiJob.ocrTotal || 0,
          writeDone: uiJob.writeDone || 0,
          writeTotal: uiJob.writeTotal || 0
        })

        if (status === 'done') {
          this.stopJobPolling()
          await this.loadJobs({ silent: true })
          this.setData({
            step: 'complete',
            currentStepIndex: stepToIndex('complete'),
            step3Phase: 'done'
          })
          return
        }
        if (status === 'failed') {
          this.stopJobPolling()
          await this.loadJobs({ silent: true })
          return
        }
      } catch (e) {
        console.error('poll job failed', e)
      } finally {
        if (this._pollingJobId === id) {
          this._jobPollTimer = setTimeout(tick, 2000)
        }
      }
    }

    tick()
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

  async uploadImages(paths) {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : []
    if (!list.length) throw new Error('no images')
    const fileIDs = []
    for (let i = 0; i < list.length; i += 1) {
      const path = list[i]
      // eslint-disable-next-line no-await-in-loop
      const fileID = await uploadImage(path)
      fileIDs.push(fileID)
      this.setData({ uploadDone: i + 1 })
    }
    return fileIDs
  },

  async onGenerate() {
    const title = String(this.data.deckTitle || '').trim()
    if (!title) return
    if (this._isGenerating) return

    const mode = this.data.selectedMode === 'text' ? 'text' : 'images'
    const knowledge = String(this.data.knowledge || '').trim()
    const rawText = mode === 'text' ? String(this.data.inputText || '').trim() : ''
    const images = mode === 'images' ? (Array.isArray(this.data.pickedImages) ? this.data.pickedImages : []) : []
    if (mode === 'text' && !rawText) {
      wx.showToast({ title: '请先粘贴/输入内容', icon: 'none' })
      return
    }
    if (mode === 'images' && !images.length) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    this._isGenerating = true
    try {
      const uploadTotal = mode === 'images' ? images.length : 0
      const ocrTotal = mode === 'images' ? images.length : 0

      this.setData({
        step: 'generate',
        currentStepIndex: stepToIndex('generate'),
        step3Phase: mode === 'text' ? 'queued' : 'upload',
        step3Title: mode === 'text' ? 'Submitting job...' : 'Uploading images...',
        step3Subtitle: 'This runs in the cloud. Feel free to leave and come back later.',
        uploadDone: 0,
        uploadTotal,
        ocrDone: 0,
        ocrTotal,
        writeDone: 0,
        writeTotal: 0
      })

      const imageFileIDs = mode === 'images' ? await this.uploadImages(images) : []

      this.setData({
        step3Phase: 'queued',
        step3Title: 'Queued in cloud',
        step3Subtitle: 'Job created. Cloud worker will process it.'
      })

      const jobId = await createJob({
        deckTitle: title,
        mode: mode === 'text' ? 'text' : 'images',
        rawText,
        imageFileIDs,
        knowledge
      })
      this.setData({ currentJobId: jobId })

      // Try to start immediately for faster feedback; timer trigger will also process queued jobs.
      startJob(jobId).catch(() => {})
      this.loadJobs({ silent: true }).catch(() => {})
      this.startJobPolling(jobId)
    } catch (e) {
      console.error('generate/write cards failed', e)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      this.setData({
        step3Phase: 'idle',
        step3Title: '',
        step3Subtitle: '',
        step: 'input',
        currentStepIndex: stepToIndex('input')
      })
    } finally {
      // Keep disabled while on generate screen; user can always leave and come back.
      this._isGenerating = false
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  onJobTap(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    const deckTitle = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.deckTitle : ''
    const status = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.status : ''
    if (!id) return
    if (status === 'done' && deckTitle) {
      wx.navigateTo({ url: `/pages/library/detail?deckTitle=${encodeURIComponent(deckTitle)}` })
      return
    }
    this.setData({ currentJobId: id })
    this.startJobPolling(id)
  }
})
