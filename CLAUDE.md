# Project: EZDash（EZDashboard builder）

## What This Is
把 Excel / CSV 一鍵變成可互動網頁儀表板的**純前端 SPA**，可匯出成資料內嵌、離線可用的單一 HTML 檔。
線上版：https://ezdashboard-builder.netlify.app

**目前狀態：功能完整、視為完成。** 等使用者回饋再決定是否續修，沒有進行中的開發項目。
接手的 agent 請注意：**不要自行發起重構、加功能或「順手改進」。**

## Tech Stack
- React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4
- `xlsx`（Excel/CSV 解析）、`chart.js`（圖表）、`lucide-react`（圖示）、`motion`（動畫）
- `vite-plugin-singlefile`（單檔匯出）
- **無後端、無資料庫、不需任何 API key** —— 這是產品定位，不是尚未實作

## Key Commands
- 開發：`npm install` → `npm run dev` → http://localhost:3000
  （走 `server.ts`：Express + Vite middleware，**不是** `vite dev`）
- 建置：`npm run build`（靜態站到 `dist/` + esbuild 打包 `server.cjs`）
- 單檔建置：`npm run build:single`（產出 `dist/index.html`）
- 檢查：`npm run lint`（**只做 `tsc --noEmit`**，無 ESLint、無測試）

## Deployment
- push 到 `main` → **只觸發 GitHub Pages**（GitHub Actions，公開 repo 免費）
- **Netlify 已解除 Git 連動，不會自動部署**——需更新時手動觸發（Netlify MCP `deploy-site`）
- 因此兩個站可能版本不一致：Pages 為最新，Netlify 停在最後一次手動發布

## Conventions
- 所有資料處理在瀏覽器端完成，不要引入後端或需要 API key 的服務
- 中文 UI；程式碼識別字與註解用英文
- **本 repo 為公開**——不要在任何進版控的檔案寫入絕對路徑、使用者名稱、內部網域或金鑰

## 專案記憶位置

本專案的脈絡、決策與進度紀錄於 Cross Project Hub（另一個 Obsidian vault，不在本 repo）：

```
$env:OneDrive\文件\Project Hub\Cross Project Hub\projects\EZDash\
```

> 路徑刻意用 `$env:OneDrive` 表示，讓它在不同機器上都能解析，也避免把個人路徑寫進公開 repo。
> PowerShell 可直接展開；找不到時請向使用者確認 OneDrive 位置。

- Session 開始時，依序讀 `context.md` → `decisions.md` → `STATE.md`
- Session 結束前，更新 `STATE.md`；若有方案取捨，追加一條到 `decisions.md`
- `decisions.md` 為 **append-only**，不得修改既有條目
- `decisions.md` 中標「（推測）」的理由尚未經使用者確認，不要當成既定事實引用
