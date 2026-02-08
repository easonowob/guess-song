import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import YouTube from 'react-youtube'
import { Music2, Play, Square, Pause, Monitor, User, Check, X, Send, LogOut, Maximize2, Clock } from 'lucide-react'

// --- 內建的波形圖元件 ---
function WaveformVisualizer() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-full w-full">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="w-3 bg-cyan-400/80 rounded-full animate-pulse"
          style={{
            height: `${Math.random() * 40 + 20}%`,
            animationDuration: `${0.6 + i * 0.1}s`,
            animationIterationCount: 'infinite'
          }}
        />
      ))}
    </div>
  )
}
// -----------------------

const SOCKET_URL = window.location.origin

function unlockAudio() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
    audio.play().catch(() => {})
  } catch (_) {}
}

function playTestSoundBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 523.25
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch (_) {}
}

function requestFullscreen() {
  const el = document.documentElement
  if (el.requestFullscreen) el.requestFullscreen()
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  else if (el.msRequestFullscreen) el.msRequestFullscreen()
}

function extractVideoId(input) {
  if (!input || typeof input !== 'string') return ''
  const s = input.trim()
  const youtuBe = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
  if (youtuBe) return youtuBe[1]
  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
  if (watch) return watch[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return ''
}

function RoleSelection({ onSelect }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex flex-col items-center justify-center p-6">
      <button onClick={requestFullscreen} className="fixed top-4 right-20 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm flex items-center gap-2 z-10">
        <Maximize2 className="w-4 h-4" /> 進入全螢幕
      </button>
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center shadow-2xl max-w-md w-full">
        <div className="inline-flex p-4 rounded-full bg-white/20 mb-6">
          <Music2 className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">猜歌遊戲</h1>
        <p className="text-white/80 mb-8">多人連線版</p>
        <div className="space-y-4">
          <button onClick={() => onSelect('host')} className="w-full py-5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center justify-center gap-3 text-lg">
            <Monitor className="w-6 h-6" /> 我是主持人 (Host)
          </button>
          <button onClick={() => onSelect('player')} className="w-full py-5 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all flex items-center justify-center gap-3 text-lg">
            <User className="w-6 h-6" /> 我是猜題者 (Player)
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayerJoinScreen({ socket, onJoined, onBack }) {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const onJoinedRef = useRef(onJoined)
  useEffect(() => { onJoinedRef.current = onJoined }, [onJoined])
  const handleJoin = () => {
    const name = nickname.trim()
    if (!name) { setError('請輸入暱稱'); return }
    setError('')
    unlockAudio()
    socket.emit('join_game', { role: 'player', playerName: name })
  }
  useEffect(() => {
    if (!socket) return
    const onConfirm = () => onJoinedRef.current?.()
    const onErr = ({ message }) => setError(message || '請輸入暱稱')
    socket.on('join_confirmed', onConfirm)
    socket.on('join_error', onErr)
    return () => { socket.off('join_confirmed', onConfirm); socket.off('join_error', onErr) }
  }, [socket])
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex flex-col items-center justify-center p-6">
      <button onClick={requestFullscreen} className="fixed top-4 right-4 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm flex items-center gap-2 z-10">
        <Maximize2 className="w-4 h-4" /> 全螢幕
      </button>
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md">
        <button onClick={onBack} className="text-white/80 hover:text-white mb-4">← 返回</button>
        <h2 className="text-xl font-bold text-white mb-4">加入遊戲</h2>
        <p className="text-white/70 text-sm mb-3">請輸入暱稱後，點擊「加入遊戲」以解鎖聲音</p>
        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="請輸入暱稱" className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20 mb-4" />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button onClick={handleJoin} className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700">加入遊戲並開啟聲音</button>
      </div>
    </div>
  )
}

const TIMELINE_MAX_SEC = 600

function HostUI({ socket, onBack }) {
  const [videoId, setVideoId] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [startTimeSeconds, setStartTimeSeconds] = useState(0)
  const [customDurationSec, setCustomDurationSec] = useState(30)
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pendingAnswers, setPendingAnswers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [correctToast, setCorrectToast] = useState(null)
  const [totalRounds, setTotalRounds] = useState(10)
  const [currentRound, setCurrentRound] = useState(1)
  const [roundLocked, setRoundLocked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [gameEnded, setGameEnded] = useState(false)
  const [finalLeaderboard, setFinalLeaderboard] = useState([])
  const previewPlayerRef = useRef(null)
  const endTimerRef = useRef(null)
  const durationTimerRef = useRef(null)
  const songTitleRef = useRef('')
  const answeredThisRoundRef = useRef(new Set())

  useEffect(() => { songTitleRef.current = songTitle }, [songTitle])

  useEffect(() => {
    if (!socket) return
    const onJoinError = ({ message }) => {
      alert(message || '加入失敗')
      onBack()
    }
    socket.on('join_error', onJoinError)
    return () => { socket.off('join_error', onJoinError) }
  }, [socket, onBack])

  useEffect(() => {
    if (!socket) return
    const onSubmitted = ({ socketId, answer, playerName }) => {
      const correctAnswer = songTitleRef.current.trim().toLowerCase()
      const playerAnswer = (answer || '').trim().toLowerCase()
      if (correctAnswer && playerAnswer === correctAnswer && !answeredThisRoundRef.current.has(socketId)) {
        answeredThisRoundRef.current.add(socketId)
        socket.emit('answer_correct', { playerId: socketId })
        setPendingAnswers((prev) => prev.filter((a) => a.socketId !== socketId))
        setCorrectToast(`${playerName} 答對了！`)
        setTimeout(() => setCorrectToast(null), 3000)
      } else {
        setPendingAnswers((prev) => [...prev, { socketId, answer, playerName }])
      }
    }
    const onLeaderboard = (data) => setLeaderboard(Array.isArray(data) ? data : [])
    const onCorrect = ({ playerId, playerName, points, answerCount, roundLocked }) => {
      setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId))
      setCorrectToast(`${playerName} 答對了！獲得 ${points} 分`)
      setTimeout(() => setCorrectToast(null), 3000)
      setCorrectCount(answerCount || 0)
      setRoundLocked(roundLocked || false)
    }
    const onGameState = (state) => {
      setCurrentSong(state.videoId ? { videoId: state.videoId, songTitle: state.songTitle } : null)
      setVideoId(state.videoId || '')
      setSongTitle(state.songTitle || '')
      setIsPlaying(state.isPlaying || false)
    }
    const onRoundUpdate = ({ currentRound, totalRounds }) => {
      setCurrentRound(currentRound || 1)
      setTotalRounds(totalRounds || 10)
    }
    const onRoundStatusUpdate = ({ correctCount, roundLocked }) => {
      setCorrectCount(correctCount || 0)
      setRoundLocked(roundLocked || false)
    }
    const onGameEnded = ({ leaderboard }) => {
      setGameEnded(true)
      setFinalLeaderboard(Array.isArray(leaderboard) ? leaderboard : [])
    }
    const onGameReset = ({ currentRound, totalRounds }) => {
      setGameEnded(false)
      setCurrentRound(currentRound || 1)
      setTotalRounds(totalRounds || 10)
      setRoundLocked(false)
      setCorrectCount(0)
      setFinalLeaderboard([])
      answeredThisRoundRef.current.clear()
      setPendingAnswers([])
    }
    socket.on('player_submitted_answer', onSubmitted)
    socket.on('update_leaderboard', onLeaderboard)
    socket.on('answer_correct_broadcast', onCorrect)
    socket.on('game_state', onGameState)
    socket.on('round_update', onRoundUpdate)
    socket.on('round_status_update', onRoundStatusUpdate)
    socket.on('game_ended', onGameEnded)
    socket.on('game_reset', onGameReset)
    const onStopGame = () => {
      clearTimers()
      setIsPlaying(false)
      setCurrentSong(null)
      previewPlayerRef.current?.stopVideo?.()
    }
    socket.on('stop_game', onStopGame)
    return () => {
      socket.off('player_submitted_answer', onSubmitted)
      socket.off('update_leaderboard', onLeaderboard)
      socket.off('answer_correct_broadcast', onCorrect)
      socket.off('game_state', onGameState)
      socket.off('round_update', onRoundUpdate)
      socket.off('round_status_update', onRoundStatusUpdate)
      socket.off('game_ended', onGameEnded)
      socket.off('game_reset', onGameReset)
      socket.off('stop_game', onStopGame)
    }
  }, [socket])

  const clearTimers = () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    endTimerRef.current = null
    if (durationTimerRef.current) clearTimeout(durationTimerRef.current)
    durationTimerRef.current = null
  }

  const getStartTimeFromSlider = () => startTimeSeconds

  const handlePlayWithDuration = (durationSec) => {
    setPendingAnswers([])
    answeredThisRoundRef.current.clear()
    setRoundLocked(false)
    setCorrectCount(0)
    clearTimers()
    const id = extractVideoId(videoId)
    if (!id) return
    const st = getStartTimeFromSlider()
    const et = st + durationSec
    socket.emit('play_song', { videoId: id, songTitle: songTitle.trim(), startTime: st, endTime: et })
    setCurrentSong({ videoId: id, songTitle: songTitle.trim() })
    setIsPlaying(true)
    durationTimerRef.current = setTimeout(() => {
      socket.emit('control_player', 'pause')
      setIsPlaying(false)
    }, durationSec * 1000)
  }

  const handlePlay10Sec = () => handlePlayWithDuration(10)
  const handlePlayCustom = () => handlePlayWithDuration(Math.max(1, Math.min(120, customDurationSec)))

  const handlePause = () => {
    clearTimers()
    socket.emit('control_player', 'pause')
    setIsPlaying(false)
  }

  const handleStop = () => {
    clearTimers()
    socket.emit('stop_game')
    setIsPlaying(false)
    setCurrentSong(null)
    previewPlayerRef.current?.stopVideo?.()
  }

  const handleRevealAnswer = () => socket.emit('reveal_answer', songTitle.trim() || undefined)

  const handleNextRound = () => { 
    answeredThisRoundRef.current.clear(); 
    socket.emit('next_round'); 
    setPendingAnswers([]);
    setRoundLocked(false);
    setCorrectCount(0);
    setVideoId('');
    setSongTitle('');
    setStartTimeSeconds(0);
    setCurrentSong(null);
  }

  const handleSliderChange = (e) => {
    const sec = Number(e.target.value)
    setStartTimeSeconds(sec)
    previewPlayerRef.current?.seekTo?.(sec)
  }

  const handleSetTotalRounds = (value) => {
    const rounds = parseInt(value, 10)
    if (rounds > 0) {
      setTotalRounds(rounds)
      socket.emit('set_total_rounds', { totalRounds: rounds })
    }
  }

  const handleResetGame = () => {
    socket.emit('reset_game')
  }

  const handleAnswerCorrect = (playerId) => { socket.emit('answer_correct', { playerId }); setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId)) }
  const handleAnswerWrong = (playerId) => { socket.emit('answer_wrong', { playerId }); setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId)) }
  
  const hostYoutubeOpts = () => ({
    height: '100%',
    width: '100%',
    playerVars: { autoplay: 0, mute: 0, controls: 1, playsinline: 1, disablekb: 0 },
  })

  const joinUrl = typeof window !== 'undefined' ? window.location.href : ''

  const handleLeaveGame = () => {
    socket.disconnect()
    onBack()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4">
      {/* 頂部導覽列 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-white/80 hover:text-white">← 返回</button>
          <button onClick={handleLeaveGame} className="px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-600 text-white font-medium flex items-center gap-2">
            <LogOut className="w-4 h-4" /> 結束／離開遊戲
          </button>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/10 border border-white/20 flex-1 max-w-xl min-w-0">
            <span className="text-white font-medium whitespace-nowrap">加入連結:</span>
            <span className="text-white/95 truncate text-sm" title={joinUrl}>{joinUrl}</span>
            <button onClick={() => navigator.clipboard?.writeText(joinUrl)} className="flex-shrink-0 px-4 py-2 rounded-lg bg-cyan-500/80 hover:bg-cyan-500 text-white font-medium">複製</button>
          </div>
          <button onClick={playTestSoundBeep} className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white">🔊 測試聲音</button>
          <button onClick={requestFullscreen} className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white" title="全螢幕"><Maximize2 className="w-5 h-5" /></button>
          <span className="text-cyan-400 font-bold flex items-center gap-2"><Monitor className="w-5 h-5" /> 主持人</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-7xl mx-auto min-h-0">
        {/* 左欄 (操作區) */}
        <div className="flex flex-col gap-5 overflow-y-auto min-w-0">
          {/* 1. 播放控制區 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">播放控制</h3>
            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">YouTube 影片</label>
                <input type="text" value={videoId} onChange={(e) => setVideoId(e.target.value)} placeholder="貼上網址或 ID" className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20" />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">歌名（正確答案）</label>
                <input type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="歌名" className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20" />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">影片進度條（拖曳決定開始時間）</label>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-xs w-10">{Math.floor(startTimeSeconds / 60)}:{String(startTimeSeconds % 60).padStart(2, '0')}</span>
                  <input
                    type="range"
                    min={0}
                    max={TIMELINE_MAX_SEC}
                    value={startTimeSeconds}
                    onChange={handleSliderChange}
                    className="flex-1 h-3 rounded-lg accent-cyan-500"
                  />
                  <span className="text-white/60 text-xs w-10">10:00</span>
                </div>
              </div>
              
              {/* 播放控制按鈕區：使用 Grid System 優化比例 */}
              <div className="grid grid-cols-12 gap-2">
                {/* 1. 播放 10 秒 (佔 3/12) */}
                <button 
                  onClick={handlePlay10Sec} 
                  disabled={!extractVideoId(videoId)} 
                  className="col-span-3 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-base flex items-center justify-center gap-1"
                >
                  <Play className="w-4 h-4" /> 10秒
                </button>

                {/* 2. 自訂長度群組 (佔 5/12) */}
                <div className="col-span-5 flex bg-white/10 rounded-xl p-1 gap-1">
                  <input 
                    type="number" 
                    min={1} 
                    max={120} 
                    value={customDurationSec} 
                    onChange={(e) => setCustomDurationSec(Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 30)))} 
                    className="w-12 px-1 text-center bg-transparent text-white font-bold border-none outline-none focus:ring-0"
                  />
                  <span className="text-white/60 text-sm flex items-center">秒</span>
                  <button 
                    onClick={handlePlayCustom} 
                    disabled={!extractVideoId(videoId)} 
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm"
                  >
                    播放
                  </button>
                </div>

                {/* 3. 暫停 (佔 2/12) */}
                <button 
                  onClick={handlePause} 
                  disabled={!isPlaying} 
                  className="col-span-2 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center"
                  title="暫停"
                >
                  <Pause className="w-5 h-5" />
                </button>

                {/* 4. 停止 (佔 2/12) */}
                <button 
                  onClick={handleStop} 
                  className="col-span-2 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl flex items-center justify-center"
                  title="停止"
                >
                  <Square className="w-5 h-5" />
                </button>
              </div>

            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              <button onClick={handleRevealAnswer} disabled={!currentSong} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-base">公布答案</button>
              <button 
                onClick={handleNextRound} 
                className={`flex-1 py-3 text-white font-semibold rounded-xl text-base ${
                  roundLocked || correctCount >= 3 ? 'bg-green-600 hover:bg-green-700' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                下一題
              </button>
              {gameEnded && (
                <button onClick={handleResetGame} className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl text-base">再來一局</button>
              )}
            </div>
          </div>

          {/* 2. 答案控制區 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">答案控制</h3>
            <p className="text-white/70 text-sm mb-3">本回合答對人數：{correctCount} / 3 {roundLocked && <span className="text-green-400">✓ 已滿員</span>}</p>
            {pendingAnswers.length === 0 ? (
              <p className="text-white/60 text-sm">等待玩家送出答案...</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pendingAnswers.map(({ socketId, answer, playerName }, index) => (
                  <div key={socketId} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/10">
                    <p className="text-white flex-1 text-sm min-w-0">
                      {/* 搶答順序顯示區 */}
                      <span className="font-bold text-red-400 mr-2 text-lg">#{index + 1}</span>
                      <span className="font-semibold text-cyan-300">{playerName}</span>
                      <span className="text-white/90">：{answer || '(空白)'}</span>
                    </p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleAnswerCorrect(socketId)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-0.5"><Check className="w-3 h-3" /> 正確</button>
                      <button onClick={() => handleAnswerWrong(socketId)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-0.5"><X className="w-3 h-3" /> 錯誤</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 遊戲設定 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">遊戲設定</h3>
            <label className="text-white/70 text-sm block mb-2">總題數</label>
            <input 
              type="number" 
              min="1" 
              value={totalRounds} 
              onChange={(e) => handleSetTotalRounds(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20"
            />
            <p className="text-white/60 text-sm mt-2">目前第 {currentRound} / {totalRounds} 題</p>
          </div>
        </div>

        {/* 右欄 (視覺與資訊區) */}
        <div className="flex flex-col gap-5 min-w-0 flex-1">
          {/* HOST: 強制 16:9 且絕對滿版 (CSS 暴力修正) */}
          <div className="relative w-full aspect-video bg-black overflow-hidden rounded-2xl shadow-lg">
            {extractVideoId(videoId) ? (
              <YouTube
                videoId={extractVideoId(videoId)}
                className="absolute top-0 left-0 w-full h-full"
                iframeClassName="w-full h-full object-cover"
                opts={hostYoutubeOpts()}
                onReady={(e) => { const p = e.target; previewPlayerRef.current = p; p.setVolume?.(100) }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50">輸入影片並播放</div>
            )}
          </div>

          {/* 排行榜 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 flex flex-col min-h-0 flex-1">
            <h3 className="text-white font-semibold mb-3">即時排行榜 · 玩家列表</h3>
            <div className="overflow-y-auto space-y-2 pr-1 h-[400px]">
              {leaderboard.length === 0 ? (
                <p className="text-white/60 text-sm">尚無玩家</p>
              ) : (
                leaderboard.map(({ socketId, name, score, rank }) => (
                  <div key={socketId} className="flex justify-between items-center py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-base">
                    <span className="font-medium">#{rank} {name}</span>
                    <span className="text-amber-400 font-bold">{score} 分</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {correctToast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-green-600/90 text-white font-bold rounded-xl shadow-lg">{correctToast}</div>}
      
      {/* 遊戲結束全屏排行榜 */}
      {gameEnded && finalLeaderboard.length > 0 && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-8">🎉 遊戲結束 🎉</h2>
            <h3 className="text-2xl font-bold text-white text-center mb-6">最終排行榜</h3>
            <div className="space-y-4 mb-6">
              {finalLeaderboard.map(({ socketId, name, score, rank }) => (
                <div 
                  key={socketId} 
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    rank === 1 
                      ? 'bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border-2 border-yellow-400' 
                      : 'bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${
                      rank === 1 ? 'text-yellow-400' : 'text-white/70'
                    }`}>
                      #{rank}
                    </span>
                    <span className={`text-xl font-semibold ${
                      rank === 1 ? 'text-yellow-300' : 'text-white'
                    }`}>
                      {rank === 1 && '👑 '}
                      {name}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${
                    rank === 1 ? 'text-yellow-400' : 'text-amber-400'
                  }`}>
                    {score} 分
                  </span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-white/70 mb-4">等待主持人重新開始...</p>
              <button 
                onClick={handleResetGame}
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl text-lg"
              >
                再來一局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerUI({ socket, onBack }) {
  const [videoId, setVideoId] = useState(null)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [revealedAnswer, setRevealedAnswer] = useState(null)
  const [playKey, setPlayKey] = useState(0)
  const [answerInput, setAnswerInput] = useState('')
  const [answerStatus, setAnswerStatus] = useState(null)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [correctToast, setCorrectToast] = useState(null)
  const [volume, setVolume] = useState(100)
  const [gameEnded, setGameEnded] = useState(false)
  const [finalLeaderboard, setFinalLeaderboard] = useState([])
  const playerRef = useRef(null)
  const shouldPlayRef = useRef(false)
  const endTimerRef = useRef(null)
  const startTimeRef = useRef(0)
  const endTimeRef = useRef(0)
  const pendingCommandRef = useRef(null)

  const myRank = leaderboard.find((p) => p.socketId === socket?.id)?.rank ?? null
  const myScore = leaderboard.find((p) => p.socketId === socket?.id)?.score ?? 0

  const clearEndTimer = () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    endTimerRef.current = null
  }

  const tryPlay = (st = 0, et = 0) => {
    if (playerRef.current) {
      playerRef.current.unMute?.()
      playerRef.current.setVolume?.(volume)
      playerRef.current.seekTo?.(st)
      playerRef.current.playVideo?.()
      shouldPlayRef.current = false
      pendingCommandRef.current = null
      clearEndTimer()
      if (et > st) {
        endTimerRef.current = setTimeout(() => {
          playerRef.current?.pauseVideo?.()
        }, (et - st) * 1000)
      }
    } else {
      shouldPlayRef.current = true
      pendingCommandRef.current = { startTime: st, endTime: et }
    }
  }

  useEffect(() => {
    if (!socket) return
    const onGameState = (state) => {
      if (state.videoId) setVideoId(state.videoId)
      if (state.answerRevealed && state.songTitle) setRevealedAnswer(state.songTitle)
    }
    const onPlaySong = ({ videoId: id, startTime: st = 0, endTime: et = 0 }) => {
      if (!id) return
      playerRef.current = null
      startTimeRef.current = st
      endTimeRef.current = et
      pendingCommandRef.current = { startTime: st, endTime: et }
      setVideoId(id)
      setStartTime(st)
      setEndTime(et)
      setRevealedAnswer(null)
      setAnswerStatus(null)
      setPlayKey((k) => k + 1)
    }
    const onAnswerResult = ({ correct, points, message }) => {
      if (correct) {
        setAnswerStatus('correct')
        setEarnedPoints(points || 0)
        if (points) {
          setCorrectToast(`答對了！獲得 ${points} 分`)
          setTimeout(() => setCorrectToast(null), 3000)
        }
      } else {
        setAnswerStatus('wrong')
        setEarnedPoints(0)
        if (message) {
          setCorrectToast(message)
          setTimeout(() => setCorrectToast(null), 3000)
        }
      }
    }
    const onLeaderboard = (data) => setLeaderboard(Array.isArray(data) ? data : [])
    const onCorrectBroadcast = ({ playerId, playerName, points }) => { 
      if (playerId !== socket.id) { 
        setCorrectToast(`${playerName} 答對了！獲得 ${points || 0} 分`)
        setTimeout(() => setCorrectToast(null), 3000) 
      } 
    }
    const onControl = (action) => {
      if (action === 'play') tryPlay(startTimeRef.current, endTimeRef.current)
      else if (action === 'pause' && playerRef.current) { clearEndTimer(); playerRef.current.pauseVideo?.() }
      else if (action === 'stop') {
        clearEndTimer()
        setVideoId(null)
        setRevealedAnswer(null)
        setAnswerStatus(null)
        shouldPlayRef.current = false
        playerRef.current?.stopVideo?.()
      }
    }
    const onReveal = (songTitle) => {
      setRevealedAnswer(songTitle || '')
      if (playerRef.current && startTimeRef.current != null) {
        playerRef.current.unMute?.()
        playerRef.current.seekTo?.(startTimeRef.current)
        playerRef.current.playVideo?.()
      }
    }
    const onStopGame = () => {
      clearEndTimer()
      setVideoId(null)
      setRevealedAnswer(null)
      setAnswerStatus(null)
      shouldPlayRef.current = false
      playerRef.current?.stopVideo?.()
    }
    const onNextRound = () => {
      setAnswerStatus(null)
      setEarnedPoints(0)
    }
    const onGameEnded = ({ leaderboard }) => {
      setGameEnded(true)
      setFinalLeaderboard(Array.isArray(leaderboard) ? leaderboard : [])
    }
    const onGameReset = () => {
      setGameEnded(false)
      setFinalLeaderboard([])
      setAnswerStatus(null)
      setEarnedPoints(0)
    }

    socket.on('game_state', onGameState)
    socket.on('play_song', onPlaySong)
    socket.on('your_answer_result', onAnswerResult)
    socket.on('update_leaderboard', onLeaderboard)
    socket.on('answer_correct_broadcast', onCorrectBroadcast)
    socket.on('control_player', onControl)
    socket.on('reveal_answer', onReveal)
    socket.on('stop_game', onStopGame)
    socket.on('next_round', onNextRound)
    socket.on('game_ended', onGameEnded)
    socket.on('game_reset', onGameReset)

    return () => {
      socket.off('game_state', onGameState)
      socket.off('play_song', onPlaySong)
      socket.off('your_answer_result', onAnswerResult)
      socket.off('update_leaderboard', onLeaderboard)
      socket.off('answer_correct_broadcast', onCorrectBroadcast)
      socket.off('control_player', onControl)
      socket.off('reveal_answer', onReveal)
      socket.off('stop_game', onStopGame)
      socket.off('next_round', onNextRound)
      socket.off('game_ended', onGameEnded)
      socket.off('game_reset', onGameReset)
    }
  }, [socket])

  useEffect(() => () => clearEndTimer(), [])

  const handleSubmitAnswer = () => {
    const ans = answerInput.trim()
    if (!ans) return
    socket.emit('submit_answer', ans)
    setAnswerInput('')
    setAnswerStatus('pending')
  }

  const playerYouTubeStyle = { position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none', overflow: 'hidden', left: -9999 }
  const playerYoutubeOpts = { height: '1', width: '1', playerVars: { autoplay: 0, mute: 0, controls: 0, playsinline: 1 } }
  // Player 顯示的 opts: 寬高 100%
  const visibleYoutubeOpts = { height: '100%', width: '100%', playerVars: { autoplay: 1, mute: 0, controls: 1, playsinline: 1 } }
  const youtubeWatchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4">
      <div style={playerYouTubeStyle} aria-hidden="true">
        {videoId && (
          <YouTube
            key={playKey}
            videoId={videoId}
            opts={playerYoutubeOpts}
            onReady={(e) => {
              const p = e.target
              playerRef.current = p
              p.unMute?.()
              p.setVolume?.(volume)
              const pending = pendingCommandRef.current
              if (pending) {
                tryPlay(pending.startTime, pending.endTime)
              } else if (shouldPlayRef.current) {
                tryPlay(startTimeRef.current, endTimeRef.current)
              }
            }}
          />
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="text-white/80 hover:text-white">← 返回</button>
        <div className="flex items-center gap-2">
          <button onClick={playTestSoundBeep} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm">🔊 測試聲音</button>
          <button onClick={requestFullscreen} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white" title="全螢幕"><Maximize2 className="w-5 h-5" /></button>
          <span className="text-pink-400 font-bold flex items-center gap-2"><User className="w-5 h-5" /> 猜題者</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <p className="text-amber-400 font-bold">我的分數：{myScore}</p>
            {myRank != null && <p className="text-cyan-400 font-bold">目前排名：第 {myRank} 名</p>}
          </div>

          {/* PLAYER: 強制 16:9 且絕對滿版 (CSS 暴力修正) */}
          <div className="relative w-full max-w-3xl mx-auto aspect-video bg-black overflow-hidden rounded-2xl shadow-lg">
            {!videoId && (
              <div className="w-full h-full flex items-center justify-center text-white/60">等待主持人播放音樂...</div>
            )}
            {videoId && !revealedAnswer && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                <WaveformVisualizer />
              </div>
            )}
            {videoId && revealedAnswer && (
              <YouTube
                key={`reveal-${playKey}`}
                videoId={videoId}
                className="absolute top-0 left-0 w-full h-full"
                iframeClassName="w-full h-full object-cover"
                opts={visibleYoutubeOpts}
                onReady={(e) => {
                  const p = e.target
                  p.unMute?.()
                  p.setVolume?.(volume)
                  p.seekTo?.(startTimeRef.current ?? 0)
                  p.playVideo?.()
                }}
              />
            )}
          </div>
          
          {/* Fix 2: 移除所有外部連結按鈕 (已刪除 <a href={youtubeWatchUrl}>) */}

          {videoId && !revealedAnswer && (
            <div className="space-y-2">
              <div><label className="text-white/80 text-sm">音量</label><input type="range" min="0" max="100" value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); playerRef.current?.setVolume?.(v) }} className="w-full h-2 rounded-lg accent-pink-500" /></div>
              <div className="flex gap-2">
                <input type="text" value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()} placeholder="輸入答案..." disabled={answerStatus === 'pending' || answerStatus === 'correct'} className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20 disabled:opacity-70" />
                <button onClick={handleSubmitAnswer} disabled={!answerInput.trim() || answerStatus === 'pending' || answerStatus === 'correct'} className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Send className="w-5 h-5" /> 送出</button>
              </div>
            </div>
          )}
          {videoId && revealedAnswer && (
            <div className="rounded-2xl p-5 text-center bg-green-600/90 border-2 border-green-400 shadow-lg">
              <p className="text-white/90 text-sm font-medium mb-1">正確答案</p>
              <p className="text-2xl font-bold text-white break-words">{revealedAnswer}</p>
              {/* Fix 2: 移除綠色區塊內的分享按鈕 */}
            </div>
          )}
          {answerStatus === 'pending' && !revealedAnswer && <p className="text-white/80">答案已送出，等待主持人判定...</p>}
          {answerStatus === 'correct' && (
            <div className="bg-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-xl font-bold text-green-300">答對了！</p>
              {earnedPoints > 0 && <p className="text-lg font-semibold text-yellow-300 mt-2">獲得 {earnedPoints} 分</p>}
            </div>
          )}
          {answerStatus === 'wrong' && !revealedAnswer && <p className="text-red-300">答錯囉，請再試一次</p>}
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 lg:max-h-[calc(100vh-12rem)] flex flex-col">
          <h3 className="text-white font-semibold mb-2">即時排行榜</h3>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
            {leaderboard.length === 0 ? <p className="text-white/60 text-sm">尚無玩家</p> : leaderboard.map(({ socketId, name, score, rank }) => (
              <div key={socketId} className="flex justify-between text-white text-sm"><span>#{rank} {name}</span><span className="text-amber-400 font-bold">{score} 分</span></div>
            ))}
          </div>
        </div>
      </div>

      {correctToast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-green-600/90 text-white font-bold rounded-xl shadow-lg">{correctToast}</div>}
      
      {/* 遊戲結束全屏排行榜 */}
      {gameEnded && finalLeaderboard.length > 0 && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-8">🎉 遊戲結束 🎉</h2>
            <h3 className="text-2xl font-bold text-white text-center mb-6">最終排行榜</h3>
            <div className="space-y-4 mb-6">
              {finalLeaderboard.map(({ socketId, name, score, rank }) => (
                <div 
                  key={socketId} 
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    rank === 1 
                      ? 'bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border-2 border-yellow-400' 
                      : 'bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${
                      rank === 1 ? 'text-yellow-400' : 'text-white/70'
                    }`}>
                      #{rank}
                    </span>
                    <span className={`text-xl font-semibold ${
                      rank === 1 ? 'text-yellow-300' : 'text-white'
                    }`}>
                      {rank === 1 && '👑 '}
                      {name}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${
                    rank === 1 ? 'text-yellow-400' : 'text-amber-400'
                  }`}>
                    {score} 分
                  </span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-white/70 mb-4">等待主持人重新開始...</p>
              <button 
                onClick={handleResetGame}
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl text-lg"
              >
                再來一局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [role, setRole] = useState(null)
  const [playerJoined, setPlayerJoined] = useState(false)
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = io(SOCKET_URL, { path: '/socket.io', transports: ['websocket', 'polling'] })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    setSocket(s)
    return () => s.disconnect()
  }, [])

  useEffect(() => { if (socket && role === 'host') socket.emit('join_game', 'host') }, [socket, role])

  useEffect(() => {
    if (role === null) return
    const preventContextMenu = (e) => e.preventDefault()
    const preventDevTools = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault()
      }
    }
    document.addEventListener('contextmenu', preventContextMenu)
    document.addEventListener('keydown', preventDevTools)
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('keydown', preventDevTools)
    }
  }, [role])
  if (!socket) return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center"><p className="text-white">連線中...</p></div>
  if (role === null) return <div className="relative"><RoleSelection onSelect={setRole} /><div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm z-10 ${connected ? 'bg-green-500/80' : 'bg-red-500/80'} text-white`}>{connected ? '已連線' : '未連線'}</div></div>
  if (role === 'player' && !playerJoined) return <PlayerJoinScreen socket={socket} onJoined={() => setPlayerJoined(true)} onBack={() => setRole(null)} /> 
  return <div className="relative"><div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm z-10 ${connected ? 'bg-green-500/80' : 'bg-red-500/80'} text-white`}>{connected ? '已連線' : '未連線'}</div>{role === 'host' && <HostUI socket={socket} onBack={() => setRole(null)} />}{role === 'player' && <PlayerUI socket={socket} onBack={() => { setRole(null); setPlayerJoined(false) }} />}</div>
}

export default App