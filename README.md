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

## 開發與驗證

```bash
npm install
npm run check
```

`npm run check` 依序執行正式規格驗證、HTML 建置與測試。必要 Gate 未通過時不得發佈。

正常變更使用 branch 與 PR。驗證時必須核對 PR exact head SHA 所對應的 GitHub Actions CI run；PR 或 commit 存在不代表驗證成功。
