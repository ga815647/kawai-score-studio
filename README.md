# Kawai Score Studio

由 `scorebook.yaml` 驅動的 KAWAI 16 音木琴正式曲庫。彩色簡譜、VexFlow 五線譜與 Web Audio 播放共用同一組 melody event；歌詞使用獨立 lyric track。

## 正式曲庫

目前版本包含 7 首已驗證曲目：

1. Hickory Dickory Dock（老鼠時鐘）
2. The Itsy Bitsy Spider（小小蜘蛛）
3. 小星星
4. 兩隻老虎
5. 王老先生有塊地
6. 瑪麗有隻小綿羊
7. 生日快樂

正式網站只提供曲庫，不公開 JSON 草稿編輯器或本機 Studio。每首曲目都有播放、停止與單曲列印按鈕。列印採 A4 直式，只輸出選定歌曲；長曲可分頁，但任何完整譜行都不得被頁界切開。

## 工作入口

- Repository 第一入口：`AGENTS.md`
- 唯一正式規格：`scorebook.yaml`
- 正式輸出：HTML
- 合成 fixture：只供 `?fixture=1` 內部 CI／Gate 路徑使用
- 正式發佈：branch、PR、exact head SHA CI 與必要 Gate 全部成功後，另待使用者批准

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

`npm run check:visual` 依序執行來源政策、結構、MusicXML fixture、建置、單元測試、Chromium 視覺與 A4 列印 Gate。
