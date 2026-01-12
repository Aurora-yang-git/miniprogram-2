# Official deck local sources (NOT packed)

This folder is **outside**:

- `miniprogramRoot`: `miniprogram/`
- `cloudfunctionRoot`: `cloudfunctions/`

So anything you put here **will not be included** in the WeChat miniprogram code package or cloudfunction packages.

## Recommended JSON format

You can import one deck per file:

```json
{
  "deckTitle": "阿房宫赋｜句子翻译",
  "tags": ["G11 Chinese"],
  "description": "官方默认卡包（可收藏到你的卡库）",
  "cards": [
    { "q": "长桥卧波，**未云**何龙？", "a": "长桥卧在水上，**没有云**怎么出现了龙？", "topic": "阿房宫赋" }
  ]
}
```

Or multiple decks in one file:

```json
{
  "decks": [ { "...": "..." }, { "...": "..." } ]
}
```

Allowed official deck tags:

- `G11 ACT`
- `AP CSP`
- `AP Psych`
- `G11 Chinese`

## How to sync (in app)

Open **Settings → Developer → Sync Official Decks**, then choose your JSON file(s) and sync.
