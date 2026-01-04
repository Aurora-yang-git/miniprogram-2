function parseCardsFromDeepSeekOutput(rawText) {
  const raw = String(rawText || '').trim()
  const noFence = raw.replace(/```[a-zA-Z]*\n?/g, '').trim()

  let jsonText = noFence
  const firstArr = noFence.indexOf('[')
  const lastArr = noFence.lastIndexOf(']')
  if (firstArr >= 0 && lastArr > firstArr) {
    jsonText = noFence.slice(firstArr, lastArr + 1)
  } else {
    const firstObj = noFence.indexOf('{')
    const lastObj = noFence.lastIndexOf('}')
    if (firstObj >= 0 && lastObj > firstObj) {
      jsonText = noFence.slice(firstObj, lastObj + 1)
    }
  }

  let parsed = null
  try {
    parsed = JSON.parse(jsonText)
  } catch (e) {
    parsed = null
  }

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

async function generateCardsByDeepSeek(sourceText) {
  const userInput = String(sourceText || '').trim()
  if (!userInput) throw new Error('内容为空')
  const systemPrompt = [
    '你是一名知识卡片设计专家，擅长为长期记忆设计高质量的学习卡片。',
    '',
    '卡片必须：',
    '- 适合翻转式学习',
    '- 考察理解而非照抄',
    '- 答案简洁、可直接记忆',
    '',
    '输出要求：',
    '1) 只输出严格的 JSON 数组，不要任何解释或额外文字',
    '2) 每一项必须包含 question、answer、hint（字符串）',
    '3) 可选包含 tags（字符串数组，0-5个）',
    '4) question 应考察理解，而不是复述原文',
    '5) hint 用于提示思路，不直接给答案',
    '6) 卡片数量建议 3-12 张，最多 20 张'
  ].join('\n')

  const raw = await streamTextDeepSeek(systemPrompt, userInput)
  const cards = parseCardsFromDeepSeekOutput(raw)
  if (!cards.length) throw new Error('未生成到卡片')
  return cards
}

export { generateCardsByDeepSeek, parseCardsFromDeepSeekOutput }


