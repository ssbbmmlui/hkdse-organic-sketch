# HKDSE IUPAC 結構式產生器

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

瀏覽器開啟 `http://127.0.0.1:5173`，輸入例如 `hex-1-ene`。

若你是在雲端同步資料夾開發，把整個專案複製到例如 `C:\Users\<你>\hkdse-iupac-structure` 再安裝依賴。

```bash
npm test
```

## HTTP API

其他應用可以直接呼叫本專案的 HTTP API，用 IUPAC 名稱產生結構式與骨架式（SVG），無需開啟網頁。解析與繪圖都在本機完成，不會呼叫外部化學服務。

開發伺服器（`npm run dev`）已掛上同一套 API，例如：

`http://127.0.0.1:5173/api/v1/formula?name=hex-1-ene`

若只要 API、不要網頁：

```bash
npm run api
```

預設聽 `http://127.0.0.1:8787`。可用環境變數改位址：`PORT=8787`、`HOST=0.0.0.0`（區網其他裝置要連進來時）、`CORS_ORIGIN=*`。

### 端點

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| `GET` | `/api/v1` | 目錄與範圍說明 |
| `GET` | `/api/v1/health` | 健康檢查 |
| `GET` | `/api/v1/formula?name=hex-1-ene` | JSON：分子式、簡明式、SMILES、結構式／骨架式 SVG、原子圖 |
| `POST` | `/api/v1/formula` | 同上，JSON 本文 `{ "name": "hex-1-ene", "showNumbers": false }` |
| `GET` | `/api/v1/formula/structural.svg?name=hex-1-ene` | 結構式 SVG（可直接給 `<img>`） |
| `GET` | `/api/v1/formula/skeletal.svg?name=hex-1-ene` | 骨架式 SVG |
| `GET` | `/api/v1/examples` | 課程範圍內的範例名稱 |

查詢參數 `showNumbers=true` 會在結構式上標碳編號。無法解析或超出 HKDSE 範圍時回傳 `400`，本文含 `error`（英文）與 `zh`（中文）。

已開 CORS（預設 `Access-Control-Allow-Origin: *`），瀏覽器裡的其他網頁也可跨來源呼叫。此 API **沒有驗證**；若放到公網，請自行加閘道或反向代理。

### 呼叫範例

curl：

```bash
curl "http://127.0.0.1:8787/api/v1/formula?name=hex-1-ene"
curl "http://127.0.0.1:8787/api/v1/formula/skeletal.svg?name=propan-2-ol" -o propan-2-ol.svg
```

JavaScript：

```js
const res = await fetch('http://127.0.0.1:8787/api/v1/formula?name=hex-1-ene')
const data = await res.json()
// data.formula, data.condensed, data.structuralSvg, data.skeletalSvg
```

Python：

```python
import urllib.parse, urllib.request, json

name = urllib.parse.quote('hex-1-ene')
with urllib.request.urlopen(f'http://127.0.0.1:8787/api/v1/formula?name={name}') as r:
    data = json.load(r)
print(data['formula'], data['condensed'])
```

HTML 直接嵌入骨架式：

```html
<img src="http://127.0.0.1:8787/api/v1/formula/skeletal.svg?name=hex-1-ene" alt="hex-1-ene" />
```

同倉庫的 TypeScript／JavaScript 專案也可以不經 HTTP，直接呼叫 `generateFromName`（見 `src/chemistry/generate.ts`）。

## 設計

本機環境沒有 Java，因此沒有直接嵌入 [OPSIN](https://github.com/dan2097/opsin)。改為撰寫 **HKDSE 範圍內的 IUPAC 解析器**（離線、可檢查課程限制），再以 SVG 繪出課本風格的結構式與骨架式。繪圖思路參考 [SmilesDrawer](https://github.com/reymond-group/smilesDrawer)。

接受新式命名（`hex-1-ene`、`propan-2-ol`），亦兼容舊式（`1-hexene`、`2-propanol`）及常見俗名（acetone、acetic acid、chloroform、isopropyl alcohol）。
