export const MOCK_CARDS = [
  {
    id: "card_001",
    subject: "微观经济学",
    unitName: "弹性理论",
    tags: ["必考", "公式"],
    status: 1,
    question: "需求价格弹性 (Price Elasticity of Demand) 的定义与公式？",
    sourceType: "preset",
    createdAt: "2023-10-01",
    sourceImage: "https://tdesign.gtimg.com/miniprogram/images/example1.png",
    answerSections: [
      {
        type: "conceptName",
        title: "概念名称",
        content: "需求价格弹性 (Ed)"
      },
      {
        type: "definition",
        title: "定义",
        content: "衡量需求量对价格变动的反应程度。即价格变动 1%，需求量变动百分之几。"
      },
      {
        type: "formula",
        title: "计算公式",
        latex: "E_d = \\frac{\\Delta Q / Q}{\\Delta P / P} = \\frac{\\Delta Q}{\\Delta P} \\cdot \\frac{P}{Q}",
        content: "Ed = (需求量变动% / 价格变动%)"
      },
      {
        type: "note",
        title: "判断标准",
        content: "|Ed| > 1 : 富有弹性 (奢侈品)\n|Ed| < 1 : 缺乏弹性 (必需品)"
      }
    ],
    memoryHint: "口诀：弹力大，反应大；弹力小，反应小。奢侈品这东西，涨价我就不买了（反应大）。",
    reviewStatus: { level: 1, nextReviewTime: 1718000000 }
  },
  {
    id: "card_002",
    subject: "微观经济学",
    unitName: "成本论",
    tags: ["核心概念"],
    status: 0,
    question: "什么是边际成本 (Marginal Cost)？",
    sourceType: "preset",
    sourceImage: "https://tdesign.gtimg.com/miniprogram/images/example2.png",
    answerSections: [
      {
        type: "definition",
        title: "定义",
        content: "边际成本是指每新增一单位产量所增加的总成本。"
      },
      {
        type: "formula",
        title: "公式",
        latex: "MC = \\frac{\\Delta TC}{\\Delta Q}",
        content: "MC = ΔTC / ΔQ"
      },
      {
        type: "curve_desc",
        title: "曲线特征",
        content: "MC 曲线呈 U 型，且穿过 AC 曲线的最低点。"
      }
    ]
  },
  {
    id: "card_003",
    subject: "国际贸易",
    unitName: "贸易理论",
    tags: ["大卫·李嘉图", "例子"],
    status: 2,
    question: "如何理解“比较优势” (Comparative Advantage)？",
    sourceType: "preset",
    answerSections: [
      {
        type: "definition",
        title: "定义",
        content: "一个生产者以低于另一个生产者的机会成本生产一种物品的行为。"
      },
      {
        type: "example",
        title: "经典案例",
        content: "假设：\n- 乔丹：打球 1000分/时，修剪草坪 100美元/时\n- 邻居小孩：打球 0分/时，修剪草坪 10美元/时\n\n乔丹修草坪的机会成本高，而邻居小孩低，因此应各自专注低机会成本的活动。"
      }
    ],
    memoryHint: "关注谁的机会成本更低，而不是谁绝对效率高。"
  }
];
