# 项目整体结构与模块职责（阶段化目标）

> 本文档用于约定后续所有开发遵循的目录结构、模块边界和 utils 设计原则，随着阶段推进可以逐步细化，但大方向保持不变。

## 1. 顶层目录规划

```
miniprogram-2/
├─ app.js / app.json / app.wxss
├─ project.config.json / sitemap.json
├─ docs/                  # 设计与方案文档
├─ utils/
│  ├─ mock-data.js        # 阶段0：预置卡片数据
│  ├─ api.js              # HTTP / 云函数封装（统一错误处理）
│  ├─ config.js           # 云环境 & 模型资源等常量
│  └─ formatters.js       # Markdown/LaTeX/标签等格式化工具
├─ services/              # 业务逻辑层（与 UI 解耦）
│  ├─ card-service.js     # 卡片 CRUD / review 状态更新 / 导出
│  ├─ upload-service.js   # 单张/批量上传、任务状态轮询
│  └─ review-service.js   # 间隔重复算法、任务生成、提醒
├─ components/            # 可复用 UI 组件（answer section、卡片预览等）
├─ pages/
│  ├─ index/              # 上传入口，负责拍照/预览/发起生成
│  ├─ cards/              # 卡片列表 + 详情 + 编辑
│  ├─ upload-batch/       # 阶段1：批量上传与进度
│  ├─ review/             # 阶段2：复习闭环（今日待复习、掌握度）
│  └─ settings/           # （可选）订阅消息授权、账号设置
├─ cloudfunctions/        # 若使用微信云函数，放 OCR/LLM/调度逻辑
└─ miniprogram_npm/       # tdesign-miniprogram 等依赖
```

## 2. utils 目录规范
1. **只放纯工具/无副作用模块**，不得混入服务层逻辑。
2. `api.js` 统一封装 `wx.request` / `wx.cloud.callFunction`，其他模块通过 `services/*` 调用 API，页面不直接依赖 utils。
3. 新工具函数需具备明确职责与单测范围，并在本文件或 README 内注明用途。
4. 阶段 0 的 mock 数据集中在 `utils/mock-data.js`，后续切换到真实数据时，只需替换 `services/card-service` 的数据来源。

## 3. 业务层与页面职责
| 页面/模块        | 职责概述 |
|------------------|----------|
| `pages/index`    | 上传/拍照 → 画布预览 → 调 `upload-service` 发起 AI 生成；负责图像选择体验。 |
| `pages/cards`    | 卡片列表、详情、编辑、记忆提示、复习按钮；数据来自 `card-service`。 |
| `pages/upload-batch` | 批量上传与进度反馈；与 `upload-service` 的批处理接口交互。 |
| `pages/review`   | 今日复习列表、掌握度选择、复习曲线；依赖 `review-service` 和订阅消息。 |
| `services/card-service` | 管理卡片生命周期，读写卡片数据、更新 reviewStatus、导出 Markdown/LaTeX。 |
| `services/upload-service` | 单张/批量上传、OCR/LLM 任务调度、结果轮询。 |
| `services/review-service` | 间隔重复算法、生成/更新每日任务、触发提醒。 |

## 4. 阶段化扩展对照
- **阶段 0**：`pages/index` + `pages/cards` + `utils/mock-data`。占位接口在 `services/card-service`/`upload-service` 中实现 mock。
- **阶段 1**：新增 `pages/upload-batch`、扩展 `upload-service` 支持批任务、`card-service` 支持分页/单元筛选。
- **阶段 2**：新增 `pages/review` 与 `review-service`，实现今日复习、掌握度记录、订阅消息。
- **阶段 3**：增强 `card-service`/`pages/cards`，显示 AI 生成轮次、质量说明、展开例题等。

## 5. 协作约定
1. Figma → Vibecoding → Windsurf 流程，组件命名和交互以 Figma 为准。
2. 所有页面使用 TDesign 组件库；在各自 `index.json` 中声明 `usingComponents`。
3. 日志与埋点由 `services/*` 负责上报，页面只负责触发。
4. 新模块需在此文档更新结构说明，防止 utils 再次堆积无序逻辑。

> 记住：utils 只放“纯工具”，业务放 services，数据流由 services → pages，确保后续扩展（批量、复习、订阅消息）依旧清晰易维护。
