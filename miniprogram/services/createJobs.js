import { getOpenid } from './auth'
import { callOkFunction } from './cloud'

const COLLECTION = 'create_jobs'

function getDb() {
  if (!wx.cloud || !wx.cloud.database) {
    throw new Error('wx.cloud.database unavailable')
  }
  return wx.cloud.database()
}

function normalizeJob(doc) {
  const d = doc && typeof doc === 'object' ? doc : {}
  return {
    id: d._id || d.id || '',
    deckTitle: typeof d.deckTitle === 'string' ? d.deckTitle : '',
    mode: d.mode === 'text' ? 'text' : 'images',
    status: typeof d.status === 'string' ? d.status : 'queued', // queued|running|done|failed
    phase: typeof d.phase === 'string' ? d.phase : '',
    ocrDone: typeof d.ocrDone === 'number' ? d.ocrDone : 0,
    ocrTotal: typeof d.ocrTotal === 'number' ? d.ocrTotal : 0,
    writeDone: typeof d.writeDone === 'number' ? d.writeDone : 0,
    writeTotal: typeof d.writeTotal === 'number' ? d.writeTotal : 0,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
    error: typeof d.error === 'string' ? d.error : '',
    resultCount: typeof d.resultCount === 'number' ? d.resultCount : 0
  }
}

async function createJob({ deckTitle, mode, rawText, imageFileIDs, knowledge }) {
  const title = String(deckTitle || '').trim()
  if (!title) throw new Error('missing deckTitle')
  const m = mode === 'text' ? 'text' : 'images'
  const images = Array.isArray(imageFileIDs) ? imageFileIDs.filter((x) => typeof x === 'string' && x.trim()).slice(0, 9) : []
  const text = String(rawText || '').trim()
  const know = String(knowledge || '').trim()

  if (m === 'text' && !text) throw new Error('missing rawText')
  if (m === 'images' && !images.length) throw new Error('missing imageFileIDs')

  // ensure openid cache is ready (also helps ensure _openid is set correctly by DB)
  await getOpenid()
  const db = getDb()
  const createdAt = db.serverDate()

  const data = {
    deckTitle: title,
    mode: m,
    rawText: m === 'text' ? text : '',
    imageFileIDs: m === 'images' ? images : [],
    knowledge: know,

    status: 'queued',
    phase: m === 'images' ? 'ocr' : 'generate',
    ocrDone: 0,
    ocrTotal: m === 'images' ? images.length : 0,
    writeDone: 0,
    writeTotal: 0,

    resultCount: 0,
    error: '',

    createdAt,
    updatedAt: createdAt
  }

  const res = await db.collection(COLLECTION).add({ data })
  const id = res && res._id ? String(res._id) : ''
  if (!id) throw new Error('create job failed')
  return id
}

async function listMyJobs({ limit = 20 } = {}) {
  const openid = await getOpenid()
  const db = getDb()
  const res = await db
    .collection(COLLECTION)
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(Math.max(1, Math.min(50, Number(limit) || 20)))
    .get()
  const list = res && Array.isArray(res.data) ? res.data : []
  return list.map((d) => normalizeJob(d))
}

async function getJob(jobId) {
  if (!jobId) throw new Error('missing jobId')
  const db = getDb()
  const res = await db.collection(COLLECTION).doc(String(jobId)).get()
  const doc = res && res.data ? res.data : null
  return normalizeJob({ ...(doc || {}), _id: String(jobId) })
}

async function startJob(jobId) {
  if (!jobId) throw new Error('missing jobId')
  return await callOkFunction('resetDailyScore', { action: 'processCreateJob', jobId: String(jobId) })
}

export { createJob, listMyJobs, getJob, startJob }


