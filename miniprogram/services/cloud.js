function callFunction(name, data) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('wx.cloud.callFunction unavailable'))
      return
    }
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
}

function getResult(res) {
  return res && res.result ? res.result : null
}

async function callOkFunction(name, data) {
  const res = await callFunction(name, data)
  const ret = getResult(res)
  if (!ret || ret.ok !== true) {
    const msg = (ret && ret.error) || `${name} failed`
    const err = new Error(msg)
    err.result = ret
    throw err
  }
  return ret
}

export { callFunction, callOkFunction, getResult }




