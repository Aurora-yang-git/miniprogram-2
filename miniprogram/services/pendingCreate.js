import { createCard } from './cards'

const KEY = 'pending_create_job_v1'

function readJob() {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(KEY)
    if (!v) return null
    if (typeof v === 'string') return JSON.parse(v)
    if (typeof v === 'object') return v
    return null
  } catch (e) {
    return null
  }
}

function writeJob(job) {
  try {
    wx.setStorageSync && wx.setStorageSync(KEY, job)
  } catch (e) {
    // ignore
  }
}

function clearJob() {
  try {
    wx.removeStorageSync && wx.removeStorageSync(KEY)
  } catch (e) {
    try {
      wx.setStorageSync && wx.setStorageSync(KEY, '')
    } catch (err) {
      // ignore
    }
  }
}

function setPendingCreateJob({ deckTitle, cards }) {
  const title = String(deckTitle || '').trim()
  const list = Array.isArray(cards) ? cards : []
  if (!title || !list.length) return

  const safeCards = list
    .map((c) => ({
      question: c && typeof c.question === 'string' ? c.question.trim() : '',
      answer: c && typeof c.answer === 'string' ? c.answer.trim() : '',
      tags: Array.isArray(c && c.tags) ? c.tags : []
    }))
    .filter((c) => c.question && c.answer)

  if (!safeCards.length) return

  writeJob({
    v: 1,
    deckTitle: title,
    cursor: 0,
    total: safeCards.length,
    cards: safeCards,
    createdAt: Date.now()
  })
}

async function resumePendingCreateJob({ onProgress } = {}) {
  const job = readJob()
  if (!job || !job.deckTitle || !Array.isArray(job.cards) || !job.cards.length) return { ok: false, reason: 'no_job' }

  const total = typeof job.total === 'number' ? job.total : job.cards.length
  let cursor = typeof job.cursor === 'number' ? job.cursor : 0
  if (cursor < 0) cursor = 0
  if (cursor >= job.cards.length) {
    clearJob()
    return { ok: true, done: total, total }
  }

  for (let i = cursor; i < job.cards.length; i += 1) {
    const c = job.cards[i]
    // eslint-disable-next-line no-await-in-loop
    await createCard({ deckTitle: job.deckTitle, question: c.question, answer: c.answer, tags: c.tags })
    cursor = i + 1
    writeJob({ ...job, cursor })
    if (typeof onProgress === 'function') onProgress({ done: cursor, total })
  }

  clearJob()
  return { ok: true, done: total, total }
}

export { setPendingCreateJob, resumePendingCreateJob }



