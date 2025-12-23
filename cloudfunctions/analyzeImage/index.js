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
        : [
          '你是专业 OCR 文字提取器。',
          '任务：从图片中“逐行”提取全部可见文字，保持原始排版（换行、空行、编号、表格结构尽量保留）。',
          '',
          '输出要求（非常重要）：',
          '1) 只输出识别到的原文，不要解释、不要总结、不要添加任何额外内容。',
          '2) 保留原有的换行、列表编号、项目符号、括号、单位、上下标符号（如 ^ _ ）等。',
          '3) 如果出现公式，请尽量按原样抄写；无法确定的字符用 ? 占位，但不要省略整行。',
          '4) 不要输出 Markdown 代码块围栏（不要出现 ``` ）。',
          '5) 如果图片为空或无法识别，只输出空字符串。'，
          '6）详细描述无法转文字的图像'
        ].join('\n')

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
      temperature: 0.2
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
