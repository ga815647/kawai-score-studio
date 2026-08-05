# Kawai Score Studio

由 `scorebook.yaml` 的結構化 event 資料產生彩色簡譜、歌詞、五線譜與 Gate 報告。

## 正式規格

- `scorebook.yaml` 是唯一正式規格檔。
- `dist/` 與 `reports/` 都是生成結果，不可手工修改來修正正式內容。
- 彩色簡譜、歌詞與五線譜由同一組 event 資料產生。
- 琴譜只能使用 KAWAI 16 音木琴實際存在的音。

## 目前版型

- 固定 A4 直式書頁，四周 12mm 邊界。
- 日式兒童教材風格的靠左圓角標題區。
- 彩色方框簡譜為主，五線譜為輔。
- 每個譜行最多 13 個 event；過長 phrase 由產生器分行，不遺失資料。
- 網頁窄螢幕以整張 A4 等比例縮小，不提供譜行橫向捲動。
- 插圖暫不放置；未來只能加入不承載文字或琴譜的裝飾圖。
- 不產生鋼琴鍵盤對照區。

## 簡譜、歌詞與節奏

- 彩色簡譜不另外顯示延長底線；節奏由同一組 event 資料產生的五線譜表達。
- 中文歌詞逐起音對位，並與彩色框共用 VexFlow 音頭的 X 座標。
- 簡譜列高度、歌詞位置、五線譜靠近量及實際允許距離都由 `scorebook.yaml` 定義。

## 五線譜與對齊

- 五線譜由固定版本的 VexFlow 5.0.0 產生 SVG，不再使用手工繪製的音頭、音桿或譜號。
- VexFlow 依每首歌的調性與拍號產生譜號、調號、拍號、附點、八分音符連桿及複合時值連結線。
- 產生器在 VexFlow 完成格式化後讀取每個 event 第一音頭的實際 X 座標。
- 彩色音符框與歌詞直接使用同一組 X 座標，因此不再各自平均分欄。
- `dist/vendor/vexflow.js` 在建置時由本地 `node_modules` 複製，不依賴執行時 CDN。

## 瀏覽器視覺 Gate

- CI 使用固定版本 Playwright 1.55.0 與 Chromium 打開建置後頁面。
- Gate 會等待頁面進入 PASS 狀態，再量測每個譜行中文底部到五線譜第一條線的實際瀏覽器距離。
- 《小小蜘蛛》會固定產生完整 A4 與第一譜行局部 PNG。
- PNG、量測 JSON、失敗截圖與 trace 都放在 GitHub Actions artifact；artifact 名稱包含 exact head SHA，保留 14 天。
- 現階段以可量測距離與人工查看 PNG 為準；使用者確認版型後，才適合把確認過的圖片升格為固定視覺回歸 baseline。

## 開發與驗證

```bash
npm install
npx playwright install chromium
npm run check:visual
```

`npm run check:visual` 依序執行正式規格驗證、HTML 建置、單元測試與 Chromium 視覺 Gate。必要 Gate 未通過時不得發佈。

正常變更使用 branch 與 PR。驗證時必須核對 PR exact head SHA 所對應的 GitHub Actions CI run；PR 或 commit 存在不代表驗證成功。
