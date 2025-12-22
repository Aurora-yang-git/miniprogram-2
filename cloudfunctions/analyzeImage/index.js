const https = require('https')

let cloud = null
try {
  cloud = require('wx-server-sdk')
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
} catch (err) {
  cloud = null
}

const codeVersion = 'analyzeImage-2025-12-21-timeoutms'

function getImageMimeType(fileID) {
  const lower = String(fileID || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/png'
}

async function resolveImageUrl(cloudSdk, fileID) {
  return resolveImageDataUrl(cloudSdk, fileID)
}

async function resolveImageDataUrl(cloudSdk, fileID) {
  const downloadRes = await cloudSdk.downloadFile({ fileID })
  const buf = downloadRes && downloadRes.fileContent
  if (!buf) {
    throw new Error('downloadFile failed')
  }

  const mime = getImageMimeType(fileID)
  const imageUrl = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  return { url: imageUrl, source: 'dataURL' }
}

function isUnsupportedImageUrlError(err) {
  const msg = err && err.message ? String(err.message) : ''
  return err && err.statusCode === 400 && msg.indexOf('unsupported image url') !== -1
}

function moonshotChatCompletions(apiKey, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = https.request(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          let json = null
          try {
            json = raw ? JSON.parse(raw) : null
          } catch (e) {
            reject(new Error('moonshot response JSON parse failed'))
            return
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const msg =
              (json && json.error && json.error.message) ||
              `moonshot http ${res.statusCode || 'unknown'}`
            const err = new Error(msg)
            err.statusCode = res.statusCode
            err.response = json
            reject(err)
            return
          }

          resolve(json)
        })
      }
    )

    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`moonshot request timeout (${timeoutMs}ms)`))
    })
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const fileID = event && event.fileID
  if (!fileID) {
    return { ok: false, error: 'missing fileID', codeVersion }
  }

  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'missing MOONSHOT_API_KEY', codeVersion }
  }

  if (!cloud) {
    return {
      ok: false,
      error: 'wx-server-sdk missing (redeploy analyzeImage with dependencies)',
      codeVersion
    }
  }

  let imageSource = ''
  let usedFallback = false
  try {
    const model =
      event && typeof event.model === 'string' && event.model.trim()
        ? event.model.trim()
        : 'moonshot-v1-8k-vision-preview'
    const prompt =
      event && typeof event.prompt === 'string' && event.prompt.trim()
        ? event.prompt.trim()
        : '请把图片中的文字完整提取出来，按行输出；只输出识别到的文字，不要解释。'

    const resolved = await resolveImageUrl(cloud, fileID)
    let imageUrl = resolved && resolved.url ? resolved.url : ''
    imageSource = resolved && resolved.source ? resolved.source : ''
    if (!imageUrl) {
      return { ok: false, error: 'resolve image url failed', codeVersion }
    }

    const payload = {
      model,
      messages: [
        { role: 'system', content: '你是 Kimi。' },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      temperature: 0.3
    }

    let completion = null
    try {
      completion = await moonshotChatCompletions(apiKey, payload)
    } catch (err) {
      if (imageSource === 'tempFileURL' && isUnsupportedImageUrlError(err)) {
        usedFallback = true
        console.log('moonshot unsupported image url, fallback to dataURL')
        const dataResolved = await resolveImageDataUrl(cloud, fileID)
        imageUrl = dataResolved && dataResolved.url ? dataResolved.url : imageUrl
        imageSource = 'dataURL'
        payload.messages[1].content[0].image_url.url = imageUrl
        completion = await moonshotChatCompletions(apiKey, payload)
      } else {
        throw err
      }
    }
    const content =
      completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
    const text = typeof content === 'string' ? content.trim() : ''

    return {
      ok: true,
      text,
      model,
      imageSource,
      usedFallback,
      codeVersion,
      usage: completion && completion.usage ? completion.usage : null
    }
  } catch (err) {
    console.error('analyzeImage failed', err)
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
      imageSource,
      usedFallback,
      codeVersion
    }
  }
}
