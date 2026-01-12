const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function asNumber(v, def = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : def
}

function asString(v) {
  return v == null ? '' : String(v)
}

function normalizeUser(u) {
  return {
    openid: u && u._openid ? String(u._openid) : '',
    xp: u && typeof u.xp === 'number' ? u.xp : 0,
    nickname: u && typeof u.nickname === 'string' && u.nickname ? u.nickname : '微信用户',
    avatarUrl: u && typeof u.avatarUrl === 'string' ? u.avatarUrl : ''
  }
}

function buildRankApprox({ myXp, topN, totalUsers, xpBuckets }) {
  const total = asNumber(totalUsers, 0)
  const minRankBase = Math.max(1, Math.trunc(topN) + 1)
  if (!Number.isFinite(myXp)) return null
  if (!total || total < minRankBase) return null

  const buckets = Array.isArray(xpBuckets)
    ? xpBuckets
        .map((b) => ({
          rank: Math.trunc(asNumber(b && b.rank, 0)),
          xp: b && typeof b.xp === 'number' ? b.xp : Number.NaN
        }))
        .filter((b) => b.rank > 0 && b.rank >= minRankBase && Number.isFinite(b.xp))
        .sort((a, b) => a.rank - b.rank)
    : []

  let prevRank = minRankBase - 1
  for (const b of buckets) {
    if (b.rank > total) continue
    if (myXp >= b.xp) {
      const min = Math.max(minRankBase, prevRank + 1)
      const max = Math.max(min, b.rank)
      return { min, max }
    }
    prevRank = b.rank
  }

  const min = Math.max(minRankBase, prevRank + 1)
  const max = Math.max(min, total)
  return { min, max }
}

exports.main = async () => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(`[getGlobalRank] ${ok} reqId=${reqId} durationMs=${durationMs}`)
    return { ...(payload || {}), reqId, durationMs }
  }
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return finish({ ok: false, error: 'missing OPENID' })

    const statsCol = db.collection('user_stats')
    const cacheCol = db.collection('leaderboard_cache')

    const [snapRes, meRes] = await Promise.all([
      cacheCol.doc('latest').get().catch(() => null),
      statsCol.where({ _openid: OPENID }).field({ xp: true, nickname: true, avatarUrl: true }).limit(1).get()
    ])

    const snap = snapRes && snapRes.data ? snapRes.data : null
    const topRaw = snap && Array.isArray(snap.top) ? snap.top : null
    const top = Array.isArray(topRaw)
      ? topRaw.map((u) => ({
          openid: asString(u && (u.openid || u._openid)).trim(),
          xp: asNumber(u && u.xp, 0),
          nickname: asString(u && u.nickname).trim() || '微信用户',
          avatarUrl: asString(u && u.avatarUrl).trim()
        }))
      : []

    const meRaw = meRes && Array.isArray(meRes.data) && meRes.data[0] ? meRes.data[0] : null
    const myXp = meRaw && typeof meRaw.xp === 'number' ? meRaw.xp : 0
    const myNickname = meRaw && typeof meRaw.nickname === 'string' && meRaw.nickname ? meRaw.nickname : '我'
    const myAvatarUrl = meRaw && typeof meRaw.avatarUrl === 'string' ? meRaw.avatarUrl : ''

    // Fast path: snapshot available -> exact rank for top50, otherwise approximate range.
    if (snap && Array.isArray(topRaw) && typeof snap.totalUsers !== 'undefined') {
      const totalUsers = asNumber(snap.totalUsers, 0)
      const topN = top.length
      const idx = top.findIndex((u) => u && u.openid === OPENID)
      if (idx >= 0) {
        const rank = idx + 1
        return finish({
          ok: true,
          source: 'cache',
          top,
          me: {
            openid: OPENID,
            xp: myXp,
            nickname: myNickname,
            avatarUrl: myAvatarUrl,
            rank,
            rankApprox: false,
            rankRange: null,
            rankText: String(rank)
          },
          totalUsers
        })
      }

      const rankRange = buildRankApprox({ myXp, topN, totalUsers, xpBuckets: snap.xpBuckets })
      const rankText = rankRange ? `${rankRange.min}-${rankRange.max}` : '-'
      return finish({
        ok: true,
        source: 'cache',
        top,
        me: {
          openid: OPENID,
          xp: myXp,
          nickname: myNickname,
          avatarUrl: myAvatarUrl,
          rank: null,
          rankApprox: Boolean(rankRange),
          rankRange: rankRange || null,
          rankText
        },
        totalUsers
      })
    }

    // Degraded but functional fallback if snapshot missing/unavailable.
    const topRes = await statsCol.orderBy('xp', 'desc').limit(50).get()
    const topRaw2 = topRes && Array.isArray(topRes.data) ? topRes.data : []
    const top2 = topRaw2.map(normalizeUser)
    const idx2 = top2.findIndex((u) => u && u.openid === OPENID)
    const rank2 = idx2 >= 0 ? idx2 + 1 : null

    return finish({
      ok: true,
      source: 'degraded',
      top: top2,
      me: {
        openid: OPENID,
        xp: myXp,
        nickname: myNickname,
        avatarUrl: myAvatarUrl,
        rank: rank2,
        rankApprox: false,
        rankRange: null,
        rankText: rank2 ? String(rank2) : '-'
      },
      totalUsers: 0
    })
  } catch (err) {
    console.error('getGlobalRank failed', err)
    return finish({
      ok: false,
      error: err && err.message ? err.message : String(err),
      top: [],
      me: null,
      totalUsers: 0
    })
  }
}


