const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const CODE_VERSION = 'leaderboardWorker-2026-01-08-v1'
const BUCKET_RANKS = [100, 500, 1000, 5000]

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function asString(v) {
  return v == null ? '' : String(v)
}

function normalizeUser(doc) {
  return {
    openid: doc && doc._openid ? String(doc._openid) : '',
    xp: doc && typeof doc.xp === 'number' ? doc.xp : 0,
    nickname: doc && typeof doc.nickname === 'string' && doc.nickname ? doc.nickname : '微信用户',
    avatarUrl: doc && typeof doc.avatarUrl === 'string' ? doc.avatarUrl : ''
  }
}

function isCollectionNotExistError(err) {
  const msg = err && err.message ? String(err.message) : ''
  const code = err && err.errCode ? String(err.errCode) : ''
  return code === 'DATABASE_COLLECTION_NOT_EXIST' || msg.includes('DATABASE_COLLECTION_NOT_EXIST')
}

async function getXpAtRank(statsCol, rank) {
  if (!rank || rank < 1) return null
  try {
    const res = await statsCol.orderBy('xp', 'desc').skip(rank - 1).limit(1).field({ xp: true }).get()
    const doc = res && Array.isArray(res.data) && res.data[0] ? res.data[0] : null
    return doc && typeof doc.xp === 'number' ? doc.xp : null
  } catch (e) {
    return null
  }
}

exports.main = async (event) => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const action = event && event.action ? String(event.action) : ''
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(
      `[leaderboardWorker] ${ok}`,
      JSON.stringify({ reqId, durationMs, action: action || 'timer', codeVersion: CODE_VERSION }, null, 0)
    )
    return { ...(payload || {}), reqId, durationMs }
  }

  try {
    const statsCol = db.collection('user_stats')
    const cacheCol = db.collection('leaderboard_cache')

    const [topRes, totalRes] = await Promise.all([
      statsCol.orderBy('xp', 'desc').limit(50).get(),
      statsCol.count()
    ])

    const topRaw = topRes && Array.isArray(topRes.data) ? topRes.data : []
    const top = topRaw.map(normalizeUser)
    const totalUsers = totalRes && typeof totalRes.total === 'number' ? totalRes.total : 0

    const ranks = BUCKET_RANKS.filter((r) => r > 0 && r <= totalUsers)
    const xps = await Promise.all(ranks.map((r) => getXpAtRank(statsCol, r)))
    const xpBuckets = ranks.map((r, idx) => ({ rank: r, xp: xps[idx] }))

    const snapshot = {
      schemaVersion: 1,
      updatedAt: db.serverDate(),
      totalUsers,
      top,
      xpBuckets
    }

    await cacheCol.doc('latest').set({ data: snapshot })

    return finish({
      ok: true,
      codeVersion: CODE_VERSION,
      action: action || 'timer',
      totalUsers,
      topCount: top.length,
      xpBuckets
    })
  } catch (err) {
    console.error('[leaderboardWorker] failed', err)
    if (isCollectionNotExistError(err)) {
      return finish({
        ok: false,
        error: 'DATABASE_COLLECTION_NOT_EXIST: 请先在云数据库创建 leaderboard_cache 集合（用于排行榜缓存）',
        codeVersion: CODE_VERSION
      })
    }
    return finish({ ok: false, error: err && err.message ? err.message : String(err), codeVersion: CODE_VERSION })
  }
}

