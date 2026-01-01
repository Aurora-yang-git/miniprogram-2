const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const originCardId = event && (event.originCardId || event.cardId || event.id || event.originId)

    if (!OPENID) return { ok: false, error: 'missing OPENID' }
    if (!originCardId) return { ok: false, error: 'missing originCardId' }

    const cardsCol = db.collection('cards')

    const originRes = await cardsCol.doc(originCardId).get()
    const origin = originRes && originRes.data ? originRes.data : null
    if (!origin) return { ok: false, error: 'origin card not found' }

    // 只允许引用公开卡
    if (origin.isPublic !== true) {
      return { ok: false, error: 'origin card not public' }
    }

    // 不允许引用自己的卡（避免刷热度/重复）
    if (origin._openid === OPENID) {
      return { ok: false, error: 'cannot fork your own card' }
    }

    // 已经引用过则直接返回（按 originId 去重）
    const existed = await cardsCol
      .where({ _openid: OPENID, originId: originCardId })
      .limit(1)
      .get()
    if (existed && Array.isArray(existed.data) && existed.data.length) {
      return { ok: true, forkedId: existed.data[0]._id, existed: true }
    }

    const now = Date.now()
    const createdAt = db.serverDate()

    // 复制一份内容到当前用户：只读由安全规则约束（originId 存在则禁止内容字段修改）
    const forkData = {
      originId: originCardId,
      forkCount: 0,

      question: origin.question || '',
      answer: origin.answer || '',
      answerSections: Array.isArray(origin.answerSections) ? origin.answerSections : [],
      tags: Array.isArray(origin.tags) ? origin.tags : [],

      // 引用到我的卡包默认私有（避免“二次公开”）
      isPublic: false,

      subject: origin.subject || '',
      unitName: origin.unitName || '',

      sourceImage: origin.sourceImage || '',
      sourceImages: Array.isArray(origin.sourceImages) ? origin.sourceImages : [],

      // SRS 初始化（从 0 开始，尽快进入复习队列）
      srsEF: 2.5,
      srsInterval: 0,
      srsReps: 0,
      lastReviewedAt: 0,
      nextReviewAt: 0,

      createdAt,
      updatedAt: createdAt,

      forkedFromOpenid: origin._openid || '',
      forkedAt: now
    }

    const addRes = await cardsCol.add({ data: forkData })
    const forkedId = addRes && addRes._id ? addRes._id : ''

    // 原卡热度 +1
    await cardsCol.doc(originCardId).update({
      data: {
        forkCount: _.inc(1),
        updatedAt: db.serverDate()
      }
    })

    return { ok: true, forkedId, existed: false }
  } catch (err) {
    console.error('forkCard failed', err)
    return { ok: false, error: err && err.message ? err.message : String(err) }
  }
}


