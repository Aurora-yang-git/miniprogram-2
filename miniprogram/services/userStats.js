import { flashcardCollections } from '../utils/flashcard-config'
import { getOpenid } from './auth'

function beijingDateString(ts) {
  const offset = 8 * 60 * 60 * 1000
  return new Date(ts + offset).toISOString().slice(0, 10)
}

function getDb() {
  if (!wx.cloud || !wx.cloud.database) {
    throw new Error('wx.cloud.database unavailable')
  }
  return wx.cloud.database()
}

async function ensureUserStats() {
  const openid = await getOpenid()
  const db = getDb()
  const col = db.collection(flashcardCollections.userStats)
  const res = await col.where({ _openid: openid }).limit(1).get()
  const current = res && Array.isArray(res.data) && res.data[0] ? res.data[0] : null
  if (current) return current

  const createdAt = db.serverDate()
  const base = {
    xp: 0,
    dailyXp: 0,
    streak: 0,
    studiedToday: 0,
    lastStudyDate: '',
    totalReviewed: 0,
    dailyGoal: 20,
    createdAt,
    updatedAt: createdAt
  }
  const addRes = await col.add({ data: base })
  return { ...base, _id: addRes && addRes._id ? addRes._id : '' }
}

async function loadMyStats() {
  const stats = await ensureUserStats()
  const now = Date.now()
  const today = beijingDateString(now)
  const lastStudyDate = stats && typeof stats.lastStudyDate === 'string' ? stats.lastStudyDate : ''
  const cardsStudiedToday = lastStudyDate === today
    ? (stats && typeof stats.studiedToday === 'number' ? stats.studiedToday : 0)
    : 0
  const dailyGoal = stats && typeof stats.dailyGoal === 'number' && stats.dailyGoal > 0 ? stats.dailyGoal : 20
  const streak = stats && typeof stats.streak === 'number' ? stats.streak : 0
  const xp = stats && typeof stats.xp === 'number' ? stats.xp : 0
  return { stats, cardsStudiedToday, dailyGoal, streak, xp }
}

async function updateDailyGoal(goal) {
  const g = Number(goal)
  if (!Number.isFinite(g) || g <= 0) throw new Error('invalid goal')
  const stats = await ensureUserStats()
  const id = stats && stats._id ? stats._id : ''
  if (!id) return
  const db = getDb()
  await db.collection(flashcardCollections.userStats).doc(id).update({
    data: { dailyGoal: g, updatedAt: db.serverDate() }
  })
}

async function updateProfile({ nickname, avatarUrl }) {
  const stats = await ensureUserStats()
  const id = stats && stats._id ? stats._id : ''
  if (!id) return
  const db = getDb()
  await db.collection(flashcardCollections.userStats).doc(id).update({
    data: {
      nickname: typeof nickname === 'string' ? nickname : '',
      avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : '',
      updatedAt: db.serverDate()
    }
  })
}

export { ensureUserStats, loadMyStats, updateDailyGoal, updateProfile }



