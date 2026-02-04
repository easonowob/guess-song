import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const httpServer = createServer(app)

app.use(express.static(path.join(__dirname, 'dist')))
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
})

// 遊戲狀態
const gameState = {
  hostId: null,
  videoId: null,
  songTitle: '',
  isPlaying: false,
  answerRevealed: false,
}

// 玩家資料：{ socketId: { name, score } }
const players = {}

function getLeaderboard() {
  return Object.entries(players)
    .map(([socketId, { name, score }]) => ({ socketId, name, score }))
    .sort((a, b) => b.score - a.score)
    .map((item, i) => ({ ...item, rank: i + 1 }))
}

function broadcastLeaderboard() {
  const leaderboard = getLeaderboard()
  io.emit('update_leaderboard', leaderboard)
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('join_game', (payload) => {
    const role = typeof payload === 'string' ? payload : payload?.role
    const playerName = (typeof payload === 'object' && payload?.playerName?.trim?.()) || null

    if (role === 'host') {
      gameState.hostId = socket.id
      socket.emit('join_confirmed', { role: 'host' })
      socket.emit('game_state', gameState)
      broadcastLeaderboard()
    } else if (role === 'player') {
      if (!playerName) {
        socket.emit('join_error', { message: '請輸入暱稱' })
        return
      }
      players[socket.id] = { name: playerName.trim(), score: 0 }
      socket.emit('join_confirmed', { role: 'player' })
      socket.emit('game_state', gameState)
      broadcastLeaderboard()
      if (gameState.videoId && gameState.isPlaying) {
        socket.emit('play_song', {
          videoId: gameState.videoId,
          songTitle: gameState.songTitle,
          startTime: 0,
          endTime: 60,
        })
        socket.emit('control_player', 'play')
      }
    }
  })

  socket.on('play_song', (payload) => {
    const { videoId, songTitle = '', startTime = 0, endTime = 60 } = payload
    gameState.videoId = videoId
    gameState.songTitle = songTitle
    gameState.isPlaying = true
    gameState.answerRevealed = false
    socket.broadcast.emit('play_song', { videoId, songTitle, startTime, endTime })
    socket.broadcast.emit('control_player', 'play')
    socket.emit('game_state', gameState)
    io.emit('next_round')
  })

  socket.on('control_player', (action) => {
    if (action === 'pause' || action === 'stop') {
      gameState.isPlaying = false
    }
    io.emit('control_player', action)
  })

  socket.on('reveal_answer', (songTitle) => {
    gameState.answerRevealed = true
    if (songTitle !== undefined) gameState.songTitle = songTitle
    io.emit('reveal_answer', gameState.songTitle)
    io.emit('next_round')
  })

  socket.on('next_round', () => {
    io.emit('next_round')
  })

  socket.on('submit_answer', (answer) => {
    if (!gameState.hostId) return
    const p = players[socket.id]
    const playerName = p ? p.name : `玩家 ${socket.id.slice(-6)}`
    io.to(gameState.hostId).emit('player_submitted_answer', {
      socketId: socket.id,
      answer: (answer && String(answer).trim()) || '',
      playerName,
    })
  })

  socket.on('answer_correct', ({ playerId }) => {
    if (gameState.hostId !== socket.id || !playerId || !players[playerId]) return
    players[playerId].score += 1
    const playerName = players[playerId].name
    io.emit('answer_correct_broadcast', {
      playerId,
      playerName,
      newScore: players[playerId].score,
    })
    broadcastLeaderboard()
    io.to(playerId).emit('your_answer_result', { correct: true })
  })

  socket.on('answer_wrong', ({ playerId }) => {
    if (gameState.hostId !== socket.id || !playerId) return
    io.to(playerId).emit('your_answer_result', { correct: false })
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    if (gameState.hostId === socket.id) gameState.hostId = null
    delete players[socket.id]
    broadcastLeaderboard()
  })
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Open http://localhost:${PORT} in your browser`)
})
