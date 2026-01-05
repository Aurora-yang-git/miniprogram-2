import { getOpenid } from './auth'
import { ensureUserStats } from './userStats'

const DEFAULT_DECK_VERSION = 1

const DEFAULT_DECK_TITLES = [
  '1/8 ACT默写单词',
  'CSP期中复习卡片'
]

function containsCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''))
}

function isLikelyEnglish(text) {
  const s = String(text || '').trim()
  if (!s) return false
  return /[a-zA-Z]/.test(s) && !containsCjk(s)
}

function isDefaultDeckTitle(deckTitle) {
  const t = typeof deckTitle === 'string' ? deckTitle.trim() : ''
  return DEFAULT_DECK_TITLES.includes(t)
}

function getDefaultDecks() {
  const actTags = ['ACT', 'Vocab']
  const cspTags = ['CSP', 'Review']

  const act = {
    deckTitle: '1/8 ACT默写单词',
    tags: actTags,
    cards: [
      { q: 'flippancy', a: '轻率 n.\nA lack of seriousness; treating important matters in a joking or dismissive way.' },
      { q: 'irritate', a: '激怒 v.\nTo annoy; provoke; or cause discomfort.' },
      { q: 'defensive', a: '防御性的 adj.\nProtective in attitude; reacting as if under attack or criticism.' },
      { q: 'torture', a: '折磨 v.\nTo inflict such suffering.' },
      { q: 'get along', a: '相处 phr./v.\nTo have a friendly or workable relationship with someone.' },
      { q: "for heaven's sake", a: '看在上帝的份上 expr.\nUsed to express frustration or emphasis; an exasperated appeal.' },
      { q: 'self-sufficient', a: '自给自足的 adj.\nAble to provide for oneself without outside help; independent.' },
      { q: 'make do with', a: '凑合 phr./v.\nTo manage with what is available; even if it is not ideal.' },
      { q: 'scrub', a: '擦洗 v.\nTo clean something thoroughly by rubbing hard.' },
      { q: 'drape', a: '覆盖 v.\nTo cover or hang loosely in folds over something.' },
      { q: 'recline against', a: '斜靠 phr./v.\nTo lean or lie back in a relaxed position while supported.' },
      { q: 'animated', a: '生机勃勃的 adj.\nFull of life; movement; and energy; lively and expressive.' },
      { q: 'be envious of', a: '嫉妒 adj.\nFeeling jealousy or desire for what someone else has.' },
      { q: 'futile', a: '徒劳的 adj.\nUseless; incapable of producing any result or change.' },
      { q: 'slug', a: '蛞蝓 n.\nA slow-moving creature.' },
      { q: 'in honor of sb', a: '向某人致敬 phr.\nTo show respect or admiration for someone; especially in a ceremony or event.' },
      { q: 'linger on', a: '徘徊 phr./v.\nTo remain for a long time; either physically or in memory.' },
      { q: 'mound up', a: '堆积 phr./v.\nTo pile or heap up into a raised mass.' },
      { q: 'crouch', a: '蹲下 v.\nTo lower the body close to the ground by bending knees and leaning forward.' },
      { q: 'shifting dynamics', a: '动态变化 n. phr.\nChanging patterns of behavior; power; or relationships within a group or situation.' },
      { q: 'diffident', a: '缺乏自信的 adj.\nShy; lacking confidence; and hesitant to assert oneself.' },
      { q: 'resentful', a: '愤恨的 adj.\nFeeling or showing bitterness or anger due to perceived unfair treatment.' },
      { q: 'adoring', a: '崇拜的 adj.\nShowing deep love; admiration; or devotion.' },
      { q: 'attentive', a: '专注的 adj.\nPaying close attention; considerate and aware of others\' needs.' },
      { q: 'tend to', a: '照料 phr./v.\nTo take care of sb/sth.' },
      { q: 'endearing', a: '讨人喜欢的 adj.\nLovable or charming in a way that inspires affection or warmth.' },
      { q: 'sprawled', a: '四肢摊开的 adj.\nLying or spread out with limbs extended in a relaxed or uncontrolled manner.' },
      { q: 'meticulous', a: '一丝不苟的 adj.\nExtremely careful and precise; showing great attention to detail.' },
      { q: 'trample', a: '踩踏 v.\nTo step on or crush something by walking or running over it; to treat without respect.' }
    ]
  }

  const csp = {
    deckTitle: 'CSP期中复习卡片',
    tags: cspTags,
    cards: [
      { q: 'Data 是什么？', a: 'Data: A collection of facts.' },
      { q: 'Number base（进制）是什么？', a: 'Number base: the number of digits or digit combinations a system uses to represent values.' },
      { q: '十进制（Base 10）使用哪些数字？', a: '0–9 的组合来表示数值。' },
      { q: '二进制（Base 2）使用哪些数字？', a: '只使用 0 和 1。' },
      { q: '二进制 101 对应十进制是多少？', a: '5（\(4 + 1 = 5\)）。' },
      { q: 'Bit 是什么？', a: 'Bit (binary digit): the smallest unit of information (0 or 1).' },
      { q: 'Byte 是什么？', a: 'Byte = 8 bits.' },
      { q: '8 bits 一共能表示多少个不同的值？', a: '256 个（0–255），因为 \(2^8 = 256\)。' },
      { q: 'n bits 能表示的最大值公式？', a: '最大值：\(2^n - 1\)。' },
      { q: 'n bits 能表示的不同取值个数公式？', a: '取值个数：\(2^n\)。' },
      { q: 'Analog data vs Digital data 区别？', a: 'Analog：连续测量、平滑变化。\nDigital：离散值，需要格式化。' },
      { q: 'Sampling（采样）是什么？', a: '以离散的时间间隔记录模拟信号，把它转换为数字数据。' },
      { q: 'Data abstraction（数据抽象）是什么？', a: '过滤掉细节、保留必要信息（如只存日期 11/13/2025，而不是每毫秒）。' },
      { q: 'Data compression（数据压缩）是什么？', a: '把数据打包成更小空间，同时能访问原始数据；压缩/解压是两步过程；节省存储与带宽。' },
      { q: 'RLE（Run-Length Encoding）怎么做？', a: '用“重复次数 + 值”替换连续重复数据，如 FFFFFIIIIIIVVVVVVVEEEE → 5F6I7V4E。' },
      { q: 'Lossless vs Lossy 压缩？', a: 'Lossless：不丢数据（ZIP/PNG）。\nLossy：牺牲部分数据换更小体积（JPEG/MP3/MP4）。' },
      { q: 'Internet 是什么？', a: '使用标准、开放协议互联的网络集合。' },
      { q: 'Packet（数据包）由哪两部分组成？', a: 'Header（源/目的地/序号等元数据）+ Data section（实际数据）。' },
      { q: 'Routing（路由）是什么？', a: '为数据包选择传输路径。' },
      { q: '为什么 packet 可能乱序到达？怎么办？', a: '走不同路径/延迟不同导致乱序；用序号重组（reassembly）。' },
      { q: 'Bandwidth 和 Latency 区别？', a: 'Bandwidth：单位时间最大数据量（bps/Mbps）。\nLatency：数据延迟时间（ms）。' },
      { q: 'TCP vs UDP 区别？', a: 'TCP/IP：可靠传输。\nUDP：更快但不保证可靠。' },
      { q: 'IPv4 vs IPv6？', a: 'IPv4：4 组十进制，地址数约 \(2^{32}\)（≈43 亿）。\nIPv6：8 组十六进制，地址数约 \(2^{128}\)。' },
      { q: 'Scalability / Fault tolerance / Redundancy 分别是什么？', a: 'Scalability：可随需求增长。\nFault tolerance：部分失效仍能运行。\nRedundancy：冗余备份组件/路径。' },
      { q: 'Digital divide（数字鸿沟）是什么？', a: '有无技术/网络接入的人群之间的差距。' },
      { q: '6 bits 有多少种不同取值？', a: '64（\(2^6 = 64\)）。' },
      { q: '10 bits 最大值是多少？', a: '1023（\(2^{10}-1\)）。' },
      { q: '二进制 1101 转十进制是多少？', a: '13（\(1\\cdot2^3 + 1\\cdot2^2 + 0\\cdot2^1 + 1\\cdot2^0 = 13\)）。' },
      { q: '温度传感器数据是 analog 还是 digital？', a: 'Analog（连续变化）。' },
      { q: '医学 X 光压缩应选 lossless 还是 lossy？', a: 'Lossless（不能丢关键信息）。' },
      { q: '什么时候更适合用 UDP？', a: '直播/游戏/VoIP 等更在意实时性的场景。' },
      { q: '家里 200 Mbps 但很卡，最可能的问题是？', a: '高 latency（延迟大）而不是带宽不足。' },
      { q: 'Redundancy 为什么能提升 fault tolerance？', a: '提供备份组件/路径，部分故障时可切换继续运行。' },
      { q: 'Digital divide 的常见成因？', a: '人口统计（年龄/教育）、社会经济地位（收入/成本）、地理位置（城乡/基础设施）。' },
      { q: '减少数字鸿沟的方案？', a: '数字素养教育、基础设施投入、设备可获得性、相关政策。' }
    ]
  }

  return [act, csp]
}

async function migrateBuiltInActDeck(db, openid) {
  if (!db || !openid) return 0
  const title = '1/8 ACT默写单词'
  let fixed = 0

  try {
    const res = await db.collection('cards').where({ _openid: openid, deckTitle: title, builtIn: true }).limit(200).get()
    const list = res && Array.isArray(res.data) ? res.data : []
    for (let i = 0; i < list.length; i += 1) {
      const card = list[i]
      const id = card && (card._id || card.id)
      if (!id) continue
      const q = typeof card.question === 'string' ? card.question.trim() : ''
      const a = typeof card.answer === 'string' ? card.answer.trim() : ''
      if (!q || !a) continue
      if (!containsCjk(q)) continue

      const lines = a.split('\n').map((x) => String(x || '').trim()).filter(Boolean)
      if (lines.length < 2) continue
      const first = lines[0]
      const rest = lines.slice(1).join('\n').trim()
      if (!isLikelyEnglish(first)) continue

      const newQuestion = first
      const newAnswer = `${q}\n${rest}`.trim()
      // eslint-disable-next-line no-await-in-loop
      await db.collection('cards').doc(String(id)).update({
        data: { question: newQuestion, answer: newAnswer, updatedAt: db.serverDate() }
      })
      fixed += 1
    }
  } catch (e) {
    console.error('migrateBuiltInActDeck failed', e)
  }

  return fixed
}

async function repairBuiltInDeckTitles(db, openid) {
  if (!db || !openid) return 0
  const _ = db.command
  const canExists = _ && typeof _.exists === 'function'
  const missingDeckTitleCond = canExists
    ? _.or([{ deckTitle: _.exists(false) }, { deckTitle: '' }, { deckTitle: 'Inbox' }])
    : { deckTitle: '' }

  // builtIn cards that lost deckTitle will fall into Inbox; fix them by tags.
  let changed = 0
  try {
    const res = await db
      .collection('cards')
      .where(canExists ? _.and([{ _openid: openid, builtIn: true }, missingDeckTitleCond]) : { _openid: openid, builtIn: true })
      .limit(200)
      .get()
    const list = res && Array.isArray(res.data) ? res.data : []
    for (let i = 0; i < list.length; i += 1) {
      const card = list[i]
      const id = card && (card._id || card.id)
      if (!id) continue
      const currentDeckTitle = typeof card.deckTitle === 'string' ? card.deckTitle.trim() : ''
      if (currentDeckTitle && currentDeckTitle !== 'Inbox') continue
      const tags = Array.isArray(card.tags) ? card.tags : []
      const hasAct = tags.includes('ACT') || tags.includes('Vocab')
      const hasCsp = tags.includes('CSP') || tags.includes('Review')

      let deckTitle = ''
      if (hasAct) deckTitle = '1/8 ACT默写单词'
      else if (hasCsp) deckTitle = 'CSP期中复习卡片'
      if (!deckTitle) continue

      // eslint-disable-next-line no-await-in-loop
      await db.collection('cards').doc(String(id)).update({
        data: { deckTitle, updatedAt: db.serverDate() }
      })
      changed += 1
    }
  } catch (e) {
    console.error('repairBuiltInDeckTitles failed', e)
  }
  return changed
}

async function updateUserStatsDefaultsMeta(statsId, patch) {
  if (!statsId) return
  if (!wx.cloud || !wx.cloud.database) return
  const db = wx.cloud.database()
  await db.collection('user_stats').doc(statsId).update({
    data: { ...patch, updatedAt: db.serverDate() }
  })
}

async function optOutDefaultDeck(deckTitle) {
  const title = typeof deckTitle === 'string' ? deckTitle.trim() : ''
  if (!isDefaultDeckTitle(title)) return
  const stats = await ensureUserStats()
  const id = stats && typeof stats._id === 'string' ? stats._id : ''
  if (!id) return
  const cur = Array.isArray(stats.defaultDecksOptOut) ? stats.defaultDecksOptOut : []
  if (cur.includes(title)) return
  await updateUserStatsDefaultsMeta(id, { defaultDecksOptOut: cur.concat([title]) })
}

async function ensureDefaultDecks() {
  if (!wx.cloud || !wx.cloud.database) return

  // simple local lock to avoid duplicate seeding in same session
  const LOCK_KEY = 'default_decks_seed_lock_v1'
  try {
    const now = Date.now()
    const v = wx.getStorageSync && wx.getStorageSync(LOCK_KEY)
    // If previous run crashed, the old boolean lock could get stuck forever.
    // Use a timestamp-based lock with short TTL to avoid permanent skip.
    if (typeof v === 'number' && now - v < 15000) return
    wx.setStorageSync && wx.setStorageSync(LOCK_KEY, now)
  } catch (e) {
    // ignore
  }

  try {
    const stats = await ensureUserStats()
    const statsId = stats && typeof stats._id === 'string' ? stats._id : ''
    const optOut = Array.isArray(stats.defaultDecksOptOut) ? stats.defaultDecksOptOut : []

    const db = wx.cloud.database()
    const openid = await getOpenid()
    const decks = getDefaultDecks()

    // Repair built-in cards that might have lost deckTitle (otherwise they appear under Inbox).
    await repairBuiltInDeckTitles(db, openid)
    // If ACT deck exists but was seeded with the old Q/A direction, fix it in-place.
    await migrateBuiltInActDeck(db, openid)

    for (let d = 0; d < decks.length; d += 1) {
      const deck = decks[d]
      const title = deck && typeof deck.deckTitle === 'string' ? deck.deckTitle : ''
      if (!title || optOut.includes(title)) continue

      const tags = Array.isArray(deck.tags) ? deck.tags : []
      const cards = Array.isArray(deck.cards) ? deck.cards : []

      // Top-up mode: if seeding was interrupted, add missing cards (avoid duplicates by question).
      // eslint-disable-next-line no-await-in-loop
      const existingRes = await db
        .collection('cards')
        .where({ _openid: openid, deckTitle: title, builtIn: true })
        .limit(200)
        .get()
      const existing = existingRes && Array.isArray(existingRes.data) ? existingRes.data : []
      const existingQ = new Set(existing.map((c) => (typeof c.question === 'string' ? c.question.trim() : '')).filter(Boolean))

      for (let i = 0; i < cards.length; i += 1) {
        const c = cards[i]
        const question = c && typeof c.q === 'string' ? c.q.trim() : ''
        const answer = c && typeof c.a === 'string' ? c.a.trim() : ''
        if (!question || !answer) continue
        if (existingQ.has(question)) continue
        // eslint-disable-next-line no-await-in-loop
        await db.collection('cards').add({
          data: {
            deckTitle: title,
            question,
            answer,
            tags,
            builtIn: true,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
        existingQ.add(question)
      }
    }

    if (statsId) {
      await updateUserStatsDefaultsMeta(statsId, {
        defaultDecksVersion: DEFAULT_DECK_VERSION,
        defaultDecksSeededAt: db.serverDate()
      })
    }
  } finally {
    try {
      wx.removeStorageSync && wx.removeStorageSync('default_decks_seed_lock_v1')
    } catch (e) {
      // ignore
    }
  }
}

export { DEFAULT_DECK_TITLES, isDefaultDeckTitle, ensureDefaultDecks, optOutDefaultDeck }


