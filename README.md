## 学习卡子（LearnCards）

一个基于 **微信小程序 + 云开发（CloudBase）** 的学习卡片应用：支持从图片/文本自动生成卡片，按卡包管理，并通过 **SRS（SM-2）间隔重复** 帮你高效复习。

### 你能做什么

- **创建卡片**
  - **扫描/上传图片 → OCR 提取文字 → AI 生成卡片**
  - **粘贴文本 → AI 生成卡片**
  - **手动新增/编辑**（支持在 Deck 详情页直接添加/编辑）
- **卡包（Deck）管理**
  - Home 聚合展示所有 Deck（由 `cards.deckTitle` 自动分组，无需单独 `decks` 集合）
  - Deck 详情查看卡片列表、删除卡片、学习/复习入口
  - **默认官方卡包已迁移到 Community**：新用户不会再自动写入默认卡片到你的 `cards`，需要在 Community 中 **Collect** 到自己的卡库
- **学习与复习**
  - **Study**：按卡包全量学习
  - **Review**：只复习到期卡（due）
  - ✅ **丝滑开局**：Review/Study 进入时先加载一小批（首批 20）即可开始，剩余队列后台分页补全（云函数 `getReviewQueue`）
  - 复习结果写入云端，由云函数更新 **nextReviewAt / streak / XP**
- **目标与数据面板**
  - Daily Goal、今日完成量、连续学习 streak、周/月统计
- **排行榜**
  - 通过 `leaderboardWorker` 定时预计算缓存，`getGlobalRank` 走缓存快路径（Top50 精确名次；其他用户返回近似区间 `rankText`）

### 技术栈概览

- **小程序端**：原生小程序（`miniprogram/`）+ `tdesign-miniprogram` + 自定义 TabBar
- **云开发**：云数据库（`cards` / `user_stats`）+ 云存储 + 云函数（`cloudfunctions/`）
- **AI**
  - **OCR**：云函数 `analyzeImage` 调用 Moonshot(Kimi) 视觉接口（需要配置 `MOONSHOT_API_KEY`）
  - **卡片生成（后台任务）**：云函数 `resetDailyScore` 作为 worker 处理 `create_jobs` 队列，在云端调用 DeepSeek API 生成卡片（需要配置 `DEEPSEEK_API_KEY`；可选回退到 Moonshot 文本模型）

### 本地开发 / 启动方式

- **前置条件**
  - 安装并登录微信开发者工具（建议使用较新版本）
  - 开通云开发并创建云环境（如果你使用的是教育版资源，请在工具设置中开启“教育版”）

- **打开项目**
  - 在微信开发者工具中导入 `xuexikazi/` 目录（该目录包含 `project.config.json`，且已配置 `miniprogramRoot: miniprogram/`）

- **安装小程序端 npm 依赖（推荐）**
  - 在 `xuexikazi/` 目录执行：

```bash
npm install
```

  - 本项目小程序端 npm 依赖目前主要是：`tdesign-miniprogram`（用于 `app.json` 的 `usingComponents`）

- **构建 npm（首次/依赖变更后必做）**
  - 在微信开发者工具中执行：**工具 → 构建 npm**
  - 产物输出到：`miniprogram/miniprogram_npm/`

- **配置云环境 envId（必做）**
  - 打开 `miniprogram/app.js`，把 `wx.cloud.init({ env: '...' })` 中的值替换为你的云环境 `envId`
  - 可选：同步更新 `miniprogram/envList.js`（便于开发者工具环境列表展示）

- **部署云函数（必做）**
  - 在开发者工具的云函数面板中，对 `cloudfunctions/` 下的云函数逐个执行：
    - **上传并部署：云端安装依赖**
  - **配置 OCR 密钥（必做）**
    - 云函数 `analyzeImage` 需要环境变量：`MOONSHOT_API_KEY`
    - 在云开发控制台/开发者工具中为该云函数配置环境变量后，重新部署一次 `analyzeImage`
  - **配置生成密钥（必做）**
    - 云函数 `resetDailyScore` 需要环境变量：`DEEPSEEK_API_KEY`
    - 图片模式还需要：`MOONSHOT_API_KEY`（worker 内部会 `downloadFile` 并调用 Moonshot 视觉 OCR；不再云函数内嵌套调用 `analyzeImage`，避免超时）
    - 可选：`DEEPSEEK_API_URL` / `DEEPSEEK_MODEL`（默认 `deepseek-chat`）
    - 可选回退：如果也配置了 `MOONSHOT_API_KEY`，可通过 `MOONSHOT_TEXT_MODEL`（默认 `moonshot-v1-8k`）作为生成兜底
    - 可选：`MOONSHOT_VISION_MODEL`（默认 `moonshot-v1-8k-vision-preview`）、`MOONSHOT_OCR_TIMEOUT_MS`（默认 `50000`）
    - 可选：`WORKER_WRITE_BATCH`（每次写入多少张卡，默认 `8`；用于避免单次执行超时）
    - 可选：`WORKER_MAX_RETRY`（worker 遇到临时网络/限流/5xx 时的最大重试次数，默认 `6`；配合 `retryAt/retryCount` 字段做退避重试）
  - **启用后台 worker 的定时触发器（必做）**
    - 打开 `cloudfunctions/resetDailyScore/config.json`
    - 在微信开发者工具中右键该 `config.json` → **上传触发器**
    - 上传成功后，触发器会按 cron 自动运行并处理 `create_jobs` 队列（即使用户退出小程序也会继续生成）
  - **启用排行榜缓存 worker（强烈推荐 / 性能关键）**
    - 创建云数据库集合：`leaderboard_cache`
    - 部署云函数：`cloudfunctions/leaderboardWorker`（上传并部署：云端安装依赖）
    - 启用定时触发器：
      - 打开 `cloudfunctions/leaderboardWorker/config.json`
      - 在微信开发者工具中右键该 `config.json` → **上传触发器**
    - 说明：
      - `leaderboardWorker` 会写入 `leaderboard_cache/latest`（Top50 + xpBuckets + totalUsers）
      - `getGlobalRank` 会优先读取缓存，极大降低 P95（不再在请求链路里做 `count(xp > myXp)`）
  - **启用 Community（社区）功能（必做）**
    - 创建云数据库集合（否则会报 `DATABASE_COLLECTION_NOT_EXIST`）：
      - `community_decks`
      - `community_deck_likes`
      - `community_deck_collections`
      - `community_collect_jobs`（收藏后台任务队列，用于秒反馈+进度）
    - 部署云函数：`cloudfunctions/community`（上传并部署：云端安装依赖）
    - 部署收藏后台 worker（强烈推荐 / 体验关键）：
      - 部署云函数：`cloudfunctions/communityCollectWorker`（上传并部署：云端安装依赖）
      - 启用定时触发器：
        - 打开 `cloudfunctions/communityCollectWorker/config.json`
        - 在微信开发者工具中右键该 `config.json` → **上传触发器**
    - 首次打开小程序的 **Community 页面** 会自动触发云函数幂等 seed：把“官方默认卡包”写入 `community_decks`（不再自动写入每个用户的 `cards`）
    - **发布/取消发布**：在任意本地 Deck 的详情页，有一个 **Community 开关**，开启后发布到 Community；关闭会从 Community 下架
    - 可选环境变量（不配置则用默认值）：
      - `COMMUNITY_MAX_COLLECT`：单次收藏最大卡片数（默认 `80`）
      - `COMMUNITY_MAX_PUBLISH`：单次发布最大卡片数（默认 `200`）
      - `COMMUNITY_COLLECT_CONCURRENCY`：收藏时并发写入卡片的并发数（默认 `8`，建议 5~10）

  - **启用快速队列云函数（强烈推荐 / 体验关键）**
    - 部署云函数：`cloudfunctions/getReviewQueue`（上传并部署：云端安装依赖）

### 依赖说明与冗余依赖结论

- **小程序端（`xuexikazi/package.json`）**
  - 只用于 **小程序端 npm 依赖管理 + 开发者工具“构建 npm”**（生成 `miniprogram/miniprogram_npm/`）
  - 当前仅需要 `tdesign-miniprogram`，**不需要**在根目录安装 `wx-server-sdk`

- **云函数（`cloudfunctions/*/package.json`）**
  - 每个云函数独立部署，依赖各自的 `package.json`（当前大多数依赖 `wx-server-sdk@^2.6.3`，worker `resetDailyScore` 为 `wx-server-sdk@^3.0.1`）
  - 这类重复声明是云函数部署方式决定的，**不属于冗余**

- **参考 UI**
  - 仓库根目录下的 `reference image/ui` 为 UI 对齐/参考工程，**不影响小程序运行**；只有在你要启动该参考工程时才需要安装它的依赖

### 云函数说明

- **`login`**：返回当前用户 `openid`
- **`submitReview`**：提交复习结果（remember/forget），更新 `cards` 的 SRS 字段，并维护 `user_stats`（XP、dailyXp、streak 等）
- **`getGlobalRank`**：读取 `user_stats`，返回 Top50 与我的排名（当前排行榜页面 streak 显示为 `-`，因为云函数返回里未包含）
- **`leaderboardWorker`**：定时预计算排行榜缓存到 `leaderboard_cache/latest`（Top50 + totalUsers + xpBuckets），用于加速 `getGlobalRank`
- **`getGlobalRank`**：优先读取 `leaderboard_cache/latest`（Top50 精确；非 Top50 返回近似区间 `rankText`）；缓存缺失时会降级返回（功能不挂）
- **`analyzeImage`**：输入云存储 `fileID`，输出 OCR 文本（依赖 `MOONSHOT_API_KEY`）
- **`resetDailyScore`**：后台 worker（定时触发器），处理 `create_jobs`：OCR→AI 生成→写入 `cards`→更新 job 进度/状态（依赖 `DEEPSEEK_API_KEY`；图片模式需 `MOONSHOT_API_KEY`）
- **`community`**：Community（社区卡包）：浏览/搜索/排序 + 详情页 + 点赞 + 收藏 + **发布/取消发布我的 Deck**（收藏会把社区 deck 的卡片复制到我的 `cards`）
- **`communityCollectWorker`**：Community 收藏后台 worker（定时触发器 + 客户端可 kick），把长耗时拷卡移出点击链路，并写入 `community_collect_jobs` 进度
- **`getReviewQueue`**：Review/Study 队列云函数：首批快速返回 + 支持分页，前端可后台补全队列

### 云数据库索引建议

建议在云开发控制台创建：

- **`user_stats`**
  - `xp`（降序）
- **`cards`**
  - `_openid`（升序）
  - `_openid + deckTitle`（组合索引）
- **`community_decks`**
  - `hotScore`（降序）
  - `downloadCount`（降序）
  - `createdAt`（降序）
- **`create_jobs`**
  - `status`（升序）
  - `status + updatedAt`（组合索引）

- **`community_collect_jobs`**
  - `status`（升序）
  - `status + updatedAt`（组合索引）

### 云数据库数据模型（简版）

- **`cards`**
  - `deckTitle`: string（缺失/空会被视为 `Inbox`）
  - `question`: string
  - `answer`: string
  - `tags`: string[]
  - （来自 Community 收藏的卡片会额外带）`sourceCommunityDeckId` / `sourceCommunityCardIndex` / `sourceCommunityTitle`
  - `createdAt` / `updatedAt`
  - SRS 字段：`nextReviewAt` / `lastReviewedAt` / `srsEF` / `srsInterval` / `srsReps`

- **`user_stats`**
  - `xp` / `dailyXp` / `totalReviewed`
  - `streak` / `studiedToday` / `lastStudyDate`
  - `dailyGoal`
  - `nickname` / `avatarUrl`（用于个人页与排行榜展示）

- **`community_decks`**
  - `title` / `description` / `tags`
  - `authorName` / `authorAvatar` / `authorLevel`
  - `cards`: `{ question, answer }[]`
  - `cardCount` / `likeCount` / `downloadCount` / `hotScore`
  - `isOfficial`（官方默认卡包）/ `isPublic`（是否公开）
  - `ownerOpenid` / `sourceDeckTitle`（用户发布的 Deck 元信息）
  - `createdAt` / `updatedAt`

- **`community_deck_likes`**：用户点赞记录（云函数按 `OPENID_deckId` 作为 docId 幂等）
- **`community_deck_collections`**：用户收藏记录（云函数按 `OPENID_deckId` 作为 docId 幂等）
- **`community_collect_jobs`**： 收藏后台任务队列（`enqueueCollect` 秒返回 jobId；worker 写入 `added/total/status`）
- **`leaderboard_cache`**：排行榜缓存（由 `leaderboardWorker` 写入 `latest` 文档；`getGlobalRank` 读取）

更完整的数据流与架构说明请参考：`docs/architecture.md`

### 目录结构

```
miniprogram-2/
├─ xuexikazi/                      # ✅ 小程序工程根目录（导入这个目录到开发者工具）
│  ├─ miniprogram/                 # 小程序主包
│  ├─ cloudfunctions/              # 云函数（OCR/复习/排行榜等）
│  ├─ docs/architecture.md         # 架构与数据流说明（建议先读）
│  ├─ package.json                 # 小程序端 npm 依赖（tdesign-miniprogram）
│  └─ project.config.json
└─ reference image/ui/             # UI 对齐/参考工程（非运行必需）
```

### 常见问题（FAQ）

- **启动后提示“云能力不可用”**
  - 确认已开通云开发、`envId` 已正确配置、基础库版本满足要求

- **OCR 报错 `missing MOONSHOT_API_KEY`**
  - 给云函数 `analyzeImage` 配置环境变量 `MOONSHOT_API_KEY`，并重新部署云函数

- **生成任务一直卡在 queued/running**
  - 检查云函数 `resetDailyScore` 是否已部署且定时触发器生效
  - 检查环境变量：`DEEPSEEK_API_KEY`（以及 `MOONSHOT_API_KEY` 用于 OCR）
  - 到云函数日志里看 `create_jobs` 的 `error` 字段与 worker 报错信息

- **小程序报错找不到 `tdesign-miniprogram/...`**
  - 先在 `xuexikazi/` 执行 `npm install`，再在开发者工具里执行 **工具 → 构建 npm**

- **旧文档里提到的 `mobilenetv2_11.onnx` 还需要上传吗？**
  - 不需要。当前 OCR 走 `analyzeImage` 的 Moonshot(Kimi) 视觉接口；仓库内的 `miniprogram/utils/config.js` 等属于历史遗留，不影响现流程

### 贡献

- 欢迎提交 Issue / PR。修改前建议先阅读 `docs/architecture.md`，保持页面 UI 与 `services/` 业务层解耦的结构。