# Dependency Graphs (Core Files Only)

> 说明：依赖图只展示核心 10–15 个文件，帮助你在重构前快速看清层级关系。\n> 图中省略了 `utils/*` 和少量页面细节，以免过度噪声。

## 1) Pages -> Services (graph LR)

```mermaid
graph LR
pageHome[pages_home_index] --> svcCards[services_cards]
pageHome --> svcDefaultDecks[services_defaultDecks]
pageHome --> svcPendingCreate[services_pendingCreate]

pageReview[pages_review_index] --> svcCloud[services_cloud]
pageReview --> svcActivity[services_activity]

pageCommunityList[pages_community_index] --> svcCommunity[services_community]
pageCommunityDetail[pages_community_detail] --> svcCommunity

pageLibrary[pages_library_index] --> svcOcr[services_ocr]
pageLibrary --> svcAi[services_ai]
pageLibraryDetail[pages_library_detail] --> svcCards
pageLibraryDetail --> svcCommunity

pageGoals[pages_goals_index] --> svcUserStats[services_userStats]
pageLeaderboard[pages_leaderboard_index] --> svcCloud
pageProfile[pages_profile_index] --> svcUserStats
```

## 2) Services internal deps (graph LR)

```mermaid
graph LR
svcCloud[services_cloud] --> wxCloud[wx_cloud_callFunction]

svcAuth[services_auth] --> svcCloud
svcCommunity[services_community] --> svcCloud
svcUserStats[services_userStats] --> svcCloud
svcOcr[services_ocr] --> svcCloud
svcAi[services_ai] --> svcCloud
svcCreateJobs[services_createJobs] --> svcCloud
svcPendingCreate[services_pendingCreate] --> svcCloud
svcActivity[services_activity] --> svcCloud

svcCards[services_cards] --> svcAuth
svcCards --> svcTime[services_time]
```

## 3) Cloudfunctions -> DB collections (graph LR)

```mermaid
graph LR
fnCommunity[fn_community] --> colCommunityDecks[col_community_decks]
fnCommunity --> colCommunityLikes[col_community_deck_likes]
fnCommunity --> colCommunityCollections[col_community_deck_collections]
fnCommunity --> colCollectJobs[col_community_collect_jobs]

fnCollectWorker[fn_communityCollectWorker] --> colCollectJobs
fnCollectWorker --> colCards[col_cards]
fnCollectWorker --> colCommunityCollections

fnGetReviewQueue[fn_getReviewQueue] --> colCards
fnSubmitReview[fn_submitReview] --> colCards
fnSubmitReview --> colUserStats[col_user_stats]

fnLeaderboardWorker[fn_leaderboardWorker] --> colLeaderboardCache[col_leaderboard_cache]
fnGetGlobalRank[fn_getGlobalRank] --> colLeaderboardCache

fnResetDailyScore[fn_resetDailyScore] --> colCreateJobs[col_create_jobs]
fnResetDailyScore --> colCards
```

