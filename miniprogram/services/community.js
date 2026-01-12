import { callOkFunction } from './cloud'

async function listCommunityDecks({ sortBy = 'hot', limit = 20 } = {}) {
  const by = sortBy === 'new' || sortBy === 'downloaded' ? sortBy : 'hot'
  const n = Math.max(1, Math.min(50, Number(limit) || 20))
  const ret = await callOkFunction('community', { action: 'listDecks', sortBy: by, limit: n })
  return Array.isArray(ret && ret.decks) ? ret.decks : []
}

async function getCommunityDeck(deckId) {
  const id = String(deckId || '').trim()
  if (!id) throw new Error('missing deckId')
  return await callOkFunction('community', { action: 'getDeck', deckId: id })
}

async function toggleCommunityDeckLike(deckId) {
  const id = String(deckId || '').trim()
  if (!id) throw new Error('missing deckId')
  return await callOkFunction('community', { action: 'toggleLike', deckId: id })
}

async function collectCommunityDeck(deckId) {
  const id = String(deckId || '').trim()
  if (!id) throw new Error('missing deckId')
  return await callOkFunction('community', { action: 'collectDeck', deckId: id })
}

async function enqueueCollectCommunityDeck(deckId) {
  const id = String(deckId || '').trim()
  if (!id) throw new Error('missing deckId')
  return await callOkFunction('community', { action: 'enqueueCollect', deckId: id })
}

async function getCollectJob(jobId) {
  const id = String(jobId || '').trim()
  if (!id) throw new Error('missing jobId')
  return await callOkFunction('community', { action: 'getCollectJob', jobId: id })
}

async function kickCollectJob(jobId) {
  const id = String(jobId || '').trim()
  if (!id) throw new Error('missing jobId')
  // Fire-and-forget worker kick; worker itself enforces job ownership when OPENID present.
  return await callOkFunction('communityCollectWorker', { action: 'kick', jobId: id })
}

async function getMyDeckPublishStatus(deckTitle) {
  const title = String(deckTitle || '').trim()
  if (!title) throw new Error('missing deckTitle')
  return await callOkFunction('community', { action: 'getMyDeckPublishStatus', deckTitle: title })
}

async function publishMyDeck(deckTitle, { description = '' } = {}) {
  const title = String(deckTitle || '').trim()
  if (!title) throw new Error('missing deckTitle')
  const desc = String(description || '').trim()
  return await callOkFunction('community', { action: 'publishMyDeck', deckTitle: title, description: desc })
}

async function unpublishMyDeck(deckTitle) {
  const title = String(deckTitle || '').trim()
  if (!title) throw new Error('missing deckTitle')
  return await callOkFunction('community', { action: 'unpublishMyDeck', deckTitle: title })
}

export {
  listCommunityDecks,
  getCommunityDeck,
  toggleCommunityDeckLike,
  collectCommunityDeck,
  enqueueCollectCommunityDeck,
  getCollectJob,
  kickCollectJob,
  getMyDeckPublishStatus,
  publishMyDeck,
  unpublishMyDeck
}


