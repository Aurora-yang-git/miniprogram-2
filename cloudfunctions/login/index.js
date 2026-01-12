const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

exports.main = async () => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(`[login] ${ok} reqId=${reqId} durationMs=${durationMs}`)
    return { ...(payload || {}), reqId, durationMs }
  }
  try {
    const wxContext = cloud.getWXContext()
    return finish({
      ok: true,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID
    })
  } catch (err) {
    console.error('[login] failed', err)
    return finish({
      ok: false,
      error: err && err.message ? err.message : String(err)
    })
  }
}
