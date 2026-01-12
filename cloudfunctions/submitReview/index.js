const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function beijingDateString(ts) {
  const offset = 8 * 60 * 60 * 1000
  return new Date(ts + offset).toISOString().slice(0, 10)
}

function calcSm2({ ef, interval, reps, quality }) {
  let nextEf = typeof ef === 'number' ? ef : 2.5
  let nextInterval = typeof interval === 'number' ? interval : 0
  let nextReps = typeof reps === 'number' ? reps : 0

  if (quality < 3) {
    nextReps = 0
    nextInterval = 1
  } else {
    if (nextReps === 0) nextInterval = 1
    else if (nextReps === 1) nextInterval = 6
    else nextInterval = Math.round(nextInterval * nextEf)

    nextReps += 1
  }

  nextEf = nextEf + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (nextEf < 1.3) nextEf = 1.3

  return {
    ef: nextEf,
    interval: nextInterval,
    reps: nextReps
  }
}

exports.main = async (event) => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(`[submitReview] ${ok} reqId=${reqId} durationMs=${durationMs}`)
    return { ...(payload || {}), reqId, durationMs }
  }

  try {
    const { OPENID } = cloud.getWXContext()
    const cardId = event && (event.cardId || event.id)
    const result = event && event.result
    const qualityInput = event && event.quality
    const attemptTs = event && typeof event.attemptTs === 'number' ? event.attemptTs : 0

    if (!OPENID) {
      return finish({ ok: false, error: 'missing OPENID' })
    }
    if (!cardId) {
      return finish({ ok: false, error: 'missing cardId' })
    }

    let quality = typeof qualityInput === 'number' ? qualityInput : null
    if (quality === null) {
      if (result === 'remember') quality = 5
      else if (result === 'forget') quality = 2
      else quality = 5
    }
    if (quality < 0) quality = 0
    if (quality > 5) quality = 5

    const now = Date.now()
    const today = beijingDateString(now)
    const yesterday = beijingDateString(now - 24 * 60 * 60 * 1000)

    const xpDelta = result === 'remember' ? 10 : 2

    const cardsCol = db.collection('cards')
    const statsCol = db.collection('user_stats')

    const reviewKey = attemptTs ? `${attemptTs}|${String(result || '')}` : ''

    // Parallelize reads (no transaction => no TransactionBusy).
    const [cardRes, statsRes] = await Promise.all([
      cardsCol
        .doc(String(cardId))
        .field({
          _openid: true,
          srsEF: true,
          srsInterval: true,
          srsReps: true,
          lastReviewKey: true,
          nextReviewAt: true,
          lastReviewedAt: true
        })
        .get(),
      statsCol
        .where({ _openid: OPENID })
        .field({
          xp: true,
          dailyXp: true,
          totalReviewed: true,
          streak: true,
          studiedToday: true,
          lastStudyDate: true,
          nickname: true,
          avatarUrl: true
        })
        .limit(1)
        .get()
    ])

    const card = cardRes && cardRes.data ? cardRes.data : null
    if (!card || card._openid !== OPENID) {
      return finish({ ok: false, error: 'card not found' })
    }

    const stats = statsRes && Array.isArray(statsRes.data) ? statsRes.data[0] : null

    // Idempotency for client retry: if same attemptTs+result already applied, don't award XP again.
    const lastKey = card && typeof card.lastReviewKey === 'string' ? card.lastReviewKey : ''
    if (reviewKey && lastKey && lastKey === reviewKey) {
      const prevXp = stats && typeof stats.xp === 'number' ? stats.xp : 0
      const prevDailyXp = stats && typeof stats.dailyXp === 'number' ? stats.dailyXp : 0
      const prevTotalReviewed = stats && typeof stats.totalReviewed === 'number' ? stats.totalReviewed : 0
      const prevStreak = stats && typeof stats.streak === 'number' ? stats.streak : 0
      const prevStudiedToday = stats && typeof stats.studiedToday === 'number' ? stats.studiedToday : 0
      return finish({
        ok: true,
        cardId,
        existed: true,
        result: typeof result === 'string' ? result : '',
        quality,
        nextReviewAt: typeof card.nextReviewAt === 'number' ? card.nextReviewAt : 0,
        srsEF: typeof card.srsEF === 'number' ? card.srsEF : 2.5,
        srsInterval: typeof card.srsInterval === 'number' ? card.srsInterval : 0,
        srsReps: typeof card.srsReps === 'number' ? card.srsReps : 0,
        xpDelta: 0,
        xp: prevXp,
        dailyXp: prevDailyXp,
        streak: prevStreak,
        studiedToday: prevStudiedToday,
        totalReviewed: prevTotalReviewed
      })
    }

    const ef = typeof card.srsEF === 'number' ? card.srsEF : 2.5
    const interval = typeof card.srsInterval === 'number' ? card.srsInterval : 0
    const reps = typeof card.srsReps === 'number' ? card.srsReps : 0

    const next = calcSm2({ ef, interval, reps, quality })
    const nextReviewAt = now + next.interval * 24 * 60 * 60 * 1000

    const prevXp = stats && typeof stats.xp === 'number' ? stats.xp : 0
    const prevDailyXp = stats && typeof stats.dailyXp === 'number' ? stats.dailyXp : 0
    const prevTotalReviewed = stats && typeof stats.totalReviewed === 'number' ? stats.totalReviewed : 0
    const prevStreak = stats && typeof stats.streak === 'number' ? stats.streak : 0
    const prevStudiedToday = stats && typeof stats.studiedToday === 'number' ? stats.studiedToday : 0
    const lastStudyDate = stats && typeof stats.lastStudyDate === 'string' ? stats.lastStudyDate : ''

    let streak = prevStreak
    let studiedToday = prevStudiedToday

    let dailyXp = prevDailyXp
    let totalReviewed = prevTotalReviewed

    if (lastStudyDate === today) {
      studiedToday += 1
      dailyXp += xpDelta
    } else {
      studiedToday = 1
      streak = lastStudyDate === yesterday ? prevStreak + 1 : 1
      dailyXp = xpDelta
    }
    totalReviewed += 1

    if (streak < 0) streak = 0
    if (studiedToday < 0) studiedToday = 0
    if (dailyXp < 0) dailyXp = 0
    if (totalReviewed < 0) totalReviewed = 0

    const xp = prevXp + xpDelta
    const updatedAt = db.serverDate()

    const cardUpdate = cardsCol.doc(String(cardId)).update({
      data: {
        srsEF: next.ef,
        srsInterval: next.interval,
        srsReps: next.reps,
        lastReviewedAt: now,
        nextReviewAt,
        ...(reviewKey ? { lastReviewKey: reviewKey } : {}),
        updatedAt
      }
    })

    let statsWrite = null
    if (stats && stats._id) {
      statsWrite = statsCol.doc(String(stats._id)).update({
        data: {
          xp,
          dailyXp,
          streak,
          studiedToday,
          totalReviewed,
          lastStudyDate: today,
          updatedAt
        }
      })
    } else {
      const createdAt = db.serverDate()
      statsWrite = statsCol.add({
        data: {
          xp,
          dailyXp,
          streak,
          studiedToday,
          totalReviewed,
          lastStudyDate: today,
          createdAt,
          updatedAt
        }
      })
    }

    await Promise.all([cardUpdate, statsWrite])

    return finish({
      ok: true,
      cardId,
      result: typeof result === 'string' ? result : '',
      quality,
      existed: false,
      nextReviewAt,
      srsEF: next.ef,
      srsInterval: next.interval,
      srsReps: next.reps,
      xpDelta,
      xp,
      dailyXp,
      streak,
      studiedToday,
      totalReviewed
    })
  } catch (err) {
    console.error('submitReview failed', err)
    return finish({ ok: false, error: err && err.message ? err.message : String(err) })
  }
}
