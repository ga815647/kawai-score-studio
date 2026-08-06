# Kawai Score Studio

由 `scorebook.yaml` 驅動的 KAWAI 16 音木琴琴譜工作室。簡譜、VexFlow 五線譜與 Web Audio 播放共用同一組 melody event；歌詞使用獨立 lyric track。

## 正式曲庫

目前 branch 版本包含 6 首已驗證曲目：

1. Hickory Dickory Dock（老鼠時鐘）
2. 小星星
3. 兩隻老虎
4. 王老先生有塊地
5. 瑪麗有隻小綿羊
6. 生日快樂

五首中文兒歌採使用者指定的通俗繁體中文版本。旋律與中文歌詞均固定到可檢視的靜態樂譜或 MusicXML；找不到確切來源時不得憑記憶補譜。舊 Itsy Bitsy Spider 仍留在隔離清單。

## 工作入口

- Repository 第一入口：`AGENTS.md`
- 唯一正式規格：`scorebook.yaml`
- 正式輸出：HTML
- 正式發佈：branch、PR、exact head SHA CI、必要 Gate 全部成功後，另待使用者肉眼批准

YouTube、影片、音訊錄音與記憶不得作為正式旋律來源。使用者提供的靜態來源優先決定版本。

## 資料與版面原則

- note、rest、小節、弱起與 tie 必須明確建模。
- 不可使用 KAWAI 16 音木琴不存在的音。
- 每個譜行依序為彩色簡譜、五線譜、歌詞。
- 正式歌曲使用 600px 寬度預算；tie 相連小節不得拆行。
- 相鄰歌詞至少保留 8px 水平距離；單一 event 水平位移不得超過 24px。
- `dist/` 與 `reports/` 都是可重建輸出，不是正式規格。

## 驗證

需要 Node.js 20、Python 3.13，以及固定版本的 VexFlow、Playwright、music21、Verovio、xmlschema 與 PyYAML。

```bash
npm install
python -m pip install -r requirements-source.txt
npx playwright install chromium
npm run check:visual
```

`npm run check:visual` 依序執行來源政策、結構、MusicXML fixture、建置、單元測試、Chromium 視覺與列印 Gate。

正式規則詳見 [`AGENTS.md`](./AGENTS.md)。
