const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COL_DECKS = 'community_decks'
const COL_COLLECTIONS = 'community_deck_collections'
const COL_COLLECT_JOBS = 'community_collect_jobs'
const COL_CARDS = 'cards'

function asString(v) {
  return v == null ? '' : String(v)
}

function asNumber(v, def = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : def
}

function clampInt(v, min, max, def) {
  const n = Math.trunc(asNumber(v, def))
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, n))
}

function normalizeStringArray(v) {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => asString(x).trim())
    .filter(Boolean)
    .slice(0, 20)
}

function normalizeCards(v) {
  if (!Array.isArray(v)) return []
  return v
    .map((c) => ({
      question: asString(c && c.question).trim(),
      answer: asString(c && c.answer).trim(),
      topic: asString(c && c.topic).trim(),
      hint: asString(c && c.hint).trim()
    }))
    .filter((c) => c.question || c.answer)
}

function sha1Hex(text) {
  return crypto.createHash('sha1').update(asString(text), 'utf8').digest('hex')
}

function makeUserDeckRelId(openid, deckId) {
  const o = asString(openid).trim()
  const d = asString(deckId).trim()
  return o && d ? `${o}_${d}` : ''
}

function makeCollectJobId(openid, deckId) {
  const o = asString(openid).trim()
  const d = asString(deckId).trim()
  if (!o || !d) return ''
  return `collect_${sha1Hex(`${o}|${d}`)}`
}

function nowMs() {
  return Date.now()
}

function toMs(v) {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : 0
  }
  if (typeof v === 'object' && v.$date) {
    const t = Date.parse(v.$date)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

async function safeGetDoc(collection, docId) {
  try {
    const res = await db.collection(collection).doc(String(docId)).get()
    return res && res.data ? res.data : null
  } catch (e) {
    return null
  }
}

async function setDoc(collection, docId, data) {
  await db.collection(collection).doc(String(docId)).set({ data })
}

async function updateDoc(collection, docId, patch) {
  await db.collection(collection).doc(String(docId)).update({ data: patch })
}

async function updateJob(jobId, patch) {
  if (!jobId) return
  const data = { ...(patch && typeof patch === 'object' ? patch : {}), updatedAt: db.serverDate() }
  try {
    await updateDoc(COL_COLLECT_JOBS, jobId, data)
  } catch (e) {
    // fall back to set if missing
    try {
      const prev = await safeGetDoc(COL_COLLECT_JOBS, jobId)
      const base = prev && typeof prev === 'object' ? prev : {}
      await setDoc(COL_COLLECT_JOBS, jobId, { ...base, ...data })
    } catch (e2) {
      // ignore
    }
  }
}

async function lockJob(jobId) {
  const leaseMs = 2 * 60 * 1000
  const lockId = `${nowMs()}_${Math.random().toString(16).slice(2)}`

  const ret = await db.runTransaction(async (tx) => {
    const got = await tx.collection(COL_COLLECT_JOBS).doc(String(jobId)).get()
    const job = got && got.data ? got.data : null
    if (!job) throw new Error('job not found')

    const status = asString(job.status || 'queued')
    const updatedAtMs = toMs(job.updatedAt)
    if (status === 'done' || status === 'failed') {
      return { ok: false, reason: 'terminal', job }
    }
    if (status === 'running' && updatedAtMs && nowMs() - updatedAtMs < leaseMs) {
      return { ok: false, reason: 'locked', job }
    }

    await tx.collection(COL_COLLECT_JOBS).doc(String(jobId)).update({
      data: {
        status: 'running',
        lockId,
        updatedAt: db.serverDate()
      }
    })
    return { ok: true, job: { ...job, lockId } }
  })

  return ret
}

async function listExistingIndexes(ownerOpenid, deckId) {
  const out = []
  const cardsCol = db.collection(COL_CARDS)
  const pageSize = 100
  let skip = 0
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const res = await cardsCol
      .where({ _openid: ownerOpenid, sourceCommunityDeckId: deckId })
      .field({ sourceCommunityCardIndex: true })
      .orderBy('createdAt', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const list = res && Array.isArray(res.data) ? res.data : []
    if (!list.length) break
    out.push(...list)
    if (list.length < pageSize) break
    skip += list.length
    if (skip > 5000) break
  }
  return out
}

async function processCollectJob(jobId, { callerOpenid = '' } = {}) {
  if (!jobId) return { ok: false, error: 'missing jobId' }

  // If invoked by user, ensure they can only kick their own job.
  if (callerOpenid) {
    const pre = await safeGetDoc(COL_COLLECT_JOBS, jobId)
    const owner = asString(pre && pre._openid).trim()
    if (!owner) return { ok: false, error: 'job not found' }
    if (owner !== callerOpenid) return { ok: false, error: 'permission denied' }
  }

  const locked = await lockJob(jobId)
  if (!locked || locked.ok !== true) {
    return { ok: true, skipped: true, reason: locked && locked.reason ? locked.reason : 'unknown' }
  }
  const job = locked.job || {}

  const ownerOpenid = asString(job._openid).trim()
  const deckId = asString(job.deckId).trim()
  if (!ownerOpenid || !deckId) {
    await updateJob(jobId, { status: 'failed', error: 'missing job fields (_openid/deckId)' })
    return { ok: false, error: 'missing job fields' }
  }

  const deckRaw = await safeGetDoc(COL_DECKS, deckId)
  if (!deckRaw) {
    await updateJob(jobId, { status: 'failed', error: 'deck not found' })
    return { ok: false, error: 'deck not found' }
  }

  const cards = normalizeCards(deckRaw && deckRaw.cards)
  const total = cards.length
  if (!total) {
    await updateJob(jobId, { status: 'failed', total: 0, added: 0, error: 'deck has no cards' })
    return { ok: false, error: 'deck has no cards' }
  }

  const maxCollect = clampInt(process.env.COMMUNITY_MAX_COLLECT, 1, 200, 80)
  if (total > maxCollect) {
    await updateJob(jobId, {
      status: 'failed',
      total,
      added: 0,
      error: `deck too large to collect (max ${maxCollect})`
    })
    return { ok: false, error: 'deck too large' }
  }

  const relId = makeUserDeckRelId(ownerOpenid, deckId)
  if (!relId) {
    await updateJob(jobId, { status: 'failed', error: 'invalid relId' })
    return { ok: false, error: 'invalid relId' }
  }

  const existedCollection = await safeGetDoc(COL_COLLECTIONS, relId)

  const existing = await listExistingIndexes(ownerOpenid, deckId)
  const doneSet = new Set(
    existing
      .map((d) => (typeof d.sourceCommunityCardIndex === 'number' ? d.sourceCommunityCardIndex : null))
      .filter((x) => typeof x === 'number')
  )

  const deckTitle = asString(deckRaw.title).trim() || 'Inbox'
  const deckTags = normalizeStringArray(deckRaw && deckRaw.tags)
  const createdAt = db.serverDate()

  const toAdd = []
  for (let i = 0; i < cards.length; i += 1) {
    if (doneSet.has(i)) continue
    const c = cards[i]
    const q = asString(c.question).trim()
    const a = asString(c.answer).trim()
    const hint = asString(c.hint).trim()
    if (!q && !a) continue
    toAdd.push({
      i,
      data: {
        _openid: ownerOpenid,
        deckTitle,
        question: q,
        answer: a,
        topic: asString(c.topic).trim(),
        ...(hint ? { hint } : {}),
        tags: deckTags,
        sourceCommunityDeckId: deckId,
        sourceCommunityCardIndex: i,
        sourceCommunityTitle: deckTitle,
        createdAt,
        updatedAt: createdAt
      }
    })
  }

  const baseDone = Math.min(total, doneSet.size)
  await updateJob(jobId, { status: 'running', total, added: baseDone, error: '' })

  const cardsCol = db.collection(COL_CARDS)
  const concurrency = clampInt(process.env.COMMUNITY_COLLECT_CONCURRENCY, 1, 20, 8)
  let added = 0
  for (let p = 0; p < toAdd.length; p += concurrency) {
    const batch = toAdd.slice(p, p + concurrency)
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(batch.map((it) => cardsCol.add({ data: it.data })))
    added += batch.length
    // eslint-disable-next-line no-await-in-loop
    await updateJob(jobId, { status: 'running', total, added: Math.min(total, baseDone + added) })
  }

  // Mark collected and bump deck counters ONCE.
  if (!existedCollection) {
    await setDoc(COL_COLLECTIONS, relId, {
      deckId,
      collectedAt: db.serverDate(),
      updatedAt: db.serverDate(),
      cardCount: total
    })
    await db.collection(COL_DECKS).doc(deckId).update({
      data: { downloadCount: _.inc(1), hotScore: _.inc(1), updatedAt: db.serverDate() }
    })
  } else {
    await updateDoc(COL_COLLECTIONS, relId, { updatedAt: db.serverDate(), cardCount: total })
  }

  await updateJob(jobId, { status: 'done', total, added: Math.min(total, baseDone + added), error: '' })
  return { ok: true, jobId, total, added: Math.min(total, baseDone + added), existed: Boolean(existedCollection) }
}

async function pickNextJobId() {
  // Prefer queued jobs; also include stale running jobs (lock will enforce lease).
  try {
    const res = await db
      .collection(COL_COLLECT_JOBS)
      .where({ status: _.in(['queued', 'running']) })
      .orderBy('updatedAt', 'asc')
      .limit(1)
      .get()
    const job = res && Array.isArray(res.data) ? res.data[0] : null
    return job && job._id ? String(job._id) : ''
  } catch (e) {
    return ''
  }
}

exports.main = async (event) => {
  const startedAt = Date.now()
  const action = asString(event && event.action).trim() || 'tick'

  let callerOpenid = ''
  try {
    const ctx = cloud.getWXContext ? cloud.getWXContext() : null
    callerOpenid = ctx && ctx.OPENID ? String(ctx.OPENID) : ''
  } catch (e) {
    callerOpenid = ''
  }

  try {
    const jobIdIn = asString(event && event.jobId).trim()
    const jobId = jobIdIn || (await pickNextJobId())
    if (!jobId) {
      const durationMs = Date.now() - startedAt
      console.log(`[communityCollectWorker] ok action=${action} durationMs=${durationMs} idle`)
      return { ok: true, idle: true, durationMs }
    }

    const ret = await processCollectJob(jobId, { callerOpenid: jobIdIn ? callerOpenid : '' })
    const durationMs = Date.now() - startedAt
    console.log(
      `[communityCollectWorker] ${ret && ret.ok ? 'ok' : 'fail'} action=${action} jobId=${jobId} durationMs=${durationMs}`
    )
    return { ...(ret || {}), durationMs }
  } catch (err) {
    const durationMs = Date.now() - startedAt
    console.error('communityCollectWorker failed', err)
    return { ok: false, error: err && err.message ? err.message : String(err), durationMs }
  }
}

