import { getOpenid } from './auth'
import { callOkFunction } from './cloud'

function getExt(path) {
  const m = String(path || '').match(/\.(\w+)$/)
  return m ? m[1].toLowerCase() : 'jpg'
}

async function uploadImage(localPath) {
  if (!wx.cloud || !wx.cloud.uploadFile) {
    throw new Error('wx.cloud.uploadFile unavailable')
  }
  const openid = await getOpenid()
  const ext = getExt(localPath)
  const cloudPath = `ocr/${openid}/${Date.now()}.${ext}`
  const res = await wx.cloud.uploadFile({ cloudPath, filePath: localPath })
  const fileID = res && res.fileID ? res.fileID : ''
  if (!fileID) throw new Error('uploadFile failed')
  return fileID
}

function normalizeOcrText(rawText) {
  let text = String(rawText || '')
  text = text.replace(/\r\n/g, '\n').trim()
  if (text.startsWith('```')) {
    const firstLf = text.indexOf('\n')
    text = firstLf >= 0 ? text.slice(firstLf + 1) : ''
  }
  text = text.trim()
  if (text.endsWith('```')) {
    text = text.slice(0, -3)
  }
  text = text.replace(/```/g, '')
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}

async function analyzeImage(fileID) {
  const ret = await callOkFunction('analyzeImage', { fileID })
  const text = normalizeOcrText(ret && ret.text ? ret.text : '')
  return { text, raw: ret }
}

export { uploadImage, analyzeImage, normalizeOcrText }




