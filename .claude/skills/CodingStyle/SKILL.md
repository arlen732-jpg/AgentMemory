---
name: CodingStyle
description: >
  AgentMemory 個人記憶庫的 Coding Style 規範。
  在此專案中撰寫或修改程式碼時自動套用，確保風格一致。
  涵蓋 Next.js 16 App Router、TypeScript、Tailwind v4 design tokens、
  sessionStorage 資料層、跳窗通知、表單驗證、命名與註解慣例。
---

# AgentMemory Coding Style Guide

## 子專案參考

修改特定子專案時，先讀 `通用.md`，再依功能類型讀對應檔案：

- **demo-site**（Next.js 16 + TS + Tailwind v4，純前端 Demo）：[demo-site/通用.md](demo-site/通用.md)
  - [列表頁面.md](demo-site/列表頁面.md) | [表單抽屜.md](demo-site/表單抽屜.md)

## 全專案共通規範

### 語言與文案
- UI 文案、註解一律繁體中文（台灣用語）；識別字用英文。
- 錯誤訊息要寫出原因與下一步，例：「分類「個人」已有同名記憶」。

### 命名
| 對象 | 規則 | 例 |
|---|---|---|
| 元件檔、元件 | PascalCase | `MemoryDrawer.tsx` |
| 工具模組檔 | 小寫單字 | `lib/dates.ts`、`lib/store.ts` |
| 常數物件 | UPPER_SNAKE | `LIMITS`、`TOKEN_STATUS` |
| `data-testid` | `{功能}-{元素}-{類型}` kebab-case | `memory-save-btn`、`memories-search-input` |

### 變更追蹤註解
新增或修改有業務意義的區塊時加註：

```ts
// [YYYY/MM/DD] - [作者] - [原因]
```

跨多行的修改用 `- Start` / `- end` 包起來（見全域 CLAUDE.md）。

### 必守規則（DevGuidelines）
- 頁面**禁止硬寫色碼**，一律用 `theme.css` 的 utility（`bg-primary`、`text-fg-secondary`…）。
- 前端儲存一律 `sessionStorage`。
- 送件結果一律 `dialog.notify()` 跳窗，不用 Toast。
- 刪除一律 `dialog.confirmDelete()`（輸入「刪除」兩字）。
- 日期顯示 `yyyy/MM/dd`，透過 `lib/dates.ts`，不直接 `toLocaleString()`。
- 文字輸入一律給 `maxLength`，值取 `LIMITS`。
- 列舉值集中定義成常數（`as const`），不寫字面值。
