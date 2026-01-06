const https = require('https')

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const CODE_VERSION = 'createJobsWorker-2026-01-05-v1'

function asString(v) {
  return v == null ? '' : String(v)
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
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 5)
        : []
      return { question, answer, hint, tags }
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

  const system = [
    '你是一个学习卡片（Flashcard）生成器。',
    '你必须只输出 JSON，且必须是一个数组，每个元素包含：question(string), answer(string), tags(string[] 可选), hint(string 可选)。',
    '禁止输出除 JSON 之外的任何字符（不要 Markdown，不要解释）。',
    '问题要具体、可自测；答案要准确且尽量简洁。',
    '请生成大约 20 张卡片（内容少则减少）。'
  ].join('\n')

  const user = [
    title ? `Deck Title: ${title}` : '',
    userKnowledge ? `User Knowledge/Focus:\n${userKnowledge}` : '',
    'Source Text:',
    text
  ]
    .filter(Boolean)
    .join('\n\n')

  // Prefer DeepSeek if configured, otherwise fallback to Moonshot (already used by analyzeImage).
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    }
    const completion = await deepseekChatCompletions(deepseekKey, payload, 90000)
    const content =
      completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
    const out = typeof content === 'string' ? content.trim() : ''
    return { provider: 'deepseek', model, raw: out }
  }

  const moonshotKey = process.env.MOONSHOT_API_KEY
  if (moonshotKey) {
    const model = process.env.MOONSHOT_TEXT_MODEL || 'moonshot-v1-8k'
    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    }
    const completion = await moonshotChatCompletions(moonshotKey, payload, 90000)
    const content =
      completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
    const out = typeof content === 'string' ? content.trim() : ''
    return { provider: 'moonshot', model, raw: out }
  }

  throw new Error('no AI provider configured (need DEEPSEEK_API_KEY or MOONSHOT_API_KEY)')
}

async function callAnalyzeImage(fileID) {
  const res = await cloud.callFunction({
    name: 'analyzeImage',
    data: { fileID }
  })
  const ret = res && res.result ? res.result : null
  if (!ret || ret.ok !== true) {
    throw new Error((ret && ret.error) || 'analyzeImage failed')
  }
  const text = ret && typeof ret.text === 'string' ? ret.text.trim() : ''
  return text
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
    let rawText = ''

    if (mode === 'text') {
      rawText = asString(job.rawText).trim()
      if (!rawText) throw new Error('missing rawText')
      await updateJob(jobId, {
        phase: 'generate',
        ocrDone: 0,
        ocrTotal: 0
      })
    } else {
      const ids = Array.isArray(job.imageFileIDs) ? job.imageFileIDs.filter(Boolean).slice(0, 9) : []
      if (!ids.length) throw new Error('missing imageFileIDs')
      await updateJob(jobId, {
        phase: 'ocr',
        ocrDone: 0,
        ocrTotal: ids.length
      })

      const parts = []
      for (let i = 0; i < ids.length; i += 1) {
        const id = String(ids[i])
        // eslint-disable-next-line no-await-in-loop
        const text = await callAnalyzeImage(id)
        if (text) parts.push(text)
        // eslint-disable-next-line no-await-in-loop
        await updateJob(jobId, { ocrDone: i + 1 })
      }
      rawText = parts.join('\n\n').trim()
      if (!rawText) throw new Error('OCR result empty')

      await updateJob(jobId, {
        phase: 'generate'
      })
    }

    const gen = await generateCardsWithAvailableModel({ rawText, knowledge, deckTitle })
    const cards = parseCardsFromModelOutput(gen.raw)
    if (!cards.length) {
      throw new Error('AI generated no cards (invalid JSON output)')
    }

    await updateJob(jobId, {
      phase: 'write',
      writeDone: 0,
      writeTotal: cards.length,
      resultCount: cards.length,
      modelProvider: gen.provider,
      modelName: gen.model,
      error: ''
    })

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

    let written = 0
    for (let i = 0; i < cards.length; i += 1) {
      if (doneSet.has(i)) {
        written += 1
        // eslint-disable-next-line no-await-in-loop
        await updateJob(jobId, { writeDone: written })
        continue
      }
      const c = cards[i]
      const hint = c && typeof c.hint === 'string' ? c.hint.trim() : ''
      const answer = hint ? `${c.answer}\n\nHint: ${hint}` : c.answer
      const data = {
        _openid: ownerOpenid,
        deckTitle,
        question: String(c.question).trim(),
        answer: String(answer).trim(),
        tags: Array.isArray(c.tags) ? c.tags : [],
        createJobId: String(jobId),
        jobCardIndex: i,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      // eslint-disable-next-line no-await-in-loop
      await db.collection('cards').add({ data })
      written += 1
      // eslint-disable-next-line no-await-in-loop
      await updateJob(jobId, { writeDone: written })
    }

    await updateJob(jobId, { status: 'done', phase: 'done', error: '' })
    return { ok: true, jobId: String(jobId), resultCount: cards.length }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    await updateJob(jobId, { status: 'failed', phase: 'failed', error: msg })
    return { ok: false, error: msg, jobId: String(jobId) }
  }
}

async function pickOneQueuedJob() {
  const res = await db
    .collection('create_jobs')
    .where({ status: _.in(['queued']) })
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get()
  const list = res && Array.isArray(res.data) ? res.data : []
  return list.length ? list[0] : null
}

async function processQueuedJobs() {
  const job = await pickOneQueuedJob()
  if (!job) return { ok: true, processed: 0, codeVersion: CODE_VERSION }
  const id = job && job._id ? String(job._id) : ''
  if (!id) return { ok: true, processed: 0, codeVersion: CODE_VERSION }
  const ret = await processCreateJob(id)
  return { ok: true, processed: 1, ret, codeVersion: CODE_VERSION }
}

exports.main = async (event) => {
  try {
    const action = event && event.action ? String(event.action) : ''
    if (action === 'processCreateJob') {
      const jobId = event && event.jobId ? String(event.jobId) : ''
      const ret = await processCreateJob(jobId)
      return { ...ret, codeVersion: CODE_VERSION }
    }

    // Default: when invoked by timer trigger, process queued jobs.
    const ret = await processQueuedJobs()
    return ret
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err), codeVersion: CODE_VERSION }
  }
}


