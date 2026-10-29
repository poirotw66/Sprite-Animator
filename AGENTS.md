# 專案維護入口

本專案已是多工具工作室。優先維護既有流程、作業還原與 SKILL 一致性；除非使用者要求，勿擴增功能或 SKILL。

## SKILL 路由與正式來源

正式來源為 `skills/`，先讀取對應的 `SKILL.md` 再執行流程：

| 使用者需求 | SKILL |
|---|---|
| 花花系列發想／下一彈／花花文案 JSON | `skills/huahua-line-sticker-series/SKILL.md` |
| 4×5 透明貼圖圖集／20 格精靈圖 | `skills/line-sticker-sprite-sheet/SKILL.md` |
| 角色參考圖／設定圖 | `skills/line-sticker-character-ref/SKILL.md` |
| 貼圖文案／phrase-set JSON | `skills/line-sticker-phrase-design/SKILL.md` |
| 從參考圖與文案／圖片 + JSON 製作整套貼圖 | `skills/line-sticker-pipeline/SKILL.md` |
| 進階 job config 操作／單張重生／既有作業修復、重切、finalize／既有圖集轉換 | `skills/line-sticker-maker/SKILL.md` |
| 每日量產／登記／主題輪替 | `skills/line-sticker-daily-factory/SKILL.md` |
| Drive staging／LINE 上傳／送審 | `skills/line-sticker-upload/SKILL.md` |

共用模組位於 `skills/shared/`。`.agents/skills/` 與 `.claude/skills/` 是 gitignored 的生成副本，勿直接修改。正式來源修改後（或首次安裝時）執行：

```bash
npm run skills:sync:line-sticker
npm run skills:check:line-sticker
npm run skills:check:contracts
```

同步會忽略 `__pycache__/`、`.pyc`、`.pyo`；憑證、登入狀態與 debug snapshots 仍禁止放入正式來源，且不會複製至副本。Python 指令使用 `python -B`；批次子程序也設定 `PYTHONDONTWRITEBYTECODE=1`。

`skills:check:contracts` 檢查技能與流程文件的本機連結，以及可匯入的正式文案範例。對話規劃用的 20 格 JSON 不套用整套 40 張匯入規格。

全域安裝副本另以 `npm run skills:check:installed` 唯讀檢查；不包含在專案副本同步與 CI 中。更新必須明確指定技能與檢查取得的舊版本指紋，並保留備份；完整指令見 README 的技能維護說明。

交付貼圖時，依 `skills/line-sticker-maker/references/content-review.md` 記錄逐張內容審核，再執行 `npm run stickers:check:content -- --out <job-dir>`。此檢查驗證審核紀錄、圖片對應與雜湊；不能代替視覺審查，也不表示已獲授權上傳或送審。

## 可重現環境與驗證

Node.js `>=20 <27`、npm 10+（專案指定 10.9.2）；Python 3.12、uv `>=0.11.28 <0.12`（CI 使用 0.11.32）。使用 lockfile 安裝，勿以刪除或重建 lockfile 處理缺少依賴：

```bash
npm ci
npm run python:sync
npx playwright install chromium
```

若要操作 Python 上傳工具，另執行 `uv run --locked playwright install chromium`。Linux 缺系統依賴時，Node Playwright 安裝可加 `--with-deps`。

完整本機品質檢查為 `npm run ci`：安全 audit／秘密掃描、SKILL sync/check、typecheck、lint、縮圖檢查、單元測試、離線與 mock E2E、Python 測試與 self-check、build、bundle 秘密掃描及 dist budget。它不部署、不生成付費圖片，也不上傳 LINE。CI workflow 位於 `.github/workflows/ci.yml`，推送 main 會觸發部署。

依修改範圍先跑必要檢查；交付時區分已通過、失敗與未驗證項目，勿只憑單元測試宣稱整套 CI 通過。修改瀏覽器縮圖來源後執行 `npm run previews:build`；字型由 predev/prebuild 建置與檢查。

## 產物與敏感設定

- 網站建置：`dist/`；E2E 產物：`test-results/`、`playwright-report/`。
- CLI 貼圖套件：通常 `output/<set>/`（也可指定 `--out`），包含 ZIP、文案、sprite sheets、manifest 與 `.env.batch/`。
- 上傳輸入：`.line-upload/input/706/<set>/`；批次環境：`.line-upload/.env.batch/`；登入狀態：`.line-upload/state/`。
- 憑證與 OAuth：`.secrets/line-sticker/`；本機開發金鑰：`.env.local`。勿讀出、列印或提交憑證、含秘密的 batch env 與登入狀態。
- `assets/` 是字型與縮圖來源；`fonts/`、`graphify-out/` 及上述執行產物為本機生成資料。

生成或封裝不代表獲授權上傳；上傳不代表獲授權送審。僅執行使用者授權的套件、批次範圍與步驟。批次腳本預設只上傳，明確授權送審後才加 `--submit`；`--skip-submit` 保留相容，兩個參數不能並用。維護與測試使用離線 fixture／mock，不呼叫付費生成或真實外部上傳。
