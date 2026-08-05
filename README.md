# Kawai Score Studio

由 `scorebook.yaml` 驅動的 KAWAI 16 音木琴琴譜工作室。

## 兩種模式，同一個網站

### 正式曲庫

正式曲庫只顯示 `status: verified` 的曲目。每首正式曲目必須具備：

- 確切來源與指定旋律版本
- 原調、拍號、弱起與權利狀態
- 明確小節、休止符及連結線
- 逐項旋律、節奏與歌詞核對紀錄
- 使用者批准
- branch、PR、exact head SHA CI 與所有必要 Gate

目前正式曲庫為空。舊有的〈生日快樂〉、Itsy Bitsy Spider 與 Hickory Dickory Dock 只保留隔離清單的名稱與原因，不保留或發佈未驗證旋律及歌詞。

### 本機 Studio

本機 Studio 可直接在瀏覽器：

- 載入或貼上 JSON 草稿
- 預覽彩色簡譜、五線譜與歌詞
- 使用 Web Audio 播放同一組 melody event
- 儲存在瀏覽器 localStorage
- 列印 A4 草稿

草稿預覽與播放不需要 GitHub、PR 或 GitHub Actions，也不會自動進入正式曲庫。

## 正式資料模型

- melody event 只包含音樂資料，不得內嵌歌詞。
- 歌詞使用獨立 `lyric_tracks`，以 event id 對位。
- 英文歌曲預設使用已驗證的原文歌詞；翻譯是可選 track。
- note、rest、小節、弱起與 tie 都必須明確建模。
- 彩色簡譜、VexFlow 五線譜與 Web Audio 播放共用同一組 melody event。
- 每個譜行依小節、五線譜符號、簡譜與歌詞實際寬度決定換行，不使用固定 event 數量。

頁面垂直順序固定為：

1. 無框彩色簡譜
2. 五線譜
3. 歌詞

全曲預設使用相同的簡譜列與歌詞 baseline。產生器會讀取每顆 VexFlow `StaveNote` 實際渲染後 SVG 群組的 `getBBox()`；只有某個標籤與該音符外框不足 6px 時，才對該標籤做最小位移。簡譜只能上移，歌詞只能下移；同一個極端音可能只移一個標籤，也可能兩個都需移動，完全由實際幾何決定。其他標籤仍維持全曲標準位置。

## 引擎測試

引擎 Gate 只使用 [`fixtures/engine-fixtures.yaml`](./fixtures/engine-fixtures.yaml) 的合成資料。fixture 涵蓋：

- 至少兩個譜行
- KAWAI 16 音木琴最低音 `4_`
- KAWAI 16 音木琴最高音 `5^`
- 弱起拍
- 小節容量
- note 與 rest
- tie
- 獨立英文 lyric track
- 長英文音節排版
- 瀏覽器播放資料

Chromium Gate 會量測全曲預設列是否一致、未碰撞標籤是否保持零位移、每個位移是否恰好等於解除碰撞所需的最小值、最高音與最低音是否都實際觸發極端音測試，以及位移後是否仍保留規定的音符外框安全距離。

fixture 不是真實歌曲，禁止當作正式曲目發佈。

## 開發與驗證

需要 Node.js 20 以上版本。

```bash
npm install
npx playwright install chromium
npm run check:visual
```

`npm run check:visual` 依序執行：

1. 正式規格與出版政策 Gate
2. 合成 fixture 音樂結構 Gate
3. HTML 建置
4. 單元測試
5. Chromium 截圖與幾何 Gate

建置輸出位於 `dist/`。本機可使用任一靜態伺服器開啟，例如：

```bash
python -m http.server 8000 -d dist
```

## 專案規則

- `scorebook.yaml` 是正式規格檔。
- `dist/`、`reports/`、`test-results/` 與 `playwright-report/` 都是可重新產生的輸出。
- 不直接修改生成後的 HTML、簡譜或五線譜來修正正式內容。
- 圖片只能作無文字裝飾，不得承載音符、歌詞或五線譜。
- 正式發佈使用 branch 與 PR，並核對 PR exact head SHA 的 CI run。
- 必要 Gate 未通過或使用者尚未批准時，不得合併或發佈。

詳細工作規範請見 [`AGENTS.md`](./AGENTS.md)。
