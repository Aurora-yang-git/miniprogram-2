# Core Business Sequence Diagrams

> 说明：为避免 Mermaid 解析报错，所有 participant id 均无空格；边上的 label 尽量避免特殊字符。

## 1) Login (openid)

```mermaid
sequenceDiagram
participant ui as UI_Pages
participant auth as Svc_auth
participant cloud as Svc_cloud
participant fn as Fn_login
participant db as CloudDB

ui->>auth: getOpenid()
auth->>cloud: callOkFunction(login)
cloud->>fn: callFunction(login)
fn->>fn: getWXContext(OPENID)
fn-->>cloud: ok_openid
cloud-->>auth: openid
auth-->>ui: openid_cached
```

How to read:
- 目标是得到 `OPENID`，后续所有数据库读写依赖 `_openid` 自动隔离。
- 云函数 `login` 只应做轻量逻辑，避免成为全链路瓶颈。

## 2) Community Collect (enqueue + poll + worker)

```mermaid
sequenceDiagram
participant ui as Page_community_detail
participant svc as Svc_community
participant cloud as Svc_cloud
participant comm as Fn_community
participant worker as Fn_communityCollectWorker
participant db as CloudDB

ui->>svc: enqueueCollectCommunityDeck(deckId)
svc->>cloud: callOkFunction(community.enqueueCollect)
cloud->>comm: enqueueCollect
comm->>db: upsert community_collect_jobs(jobId)
comm-->>cloud: jobId_total
cloud-->>ui: jobId_total

par kick_worker
ui->>svc: kickCollectJob(jobId)
svc->>cloud: callOkFunction(communityCollectWorker.kick)
cloud->>worker: processCollectJob(jobId)
worker->>db: lock job (transaction lease)
worker->>db: read community_decks(deckId)
worker->>db: batch_add cards (sourceCommunityDeckId)
worker->>db: update job progress (added_total)
worker->>db: upsert community_deck_collections
worker-->>cloud: done
cloud-->>ui: ok
and poll_progress
loop until done_or_failed
ui->>svc: getCollectJob(jobId)
svc->>cloud: callOkFunction(community.getCollectJob)
cloud->>comm: getCollectJob
comm->>db: read community_collect_jobs(jobId)
comm-->>cloud: status_added_total
cloud-->>ui: progress
end
end
```

How to read:
- 点击收藏后 **秒回 jobId**（不阻塞 UI），进度来自 `community_collect_jobs`。
- 真正拷贝卡片在 `communityCollectWorker` 中执行，避免点击链路卡顿。
- worker 用 lease lock 防止并发重复处理同一 job。

## 3) Review/Study Entry (first batch + background fill)

```mermaid
sequenceDiagram
participant ui as Page_review
participant cloud as Svc_cloud
participant fnq as Fn_getReviewQueue
participant db as CloudDB

ui->>cloud: callOkFunction(getReviewQueue,limit_20)
cloud->>fnq: getReviewQueue(mode,scope,limit,skip)
fnq->>db: query cards (field projection)
fnq-->>cloud: cards_nextSkip_hasMore
cloud-->>ui: first_batch_cards

loop background_fill
ui->>cloud: callOkFunction(getReviewQueue,limit_50)
cloud->>fnq: getReviewQueue(limit,skip)
fnq->>db: query cards
fnq-->>cloud: cards_nextSkip_hasMore
cloud-->>ui: append_queue
end
```

How to read:
- “首批 20”优先保证进入就能开始学，避免白屏等待。
- 后台分页补全只更新 `totalCards` 等轻量 UI，不打断当前卡片流程。

## 4) Submit Review (background submit)

```mermaid
sequenceDiagram
participant ui as Page_review
participant cloud as Svc_cloud
participant fn as Fn_submitReview
participant db as CloudDB

ui->>ui: optimistic_next_card
ui->>cloud: callOkFunction(submitReview)
cloud->>fn: submitReview(cardId,result,attemptTs)
fn->>db: update cards SRS
fn->>db: update user_stats XP
fn-->>cloud: ok
cloud-->>ui: ok
```

How to read:
- UI 先切下一张卡，再后台提交；失败走重试/幂等保护（避免双加 XP）。

## 5) Delete Deck (optimistic remove + background delete)

```mermaid
sequenceDiagram
participant ui as Page_home
participant svc as Svc_cards
participant cache as LocalCache
participant db as CloudDB

ui->>ui: optimistic_remove_deck
ui->>cache: write HOME_CACHE_KEY
ui->>svc: deleteDeckByTitle(deckTitle)
svc->>db: list cards by deckTitle
loop each_card
svc->>db: remove card
end
svc-->>ui: ok_or_fail
```

How to read:
- UI 立即移除 deck（丝滑），删除失败再回滚 snapshot。

