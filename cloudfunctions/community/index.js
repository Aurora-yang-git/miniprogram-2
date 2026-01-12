const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const { getOfficialDefaultDecks } = require('./official_default_decks')

const COL_DECKS = 'community_decks'
const COL_LIKES = 'community_deck_likes'
const COL_COLLECTIONS = 'community_deck_collections'
const COL_COLLECT_JOBS = 'community_collect_jobs'

// Bump this when `official_default_decks.js` changes so DB-seeded official decks refresh.
const OFFICIAL_SEED_VERSION = 5
const OFFICIAL_SEED_META_ID = '__official_seed_meta__'

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

let OFFICIAL_SEED_CACHED_VERSION = 0

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

function b64Url(s) {
  const raw = Buffer.from(asString(s), 'utf8').toString('base64')
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function makeUserPublishedDeckDocId(openid, deckTitle) {
  const o = asString(openid).trim()
  const t = asString(deckTitle).trim()
  if (!o || !t) return ''
  return `userdeck_${sha1Hex(`${o}|${t}`)}`
}

function normalizeDeck(doc) {
  const d = doc && typeof doc === 'object' ? doc : {}
  const likeCount = Math.max(0, asNumber(d.likeCount, 0))
  const downloadCount = Math.max(0, asNumber(d.downloadCount, 0))
  const cards = Array.isArray(d.cards) ? d.cards : []
  const cardCount = Math.max(0, asNumber(d.cardCount, cards.length))
  const hotScore = Math.max(0, asNumber(d.hotScore, likeCount + downloadCount))
  return {
    id: d._id ? String(d._id) : '',
    title: asString(d.title).trim(),
    description: asString(d.description).trim(),
    tags: normalizeStringArray(d.tags),
    authorName: asString(d.authorName).trim(),
    authorAvatar: asString(d.authorAvatar).trim(),
    authorLevel: asNumber(d.authorLevel, 0),
    cardCount,
    likeCount,
    downloadCount,
    hotScore,
    isOfficial: d.isOfficial === true,
    isPublic: d.isPublic === true,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null
  }
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

async function safeGetDoc(collection, docId) {
  try {
    const res = await db.collection(collection).doc(docId).get()
    return res && res.data ? res.data : null
  } catch (e) {
    return null
  }
}

function isCollectionNotExistError(err) {
  const msg = err && err.message ? String(err.message) : ''
  return msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('collection not exists') || msg.includes('Db or Table not exist')
}

async function listUserDeckCards(openid, deckTitle, limit) {
  const o = asString(openid).trim()
  const title = asString(deckTitle).trim()
  const max = clampInt(limit, 1, 500, 200)
  const out = []
  const BATCH = 100
  let skip = 0

  while (out.length < max) {
    // eslint-disable-next-line no-await-in-loop
    const res = await db
      .collection('cards')
      .where({ _openid: o, deckTitle: title })
      .orderBy('createdAt', 'asc')
      .skip(skip)
      .limit(Math.min(BATCH, max - out.length))
      .get()
    const list = res && Array.isArray(res.data) ? res.data : []
    if (!list.length) break
    out.push(...list)
    skip += list.length
    if (list.length < BATCH) break
  }

  return out
}

function computeTopTagsFromCards(cardDocs) {
  const list = Array.isArray(cardDocs) ? cardDocs : []
  const counts = new Map()
  list.forEach((c) => {
    const tags = Array.isArray(c && c.tags) ? c.tags : []
    tags.forEach((t) => {
      const key = asString(t).trim()
      if (!key) return
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((it) => it[0])
}

async function ensureOfficialDefaultsSeeded() {
  // Warm-container fast path: avoid DB read on every invocation.
  if (OFFICIAL_SEED_CACHED_VERSION >= OFFICIAL_SEED_VERSION) {
    return { ok: true, seeded: false, version: OFFICIAL_SEED_CACHED_VERSION, cached: true }
  }

  // Seed with a meta doc so we can upgrade official decks over time.
  // (Do NOT rely on "any official deck exists" because that prevents updates.)
  const meta = await safeGetDoc(COL_DECKS, OFFICIAL_SEED_META_ID)
  const metaVer = asNumber(meta && meta.seedVersion, 0)
  const metaMode = asString(meta && meta.seedMode).trim()
  // If you manually manage official decks (e.g. via admin sync), never overwrite from code.
  if (meta && metaMode === 'manual') {
    OFFICIAL_SEED_CACHED_VERSION = Math.max(OFFICIAL_SEED_VERSION, OFFICIAL_SEED_CACHED_VERSION || 0)
    return { ok: true, seeded: false, version: metaVer, mode: 'manual' }
  }
  if (meta && metaVer >= OFFICIAL_SEED_VERSION) {
    OFFICIAL_SEED_CACHED_VERSION = metaVer
    return { ok: true, seeded: false, version: metaVer }
  }

  const defaults = getOfficialDefaultDecks()
  const now = db.serverDate()
  for (let i = 0; i < defaults.length; i += 1) {
    const d = defaults[i]
    const title = asString(d && d.deckTitle).trim()
    const tags = normalizeStringArray(d && d.tags)
    const rawCards = Array.isArray(d && d.cards) ? d.cards : []
    const cards = rawCards
      .map((c) => ({
        question: asString(c && c.q).trim(),
        answer: asString(c && c.a).trim(),
        topic: asString(c && c.topic).trim(),
        hint: asString(c && c.hint).trim()
      }))
      .filter((c) => c.question || c.answer)

    if (!title || !cards.length) continue

    const docId = `official_${b64Url(title)}`
    // Preserve counters for already-seeded decks.
    // eslint-disable-next-line no-await-in-loop
    const prev = await safeGetDoc(COL_DECKS, docId)
    const likeCount = asNumber(prev && prev.likeCount, 0)
    const downloadCount = asNumber(prev && prev.downloadCount, 0)
    const hotScore = asNumber(prev && prev.hotScore, likeCount + downloadCount)
    const createdAt = prev && prev.createdAt ? prev.createdAt : now
    const data = {
      title,
      description: '官方默认卡包（可收藏到你的卡库）',
      tags,
      authorName: 'LearnCards Official',
      authorAvatar: '',
      authorLevel: 99,
      cards,
      cardCount: cards.length,
      likeCount,
      downloadCount,
      hotScore,
      isOfficial: true,
      isPublic: true,
      officialSeedVersion: OFFICIAL_SEED_VERSION,
      createdAt,
      updatedAt: now
    }

    // eslint-disable-next-line no-await-in-loop
    await db.collection(COL_DECKS).doc(docId).set({ data })
  }

  await db.collection(COL_DECKS).doc(OFFICIAL_SEED_META_ID).set({
    data: {
      seedVersion: OFFICIAL_SEED_VERSION,
      seedMode: 'code',
      isOfficial: false,
      isPublic: false,
      createdAt: now,
      updatedAt: now
    }
  })

  OFFICIAL_SEED_CACHED_VERSION = OFFICIAL_SEED_VERSION
  return { ok: true, seeded: true, version: OFFICIAL_SEED_VERSION }
}

async function getMyDeckPublishStatus(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const deckTitle = asString(event && event.deckTitle).trim()
  if (!deckTitle) return { ok: false, error: 'missing deckTitle' }

  const docId = makeUserPublishedDeckDocId(OPENID, deckTitle)
  if (!docId) return { ok: false, error: 'invalid deckTitle' }

  const doc = await safeGetDoc(COL_DECKS, docId)
  if (!doc) {
    return { ok: true, published: false, deckId: docId, isPublic: false }
  }

  const owner = asString(doc.ownerOpenid).trim()
  const src = asString(doc.sourceDeckTitle).trim()
  if (owner && owner !== OPENID) {
    // should not happen for deterministic docId, but be safe
    return { ok: true, published: false, deckId: docId, isPublic: false }
  }
  if (src && src !== deckTitle) {
    return { ok: true, published: false, deckId: docId, isPublic: false }
  }

  const isPublic = doc.isPublic === true
  return { ok: true, published: isPublic, deckId: docId, isPublic }
}

async function publishMyDeck(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const deckTitle = asString(event && event.deckTitle).trim()
  if (!deckTitle) return { ok: false, error: 'missing deckTitle' }

  const docId = makeUserPublishedDeckDocId(OPENID, deckTitle)
  if (!docId) return { ok: false, error: 'invalid deckTitle' }

  const maxPublish = clampInt(process.env.COMMUNITY_MAX_PUBLISH, 1, 500, 200)
  const docs = await listUserDeckCards(OPENID, deckTitle, maxPublish + 1)
  if (!docs.length) return { ok: false, error: 'deck has no cards' }
  if (docs.length > maxPublish) {
    return { ok: false, error: `deck too large to publish (max ${maxPublish})`, maxPublish, cardCount: docs.length }
  }

  // built-in default decks are now official in community
  const allBuiltIn = docs.every((c) => c && c.builtIn === true)
  if (allBuiltIn) {
    return { ok: false, error: 'built-in default deck should use official community decks' }
  }

  const cards = docs
    .map((c) => ({
      question: asString(c && c.question).trim(),
      answer: asString(c && c.answer).trim(),
      topic: asString(c && c.topic).trim()
    }))
    .filter((c) => c.question || c.answer)
  if (!cards.length) return { ok: false, error: 'deck has no valid cards' }

  const tags = computeTopTagsFromCards(docs)

  // author info from user_stats if available
  let authorName = ''
  let authorAvatar = ''
  let authorLevel = 1
  try {
    const res = await db.collection('user_stats').where({ _openid: OPENID }).limit(1).get()
    const st = res && Array.isArray(res.data) ? res.data[0] : null
    authorName = asString(st && (st.nickname || st.nickName || st.name)).trim()
    authorAvatar = asString(st && (st.avatarUrl || st.avatar)).trim()
    const xp = asNumber(st && st.xp, 0)
    authorLevel = Math.max(1, Math.floor(xp / 100) + 1)
  } catch (e) {
    authorName = ''
    authorAvatar = ''
    authorLevel = 1
  }
  if (!authorName) authorName = 'Anonymous'

  const descIn = asString(event && event.description).trim()
  const description = descIn ? descIn.slice(0, 200) : 'Shared deck'

  const existed = await safeGetDoc(COL_DECKS, docId)
  const likeCount = asNumber(existed && existed.likeCount, 0)
  const downloadCount = asNumber(existed && existed.downloadCount, 0)
  const hotScore = asNumber(existed && existed.hotScore, likeCount + downloadCount)
  const createdAt = existed && existed.createdAt ? existed.createdAt : db.serverDate()

  const data = {
    title: deckTitle,
    description,
    tags,
    authorName,
    authorAvatar,
    authorLevel,
    cards,
    cardCount: cards.length,
    likeCount,
    downloadCount,
    hotScore,
    isOfficial: false,
    isPublic: true,
    ownerOpenid: OPENID,
    sourceDeckTitle: deckTitle,
    createdAt,
    updatedAt: db.serverDate()
  }

  await db.collection(COL_DECKS).doc(docId).set({ data })

  return { ok: true, published: true, deckId: docId, cardCount: cards.length }
}

async function unpublishMyDeck(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const deckTitle = asString(event && event.deckTitle).trim()
  if (!deckTitle) return { ok: false, error: 'missing deckTitle' }

  const docId = makeUserPublishedDeckDocId(OPENID, deckTitle)
  if (!docId) return { ok: false, error: 'invalid deckTitle' }

  const doc = await safeGetDoc(COL_DECKS, docId)
  if (!doc) return { ok: true, unpublished: true, existed: false, deckId: docId }

  const owner = asString(doc.ownerOpenid).trim()
  if (owner && owner !== OPENID) return { ok: false, error: 'not owner' }

  await db.collection(COL_DECKS).doc(docId).update({
    data: { isPublic: false, updatedAt: db.serverDate() }
  })

  return { ok: true, unpublished: true, existed: true, deckId: docId }
}

async function listDecks(event) {
  await ensureOfficialDefaultsSeeded()

  const sortBy = asString(event && event.sortBy).trim() || 'hot'
  const limit = clampInt(event && event.limit, 1, 50, 20)

  let q = db
    .collection(COL_DECKS)
    .where(_.or([{ isPublic: true }, { isOfficial: true }]))
  if (sortBy === 'downloaded') {
    q = q.orderBy('downloadCount', 'desc')
  } else if (sortBy === 'new') {
    q = q.orderBy('createdAt', 'desc')
  } else {
    q = q.orderBy('hotScore', 'desc')
  }

  const res = await q.limit(limit).get()
  const list = res && Array.isArray(res.data) ? res.data : []
  const decks = list.map((d) => normalizeDeck(d))
  return { ok: true, decks }
}

async function getDeck(event) {
  await ensureOfficialDefaultsSeeded()

  const deckId = asString(event && (event.deckId || event.id)).trim()
  if (!deckId) return { ok: false, error: 'missing deckId' }

  const { OPENID } = cloud.getWXContext()
  const deckRaw = await safeGetDoc(COL_DECKS, deckId)
  if (!deckRaw) return { ok: false, error: 'deck not found' }

  // Only allow viewing public/official decks, or your own (for unpublished drafts later).
  if (deckRaw.isOfficial !== true && deckRaw.isPublic !== true) {
    const owner = asString(deckRaw.ownerOpenid).trim()
    if (!OPENID || !owner || owner !== OPENID) {
      return { ok: false, error: 'deck not public' }
    }
  }

  const deck = normalizeDeck({ ...deckRaw, _id: deckId })
  const cards = normalizeCards(deckRaw && deckRaw.cards)

  let isLiked = false
  let isCollected = false
  if (OPENID) {
    const relId = makeUserDeckRelId(OPENID, deckId)
    if (relId) {
      const [like, collected] = await Promise.all([safeGetDoc(COL_LIKES, relId), safeGetDoc(COL_COLLECTIONS, relId)])
      isLiked = Boolean(like)
      isCollected = Boolean(collected)
    }
  }

  return { ok: true, deck: { ...deck, cards }, isLiked, isCollected }
}

async function toggleLike(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const deckId = asString(event && (event.deckId || event.id)).trim()
  if (!deckId) return { ok: false, error: 'missing deckId' }

  const relId = makeUserDeckRelId(OPENID, deckId)
  if (!relId) return { ok: false, error: 'invalid deckId' }

  const existed = await safeGetDoc(COL_LIKES, relId)
  const decksCol = db.collection(COL_DECKS)

  if (existed) {
    await db.collection(COL_LIKES).doc(relId).remove()
    await decksCol.doc(deckId).update({
      data: { likeCount: _.inc(-1), hotScore: _.inc(-1), updatedAt: db.serverDate() }
    })
    return { ok: true, liked: false }
  }

  const createdAt = db.serverDate()
  await db.collection(COL_LIKES).doc(relId).set({
    data: { deckId, createdAt, updatedAt: createdAt }
  })
  await decksCol.doc(deckId).update({
    data: { likeCount: _.inc(1), hotScore: _.inc(1), updatedAt: db.serverDate() }
  })
  return { ok: true, liked: true }
}

async function enqueueCollect(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const deckId = asString(event && (event.deckId || event.id)).trim()
  if (!deckId) return { ok: false, error: 'missing deckId' }

  const jobId = makeCollectJobId(OPENID, deckId)
  if (!jobId) return { ok: false, error: 'invalid deckId' }

  // Validate deck exists and is viewable
  await ensureOfficialDefaultsSeeded()
  const deckRaw = await safeGetDoc(COL_DECKS, deckId)
  if (!deckRaw) return { ok: false, error: 'deck not found' }

  if (deckRaw.isOfficial !== true && deckRaw.isPublic !== true) {
    const owner = asString(deckRaw.ownerOpenid).trim()
    if (!owner || owner !== OPENID) return { ok: false, error: 'deck not public' }
  }

  const cardsRaw = Array.isArray(deckRaw.cards) ? deckRaw.cards : []
  const total = Math.max(0, asNumber(deckRaw.cardCount, cardsRaw.length))
  if (!total) return { ok: false, error: 'deck has no cards' }

  const maxCollect = clampInt(process.env.COMMUNITY_MAX_COLLECT, 1, 200, 80)
  if (total > maxCollect) {
    return {
      ok: false,
      error: `deck too large to collect (max ${maxCollect})`,
      maxCollect,
      cardCount: total
    }
  }

  const now = db.serverDate()
  const data = {
    _openid: OPENID,
    deckId,
    status: 'queued',
    total,
    added: 0,
    error: '',
    createdAt: now,
    updatedAt: now
  }

  // Idempotency: deterministic jobId per user+deck. Reset to queued on every request (supports resync).
  await db.collection(COL_COLLECT_JOBS).doc(jobId).set({ data })

  return { ok: true, jobId, status: 'queued', total, added: 0 }
}

async function getCollectJob(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const jobId = asString(event && event.jobId).trim()
  if (!jobId) return { ok: false, error: 'missing jobId' }

  const job = await safeGetDoc(COL_COLLECT_JOBS, jobId)
  if (!job) return { ok: false, error: 'job not found' }
  const owner = asString(job._openid).trim()
  if (!owner || owner !== OPENID) return { ok: false, error: 'permission denied' }

  return {
    ok: true,
    job: {
      jobId,
      deckId: asString(job.deckId).trim(),
      status: asString(job.status).trim() || 'queued',
      total: Math.max(0, asNumber(job.total, 0)),
      added: Math.max(0, asNumber(job.added, 0)),
      error: asString(job.error).trim()
    }
  }
}

async function collectDeck(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'missing OPENID' }

  const deckId = asString(event && (event.deckId || event.id)).trim()
  if (!deckId) return { ok: false, error: 'missing deckId' }

  const relId = makeUserDeckRelId(OPENID, deckId)
  if (!relId) return { ok: false, error: 'invalid deckId' }

  const existedCollection = await safeGetDoc(COL_COLLECTIONS, relId)

  const deckRaw = await safeGetDoc(COL_DECKS, deckId)
  if (!deckRaw) return { ok: false, error: 'deck not found' }

  const deck = normalizeDeck({ ...deckRaw, _id: deckId })
  const cards = normalizeCards(deckRaw && deckRaw.cards)
  if (!cards.length) return { ok: false, error: 'deck has no cards' }

  const maxCollect = clampInt(process.env.COMMUNITY_MAX_COLLECT, 1, 200, 80)
  if (cards.length > maxCollect) {
    return {
      ok: false,
      error: `deck too large to collect (max ${maxCollect})`,
      maxCollect,
      cardCount: cards.length
    }
  }

  // Idempotency/resume: check what has already been copied.
  const cardsCol = db.collection('cards')
  const existing = []
  const pageSize = 100
  let skip = 0
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const existingRes = await cardsCol
      .where({ _openid: OPENID, sourceCommunityDeckId: deckId })
      .field({ sourceCommunityCardIndex: true })
      .orderBy('createdAt', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const batch = existingRes && Array.isArray(existingRes.data) ? existingRes.data : []
    if (!batch.length) break
    existing.push(...batch)
    if (batch.length < pageSize) break
    skip += batch.length
    if (skip > 5000) break
  }
  const doneSet = new Set(
    existing
      .map((d) => (typeof d.sourceCommunityCardIndex === 'number' ? d.sourceCommunityCardIndex : null))
      .filter((x) => typeof x === 'number')
  )

  const createdAt = db.serverDate()
  const deckTitle = deck.title || 'Inbox'
  const deckTags = normalizeStringArray(deckRaw && deckRaw.tags)

  const concurrency = clampInt(process.env.COMMUNITY_COLLECT_CONCURRENCY, 1, 20, 8)
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
        _openid: OPENID,
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

  let added = 0
  for (let p = 0; p < toAdd.length; p += concurrency) {
    const batch = toAdd.slice(p, p + concurrency)
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(batch.map((it) => cardsCol.add({ data: it.data })))
    added += batch.length
  }

  // Mark collected and bump deck download/hot counters ONCE.
  if (!existedCollection) {
    await db.collection(COL_COLLECTIONS).doc(relId).set({
      data: {
        deckId,
        collectedAt: db.serverDate(),
        updatedAt: db.serverDate(),
        cardCount: cards.length
      }
    })

    await db.collection(COL_DECKS).doc(deckId).update({
      data: { downloadCount: _.inc(1), hotScore: _.inc(1), updatedAt: db.serverDate() }
    })

    return { ok: true, collected: true, existed: false, added, total: cards.length }
  }

  // If user collected before (or due to older bug), still ensure cards are present; do not bump counters again.
  await db.collection(COL_COLLECTIONS).doc(relId).update({
    data: { updatedAt: db.serverDate(), cardCount: cards.length }
  })

  return { ok: true, collected: true, existed: true, added, total: cards.length }
}

exports.main = async (event) => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload, action) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(`[community] ${ok} reqId=${reqId} action=${asString(action) || 'listDecks'} durationMs=${durationMs}`)
    return { ...(payload || {}), reqId, durationMs }
  }

  try {
    const action = asString(event && event.action).trim() || 'listDecks'
    if (action === 'listDecks') return finish(await listDecks(event), action)
    if (action === 'getDeck') return finish(await getDeck(event), action)
    if (action === 'toggleLike') return finish(await toggleLike(event), action)
    if (action === 'enqueueCollect') return finish(await enqueueCollect(event), action)
    if (action === 'getCollectJob') return finish(await getCollectJob(event), action)
    if (action === 'collectDeck') return finish(await collectDeck(event), action)
    if (action === 'getMyDeckPublishStatus') return finish(await getMyDeckPublishStatus(event), action)
    if (action === 'publishMyDeck') return finish(await publishMyDeck(event), action)
    if (action === 'unpublishMyDeck') return finish(await unpublishMyDeck(event), action)
    return finish({ ok: false, error: `unknown action: ${action}` }, action)
  } catch (err) {
    console.error('community failed', err)
    if (isCollectionNotExistError(err)) {
      return finish(
        {
        ok: false,
        error:
          'DATABASE_COLLECTION_NOT_EXIST: 请先在云数据库创建 community_decks / community_deck_likes / community_deck_collections / community_collect_jobs 四个集合'
        },
        asString(event && event.action).trim() || 'listDecks'
      )
    }
    return finish(
      { ok: false, error: err && err.message ? err.message : String(err) },
      asString(event && event.action).trim() || 'listDecks'
    )
  }
}


