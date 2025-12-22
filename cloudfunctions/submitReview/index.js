const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

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
  try {
    const { OPENID } = cloud.getWXContext()
    const cardId = event && (event.cardId || event.id)
    const result = event && event.result
    const qualityInput = event && event.quality

    if (!OPENID) {
      return { ok: false, error: 'missing OPENID' }
    }
    if (!cardId) {
      return { ok: false, error: 'missing cardId' }
    }

    let quality = typeof qualityInput === 'number' ? qualityInput : null
    if (quality === null) {
      if (result === 'remember') quality = 5
      else if (result === 'forget') quality = 2
      else quality = 5
    }
    if (quality < 0) quality = 0
    if (quality > 5) quality = 5

    const cardsCol = db.collection('cards')
    let card = null
    try {
      const docRes = await cardsCol.doc(cardId).get()
      card = docRes && docRes.data ? docRes.data : null
    } catch (e) {
      card = null
    }
    if (!card || card._openid !== OPENID) {
      return { ok: false, error: 'card not found' }
    }

    const ef = typeof card.srsEF === 'number' ? card.srsEF : 2.5
    const interval = typeof card.srsInterval === 'number' ? card.srsInterval : 0
    const reps = typeof card.srsReps === 'number' ? card.srsReps : 0

    const now = Date.now()
    const next = calcSm2({ ef, interval, reps, quality })
    const nextReviewAt = now + next.interval * 24 * 60 * 60 * 1000

    await cardsCol.doc(cardId).update({
      data: {
        srsEF: next.ef,
        srsInterval: next.interval,
        srsReps: next.reps,
        lastReviewedAt: now,
        nextReviewAt,
        updatedAt: db.serverDate()
      }
    })

    const statsCol = db.collection('user_stats')
    const statsRes = await statsCol.where({ _openid: OPENID }).limit(1).get()
    const stats = statsRes && Array.isArray(statsRes.data) ? statsRes.data[0] : null

    const today = beijingDateString(now)
    const yesterday = beijingDateString(now - 24 * 60 * 60 * 1000)

    const prevXp = stats && typeof stats.xp === 'number' ? stats.xp : 0
    const prevStreak = stats && typeof stats.streak === 'number' ? stats.streak : 0
    const prevStudiedToday = stats && typeof stats.studiedToday === 'number' ? stats.studiedToday : 0
    const lastStudyDate = stats && typeof stats.lastStudyDate === 'string' ? stats.lastStudyDate : ''

    const xpDelta = result === 'remember' ? 10 : 2

    let streak = prevStreak
    let studiedToday = prevStudiedToday

    if (lastStudyDate === today) {
      studiedToday += 1
    } else {
      studiedToday = 1
      streak = lastStudyDate === yesterday ? prevStreak + 1 : 1
    }

    const xp = prevXp + xpDelta
    const updatedAt = db.serverDate()

    if (stats && stats._id) {
      await statsCol.doc(stats._id).update({
        data: {
          xp,
          streak,
          studiedToday,
          lastStudyDate: today,
          updatedAt
        }
      })
    } else {
      const createdAt = db.serverDate()
      await statsCol.add({
        data: {
          xp,
          streak,
          studiedToday,
          lastStudyDate: today,
          createdAt,
          updatedAt
        }
      })
    }

    return {
      ok: true,
      cardId,
      result: typeof result === 'string' ? result : '',
      quality,
      nextReviewAt,
      srsEF: next.ef,
      srsInterval: next.interval,
      srsReps: next.reps,
      xpDelta,
      xp,
      streak,
      studiedToday
    }
  } catch (err) {
    console.error('submitReview failed', err)
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    }
  }
}
