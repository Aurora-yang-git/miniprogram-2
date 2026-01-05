import { callFunction, getResult } from './cloud'

let cachedOpenid = ''

async function getOpenid(force = false) {
  if (!force && cachedOpenid) return cachedOpenid

  const res = await callFunction('login', {})
  const ret = getResult(res)
  const openid = ret && ret.openid ? ret.openid : ''
  if (!openid) throw new Error('login no openid')
  cachedOpenid = openid
  return openid
}

function clearAuthCache() {
  cachedOpenid = ''
}

export { getOpenid, clearAuthCache }




