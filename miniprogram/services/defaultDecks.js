import { ensureUserStats } from './userStats'

// Default decks are now **official Community decks** (seeded once in backend).
// The client should NOT bundle their full card data. We only keep lightweight helpers here.

const DEFAULT_DECK_TITLES = [
  '1/8 ACT默写单词',
  'CSP期中复习卡片',
  '期末复习加点字',
  'AP Psych｜Unit 0',
  'AP Psych｜Unit 1',
  'AP Psych｜Social Psychology',
  '阿房宫赋｜句子翻译',
  'AP Psych｜Unit 2',
  'AP Psych｜Unit 4',
  'AP Psych｜Industrial-Organizational'
]

function isDefaultDeckTitle(deckTitle) {
  const t = typeof deckTitle === 'string' ? deckTitle.trim() : ''
  return DEFAULT_DECK_TITLES.includes(t)
}

async function optOutDefaultDeck(deckTitle) {
  const title = typeof deckTitle === 'string' ? deckTitle.trim() : ''
  if (!isDefaultDeckTitle(title)) return
  if (!wx.cloud || !wx.cloud.database) return

  const stats = await ensureUserStats()
  const id = stats && typeof stats._id === 'string' ? stats._id : ''
  if (!id) return

  const cur = Array.isArray(stats.defaultDecksOptOut) ? stats.defaultDecksOptOut : []
  if (cur.includes(title)) return

  const db = wx.cloud.database()
  await db.collection('user_stats').doc(id).update({
    data: {
      defaultDecksOptOut: cur.concat([title]),
      updatedAt: db.serverDate()
    }
  })
}

// Kept for backward compatibility with older code paths.
// Defaults are no longer seeded to each user; this is intentionally a no-op.
async function ensureDefaultDecks() {}

export { DEFAULT_DECK_TITLES, isDefaultDeckTitle, ensureDefaultDecks, optOutDefaultDeck }

