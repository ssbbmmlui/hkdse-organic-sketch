# HKDSE IUPAC 結構式產生器

網站已發布於 GitHub Pages：

**https://ssbbmmlui.github.io/hkdse-organic-sketch/**

合併 pull request 到 `main`（或直接推送到 `main`）後，GitHub Actions 會自動測試、建置並部署。也可在 Actions 分頁手動執行 **Deploy to GitHub Pages**。

輸入有機化合物的 IUPAC 系統名稱，產生：

- **結構式**（顯示所有 C、H 與鍵）
- **簡明結構式**
- **骨架式**
- 分子式與同系列

範圍依 HKDSE 化學課程（課本 `cbte21`、`cbte42`）：主碳鏈最多 8 個碳，只包括烷、烯、鹵烷、醇、醛／酮、羧酸、酯、未經取代的酰胺、一級胺。

## 使用

在本機硬碟資料夾執行（Google Drive 捷徑路徑常常無法寫入 `node_modules`）：

```bash
npm install
npm run dev
```

瀏覽器開啟 `http://127.0.0.1:5173`，輸入例如 `hex-1-ene`。網站上的 **Practice** 模式會依難度隨機出題（寫出 IUPAC 名稱，或辨認同系列）。

若你是在雲端同步資料夾開發，把整個專案複製到例如 `C:\Users\<你>\hkdse-iupac-structure` 再安裝依賴。

```bash
npm test
```

## 設計

本機環境沒有 Java，因此沒有直接嵌入 [OPSIN](https://github.com/dan2097/opsin)。改為撰寫 **HKDSE 範圍內的 IUPAC 解析器**（離線、可檢查課程限制），再以 SVG 繪出課本風格的結構式與骨架式。繪圖思路參考 [SmilesDrawer](https://github.com/reymond-group/smilesDrawer)。

接受新式命名（`hex-1-ene`、`propan-2-ol`），亦兼容舊式（`1-hexene`、`2-propanol`）及常見俗名（acetone、acetic acid、chloroform、isopropyl alcohol）。
