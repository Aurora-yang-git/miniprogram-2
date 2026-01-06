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
- **学习与复习**
  - **Study**：按卡包全量学习
  - **Review**：只复习到期卡（due）
  - 复习结果写入云端，由云函数更新 **nextReviewAt / streak / XP**
- **目标与数据面板**
  - Daily Goal、今日完成量、连续学习 streak、周/月统计
- **排行榜**
  - 云函数聚合 `user_stats.xp` 返回 Top 与我的排名

### 技术栈概览

- **小程序端**：原生小程序（`miniprogram/`）+ `tdesign-miniprogram` + 自定义 TabBar
- **云开发**：云数据库（`cards` / `user_stats`）+ 云存储 + 云函数（`cloudfunctions/`）
- **AI**
  - **OCR**：云函数 `analyzeImage` 调用 Moonshot(Kimi) 视觉接口（需要配置 `MOONSHOT_API_KEY`）
  - **卡片生成**：小程序端调用 `wx.cloud.extend.AI` 的 `deepseek-r1`

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

### 依赖说明与冗余依赖结论

- **小程序端（`xuexikazi/package.json`）**
  - 只用于 **小程序端 npm 依赖管理 + 开发者工具“构建 npm”**（生成 `miniprogram/miniprogram_npm/`）
  - 当前仅需要 `tdesign-miniprogram`，**不需要**在根目录安装 `wx-server-sdk`

- **云函数（`cloudfunctions/*/package.json`）**
  - 每个云函数独立部署，依赖各自的 `package.json`（当前都依赖 `wx-server-sdk@^2.6.3`）
  - 这类重复声明是云函数部署方式决定的，**不属于冗余**

- **参考 UI**
  - 仓库根目录下的 `reference image/ui` 为 UI 对齐/参考工程，**不影响小程序运行**；只有在你要启动该参考工程时才需要安装它的依赖

### 云函数说明

- **`login`**：返回当前用户 `openid`
- **`submitReview`**：提交复习结果（remember/forget），更新 `cards` 的 SRS 字段，并维护 `user_stats`（XP、dailyXp、streak 等）
- **`getGlobalRank`**：读取 `user_stats`，返回 Top50 与我的排名（当前排行榜页面 streak 显示为 `-`，因为云函数返回里未包含）
- **`analyzeImage`**：输入云存储 `fileID`，输出 OCR 文本（依赖 `MOONSHOT_API_KEY`）

### 云数据库数据模型（简版）

- **`cards`**
  - `deckTitle`: string（缺失/空会被视为 `Inbox`）
  - `question`: string
  - `answer`: string
  - `tags`: string[]
  - `createdAt` / `updatedAt`
  - SRS 字段：`nextReviewAt` / `lastReviewedAt` / `srsEF` / `srsInterval` / `srsReps`

- **`user_stats`**
  - `xp` / `dailyXp` / `totalReviewed`
  - `streak` / `studiedToday` / `lastStudyDate`
  - `dailyGoal`
  - `nickname` / `avatarUrl`（用于个人页与排行榜展示）

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

- **生成卡片时报 “AI能力不可用”**
  - 需要云开发 AI 能力可用（`wx.cloud.extend.AI`）；无法使用时可先用“粘贴文本/手动创建”方式

- **小程序报错找不到 `tdesign-miniprogram/...`**
  - 先在 `xuexikazi/` 执行 `npm install`，再在开发者工具里执行 **工具 → 构建 npm**

- **旧文档里提到的 `mobilenetv2_11.onnx` 还需要上传吗？**
  - 不需要。当前 OCR 走 `analyzeImage` 的 Moonshot(Kimi) 视觉接口；仓库内的 `miniprogram/utils/config.js` 等属于历史遗留，不影响现流程

### 贡献

- 欢迎提交 Issue / PR。修改前建议先阅读 `docs/architecture.md`，保持页面 UI 与 `services/` 业务层解耦的结构。