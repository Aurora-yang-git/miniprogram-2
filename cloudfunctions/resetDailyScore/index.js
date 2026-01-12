const https = require('https')

const KEEP_ALIVE_AGENT = new https.Agent({ keepAlive: true, maxSockets: 32 })

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const CODE_VERSION = 'createJobsWorker-2026-01-07-v2'
const WORKER_STATUS_DOC_ID = '__worker_status__'

// Prompt registry must live inside this cloudfunction directory so it can be packaged & deployed.
// (Cloudfunctions are uploaded per-folder; they cannot import miniprogram files.)
const promptRegistry = require('./prompt_registry.json')

function asString(v) {
  return v == null ? '' : String(v)
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fillTemplate(template, vars) {
  let out = asString(template)
  const v = vars && typeof vars === 'object' ? vars : {}
  Object.keys(v).forEach((key) => {
    const val = v[key] == null ? '' : String(v[key])
    out = out.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g'), val)
  })
  return out
}

function nowMs() {
  return Date.now()
}

function toMs(v) {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : 0
  }
  // cloud db may return { $date: ... }
  if (typeof v === 'object' && v.$date) {
    const t = Date.parse(v.$date)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function truncateText(s, maxLen) {
  const str = asString(s)
  if (!maxLen || maxLen <= 0) return str
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '\n\n[TRUNCATED]'
}

async function setWorkerStatus(patch) {
  const base = {
    status: 'system',
    phase: 'system',
    codeVersion: CODE_VERSION,
    updatedAt: db.serverDate()
  }
  const data = { ...base, ...(patch && typeof patch === 'object' ? patch : {}) }
  try {
    await db.collection('create_jobs').doc(WORKER_STATUS_DOC_ID).set({ data })
  } catch (e) {
    // ignore (create_jobs may not exist or permission issues)
  }
}

function extractJsonCandidate(rawText) {
  const raw = asString(rawText).trim()
  const noFence = raw.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim()

  let jsonText = noFence
  const firstArr = noFence.indexOf('[')
  const lastArr = noFence.lastIndexOf(']')
  if (firstArr >= 0 && lastArr > firstArr) {
    jsonText = noFence.slice(firstArr, lastArr + 1)
    return jsonText
  }

  const firstObj = noFence.indexOf('{')
  const lastObj = noFence.lastIndexOf('}')
  if (firstObj >= 0 && lastObj > firstObj) {
    jsonText = noFence.slice(firstObj, lastObj + 1)
  }
  return jsonText
}

function safeJsonParse(rawText) {
  const jsonText = extractJsonCandidate(rawText)
  try {
    return JSON.parse(jsonText)
  } catch (e) {
    return null
  }
}

function normalizeStringArray(val) {
  if (!Array.isArray(val)) return []
  return val.map((x) => String(x == null ? '' : x).trim()).filter(Boolean)
}

function normalizeStringArrayDedup(val, maxLen = 30) {
  const list = normalizeStringArray(val)
  const out = []
  const seen = new Set()
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i]
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= maxLen) break
  }
  return out
}

function pickCandidateTag(candidates, proposed) {
  const list = normalizeStringArrayDedup(candidates, 50)
  if (!list.length) return ''
  const p = asString(proposed).trim()
  if (!p) return list[0]
  if (list.includes(p)) return p

  // case-insensitive exact match
  const lower = p.toLowerCase()
  const ci = list.find((x) => x.toLowerCase() === lower)
  if (ci) return ci

  // substring match (either direction)
  const sub = list.find((x) => x.toLowerCase().includes(lower) || lower.includes(x.toLowerCase()))
  if (sub) return sub

  return list[0]
}

function stripOcrHeaders(text) {
  const raw = asString(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^【图片\d+】$/.test(l))
    .join('\n')
    .trim()
}

function hashSeed(str) {
  const s = asString(str)
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleDeterministic(arr, seedStr) {
  const list = Array.isArray(arr) ? arr.slice() : []
  const rand = mulberry32(hashSeed(seedStr))
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = list[i]
    list[i] = list[j]
    list[j] = tmp
  }
  return list
}

function parseColonPairs(text) {
  const raw = stripOcrHeaders(text)
  if (!raw) return []
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const out = []
  lines.forEach((line) => {
    const pickSep = () => {
      const col = line.indexOf('：') >= 0 ? line.indexOf('：') : line.indexOf(':')
      if (col > 0) return { idx: col, len: 1 }
      const seps = [' - ', ' – ', ' — ', '—', '–', '-']
      for (let i = 0; i < seps.length; i += 1) {
        const sep = seps[i]
        const j = line.indexOf(sep)
        if (j > 0) return { idx: j, len: sep.length }
      }
      return null
    }

    const found = pickSep()
    if (!found || found.idx <= 0) return
    const left = line.slice(0, found.idx).trim()
    const right = line.slice(found.idx + found.len).trim()
    if (!left || !right) return
    out.push({ question: left, answer: right, hint: '' })
  })
  return out
}

function parseTermTableByTopic(text) {
  const raw = stripOcrHeaders(text)
  if (!raw) return []
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const out = []

  const isTopicLine = (l) => l.includes('｜') || l.includes('|')
  const extractTopic = (l) => {
    const s = String(l || '').trim()
    const parts = s.split('｜')
    if (parts.length >= 2) return parts.slice(1).join('｜').trim()
    const parts2 = s.split('|')
    if (parts2.length >= 2) return parts2.slice(1).join('|').trim()
    return s
  }

  const isHeader = (l) => {
    const s = String(l || '').trim().toLowerCase()
    return s === 'term' || s === '中文' || s === '意思' || s === '例子'
  }

  const triple = (cn, meaning, example) => `**中文**：${cn}\n**意思**：${meaning}\n**例子**：${example}`.trim()

  let topic = ''
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isTopicLine(line)) {
      topic = extractTopic(line)
      i += 1
      // swallow common headers (Term/中文/意思/例子)
      while (i < lines.length && isHeader(lines[i])) i += 1
      continue
    }
    if (isHeader(line)) {
      i += 1
      continue
    }
    const term = line
    const cn = lines[i + 1]
    const meaning = lines[i + 2]
    const example = lines[i + 3]
    if (!term || !cn || !meaning || !example) break
    out.push({
      question: term,
      answer: triple(cn, meaning, example),
      hint: '',
      topic: topic || ''
    })
    i += 4
  }

  return out
}

function splitChineseSentences(text) {
  const raw = stripOcrHeaders(text)
  if (!raw) return []
  // Prefer newline as sentence boundary if present.
  const hasNewline = raw.includes('\n')
  // For Chinese recite, commas often separate 上句/下句 (e.g. 古诗词：A，B。)
  const src = hasNewline ? raw : raw.replace(/([。！？；，])/g, '$1\n')
  return src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.length >= 2)
}

function buildChineseReciteClozeCards(text, { seed, bidirectional = true } = {}) {
  const sentences = splitChineseSentences(text)
  if (sentences.length < 2) return []
  const cards = []
  for (let i = 0; i < sentences.length - 1; i += 1) {
    const a = sentences[i]
    const b = sentences[i + 1]
    // fill next
    cards.push({
      question: `上句：${a}\n下句：____`,
      answer: b,
      hint: '',
      topic: ''
    })
    if (bidirectional) {
      cards.push({
        question: `上句：____\n下句：${b}`,
        answer: a,
        hint: '',
        topic: ''
      })
    }
  }
  return seed ? shuffleDeterministic(cards, seed) : cards
}

function normalizeCards(arr) {
  const list = Array.isArray(arr) ? arr : []
  return list
    .map((it) => {
      const qRaw = it && (it.question ?? it.q)
      const aRaw = it && (it.answer ?? it.a)
      const hRaw = it && (it.hint ?? it.h ?? it.tip ?? it.tips)
      const question = qRaw == null ? '' : String(qRaw).trim()
      const answer = Array.isArray(aRaw)
        ? aRaw.map((x) => (x == null ? '' : String(x).trim())).filter(Boolean).join('\n')
        : (aRaw == null ? '' : String(aRaw).trim())
      const hint = hRaw == null ? '' : String(hRaw).trim()
      const tagsRaw = it && (it.tags ?? it.tagList)
      const cardTags = Array.isArray(tagsRaw)
        ? tagsRaw.map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 10)
        : []
      const topicRaw = it && (it.topic ?? it.section ?? it.theme)
      const topic = typeof topicRaw === 'string' ? topicRaw.trim() : ''
      return { question, answer, hint, cardTags, topic }
    })
    .filter((it) => it.question && it.answer)
}

function parseCardsFromModelOutput(rawText) {
  const parsed = safeJsonParse(rawText)
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.cards) ? parsed.cards : [])
  return normalizeCards(arr)
}

function extractCompletionText(completion) {
  const content =
    completion &&
    completion.choices &&
    completion.choices[0] &&
    completion.choices[0].message &&
    completion.choices[0].message.content
  return typeof content === 'string' ? content.trim() : ''
}

async function runChatCompletions({ provider, apiKey, model, system, user, timeoutMs = 90000 }) {
  const payload = {
    model,
    messages: [
      { role: 'system', content: asString(system) },
      { role: 'user', content: asString(user) }
    ],
    temperature: 0.2
  }

  const completion =
    provider === 'deepseek'
      ? await deepseekChatCompletions(apiKey, payload, timeoutMs)
      : await moonshotChatCompletions(apiKey, payload, timeoutMs)

  return extractCompletionText(completion)
}

function getPromptLayer(id) {
  const layers = promptRegistry && promptRegistry.layers ? promptRegistry.layers : {}
  const layer = layers && layers[id] ? layers[id] : null
  return layer && typeof layer === 'object' ? layer : null
}

async function generateCardsByRegistry({ provider, apiKey, model, rawText, knowledge }) {
  const text = truncateText(asString(rawText).trim(), 12000)
  if (!text) throw new Error('empty rawText')

  const userKnowledge = asString(knowledge).trim() || '无'

  const L1 = getPromptLayer('L1_deepseek_analyze_decompose')
  const L2 = getPromptLayer('L2_deepseek_generate_cards')
  if (!L1 || !L2) {
    throw new Error('prompt_registry missing L1/L2')
  }

  const l1User = fillTemplate(L1.user_template, {
    raw_text: text,
    visual_elements: JSON.stringify([], null, 2),
    layout_notes: JSON.stringify([], null, 2),
    user_prompt: userKnowledge
  })
  const l1Raw = await runChatCompletions({
    provider,
    apiKey,
    model,
    system: asString(L1.system),
    user: l1User,
    timeoutMs: 90000
  })
  const l1Parsed = safeJsonParse(l1Raw) || {}
  let corePoints = normalizeStringArray(l1Parsed && l1Parsed.core_points)
  let questionPoints = normalizeStringArray(l1Parsed && l1Parsed.question_points)
  if (!corePoints.length && !questionPoints.length) {
    corePoints = [text.slice(0, 4000)]
    questionPoints = []
  }

  const l2User = fillTemplate(L2.user_template, {
    core_points: JSON.stringify(corePoints, null, 2),
    question_points: JSON.stringify(questionPoints, null, 2),
    learning_style: userKnowledge
  })
  const l2Raw = await runChatCompletions({
    provider,
    apiKey,
    model,
    system: asString(L2.system),
    user: l2User,
    timeoutMs: 90000
  })

  return {
    provider,
    model,
    raw: l2Raw
  }
}

function httpJsonPost(url, headers, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const u = new URL(url)
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        protocol: u.protocol,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        agent: KEEP_ALIVE_AGENT,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(headers || {})
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
            reject(new Error('response JSON parse failed'))
            return
          }
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const msg =
              (json && json.error && json.error.message) ||
              (json && json.message) ||
              `http ${res.statusCode || 'unknown'}`
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
      req.destroy(new Error(`request timeout (${timeoutMs}ms)`))
    })
    req.write(body)
    req.end()
  })
}

function isRetryableError(err) {
  const msg = err && err.message ? String(err.message) : ''
  const code = err && err.errCode ? String(err.errCode) : ''
  const statusRaw = err && typeof err.statusCode !== 'undefined' ? err.statusCode : null
  const status = typeof statusRaw === 'number' ? statusRaw : Number(statusRaw)

  // HTTP: rate limit / transient server errors
  if (Number.isFinite(status)) {
    if (status === 408 || status === 409 || status === 425 || status === 429) return true
    if (status >= 500 && status < 600) return true
  }

  // CloudBase transient
  if (code === 'DATABASE_TRANSACTION_FAIL') return true
  if (msg.includes('TransactionBusy')) return true
  if (msg.includes('ResourceUnavailable')) return true

  // Network / timeout
  if (msg.includes('timeout')) return true
  if (msg.includes('ECONNRESET')) return true
  if (msg.includes('ETIMEDOUT')) return true
  if (msg.includes('EAI_AGAIN')) return true
  if (msg.includes('ENOTFOUND')) return true
  if (msg.includes('socket hang up')) return true

  return false
}

function computeRetryDelayMs(retryCount) {
  const n = typeof retryCount === 'number' && retryCount > 0 ? Math.min(20, Math.trunc(retryCount)) : 0
  const base = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, n))
  const jitter = Math.floor(Math.random() * 400)
  return Math.max(500, base) + jitter
}

async function deepseekChatCompletions(apiKey, payload, timeoutMs = 60000) {
  const url = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions'
  return await httpJsonPost(
    url,
    {
      Authorization: `Bearer ${apiKey}`
    },
    payload,
    timeoutMs
  )
}

async function moonshotChatCompletions(apiKey, payload, timeoutMs = 60000) {
  return await httpJsonPost(
    'https://api.moonshot.cn/v1/chat/completions',
    {
      Authorization: `Bearer ${apiKey}`
    },
    payload,
    timeoutMs
  )
}

async function generateCardsWithAvailableModel({ rawText, knowledge, deckTitle }) {
  const text = truncateText(asString(rawText).trim(), 12000)
  if (!text) throw new Error('empty rawText')

  const userKnowledge = asString(knowledge).trim()
  const title = asString(deckTitle).trim()

  const deepseekKey = process.env.DEEPSEEK_API_KEY
  const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

  const moonshotKey = process.env.MOONSHOT_API_KEY
  const moonshotModel = process.env.MOONSHOT_TEXT_MODEL || 'moonshot-v1-8k'

  // Prefer DeepSeek if configured, otherwise fallback to Moonshot.
  if (deepseekKey) {
    try {
      return await generateCardsByRegistry({
        provider: 'deepseek',
        apiKey: deepseekKey,
        model: deepseekModel,
        rawText: text,
        knowledge: userKnowledge || title || ''
      })
    } catch (err) {
      if (!moonshotKey) throw err
      // fallback: still try to finish the job with Moonshot if DeepSeek fails
      return await generateCardsByRegistry({
        provider: 'moonshot',
        apiKey: moonshotKey,
        model: moonshotModel,
        rawText: text,
        knowledge: userKnowledge || title || ''
      })
    }
  }

  if (moonshotKey) {
    return await generateCardsByRegistry({
      provider: 'moonshot',
      apiKey: moonshotKey,
      model: moonshotModel,
      rawText: text,
      knowledge: userKnowledge || title || ''
    })
  }

  throw new Error('no AI provider configured (need DEEPSEEK_API_KEY; optional fallback MOONSHOT_API_KEY)')
}

async function callAnalyzeImage(fileID) {
  // IMPORTANT:
  // Calling another cloudfunction from within a cloudfunction can timeout much earlier
  // than the function's configured timeout (nested callFunction).
  // We therefore perform OCR in-process: downloadFile -> Moonshot vision.

  const fileId = String(fileID || '').trim()
  if (!fileId) return ''

  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) {
    throw new Error('missing MOONSHOT_API_KEY')
  }

  const visionModel = process.env.MOONSHOT_VISION_MODEL || 'moonshot-v1-8k-vision-preview'
  const prompt = [
    '你是专业 OCR 文字提取器。',
    '任务：从图片中“逐行”提取全部可见文字，保持原始排版（换行、空行、编号、表格结构尽量保留）。',
    '',
    '输出要求（非常重要）：',
    '1) 只输出识别到的原文，不要解释、不要总结、不要添加任何额外内容。',
    '2) 保留原有的换行、列表编号、项目符号、括号、单位、上下标符号（如 ^ _ ）等。',
    '3) 如果出现公式，请尽量按原样抄写；无法确定的字符用 ? 占位，但不要省略整行。',
    '4) 不要输出 Markdown 代码块围栏（不要出现 ``` ）。',
    '5) 如果图片为空或无法识别，只输出空字符串。',
    '6) 对于无法转文字的图像内容，请用简短文字描述（例如“表格/图形/流程图”等）。'
  ].join('\n')

  function getImageMimeType(fid) {
    const lower = String(fid || '').toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg'
    if (lower.endsWith('.bmp')) return 'image/bmp'
    return 'image/png'
  }

  async function resolveImageDataUrl(fid) {
    const downloadRes = await cloud.downloadFile({ fileID: fid })
    const buf = downloadRes && downloadRes.fileContent
    if (!buf) {
      throw new Error('downloadFile failed')
    }
    const mime = getImageMimeType(fid)
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  }

  function isUnsupportedImageUrlError(err) {
    const msg = err && err.message ? String(err.message) : ''
    return err && err.statusCode === 400 && msg.indexOf('unsupported image url') !== -1
  }

  async function resolveTempFileUrl(fid) {
    try {
      const tmp = await cloud.getTempFileURL({ fileList: [fid] })
      const list = tmp && Array.isArray(tmp.fileList) ? tmp.fileList : []
      const first = list && list[0] ? list[0] : null
      const url = first && first.tempFileURL ? String(first.tempFileURL) : ''
      return url
    } catch (e) {
      return ''
    }
  }

  function normalizeOcrText(rawText) {
    let text = asString(rawText)
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

  let imageSource = 'dataURL'
  let imageUrl = await resolveTempFileUrl(fileId)
  if (imageUrl) {
    imageSource = 'tempFileURL'
  } else {
    imageUrl = await resolveImageDataUrl(fileId)
    imageSource = 'dataURL'
  }
  const payload = {
    model: visionModel,
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

  // Keep below cloudfunction timeout, but high enough for vision models.
  const ocrTimeoutMs = Math.max(1000, Math.min(55000, Number(process.env.MOONSHOT_OCR_TIMEOUT_MS) || 50000))
  let completion = null
  try {
    completion = await moonshotChatCompletions(apiKey, payload, ocrTimeoutMs)
  } catch (err) {
    if (imageSource === 'tempFileURL' && isUnsupportedImageUrlError(err)) {
      const dataUrl = await resolveImageDataUrl(fileId)
      payload.messages[1].content[0].image_url.url = dataUrl
      completion = await moonshotChatCompletions(apiKey, payload, ocrTimeoutMs)
    } else {
      throw err
    }
  }
  const text = extractCompletionText(completion)
  return normalizeOcrText(text)
}

async function updateJob(jobId, patch) {
  if (!jobId) return
  const data = {
    ...patch,
    updatedAt: db.serverDate()
  }
  await db.collection('create_jobs').doc(String(jobId)).update({ data })
}

async function lockJob(jobId) {
  // Use a simple transaction-based lock to avoid concurrent workers.
  const leaseMs = 2 * 60 * 1000
  const lockId = `${nowMs()}_${Math.random().toString(16).slice(2)}`

  const ret = await db.runTransaction(async (tx) => {
    const got = await tx.collection('create_jobs').doc(String(jobId)).get()
    const job = got && got.data ? got.data : null
    if (!job) throw new Error('job not found')

    const status = asString(job.status || 'queued')
    const updatedAtMs = toMs(job.updatedAt)
    if (status === 'done' || status === 'failed') {
      return { ok: false, reason: 'terminal', job }
    }
    if (status === 'running' && updatedAtMs && nowMs() - updatedAtMs < leaseMs) {
      return { ok: false, reason: 'locked', job }
    }

    await tx.collection('create_jobs').doc(String(jobId)).update({
      data: {
        status: 'running',
        lockId,
        updatedAt: db.serverDate()
      }
    })
    return { ok: true, job: { ...job, lockId } }
  })

  return ret
}

async function processCreateJob(jobId) {
  if (!jobId) throw new Error('missing jobId')

  // If invoked by a user (callFunction), ensure they can only process their own job.
  // Timer-trigger invocations typically don't carry OPENID, so we only enforce when present.
  let callerOpenid = ''
  try {
    const ctx = cloud.getWXContext ? cloud.getWXContext() : null
    callerOpenid = ctx && ctx.OPENID ? String(ctx.OPENID) : ''
  } catch (e) {
    callerOpenid = ''
  }
  if (callerOpenid) {
    let preJob = null
    try {
      const pre = await db.collection('create_jobs').doc(String(jobId)).get()
      preJob = pre && pre.data ? pre.data : null
    } catch (e) {
      preJob = null
    }
    const owner = asString(preJob && preJob._openid).trim()
    if (!owner) return { ok: false, error: 'job not found' }
    if (owner !== callerOpenid) return { ok: false, error: 'permission denied' }
  }

  const locked = await lockJob(jobId)
  if (!locked || locked.ok !== true) {
    return { ok: true, skipped: true, reason: locked && locked.reason ? locked.reason : 'unknown' }
  }
  const job = locked.job || {}

  const ownerOpenid = asString(job._openid).trim()
  if (!ownerOpenid) {
    await updateJob(jobId, { status: 'failed', phase: 'failed', error: 'missing job _openid' })
    return { ok: false, error: 'missing job _openid' }
  }

  const deckTitle = asString(job.deckTitle).trim() || 'Inbox'
  const mode = job.mode === 'text' ? 'text' : 'images'
  const knowledge = asString(job.knowledge).trim()

  try {
    // === Time-slicing strategy ===
    // Each invocation only does a small step (OCR 1 image OR L1 OR L2 OR write a small batch),
    // then sets status back to queued so the next timer trigger continues.

    const ids = mode === 'images'
      ? (Array.isArray(job.imageFileIDs) ? job.imageFileIDs.filter(Boolean).slice(0, 9) : [])
      : []
    const ocrTotal = ids.length
    const ocrDone = typeof job.ocrDone === 'number' ? Math.max(0, job.ocrDone) : 0

    // 1) OCR step: do exactly ONE image per run.
    if (mode === 'images') {
      if (!ocrTotal) throw new Error('missing imageFileIDs')
      if (ocrDone < ocrTotal) {
        const idx = ocrDone
        const fileID = String(ids[idx])

        await updateJob(jobId, {
          phase: 'ocr',
          ocrTotal,
          ocrDone: idx,
          error: ''
        })

        const text = await callAnalyzeImage(fileID)
        const block = text ? `【图片${idx + 1}】\n${text}` : `【图片${idx + 1}】`
        const prev = asString(job.rawText).trim()
        const merged = prev ? `${prev}\n\n${block}` : block
        const nextRaw = truncateText(merged, 30000)

        const nextDone = idx + 1
        const nextPhase = nextDone >= ocrTotal ? 'generate' : 'ocr'
        await updateJob(jobId, {
          status: 'queued',
          phase: nextPhase,
          rawText: nextRaw,
          ocrTotal,
          ocrDone: nextDone,
          error: ''
        })
        return { ok: true, jobId: String(jobId), phase: nextPhase, ocrDone: nextDone, ocrTotal }
      }
    }

    // 2) Determine rawText (text mode OR images mode after OCR completed)
    const rawText = asString(job.rawText).trim()
    if (!rawText) {
      throw new Error(mode === 'images' ? 'OCR result empty' : 'missing rawText')
    }

    // 3) Generate step (Classify -> L1 -> L2) - one API call per run.
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    const moonshotKey = process.env.MOONSHOT_API_KEY
    const moonshotModel = process.env.MOONSHOT_TEXT_MODEL || 'moonshot-v1-8k'

    const primary = deepseekKey
      ? { provider: 'deepseek', apiKey: deepseekKey, model: deepseekModel }
      : (moonshotKey ? { provider: 'moonshot', apiKey: moonshotKey, model: moonshotModel } : null)
    const fallback = deepseekKey && moonshotKey
      ? { provider: 'moonshot', apiKey: moonshotKey, model: moonshotModel }
      : null

    if (!primary) {
      throw new Error('no AI provider configured (need DEEPSEEK_API_KEY; optional fallback MOONSHOT_API_KEY)')
    }

    // 3.0) Classify input type + subjectTag (run once; store into job)
    const contentTypeStored = asString(job.contentType).trim()
    const subjectTagStored = asString(job.subjectTag).trim()
    const subjectCandidates = normalizeStringArrayDedup(job.subjectCandidates, 30)

    if (!contentTypeStored || !subjectTagStored) {
      const L0 = getPromptLayer('L0_input_classify')
      if (!L0) throw new Error('prompt_registry missing L0_input_classify')

      const l0User = fillTemplate(L0.user_template, {
        deck_title: deckTitle,
        subject_candidates: JSON.stringify(subjectCandidates, null, 0),
        raw_text: truncateText(rawText, 6000)
      })

      let l0Raw = ''
      let used = primary
      try {
        l0Raw = await runChatCompletions({
          ...primary,
          system: asString(L0.system),
          user: l0User,
          timeoutMs: 45000
        })
      } catch (e) {
        if (!fallback) throw e
        used = fallback
        l0Raw = await runChatCompletions({
          ...fallback,
          system: asString(L0.system),
          user: l0User,
          timeoutMs: 45000
        })
      }

      const parsed = safeJsonParse(l0Raw) || {}
      const ct = asString(parsed && parsed.contentType).trim()
      const st = asString(parsed && parsed.subjectTag).trim()
      const confRaw = parsed && parsed.confidence
      const conf = typeof confRaw === 'number' ? confRaw : Number(confRaw)

      const allowed = new Set(['vocab', 'recite', 'concept', 'notes'])
      const nextContentType = allowed.has(ct) ? ct : 'notes'

      // Respect user-provided subjectTag; otherwise prefer candidate list; otherwise use AI guess.
      let nextSubjectTag = subjectTagStored
      if (!nextSubjectTag) {
        nextSubjectTag = subjectCandidates.length ? pickCandidateTag(subjectCandidates, st) : (st || 'General')
      }

      await updateJob(jobId, {
        status: 'queued',
        phase: 'generate',
        contentType: nextContentType,
        subjectTag: nextSubjectTag,
        subjectCandidates,
        classifierConfidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : null,
        modelProvider: used.provider,
        modelName: used.model,
        error: ''
      })
      return { ok: true, jobId: String(jobId), phase: 'generate', step: 'classify', contentType: nextContentType }
    }

    const generatedCards = Array.isArray(job.generatedCards) ? job.generatedCards : []
    if (!generatedCards.length) {
      // 3.A) Original-text flows: vocab / concept / recite
      const contentType = contentTypeStored
      const subjectTag = subjectTagStored
      const seed = `${String(jobId)}|${deckTitle}|${contentType}|${subjectTag}`

      if (contentType === 'concept') {
        // Prefer Term/中文/意思/例子 tables; fallback to colon pairs.
        const tableCards = parseTermTableByTopic(rawText)
        const colonCards = tableCards.length ? [] : parseColonPairs(rawText)
        const cards = (tableCards.length ? tableCards : colonCards).map((c) => ({
          question: c.question,
          answer: c.answer,
          hint: c.hint || '',
          topic: c.topic || ''
        }))
        if (cards.length) {
          const shuffled = shuffleDeterministic(cards, seed)
          await updateJob(jobId, {
            status: 'queued',
            phase: 'write',
            generatedCards: shuffled,
            writeDone: 0,
            writeTotal: shuffled.length,
            resultCount: shuffled.length,
            error: ''
          })
          return { ok: true, jobId: String(jobId), phase: 'write', step: 'parse_concept', resultCount: shuffled.length }
        }
        // If parsing failed, fallback to notes pipeline.
      } else if (contentType === 'vocab') {
        const pairs = parseColonPairs(rawText)
        if (pairs.length) {
          const shuffled = shuffleDeterministic(pairs, seed)
          await updateJob(jobId, {
            status: 'queued',
            phase: 'write',
            generatedCards: shuffled,
            writeDone: 0,
            writeTotal: shuffled.length,
            resultCount: shuffled.length,
            error: ''
          })
          return { ok: true, jobId: String(jobId), phase: 'write', step: 'parse_vocab', resultCount: shuffled.length }
        }
        // If parsing failed, fallback to notes pipeline.
      } else if (contentType === 'recite') {
        const isChinese = /chinese|语文/i.test(subjectTag)
        const cards = buildChineseReciteClozeCards(rawText, { seed, bidirectional: true })
        if (cards.length) {
          await updateJob(jobId, {
            status: 'queued',
            phase: 'write',
            generatedCards: cards,
            writeDone: 0,
            writeTotal: cards.length,
            resultCount: cards.length,
            error: ''
          })
          return { ok: true, jobId: String(jobId), phase: 'write', step: isChinese ? 'recite_chinese' : 'recite_generic', resultCount: cards.length }
        }
        // If parsing failed, fallback to notes pipeline.
      }

      const corePointsStored = normalizeStringArray(job.analysisCorePoints)
      const questionPointsStored = normalizeStringArray(job.analysisQuestionPoints)

      // 3.1) L1
      if (!corePointsStored.length && !questionPointsStored.length) {
        const L1 = getPromptLayer('L1_deepseek_analyze_decompose')
        if (!L1) throw new Error('prompt_registry missing L1')

        const l1User = fillTemplate(L1.user_template, {
          raw_text: truncateText(rawText, 12000),
          visual_elements: JSON.stringify([], null, 2),
          layout_notes: JSON.stringify([], null, 2),
          user_prompt: knowledge || '无'
        })

        let l1Raw = ''
        let used = primary
        try {
          l1Raw = await runChatCompletions({
            ...primary,
            system: asString(L1.system),
            user: l1User,
            timeoutMs: 45000
          })
        } catch (e) {
          if (!fallback) throw e
          used = fallback
          l1Raw = await runChatCompletions({
            ...fallback,
            system: asString(L1.system),
            user: l1User,
            timeoutMs: 45000
          })
        }

        const l1Parsed = safeJsonParse(l1Raw) || {}
        let corePoints = normalizeStringArray(l1Parsed && l1Parsed.core_points)
        let questionPoints = normalizeStringArray(l1Parsed && l1Parsed.question_points)
        const prerequisites = normalizeStringArray(l1Parsed && l1Parsed.prerequisites)
        if (!corePoints.length && !questionPoints.length) {
          corePoints = [truncateText(rawText, 4000)]
          questionPoints = []
        }

        await updateJob(jobId, {
          status: 'queued',
          phase: 'generate',
          analysisCorePoints: corePoints,
          analysisQuestionPoints: questionPoints,
          analysisPrerequisites: prerequisites,
          modelProvider: used.provider,
          modelName: used.model,
          error: ''
        })
        return { ok: true, jobId: String(jobId), phase: 'generate', step: 'L1' }
      }

      // 3.2) L2
      const L2 = getPromptLayer('L2_deepseek_generate_cards')
      if (!L2) throw new Error('prompt_registry missing L2')
      const l2User = fillTemplate(L2.user_template, {
        core_points: JSON.stringify(corePointsStored, null, 2),
        question_points: JSON.stringify(questionPointsStored, null, 2),
        learning_style: knowledge || '无'
      })

      let l2Raw = ''
      let used = primary
      try {
        l2Raw = await runChatCompletions({
          ...primary,
          system: asString(L2.system),
          user: l2User,
          timeoutMs: 45000
        })
      } catch (e) {
        if (!fallback) throw e
        used = fallback
        l2Raw = await runChatCompletions({
          ...fallback,
          system: asString(L2.system),
          user: l2User,
          timeoutMs: 45000
        })
      }

      const cards = parseCardsFromModelOutput(l2Raw)
      if (!cards.length) {
        throw new Error('AI generated no cards (invalid JSON output)')
      }

      await updateJob(jobId, {
        status: 'queued',
        phase: 'write',
        generatedCards: cards,
        writeDone: 0,
        writeTotal: cards.length,
        resultCount: cards.length,
        modelProvider: used.provider,
        modelName: used.model,
        error: ''
      })
      return { ok: true, jobId: String(jobId), phase: 'write', step: 'L2', resultCount: cards.length }
    }

    // 4) Write step - write a small batch per run.
    const cards = normalizeCards(generatedCards)
    if (!cards.length) throw new Error('missing generatedCards')

    // Idempotency: avoid duplicate writes on retries by checking existing indices.
    const existingRes = await db
      .collection('cards')
      .where({ _openid: ownerOpenid, createJobId: String(jobId) })
      .limit(100)
      .get()
    const existing = existingRes && Array.isArray(existingRes.data) ? existingRes.data : []
    const doneSet = new Set(
      existing
        .map((d) => (typeof d.jobCardIndex === 'number' ? d.jobCardIndex : null))
        .filter((x) => typeof x === 'number')
    )

    const WRITE_BATCH = Math.max(1, Math.min(10, Number(process.env.WORKER_WRITE_BATCH) || 8))
    let wroteNow = 0
    for (let i = 0; i < cards.length; i += 1) {
      if (wroteNow >= WRITE_BATCH) break
      if (doneSet.has(i)) continue

      const c = cards[i]
      const hint = c && typeof c.hint === 'string' ? c.hint.trim() : ''
      const subjectTag = asString(job.subjectTag).trim() || 'General'
      const cardTags = Array.isArray(c && c.cardTags) ? c.cardTags : []
      const topic = (c && typeof c.topic === 'string' ? c.topic.trim() : '') || (cardTags.length ? String(cardTags[0] || '').trim() : '')
      const data = {
        _openid: ownerOpenid,
        deckTitle,
        question: String(c.question).trim(),
        answer: asString(c && c.answer).trim(),
        ...(hint ? { hint } : {}),
        tags: [subjectTag],
        ...(topic ? { topic } : {}),
        ...(cardTags && cardTags.length ? { cardTags: cardTags.slice(0, 10) } : {}),
        createJobId: String(jobId),
        jobCardIndex: i,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      // eslint-disable-next-line no-await-in-loop
      await db.collection('cards').add({ data })
      doneSet.add(i)
      wroteNow += 1
    }

    const doneCount = doneSet.size
    const isDone = doneCount >= cards.length
    await updateJob(jobId, {
      status: isDone ? 'done' : 'queued',
      phase: isDone ? 'done' : 'write',
      writeDone: doneCount,
      writeTotal: cards.length,
      resultCount: cards.length,
      error: ''
    })

    return isDone
      ? { ok: true, jobId: String(jobId), resultCount: cards.length }
      : { ok: true, jobId: String(jobId), phase: 'write', writeDone: doneCount, writeTotal: cards.length }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    const retryCount = typeof job.retryCount === 'number' ? Math.max(0, Math.trunc(job.retryCount)) : 0
    const maxRetry = Math.max(0, Math.min(20, Number(process.env.WORKER_MAX_RETRY) || 6))
    if (retryCount < maxRetry && isRetryableError(err)) {
      const delayMs = computeRetryDelayMs(retryCount)
      const retryAt = nowMs() + delayMs
      await updateJob(jobId, {
        status: 'queued',
        retryAt,
        retryCount: retryCount + 1,
        error: msg
      })
      return { ok: true, queued: true, jobId: String(jobId), retryAt, retryCount: retryCount + 1, error: msg }
    }

    await updateJob(jobId, { status: 'failed', phase: 'failed', error: msg })
    return { ok: false, error: msg, jobId: String(jobId) }
  }
}

async function pickOneQueuedJob() {
  const now = nowMs()
  const res = await db
    .collection('create_jobs')
    .where({ status: _.in(['queued']) })
    // Use updatedAt to avoid one big job starving others when we time-slice.
    .orderBy('updatedAt', 'asc')
    .limit(10)
    .get()
  const list = res && Array.isArray(res.data) ? res.data : []
  for (let i = 0; i < list.length; i += 1) {
    const job = list[i]
    const retryAt = job && typeof job.retryAt === 'number' ? job.retryAt : 0
    if (retryAt && retryAt > now) continue
    return job
  }
  return null
}

async function processQueuedJobs() {
  const job = await pickOneQueuedJob()
  if (!job) {
    console.log(`[${CODE_VERSION}] tick: no queued jobs`)
    return { ok: true, processed: 0, codeVersion: CODE_VERSION }
  }
  const id = job && job._id ? String(job._id) : ''
  if (!id) {
    console.log(`[${CODE_VERSION}] tick: picked job missing _id`)
    return { ok: true, processed: 0, codeVersion: CODE_VERSION }
  }
  console.log(
    `[${CODE_VERSION}] tick: picked job`,
    JSON.stringify(
      {
        jobId: id,
        status: asString(job.status),
        phase: asString(job.phase),
        mode: asString(job.mode),
        ocrDone: typeof job.ocrDone === 'number' ? job.ocrDone : null,
        ocrTotal: typeof job.ocrTotal === 'number' ? job.ocrTotal : null,
        writeDone: typeof job.writeDone === 'number' ? job.writeDone : null,
        writeTotal: typeof job.writeTotal === 'number' ? job.writeTotal : null
      },
      null,
      0
    )
  )
  const ret = await processCreateJob(id)
  return { ok: true, processed: 1, ret, codeVersion: CODE_VERSION }
}

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

exports.main = async (event) => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    const action = event && event.action ? String(event.action) : ''
    console.log(
      `[${CODE_VERSION}] done`,
      JSON.stringify({ reqId, ok, durationMs, action: action || 'timer' }, null, 0)
    )
    return { ...(payload || {}), reqId, durationMs }
  }

  try {
    const action = event && event.action ? String(event.action) : ''
    let ctxOpenid = ''
    try {
      const ctx = cloud.getWXContext ? cloud.getWXContext() : null
      ctxOpenid = ctx && ctx.OPENID ? String(ctx.OPENID) : ''
    } catch (e) {
      ctxOpenid = ''
    }
    console.log(
      `[${CODE_VERSION}] invoked`,
      JSON.stringify({ reqId, action: action || 'timer', hasOpenid: Boolean(ctxOpenid) }, null, 0)
    )
    if (action === 'ping') {
      let queuedTotal = null
      try {
        const c = await db.collection('create_jobs').where({ status: 'queued' }).count()
        queuedTotal = c && typeof c.total === 'number' ? c.total : null
      } catch (e) {
        queuedTotal = null
      }

      let workerDoc = null
      try {
        const got = await db.collection('create_jobs').doc(WORKER_STATUS_DOC_ID).get()
        workerDoc = got && got.data ? got.data : null
      } catch (e) {
        workerDoc = null
      }

      return finish({
        ok: true,
        codeVersion: CODE_VERSION,
        serverTime: new Date().toISOString(),
        env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.ENV || '',
        hasDeepseekKey: Boolean(process.env.DEEPSEEK_API_KEY),
        hasMoonshotKey: Boolean(process.env.MOONSHOT_API_KEY),
        queuedTotal,
        worker: workerDoc
          ? {
              lastTimerAt: workerDoc.lastTimerAt || null,
              lastTimerAtMs: toMs(workerDoc.lastTimerAt),
              lastManualAt: workerDoc.lastManualAt || null,
              lastManualAtMs: toMs(workerDoc.lastManualAt),
              lastAction: asString(workerDoc.lastAction),
              lastError: asString(workerDoc.lastError)
            }
          : null
      })
    }

    // Write a heartbeat record into create_jobs so we can debug without Cloud Console.
    // - timer: lastTimerAt
    // - manual: lastManualAt
    if (action === '' || action === 'processCreateJob' || action === 'processQueuedJobs') {
      const isTimer = action === ''
      await setWorkerStatus({
        lastAction: action || 'timer',
        lastError: '',
        ...(isTimer ? { lastTimerAt: db.serverDate() } : { lastManualAt: db.serverDate() })
      })
    }
    if (action === 'processCreateJob') {
      const jobId = event && event.jobId ? String(event.jobId) : ''
      const ret = await processCreateJob(jobId)
      return finish({ ...ret, codeVersion: CODE_VERSION })
    }
    if (action === 'processQueuedJobs') {
      const ret = await processQueuedJobs()
      return finish(ret)
    }

    // Default: when invoked by timer trigger, process queued jobs.
    const ret = await processQueuedJobs()
    return finish(ret)
  } catch (err) {
    try {
      const action = event && event.action ? String(event.action) : ''
      if (action === '' || action === 'processCreateJob' || action === 'processQueuedJobs') {
        await setWorkerStatus({
          lastAction: action || 'timer',
          lastError: err && err.message ? String(err.message) : String(err),
          ...(action === '' ? { lastTimerAt: db.serverDate() } : { lastManualAt: db.serverDate() })
        })
      }
    } catch (e) {
      // ignore
    }
    return finish({ ok: false, error: err && err.message ? err.message : String(err), codeVersion: CODE_VERSION })
  }
}


