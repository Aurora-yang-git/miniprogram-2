import { ensureUserStats } from './userStats'

const BJ_OFFSET_MS = 8 * 60 * 60 * 1000
const LOGGED_KEYS_STORAGE = 'review_event_logged_keys_v1'

function bjYmd(ts = Date.now()) {
  return new Date(Number(ts) + BJ_OFFSET_MS).toISOString().slice(0, 10)
}

function addDaysYmd(ymd, deltaDays) {
  const parts = String(ymd || '').split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3) return ''
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  const t = Date.UTC(y, m - 1, d) + Number(deltaDays || 0) * 24 * 60 * 60 * 1000
  return new Date(t).toISOString().slice(0, 10)
}

function bjDayOfWeek(now = Date.now()) {
  // 0 (Sun) - 6 (Sat), aligned to Beijing time
  return new Date(Number(now) + BJ_OFFSET_MS).getUTCDay()
}

function readLoggedKeys() {
  try {
    const v = wx.getStorageSync && wx.getStorageSync(LOGGED_KEYS_STORAGE)
    if (Array.isArray(v)) return v
    if (typeof v === 'string') {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    }
    return []
  } catch (e) {
    return []
  }
}

function writeLoggedKeys(keys) {
  try {
    wx.setStorageSync && wx.setStorageSync(LOGGED_KEYS_STORAGE, Array.isArray(keys) ? keys : [])
  } catch (e) {
    // ignore
  }
}

function makeEventKey({ cardId, result, attemptTs }) {
  const id = typeof cardId === 'string' ? cardId.trim() : ''
  const r = typeof result === 'string' ? result.trim() : ''
  const ts = typeof attemptTs === 'number' ? attemptTs : 0
  return `${id}|${r}|${ts}`
}

async function recordReviewEvent({ cardId, result, attemptTs }) {
  const id = typeof cardId === 'string' ? cardId.trim() : ''
  const ts = typeof attemptTs === 'number' ? attemptTs : 0
  if (!id || !ts) return

  const key = makeEventKey({ cardId: id, result, attemptTs: ts })
  const logged = readLoggedKeys()
  if (logged.includes(key)) return

  if (!wx.cloud || !wx.cloud.database) return

  try {
    const stats = await ensureUserStats()
    const statsId = stats && typeof stats._id === 'string' ? stats._id : ''
    if (!statsId) return

    const db = wx.cloud.database()
    const _ = db.command
    const day = bjYmd(ts)

    await db.collection('user_stats').doc(statsId).update({
      data: {
        [`activityDaily.${day}`]: _.inc(1),
        activityUpdatedAt: db.serverDate()
      }
    })

    writeLoggedKeys(logged.concat([key]).slice(-500))
  } catch (e) {
    console.error('recordReviewEvent failed', e)
  }
}

async function getWeekMonthStats() {
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const fallback = {
    weekTotal: 0,
    monthTotal: 0,
    weeklyDays: weekLabels,
    weeklyCounts: [0, 0, 0, 0, 0, 0, 0],
    weeklyHeights: [0, 0, 0, 0, 0, 0, 0],
    todayIndex: 6
  }

  if (!wx.cloud || !wx.cloud.database) return fallback

  try {
    const stats = await ensureUserStats()
    const activityDaily = stats && stats.activityDaily && typeof stats.activityDaily === 'object'
      ? stats.activityDaily
      : {}

    const now = Date.now()
    const today = bjYmd(now)
    // Reconcile: cloud function already tracks studiedToday for "today",
    // but activityDaily starts counting from when we introduced logging.
    // To avoid Goals showing week/month as 0 while today has progress,
    // ensure activityDaily[today] >= studiedToday when lastStudyDate is today.
    const lastStudyDate = stats && typeof stats.lastStudyDate === 'string' ? stats.lastStudyDate : ''
    const studiedToday = lastStudyDate === today
      ? (stats && typeof stats.studiedToday === 'number' ? stats.studiedToday : 0)
      : 0
    const existingToday = today in (activityDaily || {}) ? Number(activityDaily[today]) : 0
    if (studiedToday > (Number.isFinite(existingToday) ? existingToday : 0)) {
      try {
        const statsId = stats && typeof stats._id === 'string' ? stats._id : ''
        if (statsId) {
          const db = wx.cloud.database()
          await db.collection('user_stats').doc(statsId).update({
            data: {
              [`activityDaily.${today}`]: studiedToday,
              activityUpdatedAt: db.serverDate()
            }
          })
        }
      } catch (e) {
        // ignore sync failure
      }
      activityDaily[today] = studiedToday
    }

    const dow = bjDayOfWeek(now) // 0-6 (Sun-Sat)
    const daysSinceMonday = (dow + 6) % 7
    const monday = addDaysYmd(today, -daysSinceMonday)
    const weekYmds = Array.from({ length: 7 }).map((_, i) => addDaysYmd(monday, i))

    const weeklyCounts = weekYmds.map((d) => {
      const n = activityDaily && d in activityDaily ? Number(activityDaily[d]) : 0
      return Number.isFinite(n) ? n : 0
    })
    const weekTotal = weeklyCounts.reduce((a, b) => a + b, 0)

    const monthPrefix = today.slice(0, 7)
    const monthTotal = Object.keys(activityDaily || {})
      .filter((k) => String(k).startsWith(monthPrefix))
      .reduce((sum, k) => {
        const n = Number(activityDaily[k])
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0)

    const max = Math.max(0, ...weeklyCounts)
    const weeklyHeights = weeklyCounts.map((c) => (max ? Math.round((c / max) * 100) : 0))
    const todayIndex = Math.min(6, Math.max(0, daysSinceMonday))

    return {
      weekTotal,
      monthTotal,
      weeklyDays: weekLabels,
      weeklyCounts,
      weeklyHeights,
      todayIndex
    }
  } catch (e) {
    console.error('getWeekMonthStats failed', e)
    return fallback
  }
}

export { recordReviewEvent, getWeekMonthStats }


