# LearnCards 小程序架构说明（新 UI + 云开发数据联通）

本文档描述当前小程序（`miniprogram/`）的目录结构、数据模型、关键数据流与云函数连接方式。目标是保证 **页面 UI 与业务逻辑解耦**、**数据全部来自云数据库**、并在 **不修改 `cloudfunctions/`** 的约束下仍能完成完整闭环。

## 目录结构

```
miniprogram-2/
├─ cloudfunctions/                 # 云函数（本方案不修改此目录）
├─ docs/
│  └─ architecture.md              # 本文档
├─ miniprogram/
│  ├─ app.js / app.json / app.wxss # 全局主题/自定义tabBar/样式token
│  ├─ custom-tab-bar/              # 自定义底部导航（5入口）
│  ├─ pages/
│  │  ├─ home/                     # Home：搜索/筛选/Deck列表
│  │  ├─ library/                  # Create：选择输入方式→生成→写库
│  │  ├─ library/detail.*          # DeckDetail：卡片列表 + Add/Edit Modal
│  │  ├─ review/                   # StudyMode：due卡片翻转学习 + Summary
│  │  ├─ goals/                    # DailyGoals：目标/进度（读写 user_stats）
│  │  ├─ leaderboard/              # Rank：调用 getGlobalRank
│  │  ├─ profile/                  # Settings：用户统计/资料/开关/退出
│  │  └─ editor/                   # 旧编辑器页（保留且不改）
│  ├─ services/                    # 数据访问与业务服务层（页面不直连云能力）
│  │  ├─ auth.js                   # openid 获取与缓存（login）
│  │  ├─ cloud.js                  # 云函数统一封装（callFunction/callOkFunction）
│  │  ├─ cards.js                  # cards CRUD/聚合/查询 due
│  │  ├─ userStats.js              # user_stats 读取/写 dailyGoal/更新头像昵称
│  │  ├─ ocr.js                    # 上传图片 + analyzeImage OCR
│  │  ├─ ai.js                     # deepseek 生成卡片（复用 editor 的解析逻辑）
│  │  └─ time.js                   # 时间格式化
│  └─ utils/
│     ├─ flashcard-config.js       # 集合名常量（不改）
│     └─ config.js                 # 环境常量（不改）
└─ ui/                             # 用于对齐 UI
```

## 数据模型（云数据库）

### `cards`（collection: `cards`）
- **所有卡片均以用户隔离**：每条记录带系统字段 `_openid`。\n- **核心字段**（由前端写入/更新）：\n  - `deckTitle`: string（用于分组为 Deck；缺失/空 → 视为 `Inbox`）\n  - `question`: string\n  - `answer`: string\n  - `tags`: string[]（0-5）\n  - `createdAt` / `updatedAt`: `serverDate`\n- **复习字段**（由云函数 `submitReview` 写入/更新）：\n  - `nextReviewAt`: number (ms)\n  - `lastReviewedAt`: number (ms)\n  - `srsEF` / `srsInterval` / `srsReps`\n- **可选字段**（兼容旧数据/编辑器页）：\n  - `answerSections`, `sourceImage`, `sourceImages` 等\n+
### `user_stats`（collection: `user_stats`）
- **用户维度统计**：每条记录带 `_openid`。\n- 云函数 `submitReview` 会维护：\n  - `xp`, `dailyXp`, `streak`, `studiedToday`, `lastStudyDate`, `totalReviewed`\n- 前端会维护：\n  - `dailyGoal`（Goals页）\n  - `nickname`, `avatarUrl`（Settings/Profile 授权后写入，供排行榜展示）\n+
## Deck 分组策略（不新增 `decks` 集合）
由于不新增 `decks` 集合，Deck 完全由 `cards.deckTitle` 聚合得出：\n- **Deck 标识**：`deckTitle`（string）\n- **Inbox**：`deckTitle` 缺失/空/`Inbox` → 归为同一组\n- **统计字段（前端计算）**：\n  - `totalCards`: 该 deck 下 cards 数量\n  - `dueCount`: `nextReviewAt` 缺失或 `<= now` 的数量\n  - `progress`: \(100 - dueCount/totalCards\) 粗略百分比（用于 UI 进度条）\n  - `lastStudied`: `lastReviewedAt` 最大值转相对时间\n+
## 云函数连接（不改云函数）
前端通过 `[miniprogram/services/cloud.js](../miniprogram/services/cloud.js)` 统一调用：\n- `login`：返回 `openid`（用于前端查询 `_openid`）\n- `analyzeImage`：输入 `fileID`，返回 OCR `text`\n- `submitReview`：输入 `cardId` + `result(remember/forget)`，更新 `cards` 的 SRS 字段并更新 `user_stats`\n- `getGlobalRank`：返回 `top`（按 xp 排序）和 `me`（包含 rank；当前用于 Settings 页展示我的名次）\n\n注意：如果 Rank 页需要展示“所有用户”，且不改云函数，则需要将 `user_stats` 集合权限设置为“所有用户可读，仅创建者可写”。\n+
## 关键数据流

```mermaid
flowchart TD
  HomePage[HomePage] -->|query_cards_by_openid| CardsCollection[cards]
  CreatePage[CreatePage] -->|chooseImage| LocalImage[local_image]
  CreatePage -->|uploadFile| CloudStorage[cloud_storage]
  CreatePage -->|call_analyzeImage| AnalyzeImageFn[analyzeImage_fn]
  AnalyzeImageFn -->|ocr_text| CreatePage
  CreatePage -->|deepseek_generate_cards| DeepSeekAI[deepseek_ai]
  CreatePage -->|write_cards(deckTitle)| CardsCollection
  DeckDetailPage[DeckDetailPage] -->|query_cards_by_deckTitle| CardsCollection
  ReviewPage[ReviewPage] -->|query_due_cards_by_openid| CardsCollection
  ReviewPage -->|call_submitReview| SubmitReviewFn[submitReview_fn]
  SubmitReviewFn -->|update_srs_nextReviewAt| CardsCollection
  SubmitReviewFn -->|update_xp_streak_dailyXp| UserStats[user_stats]
  GoalsPage[GoalsPage] -->|read_write_dailyGoal| UserStats
  LeaderboardPage[LeaderboardPage] -->|query_user_stats_public| UserStats[user_stats]
  SettingsPage[SettingsPage] -->|read_user_stats| UserStats
  SettingsPage -->|update_nickname_avatar| UserStats
```

## 运行与权限要点
- **云能力初始化**：`app.js` 中 `wx.cloud.init({ env })`。\n- **读写隔离**：cards 默认按 `_openid` 隔离；如需 Rank 展示所有用户且不改云函数，需要将 `user_stats` 设置为“所有用户可读”（会暴露 `_openid`，请评估隐私）。\n- **可扩展点**：若未来允许改云函数，可继续通过 `getGlobalRank` 做更严格的数据脱敏/限字段返回等。 
