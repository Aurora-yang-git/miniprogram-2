const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function makeReqId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function asString(v) {
  return v == null ? '' : String(v)
}

function sha1Hex(text) {
  return crypto.createHash('sha1').update(asString(text), 'utf8').digest('hex')
}

function isTransactionBusyError(err) {
  const msg = err && err.message ? String(err.message) : ''
  const code = err && err.errCode ? String(err.errCode) : ''
  return (
    msg.includes('TransactionBusy') ||
    msg.includes('DATABASE_TRANSACTION_FAIL') ||
    msg.includes('ResourceUnavailable.TransactionBusy') ||
    code === 'DATABASE_TRANSACTION_FAIL'
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

exports.main = async (event) => {
  const reqId = makeReqId()
  const startedAt = Date.now()
  const finish = (payload) => {
    const durationMs = Date.now() - startedAt
    const ok = payload && payload.ok ? 'ok' : 'fail'
    console.log(`[forkCard] ${ok} reqId=${reqId} durationMs=${durationMs}`)
    return { ...(payload || {}), reqId, durationMs }
  }

  try {
    const { OPENID } = cloud.getWXContext()
    const originCardId = asString(event && (event.originCardId || event.cardId || event.id || event.originId)).trim()

    if (!OPENID) return finish({ ok: false, error: 'missing OPENID' })
    if (!originCardId) return finish({ ok: false, error: 'missing originCardId' })

    const forkDocId = `fork_${sha1Hex(`${OPENID}|${originCardId}`)}`

    let txRet = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        txRet = await db.runTransaction(async (tx) => {
          const cardsCol = tx.collection('cards')

          let originRes = null
          try {
            originRes = await cardsCol
              .doc(originCardId)
              .field({
                _openid: true,
                isPublic: true,
                question: true,
                answer: true,
                answerSections: true,
                tags: true,
                subject: true,
                unitName: true,
                sourceImage: true,
                sourceImages: true
              })
              .get()
          } catch (e) {
            originRes = null
          }
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

          let existed = null
          try {
            const got = await cardsCol.doc(forkDocId).get()
            existed = got && got.data ? got.data : null
          } catch (e) {
            existed = null
          }
          if (existed) {
            return { ok: true, forkedId: forkDocId, existed: true }
          }

          // Backward-compat: older versions used random _id and deduped by query.
          // If user already forked before, avoid creating a duplicate.
          try {
            const legacy = await cardsCol.where({ _openid: OPENID, originId: originCardId }).limit(1).field({ _id: true }).get()
            const legacyDoc =
              legacy && Array.isArray(legacy.data) && legacy.data[0] ? legacy.data[0] : null
            if (legacyDoc && legacyDoc._id) {
              return { ok: true, forkedId: String(legacyDoc._id), existed: true, legacy: true }
            }
          } catch (e) {
            // ignore legacy lookup failures
          }

          const now = Date.now()
          const createdAt = db.serverDate()

          // 复制一份内容到当前用户：只读由安全规则约束（originId 存在则禁止内容字段修改）
          const forkData = {
            _openid: OPENID,
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

          await cardsCol.doc(forkDocId).set({ data: forkData })

          // 原卡热度 +1
          await cardsCol.doc(originCardId).update({
            data: {
              forkCount: _.inc(1),
              updatedAt: db.serverDate()
            }
          })

          return { ok: true, forkedId: forkDocId, existed: false }
        })
        break
      } catch (e) {
        if (!isTransactionBusyError(e) || attempt >= 2) throw e
        const backoffMs = 40 * (attempt + 1) + Math.floor(Math.random() * 40)
        // eslint-disable-next-line no-await-in-loop
        await sleep(backoffMs)
      }
    }

    if (!txRet) return finish({ ok: false, error: 'forkCard failed: empty result' })
    return finish(txRet)
  } catch (err) {
    console.error('forkCard failed', err)
    return finish({ ok: false, error: err && err.message ? err.message : String(err) })
  }
}


