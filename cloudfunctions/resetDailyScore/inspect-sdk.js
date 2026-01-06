const cloud = require('wx-server-sdk')

console.log('wx-server-sdk keys:', Object.keys(cloud))
console.log('has extend:', Object.prototype.hasOwnProperty.call(cloud, 'extend'), 'type:', typeof cloud.extend)
console.log('has openapi:', Object.prototype.hasOwnProperty.call(cloud, 'openapi'), 'type:', typeof cloud.openapi)
try {
  console.log('openapi keys:', Object.keys(cloud.openapi || {}).slice(0, 50))
} catch (e) {
  console.log('openapi keys: <error>', e && e.message ? e.message : String(e))
}

try {
  const inst = typeof cloud.createNewInstance === 'function' ? cloud.createNewInstance({ env: cloud.DYNAMIC_CURRENT_ENV }) : null
  console.log('createNewInstance type:', typeof inst)
  console.log('instance keys:', inst ? Object.keys(inst) : null)
  console.log('instance has extend:', inst ? Object.prototype.hasOwnProperty.call(inst, 'extend') : null, 'type:', inst ? typeof inst.extend : null)
} catch (e) {
  console.log('createNewInstance error:', e && e.message ? e.message : String(e))
}


