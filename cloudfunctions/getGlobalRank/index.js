const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { ok: false, error: 'missing OPENID' }

    const statsCol = db.collection('user_stats')

    // top 50
    const topRes = await statsCol.orderBy('xp', 'desc').limit(50).get()
    const topRaw = topRes && Array.isArray(topRes.data) ? topRes.data : []
    const top = topRaw.map((u) => ({
      openid: u._openid || '',
      xp: typeof u.xp === 'number' ? u.xp : 0,
      nickname: typeof u.nickname === 'string' && u.nickname ? u.nickname : '微信用户',
      avatarUrl: typeof u.avatarUrl === 'string' ? u.avatarUrl : ''
    }))

    // me
    const meRes = await statsCol.where({ _openid: OPENID }).limit(1).get()
    const meRaw = meRes && Array.isArray(meRes.data) && meRes.data[0] ? meRes.data[0] : null
    const myXp = meRaw && typeof meRaw.xp === 'number' ? meRaw.xp : 0
    const myNickname = meRaw && typeof meRaw.nickname === 'string' && meRaw.nickname ? meRaw.nickname : '我'
    const myAvatarUrl = meRaw && typeof meRaw.avatarUrl === 'string' ? meRaw.avatarUrl : ''

    // rank = count(xp > myXp) + 1
    const _ = db.command
    const rankRes = await statsCol.where({ xp: _.gt(myXp) }).count()
    const rank = (rankRes && typeof rankRes.total === 'number' ? rankRes.total : 0) + 1

    const totalRes = await statsCol.count()
    const totalUsers = totalRes && typeof totalRes.total === 'number' ? totalRes.total : 0

    return {
      ok: true,
      top,
      me: { openid: OPENID, xp: myXp, nickname: myNickname, avatarUrl: myAvatarUrl, rank },
      totalUsers
    }
  } catch (err) {
    console.error('getGlobalRank failed', err)
    return { ok: false, error: err && err.message ? err.message : String(err), top: [], me: null, totalUsers: 0 }
  }
}


