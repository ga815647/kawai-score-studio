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

全曲預設使用相同的簡譜列與歌詞 baseline。標準簡譜列固定在譜行頂端 `0px`，標準歌詞列固定在 `120px`；目前五線譜相較原始位置單獨上移 6px，因此標準簡譜到第一條譜線為 10px，最後一條譜線到歌詞為 18px。簡譜與歌詞的標準位置不會跟著五線譜移動。

產生器會讀取 VexFlow 為每顆 `StaveNote` 產生的 pointer rectangle；該矩形依音頭、音桿、旗幟及加線幾何形成安全範圍。簡譜與歌詞採用不同門檻：簡譜只有實際與安全範圍重疊時才上移，門檻為 `0px`；歌詞保留 `2px` 安全距離，不足時才下移。兩者都只做解除碰撞所需的最小位移。

因此最高音 `5^` 的簡譜可維持全曲共同簡譜列，Do（音 `1`）的歌詞也維持共同 baseline；只有真正超過各自門檻的標籤才個別位移。極端音仍使用與一般音完全相同的幾何規則，不依音名硬編碼。

## MusicXML 來源驗證

MusicXML 是來源證據，不是第二份正式規格。正式內容仍只修改 `scorebook.yaml`。來源 Gate 使用四層互相獨立的確定性檢查：

1. 下載 W3C MusicXML 4.0 官方 XSD，並以固定 Git blob SHA 驗證檔案內容。
2. 使用固定版本 `music21` 將來源正規化為逐顆 event，與 scorebook fixture 精確比較小節、順序、offset、音高、時值、休止符、tie 與歌詞。
3. 由 `music21` 寫回 MusicXML，再次通過 XSD 並與來源逐顆比較，確認 round-trip 沒有改變內容。
4. 使用固定版本 Verovio 產生獨立的 SVG 與 MIDI 參考證據。Verovio 產物不能反向成為正式資料。

目前 Gate 只接受 MusicXML 4.0 `score-partwise`、單一 part、單聲部、未壓縮 `.musicxml`。為避免 XML external entity 風險，含 `ENTITY` 或 DOCTYPE internal subset 的輸入會直接拒絕；單純外部 DOCTYPE 只會在暫存副本中移除，原始來源不會被改寫。

合成來源 fixture 位於 [`fixtures/source-verification.musicxml`](./fixtures/source-verification.musicxml)，只用來驗證工具鏈，不是真實歌曲，也不得發佈。

來源 Gate 會建立：

```text
reports/source/
├─ musicxml-schema-report.json
├─ normalized-source-events.json
├─ normalized-scorebook-events.json
├─ event-diff.json
├─ roundtrip-diff.json
├─ roundtrip.musicxml
├─ verovio-reference.svg
├─ verovio-reference.mid
├─ source-verification-report.json
└─ source-verification-report.html
```

這些檔案是可重新產生的驗證證據，不是規格來源。

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

Chromium Gate 會量測全曲預設列是否一致、五線譜上移後簡譜與歌詞標準列是否仍鎖定、每個標籤是否套用正確的獨立安全門檻、每個位移是否恰好等於解除碰撞所需的最小值、最高音簡譜與 Do 歌詞是否保持共同列，以及最高音與最低音是否都實際進入測試。

fixture 不是真實歌曲，禁止當作正式曲目發佈。

## 開發與驗證

需要 Node.js 20 與 Python 3.13。

```bash
npm install
python -m pip install -r requirements-source.txt
npx playwright install chromium
npm run check:visual
```

`npm run check:visual` 依序執行：

1. 正式規格與出版政策 Gate
2. MusicXML XSD、music21 event diff、round-trip 與 Verovio 證據 Gate
3. 合成 fixture 音樂結構 Gate
4. HTML 建置
5. 單元測試
6. Chromium 截圖與幾何 Gate

建置輸出位於 `dist/`。本機可使用任一靜態伺服器開啟，例如：

```bash
python -m http.server 8000 -d dist
```

## 專案規則

- `scorebook.yaml` 是正式規格檔。
- MusicXML、OMR、MIDI 與 AI 轉錄只可作來源證據或草稿。
- `dist/`、`reports/`、`test-results/` 與 `playwright-report/` 都是可重新產生的輸出。
- 不直接修改生成後的 HTML、簡譜或五線譜來修正正式內容。
- 圖片只能作無文字裝飾，不得承載音符、歌詞或五線譜。
- 正式發佈使用 branch 與 PR，並核對 PR exact head SHA 的 CI run。
- 必要 Gate 未通過或使用者尚未批准時，不得合併或發佈。

詳細工作規範請見 [`AGENTS.md`](./AGENTS.md)。
