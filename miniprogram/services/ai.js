const promptRegistry = require('../prompts/prompt_registry')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fillTemplate(template, vars) {
  let out = String(template || '')
  const v = vars && typeof vars === 'object' ? vars : {}
  Object.keys(v).forEach((key) => {
    const val = v[key] == null ? '' : String(v[key])
    out = out.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g'), val)
  })
  return out
}

function extractJsonCandidate(rawText) {
  const raw = String(rawText || '').trim()
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

function parseCardsFromDeepSeekOutput(rawText) {
  const parsed = safeJsonParse(rawText)
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.cards) ? parsed.cards : [])

  return arr
    .map((it) => {
      const qRaw = it && (it.question ?? it.q)
      const aRaw = it && (it.answer ?? it.a)
      const hRaw = it && (it.hint ?? it.h ?? it.tip ?? it.tips)
      const question = qRaw == null ? '' : String(qRaw).trim()
      const answer = Array.isArray(aRaw)
        ? aRaw.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).join('\n')
        : (aRaw == null ? '' : String(aRaw).trim())
      const hint = hRaw == null ? '' : String(hRaw).trim()
      const tagsRaw = it && (it.tags ?? it.tagList)
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.map((t) => String(t == null ? '' : t).trim()).filter(Boolean)
        : []
      return { question, answer, hint, tags }
    })
    .filter((it) => it.question && it.answer)
}

async function streamTextDeepSeek(systemPrompt, userInput) {
  if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI || !wx.cloud.extend.AI.createModel) {
    throw new Error('AI能力不可用')
  }
  const model = wx.cloud.extend.AI.createModel('deepseek')
  const res = await model.streamText({
    data: {
      model: 'deepseek-r1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: String(userInput || '').trim() }
      ]
    }
  })

  if (!res || !res.textStream || typeof res.textStream[Symbol.asyncIterator] !== 'function') {
    throw new Error('AI返回格式异常')
  }

  let out = ''
  // eslint-disable-next-line no-restricted-syntax
  for await (const str of res.textStream) {
    out += str
  }
  return String(out || '')
}

async function generateCardsByDeepSeek({ rawText, knowledge, learningStyle }) {
  const layers = promptRegistry && promptRegistry.layers ? promptRegistry.layers : {}
  const L1 = layers.L1_deepseek_analyze_decompose
  const L2 = layers.L2_deepseek_generate_cards
  if (!L1 || !L2) throw new Error('Prompt registry missing L1/L2')

  const text = String(rawText || '').trim()
  if (!text) throw new Error('内容为空')

  const userPrompt = String(knowledge || '').trim() || '无'
  const style = String(learningStyle || '').trim() || '无'

  const l1User = fillTemplate(L1.user_template, {
    raw_text: text,
    visual_elements: JSON.stringify([], null, 2),
    layout_notes: JSON.stringify([], null, 2),
    user_prompt: userPrompt
  })
  const l1Raw = await streamTextDeepSeek(String(L1.system || ''), l1User)
  const l1Parsed = safeJsonParse(l1Raw)

  let corePoints = normalizeStringArray(l1Parsed && l1Parsed.core_points)
  let questionPoints = normalizeStringArray(l1Parsed && l1Parsed.question_points)
  if (!corePoints.length && !questionPoints.length) {
    // fallback: still keep prompts strictly from registry, just degrade inputs
    corePoints = [text.slice(0, 4000)]
    questionPoints = []
  }

  const l2User = fillTemplate(L2.user_template, {
    core_points: JSON.stringify(corePoints, null, 2),
    question_points: JSON.stringify(questionPoints, null, 2),
    learning_style: style
  })
  const l2Raw = await streamTextDeepSeek(String(L2.system || ''), l2User)
  const cards = parseCardsFromDeepSeekOutput(l2Raw)
  if (!cards.length) throw new Error('未生成到卡片')
  return cards
}

export { generateCardsByDeepSeek, parseCardsFromDeepSeekOutput }


