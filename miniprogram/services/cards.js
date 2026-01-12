import { getOpenid } from './auth'
import { formatRelativeTime } from './time'

function getDb() {
  if (!wx.cloud || !wx.cloud.database) {
    throw new Error('wx.cloud.database unavailable')
  }
  return wx.cloud.database()
}

function normalizeDeckTitle(raw) {
  const t = typeof raw === 'string' ? raw.trim() : ''
  return t ? t : 'Inbox'
}

function isDue(card, now) {
  if (!card) return false
  const next = typeof card.nextReviewAt === 'number' ? card.nextReviewAt : null
  if (next === null) return true
  return next <= now
}

async function listAll(where, { field } = {}) {
  const db = getDb()
  const col = db.collection('cards')
  // WeChat Cloud DB client side returns at most 20 docs per request; paginate via skip.
  const limit = 20
  let skip = 0
  let out = []
  while (true) {
    let q = col.where(where).orderBy('updatedAt', 'desc').skip(skip).limit(limit)
    if (field && typeof q.field === 'function') q = q.field(field)
    const res = await q.get()
    const batch = res && Array.isArray(res.data) ? res.data : []
    out = out.concat(batch)
    if (batch.length < limit) break
    skip += limit
    if (skip > 10000) break
  }
  return out
}

async function listUserCards() {
  const openid = await getOpenid()
  // Home page only needs deck aggregation fields; avoid downloading full card bodies.
  const cards = await listAll(
    { _openid: openid },
    { field: { deckTitle: true, tags: true, nextReviewAt: true, lastReviewedAt: true, updatedAt: true } }
  )
  return cards
}

async function countUserCards() {
  const openid = await getOpenid()
  const db = getDb()
  const res = await db.collection('cards').where({ _openid: openid }).count()
  const total = res && typeof res.total === 'number' ? res.total : 0
  return total
}

async function listCardsByDeckTitle(deckTitle) {
  const openid = await getOpenid()
  const db = getDb()
  const _ = db.command
  const title = normalizeDeckTitle(deckTitle)
  const where = title === 'Inbox'
    ? _.and([
      { _openid: openid },
      _.or([{ deckTitle: 'Inbox' }, { deckTitle: _.exists(false) }, { deckTitle: '' }])
    ])
    : { _openid: openid, deckTitle: title }
  const cards = await listAll(where)
  return cards
}

async function listDueCards({ deckTitle, limit } = {}) {
  const openid = await getOpenid()
  const db = getDb()
  const _ = db.command
  const now = Date.now()
  const canExists = _ && typeof _.exists === 'function'
  const dueCond = canExists
    ? _.or([{ nextReviewAt: _.lte(now) }, { nextReviewAt: _.exists(false) }])
    : { nextReviewAt: _.lte(now) }

  const title = deckTitle != null ? normalizeDeckTitle(deckTitle) : ''
  const deckCond = title
    ? (title === 'Inbox'
      ? _.or([{ deckTitle: 'Inbox' }, { deckTitle: _.exists(false) }, { deckTitle: '' }])
      : { deckTitle: title })
    : null

  const where = deckCond
    ? _.and([{ _openid: openid }, dueCond, deckCond])
    : _.and([{ _openid: openid }, dueCond])

  // paginate because each get() returns at most 20 docs
  const pageSize = 20
  let skip = 0
  let list = []
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const res = await db
      .collection('cards')
      .where(where)
      .field({
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
      })
      .orderBy('updatedAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const batch = res && Array.isArray(res.data) ? res.data : []
    list = list.concat(batch)

    if (typeof limit === 'number' && limit > 0 && list.length >= limit) {
      list = list.slice(0, limit)
      break
    }
    if (batch.length < pageSize) break
    skip += pageSize
    if (skip > 10000) break
  }

  // sort by nextReviewAt asc (missing first)
  list.sort((a, b) => {
    const na = typeof a.nextReviewAt === 'number' ? a.nextReviewAt : 0
    const nb = typeof b.nextReviewAt === 'number' ? b.nextReviewAt : 0
    return na - nb
  })
  return list
}

async function createCard({ deckTitle, question, answer, tags }) {
  const openid = await getOpenid()
  const db = getDb()
  const data = {
    deckTitle: normalizeDeckTitle(deckTitle),
    question: String(question || '').trim(),
    answer: String(answer || '').trim(),
    tags: Array.isArray(tags) ? tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 5) : [],
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  if (!data.question || !data.answer) {
    throw new Error('missing question/answer')
  }
  const res = await db.collection('cards').add({ data })
  return { _id: res && res._id ? res._id : '', openid }
}

async function updateCard(cardId, patch) {
  if (!cardId) throw new Error('missing cardId')
  const db = getDb()
  const data = { ...patch, updatedAt: db.serverDate() }
  await db.collection('cards').doc(cardId).update({ data })
}

async function deleteCard(cardId) {
  if (!cardId) throw new Error('missing cardId')
  const db = getDb()
  await db.collection('cards').doc(cardId).remove()
}

async function deleteDeckByTitle(deckTitle) {
  const cards = await listCardsByDeckTitle(deckTitle)
  if (!Array.isArray(cards) || !cards.length) return 0
  let removed = 0
  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i]
    const id = c && (c._id || c.id)
    if (!id) continue
    // eslint-disable-next-line no-await-in-loop
    await deleteCard(String(id))
    removed += 1
  }
  return removed
}

function computeDecksFromCards(cards, now = Date.now()) {
  const list = Array.isArray(cards) ? cards : []
  const map = new Map()
  list.forEach((card) => {
    const title = normalizeDeckTitle(card && card.deckTitle)
    if (!map.has(title)) {
      map.set(title, { title, tagsCount: new Map(), totalCards: 0, dueCount: 0, learnedCount: 0, lastReviewedAt: 0 })
    }
    const agg = map.get(title)
    agg.totalCards += 1
    if (isDue(card, now)) agg.dueCount += 1
    else agg.learnedCount += 1
    const last = typeof card.lastReviewedAt === 'number' ? card.lastReviewedAt : 0
    if (last > agg.lastReviewedAt) agg.lastReviewedAt = last

    const tags = Array.isArray(card && card.tags) ? card.tags : []
    tags.forEach((t) => {
      const key = String(t || '').trim()
      if (!key) return
      agg.tagsCount.set(key, (agg.tagsCount.get(key) || 0) + 1)
    })
  })

  const decks = Array.from(map.values()).map((d) => {
    const progress = d.totalCards
      ? Math.max(0, Math.min(100, Math.round((d.learnedCount / d.totalCards) * 100)))
      : 0
    const tags = Array.from(d.tagsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((it) => it[0])
    return {
      id: d.title,
      title: d.title,
      tags,
      dueCount: d.dueCount,
      totalCards: d.totalCards,
      progress,
      lastStudied: d.lastReviewedAt ? formatRelativeTime(d.lastReviewedAt, now) : ''
    }
  })

  // Sort: due first, then recently studied
  decks.sort((a, b) => {
    if (a.dueCount !== b.dueCount) return b.dueCount - a.dueCount
    return (b.totalCards || 0) - (a.totalCards || 0)
  })

  return decks
}

function extractFiltersFromDecks(decks) {
  const list = Array.isArray(decks) ? decks : []
  const counts = new Map()
  list.forEach((d) => {
    const tags = Array.isArray(d.tags) ? d.tags : []
    tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
  })
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map((it) => it[0])
  return ['All'].concat(sorted.slice(0, 8))
}

export {
  normalizeDeckTitle,
  listUserCards,
  countUserCards,
  listCardsByDeckTitle,
  listDueCards,
  createCard,
  updateCard,
  deleteCard,
  deleteDeckByTitle,
  computeDecksFromCards,
  extractFiltersFromDecks
}


