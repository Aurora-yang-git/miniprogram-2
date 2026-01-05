/* eslint-disable no-console */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

console.log('cloud keys:', Object.keys(cloud))
console.log('cloud.extend exists:', Boolean(cloud.extend))
console.log('cloud.extend keys:', cloud.extend ? Object.keys(cloud.extend) : null)
console.log('cloud.extend.AI exists:', Boolean(cloud.extend && cloud.extend.AI))
console.log('cloud.extend.AI keys:', cloud.extend && cloud.extend.AI ? Object.keys(cloud.extend.AI) : null)


