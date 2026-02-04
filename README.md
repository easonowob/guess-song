# 猜歌遊戲（多人連線版）

Vite + React + Socket.io 多人連線猜歌遊戲，使用 Tailwind CSS、react-youtube 和 lucide-react。

## 安裝

```bash
npm install
```

## 啟動（推薦）

同時啟動前端 (Vite) 和後端 (Socket.io)：

```bash
npm run start:server
```

## 分開啟動

```bash
# 終端機 1：後端
npm run server

# 終端機 2：前端
npm run dev
```

## 遊戲模式

- **主持人 (Host)**：輸入 YouTube 影片 ID、控制播放、輸入正確答案、人工判定得分（⭕ 答對 / ❌ 答錯）
- **玩家 (Player)**：僅顯示波形動畫與搶答按鈕，聽音樂搶答（口頭回答，主持人判定）

## 環境變數

- `VITE_SOCKET_URL`：Socket 伺服器位址，預設 `http://localhost:3001`
- `PORT`：後端埠號，預設 `3001`

## 建置

```bash
npm run build
```
