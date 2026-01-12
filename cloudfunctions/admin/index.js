/* eslint-disable no-console */
const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COL_DECKS = 'community_decks'
const OFFICIAL_SEED_META_ID = '__official_seed_meta__'
const ALLOWED_OFFICIAL_TAGS = ['G11 ACT', 'AP CSP', 'AP Psych', 'G11 Chinese']

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

function requireAdminToken(event) {
  const expected = asString(process.env.ADMIN_TOKEN).trim()
  if (!expected) {
    return { ok: false, error: 'missing ADMIN_TOKEN env var (set it in Cloud Function env before use)' }
  }
  const token = asString(event && event.token).trim()
  if (!token || token !== expected) {
    return { ok: false, error: 'invalid admin token' }
  }
  const confirm = asString(event && event.confirm).trim()
  if (confirm !== 'DELETE_ALL_CARDS') {
    return { ok: false, error: 'missing/invalid confirm (must be exactly: DELETE_ALL_CARDS)' }
  }
  return { ok: true }
}

function normalizeStringArray(v) {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => asString(x).trim())
    .filter(Boolean)
    .slice(0, 20)
}

function b64Url(s) {
  const raw = Buffer.from(asString(s), 'utf8').toString('base64')
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function sha1Hex(text) {
  return crypto.createHash('sha1').update(asString(text), 'utf8').digest('hex')
}

function normalizeOfficialTags(tags) {
  const list = normalizeStringArray(tags)
  const out = []
  for (let i = 0; i < list.length; i += 1) {
    const t = list[i]
    if (!ALLOWED_OFFICIAL_TAGS.includes(t)) continue
    if (!out.includes(t)) out.push(t)
  }
  return out
}

function normalizeDeckInput(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const deckTitle = asString(d.deckTitle || d.title).trim()
  const description = asString(d.description).trim()
  const tags = normalizeOfficialTags(d.tags)
  const rawCards = Array.isArray(d.cards) ? d.cards : []
  const cards = rawCards
    .map((c) => {
      const cc = c && typeof c === 'object' ? c : {}
      const question = asString(cc.q || cc.question).trim()
      const answer = asString(cc.a || cc.answer).trim()
      const topic = asString(cc.topic).trim()
      const hint = asString(cc.hint).trim()
      return { question, answer, topic, hint }
    })
    .filter((c) => c.question || c.answer)
  return { deckTitle, description, tags, cards }
}

function parseAdminOpenids() {
  const raw = asString(process.env.ADMIN_OPENIDS).trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => asString(x).trim())
    .filter(Boolean)
}

function requireAdmin(event, { allowToken = true } = {}) {
  const { OPENID } = cloud.getWXContext()
  const openid = asString(OPENID).trim()
  const allow = parseAdminOpenids()
  if (openid && allow.includes(openid)) {
    return { ok: true, mode: 'openid', openid }
  }

  if (!allowToken) {
    return { ok: false, error: 'not authorized (set ADMIN_OPENIDS in cloud function env)' }
  }

  const expected = asString(process.env.ADMIN_TOKEN).trim()
  if (!expected) {
    return { ok: false, error: 'not authorized (set ADMIN_OPENIDS or ADMIN_TOKEN in cloud function env)' }
  }
  const token = asString(event && event.token).trim()
  if (!token || token !== expected) {
    return { ok: false, error: 'not authorized (invalid token)' }
  }
  return { ok: true, mode: 'token', openid }
}

async function safeGetDoc(collection, docId) {
  try {
    const res = await db.collection(collection).doc(docId).get()
    return res && res.data ? res.data : null
  } catch (e) {
    return null
  }
}

async function removeByIds(collectionName, ids) {
  if (!ids || !ids.length) return 0
  const chunks = []
  for (let i = 0; i < ids.length; i += 20) {
    chunks.push(ids.slice(i, i + 20))
  }
  let removed = 0
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]
    // eslint-disable-next-line no-await-in-loop
    const res = await db
      .collection(collectionName)
      .where({ _id: _.in(chunk) })
      .remove()
    removed += res && res.stats && typeof res.stats.removed === 'number' ? res.stats.removed : 0
  }
  return removed
}

async function wipeCards({ batchFetch = 100, maxDelete = 2000 } = {}) {
  const fetchN = clampInt(batchFetch, 1, 100, 100)
  const maxN = clampInt(maxDelete, 1, 20000, 2000)

  let removed = 0
  let loops = 0

  while (removed < maxN) {
    loops += 1
    if (loops > 500) break

    // eslint-disable-next-line no-await-in-loop
    const res = await db.collection('cards').limit(fetchN).get()
    const list = res && Array.isArray(res.data) ? res.data : []
    if (!list.length) break

    const ids = list.map((d) => (d && d._id ? String(d._id) : '')).filter(Boolean)
    if (!ids.length) break

    // eslint-disable-next-line no-await-in-loop
    const n = await removeByIds('cards', ids)
    removed += n

    if (list.length < fetchN) break
  }

  let done = false
  try {
    const left = await db.collection('cards').limit(1).get()
    const leftN = left && Array.isArray(left.data) ? left.data.length : 0
    done = leftN === 0
  } catch (e) {
    done = false
  }

  return { removed, done, maxDelete: maxN, batchFetch: fetchN }
}

async function upsertOfficialDecks(event) {
  const strict = event && event.strict === true
  const decksIn = Array.isArray(event && event.decks) ? event.decks : event && event.deck ? [event.deck] : []
  if (!decksIn.length) return { ok: false, error: 'missing decks' }

  const normalized = decksIn.map((d) => normalizeDeckInput(d)).filter((d) => d.deckTitle && d.cards.length)
  if (!normalized.length) return { ok: false, error: 'no valid decks (need deckTitle + non-empty cards)' }

  // De-dupe by deckTitle (last one wins)
  const byTitle = new Map()
  normalized.forEach((d) => {
    byTitle.set(d.deckTitle, d)
  })
  const decks = Array.from(byTitle.values())

  // Validate tags
  for (let i = 0; i < decks.length; i += 1) {
    const d = decks[i]
    if (!d.tags.length) {
      return {
        ok: false,
        error: `deck "${d.deckTitle}" missing/invalid tags (allowed: ${ALLOWED_OFFICIAL_TAGS.join(', ')})`
      }
    }
  }

  const now = db.serverDate()
  const upserted = []
  for (let i = 0; i < decks.length; i += 1) {
    const d = decks[i]
    const title = d.deckTitle
    const docId = `official_${b64Url(title)}`

    // eslint-disable-next-line no-await-in-loop
    const prev = await safeGetDoc(COL_DECKS, docId)
    const likeCount = asNumber(prev && prev.likeCount, 0)
    const downloadCount = asNumber(prev && prev.downloadCount, 0)
    const hotScore = asNumber(prev && prev.hotScore, likeCount + downloadCount)
    const createdAt = prev && prev.createdAt ? prev.createdAt : now

    const data = {
      title,
      description: d.description || '官方默认卡包（可收藏到你的卡库）',
      tags: d.tags,
      authorName: 'LearnCards Official',
      authorAvatar: '',
      authorLevel: 99,
      cards: d.cards,
      cardCount: d.cards.length,
      likeCount,
      downloadCount,
      hotScore,
      isOfficial: true,
      isPublic: true,
      officialSeedVersion: asNumber(event && event.seedVersion, 0),
      createdAt,
      updatedAt: now
    }

    // eslint-disable-next-line no-await-in-loop
    await db.collection(COL_DECKS).doc(docId).set({ data })
    upserted.push({ id: docId, title, cardCount: d.cards.length })
  }

  // Strict mode: remove official decks not present in this upload.
  let removed = 0
  if (strict) {
    const keepIds = new Set(upserted.map((d) => d.id))
    const all = []
    let skip = 0
    const pageSize = 100
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const res = await db.collection(COL_DECKS).where({ isOfficial: true }).field({ _id: true }).skip(skip).limit(pageSize).get()
      const list = res && Array.isArray(res.data) ? res.data : []
      if (!list.length) break
      all.push(...list)
      if (list.length < pageSize) break
      skip += list.length
      if (skip > 5000) break
    }
    const toRemove = all
      .map((d) => (d && d._id ? String(d._id) : ''))
      .filter((id) => id && !keepIds.has(id))
    removed = await removeByIds(COL_DECKS, toRemove)
  }

  // Mark meta as manual so community seeding won't overwrite.
  const prevMeta = await safeGetDoc(COL_DECKS, OFFICIAL_SEED_META_ID)
  const createdAt = prevMeta && prevMeta.createdAt ? prevMeta.createdAt : now
  await db.collection(COL_DECKS).doc(OFFICIAL_SEED_META_ID).set({
    data: {
      seedVersion: Date.now(),
      seedMode: 'manual',
      seedHash: sha1Hex(upserted.map((d) => d.id).sort().join('|')),
      isOfficial: false,
      isPublic: false,
      createdAt,
      updatedAt: now
    }
  })

  return { ok: true, upserted, removed, strict }
}

exports.main = async (event) => {
  try {
    const action = asString(event && event.action).trim() || 'ping'
    if (action === 'ping') {
      return { ok: true, now: new Date().toISOString(), hasAdminToken: Boolean(asString(process.env.ADMIN_TOKEN).trim()) }
    }

    if (action === 'wipeAllCards' || action === 'wipeCards') {
      const auth = requireAdminToken(event)
      if (!auth.ok) return auth

      const dryRun = event && event.dryRun === true
      if (dryRun) {
        let total = null
        try {
          const c = await db.collection('cards').count()
          total = c && typeof c.total === 'number' ? c.total : null
        } catch (e) {
          total = null
        }
        return { ok: true, dryRun: true, totalCards: total }
      }

      const ret = await wipeCards({
        batchFetch: event && event.batchFetch,
        maxDelete: event && event.maxDelete
      })
      return { ok: true, ...ret }
    }

    if (action === 'upsertOfficialDecks') {
      const auth = requireAdmin(event, { allowToken: true })
      if (!auth.ok) return auth
      const ret = await upsertOfficialDecks(event)
      return ret
    }

    return { ok: false, error: `unknown action: ${action}` }
  } catch (err) {
    return { ok: false, error: err && err.message ? String(err.message) : String(err) }
  }
}

