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
  currentRound: 1,
  totalRounds: 10,
  roundLocked: false,
  correctAnswersThisRound: [], // [{ playerId, playerName, score, timestamp }]
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
    gameState.roundLocked = false
    gameState.correctAnswersThisRound = []
    socket.broadcast.emit('play_song', { videoId, songTitle, startTime, endTime })
    socket.broadcast.emit('control_player', 'play')
    socket.emit('game_state', gameState)
    io.emit('round_update', { currentRound: gameState.currentRound, totalRounds: gameState.totalRounds })
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
  })

  socket.on('next_round', () => {
    if (gameState.hostId !== socket.id) return
    
    // 重置回合狀態
    gameState.roundLocked = false
    gameState.correctAnswersThisRound = []
    gameState.answerRevealed = false
    gameState.isPlaying = false
    
    // 增加回合數
    gameState.currentRound += 1
    
    // 檢查遊戲是否結束
    if (gameState.currentRound > gameState.totalRounds) {
      gameState.currentRound = gameState.totalRounds + 1
      io.emit('game_ended', { leaderboard: getLeaderboard() })
    } else {
      io.emit('next_round', { currentRound: gameState.currentRound, totalRounds: gameState.totalRounds })
      io.emit('round_update', { currentRound: gameState.currentRound, totalRounds: gameState.totalRounds })
    }
  })

  socket.on('submit_answer', (answer) => {
    if (!gameState.hostId) return
    
    // 如果回合已鎖定（已有3人答對），拒絕提交
    if (gameState.roundLocked) {
      io.to(socket.id).emit('your_answer_result', { correct: false, message: '手慢了，該回合已有3人答對' })
      return
    }
    
    // 如果該玩家已經答對，不再接受提交
    if (gameState.correctAnswersThisRound.some(a => a.playerId === socket.id)) {
      return
    }
    
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
    
    // 如果回合已鎖定，不再處理
    if (gameState.roundLocked) return
    
    // 如果該玩家已經答對過，不再處理
    if (gameState.correctAnswersThisRound.some(a => a.playerId === playerId)) return
    
    // 計算該玩家是第幾個答對的
    const answerCount = gameState.correctAnswersThisRound.length
    let points = 0
    
    if (answerCount === 0) {
      points = 3 // 第一個答對：3分
    } else if (answerCount === 1) {
      points = 2 // 第二個答對：2分
    } else if (answerCount === 2) {
      points = 1 // 第三個答對：1分
    } else {
      // 已經有3人答對，不應該到這裡
      return
    }
    
    // 更新玩家分數
    players[playerId].score += points
    const playerName = players[playerId].name
    
    // 記錄該回合的答對者
    gameState.correctAnswersThisRound.push({
      playerId,
      playerName,
      score: points,
      timestamp: Date.now()
    })
    
    // 如果已經有3人答對，鎖定回合
    if (gameState.correctAnswersThisRound.length >= 3) {
      gameState.roundLocked = true
    }
    
    // 廣播答對訊息
    io.emit('answer_correct_broadcast', {
      playerId,
      playerName,
      newScore: players[playerId].score,
      points,
      answerCount: gameState.correctAnswersThisRound.length,
      roundLocked: gameState.roundLocked,
    })
    
    broadcastLeaderboard()
    io.to(playerId).emit('your_answer_result', { correct: true, points })
    
    // 通知主持人回合狀態
    io.to(gameState.hostId).emit('round_status_update', {
      correctCount: gameState.correctAnswersThisRound.length,
      roundLocked: gameState.roundLocked,
    })
  })

  socket.on('answer_wrong', ({ playerId }) => {
    if (gameState.hostId !== socket.id || !playerId) return
    io.to(playerId).emit('your_answer_result', { correct: false })
  })

  socket.on('set_total_rounds', ({ totalRounds }) => {
    if (gameState.hostId !== socket.id) return
    const rounds = parseInt(totalRounds, 10)
    if (rounds > 0) {
      gameState.totalRounds = rounds
      io.emit('round_update', { currentRound: gameState.currentRound, totalRounds: gameState.totalRounds })
    }
  })

  socket.on('reset_game', () => {
    if (gameState.hostId !== socket.id) return
    
    // 重置所有玩家分數
    Object.keys(players).forEach(socketId => {
      players[socketId].score = 0
    })
    
    // 重置遊戲狀態
    gameState.currentRound = 1
    gameState.roundLocked = false
    gameState.correctAnswersThisRound = []
    gameState.answerRevealed = false
    gameState.isPlaying = false
    gameState.videoId = null
    gameState.songTitle = ''
    
    // 廣播重置
    broadcastLeaderboard()
    io.emit('game_reset', { currentRound: gameState.currentRound, totalRounds: gameState.totalRounds })
    io.emit('round_update', { currentRound: gameState.currentRound, totalRounds: gameState.totalRounds })
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
