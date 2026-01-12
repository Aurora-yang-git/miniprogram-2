const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

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

function normalizeDeckTitle(raw) {
  const t = typeof raw === 'string' ? raw.trim() : ''
  return t ? t : 'Inbox'
}

function buildDeckCond(deckTitle) {
  const title = normalizeDeckTitle(deckTitle)
  if (!title) return null
  const canExists = _ && typeof _.exists === 'function'
  if (title === 'Inbox' && canExists) {
    return _.or([{ deckTitle: 'Inbox' }, { deckTitle: _.exists(false) }, { deckTitle: '' }])
  }
  if (title === 'Inbox') {
    return _.or([{ deckTitle: 'Inbox' }, { deckTitle: '' }])
  }
  return { deckTitle: title }
}

function dueCond(now) {
  const canExists = _ && typeof _.exists === 'function'
  return canExists ? _.or([{ nextReviewAt: _.lte(now) }, { nextReviewAt: _.exists(false) }]) : { nextReviewAt: _.lte(now) }
}

function pickCardField() {
  return {
    deckTitle: true,
    question: true,
    answer: true,
    hint: true,
    tags: true,
    topic: true,
    cardTags: true,
    answerSections: true,
    sourceImages: true,
    sourceImage: true,
    nextReviewAt: true,
    lastReviewedAt: true,
    updatedAt: true
  }
}

exports.main = async (event) => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(`[getReviewQueue] ${ok} reqId=${reqId} durationMs=${durationMs}`)
    return { ...(payload || {}), reqId, durationMs }
  }

  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return finish({ ok: false, error: 'missing OPENID' })

    const mode = asString(event && event.mode).trim() === 'study' ? 'study' : 'review'
    const scope = asString(event && event.scope).trim() === 'all' ? 'all' : 'deck'
    const limit = clampInt(event && event.limit, 1, 50, 20)
    const skip = clampInt(event && event.skip, 0, 10000, 0)

    const deckTitle = asString(event && event.deckTitle).trim()
    const deckCond = scope === 'deck' ? buildDeckCond(deckTitle) : null
    const now = Date.now()

    let where = null
    if (mode === 'study') {
      if (!deckCond) return finish({ ok: false, error: 'missing deckTitle for study' })
      where = _.and([{ _openid: OPENID }, deckCond])
    } else {
      const due = dueCond(now)
      where = deckCond ? _.and([{ _openid: OPENID }, due, deckCond]) : _.and([{ _openid: OPENID }, due])
    }

    const res = await db
      .collection('cards')
      .where(where)
      .field(pickCardField())
      .orderBy('updatedAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    let cards = res && Array.isArray(res.data) ? res.data : []

    if (mode !== 'study') {
      cards.sort((a, b) => {
        const na = typeof a.nextReviewAt === 'number' ? a.nextReviewAt : 0
        const nb = typeof b.nextReviewAt === 'number' ? b.nextReviewAt : 0
        return na - nb
      })
    }

    return finish({
      ok: true,
      cards,
      nextSkip: skip + cards.length,
      hasMore: cards.length === limit
    })
  } catch (err) {
    console.error('getReviewQueue failed', err)
    return finish({ ok: false, error: err && err.message ? err.message : String(err) })
  }
}

