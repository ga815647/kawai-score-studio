# Kawai Score Studio

以 `scorebook.yaml` 驅動的兒童木琴琴譜產生器。

## 現在可以做什麼

- 驗證音符是否落在 KAWAI 16 音木琴的實際音域內
- 驗證每個起音都有歌詞、節奏時值為正整數
- 產生彩色數字簡譜
- 將上點／下點固定在框內、數字正上方／正下方，並與數字同色
- 從同一組 event 資料產生五線譜 SVG 對照
- 顯示／隱藏歌詞與五線譜
- 以 A4 直式列印，每首歌獨立分頁
- 在 GitHub Actions 自動跑 Gate，通過後可部署 GitHub Pages

第一版先收錄三首完整資料：

1. 生日快樂
2. 小小蜘蛛（6/8 原曲）
3. 老鼠時鐘（6/8 原曲）

其餘已知曲目列在 `scorebook.yaml` 的 `catalog`，後續逐首遷移成相同 event 格式。

## 開發

需要 Node.js 20 以上版本。

```bash
npm install
npm run check
```

建置完成後，靜態網站位於 `dist/`：

```bash
python -m http.server 8000 -d dist
```

再開啟 `http://localhost:8000`。

## 專案規則

- 正式規格只修改 `scorebook.yaml`
- `dist/` 與 `reports/` 都是可重新產生的輸出
- 不直接修改生成後的 HTML 來修正曲譜
- 圖片不得承載音符、歌詞、上下點或五線譜
- 必要 Gate 未通過時不得發佈

詳細工作規範請見 [`AGENTS.md`](./AGENTS.md)。
