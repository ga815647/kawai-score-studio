# Kawai Score Studio

由 `scorebook.yaml` 驅動的 KAWAI 16 音木琴琴譜工作室。

## 一個 Project、一個入口

日後只使用一個 ChatGPT Project：`Kawai Score Studio`。使用者可以直接提出：

- 新增或修改琴譜
- 提供樂譜來源
- 請助理上網找樂譜
- 修改資料格式、產生器、Gate、CI 或網站

使用者不需要先選「使用」或「開發」模式；助理會自行判斷本次是琴譜內容工作或產生器開發。

網站仍保留正式曲庫與本機 Studio，兩者只是同一產品的功能模式，不是兩個 ChatGPT Project。

## 琴譜來源

正式琴譜只接受兩條來源路徑：

1. 使用者提供可檢視的樂譜網站、圖片、PDF、MusicXML 或其他靜態樂譜檔案。
2. 使用者只提供曲名，由助理上網找到可檢視的靜態樂譜或 MusicXML，固定確切版本後再轉錄。

使用者提供的來源優先決定旋律版本。網路研究必須先記錄確切來源、版本、原調、拍號、弱起、出版者或來源單位、權利狀態與存取日期。

私人圖片或檔案可只保存檔案參照與 SHA-256，不需要把有著作權的原檔放入公開 repository。

YouTube、影片、音訊錄音與記憶不作為旋律轉錄或正式驗證來源。找不到可核對的靜態樂譜或 MusicXML 時，流程停止，不憑印象補譜。

## 正式曲庫與本機 Studio

### 正式曲庫

正式曲庫只顯示 `status: verified` 的曲目。每首曲目必須具備：

- 確切靜態樂譜或 MusicXML 來源
- 指定旋律版本、原調、拍號、弱起及權利狀態
- 明確小節、休止符與連結線
- 來源到 scorebook 的逐項核對
- 旋律、節奏與歌詞驗證紀錄
- 使用者批准
- branch、PR、exact head SHA CI 與所有必要 Gate

目前正式曲庫收錄使用者指定的 Itsy Bitsy Kids Music 2018 PDF 版本〈Hickory Dickory Dock〉，只收譜面標示的第一段歌詞。舊有〈生日快樂〉與 Itsy Bitsy Spider 仍只保留隔離清單的名稱與原因。

來源資料以 `publisher_or_origin` 為正式欄位；`publisher` 只保留給現有結構驗證的相容路徑，兩者必須記錄相同來源單位。

### 本機 Studio

Studio 可直接在瀏覽器載入或貼上 JSON 草稿、預覽、播放、儲存到 localStorage 並列印 A4。草稿不會自動進入正式曲庫。

## 正式資料模型

- `scorebook.yaml` 是唯一正式規格。
- melody event 只包含音樂資料，不得內嵌歌詞。
- 歌詞使用獨立 `lyric_tracks`，以 event id 對位。
- note、rest、小節、弱起與 tie 都必須明確建模。
- 彩色簡譜、VexFlow 五線譜與 Web Audio 播放共用同一組 melody event。
- 英文歌曲預設使用已驗證的原文歌詞；翻譯是可選 track。
- 換行依小節、五線譜符號、簡譜及歌詞的實際寬度決定，不使用固定 event 數量。

每個譜行固定為：

1. 無框彩色簡譜
2. 五線譜
3. 歌詞

標準簡譜列固定在 `0px`，標準歌詞列固定在 `120px`；簡譜到第一條譜線為 10px，最後一條譜線到歌詞為 18px。簡譜只有實際重疊才上移，歌詞保留 2px 安全距離並只做最小下移。

## MusicXML 來源驗證

MusicXML 是來源證據，不是第二份正式規格。來源 Gate 使用固定版本工具：

1. W3C MusicXML 4.0 XSD，並核對固定 Git blob SHA。
2. `music21` 正規化逐顆 event，精確比較小節、順序、offset、音高、時值、休止符、tie 與歌詞。
3. `music21` round-trip 後再次通過 XSD，且事件完全不變。
4. Verovio 產生獨立 SVG 與 MIDI 參考證據。

目前 Gate 接受未壓縮、單一 part、單聲部的 MusicXML 4.0 `score-partwise`。含 `ENTITY` 或 DOCTYPE internal subset 的輸入會被拒絕。

合成來源 fixture 位於 [`fixtures/source-verification.musicxml`](./fixtures/source-verification.musicxml)，只驗證工具鏈，不是真實歌曲。

## 引擎與視覺 Gate

[`fixtures/engine-fixtures.yaml`](./fixtures/engine-fixtures.yaml) 使用純合成資料，涵蓋：

- 至少兩個譜行
- 木琴最低音 `4_` 與最高音 `5^`
- 弱起、小節容量、note、rest 與 tie
- 獨立英文 lyric track 與長音節排版
- 瀏覽器播放資料

Chromium Gate 量測共同簡譜列、共同歌詞 baseline、碰撞門檻、水平溢位與 A4 列印結果。

## 開發與驗證

需要 Node.js 20 與 Python 3.13。

```bash
npm install
python -m pip install -r requirements-source.txt
npx playwright install chromium
npm run check:visual
```

`npm run check:visual` 依序執行：

1. 正式規格、單一入口與來源政策 Gate
2. MusicXML XSD、music21 diff、round-trip 與 Verovio Gate
3. 合成 fixture 音樂結構 Gate
4. HTML 建置與單元測試
5. Chromium 視覺與列印 Gate

建置輸出位於 `dist/`；驗證結果位於 `reports/` 與 `test-results/`。這些都是可重新產生的輸出，不是規格來源。

## 發佈規則

- 正常變更使用 branch 與 PR。
- 必須核對 PR exact head SHA 對應的 CI run。
- 必要 Gate 未通過或使用者尚未批准時，不得合併或發佈。
- 輸出頁面的圖片只能作無文字裝飾；來源樂譜圖片不受此限制。

詳細規範請見 [`AGENTS.md`](./AGENTS.md)。
