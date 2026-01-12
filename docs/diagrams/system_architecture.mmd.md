# System Architecture Diagram (graph TD)

```mermaid
graph TD

subgraph presentation [Presentation_Layer]
  wxRuntime[WeChat_Runtime]
  uiPages[UI_Pages]
  localCache[Local_Storage_Cache]
end

subgraph logic [Logic_Layer]
  svcLayer[Miniprogram_Services]
  cloudClient[Cloud_Client_Wrapper]
end

subgraph backend [Backend_Layer_CloudFunctions]
  fnLogin[Fn_login]
  fnCommunity[Fn_community]
  fnCollectWorker[Fn_communityCollectWorker]
  fnGetReviewQueue[Fn_getReviewQueue]
  fnSubmitReview[Fn_submitReview]
  fnAnalyzeImage[Fn_analyzeImage]
  fnLeaderboardWorker[Fn_leaderboardWorker]
  fnGetGlobalRank[Fn_getGlobalRank]
  fnResetDailyScore[Fn_resetDailyScore]
end

subgraph data [Data_Layer_CloudBase]
  cloudDB[CloudBase_Database]
  cloudStorage[CloudBase_Storage]
end

subgraph external [External_Services]
  deepSeek[DeepSeek_API]
  moonshot[Kimi_Moonshot_API]
end

wxRuntime --> uiPages
uiPages -->|"read_write"| localCache

uiPages -->|"import_call"| svcLayer
svcLayer -->|"callFunction"| cloudClient

cloudClient -->|"call"| fnLogin
cloudClient -->|"call"| fnCommunity
cloudClient -->|"call"| fnCollectWorker
cloudClient -->|"call"| fnGetReviewQueue
cloudClient -->|"call"| fnSubmitReview
cloudClient -->|"call"| fnAnalyzeImage
cloudClient -->|"call"| fnGetGlobalRank

fnLogin -->|"read_write"| cloudDB
fnCommunity -->|"read_write"| cloudDB
fnCollectWorker -->|"read_write"| cloudDB
fnGetReviewQueue -->|"read"| cloudDB
fnSubmitReview -->|"read_write"| cloudDB
fnLeaderboardWorker -->|"read_write"| cloudDB
fnGetGlobalRank -->|"read"| cloudDB
fnResetDailyScore -->|"read_write"| cloudDB

uiPages -->|"upload"| cloudStorage
fnAnalyzeImage -->|"tempurl_or_download"| cloudStorage

fnAnalyzeImage -->|"ocr_request"| moonshot
fnResetDailyScore -->|"ocr_request"| moonshot
fnResetDailyScore -->|"generate_cards"| deepSeek
```

## How to read

- Presentation 层主要是页面与本地缓存（“秒开/丝滑”很多来自 cache-first 与 optimistic UI）。
- Logic 层是 `miniprogram/services/*`，页面不直接访问云函数/数据库。
- Backend 层每个云函数是一个独立部署单元（按目录上传）。
- Data 层是 CloudBase 数据库/存储；External 是 OCR/LLM。

