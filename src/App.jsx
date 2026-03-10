import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import YouTube from 'react-youtube'
import {
  Music2,
  Square,
  Pause,
  Monitor,
  User,
  Check,
  X,
  Send,
  LogOut,
  Maximize2,
  Infinity,
} from 'lucide-react'

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
            animationIterationCount: 'infinite',
          }}
        />
      ))}
    </div>
  )
}
// -----------------------

const SOCKET_URL = window.location.origin

// Player 端隱藏用 YouTube 播放器設定（避免每次 render 產生新物件）
const PLAYER_HIDDEN_IFRAME_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  opacity: 0.01,
  pointerEvents: 'none',
  overflow: 'hidden',
  left: -9999,
}

const PLAYER_YOUTUBE_OPTS = {
  height: '1',
  width: '1',
  playerVars: { autoplay: 0, mute: 0, controls: 0, playsinline: 1 },
}

// Player 顯示用 YouTube 播放器設定
const VISIBLE_YOUTUBE_OPTS = {
  height: '100%',
  width: '100%',
  playerVars: { autoplay: 0, mute: 0, controls: 1, playsinline: 1 },
}

// Host 顯示用 YouTube 播放器設定
const HOST_YOUTUBE_OPTS = {
  height: '100%',
  width: '100%',
  playerVars: { autoplay: 0, mute: 0, controls: 1, playsinline: 1, disablekb: 0 },
}

function unlockAudio() {
  try {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    )
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
      <button
        onClick={requestFullscreen}
        className="fixed top-4 right-20 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm flex items-center gap-2 z-10"
      >
        <Maximize2 className="w-4 h-4" /> 進入全螢幕
      </button>
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center shadow-2xl max-w-md w-full border border-white/10">
        <div className="inline-flex p-4 rounded-full bg-white/20 mb-6">
          <Music2 className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">猜歌遊戲</h1>
        <p className="text-white/80 mb-8">多人連線版</p>
        <div className="space-y-4">
          <button
            onClick={() => onSelect('host')}
            className="w-full py-5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center justify-center gap-3 text-lg"
          >
            <Monitor className="w-6 h-6" /> 我是主持人 (Host)
          </button>
          <button
            onClick={() => onSelect('player')}
            className="w-full py-5 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all flex items-center justify-center gap-3 text-lg"
          >
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
  useEffect(() => {
    onJoinedRef.current = onJoined
  }, [onJoined])
  const handleJoin = () => {
    const name = nickname.trim()
    if (!name) {
      setError('請輸入暱稱')
      return
    }
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
    return () => {
      socket.off('join_confirmed', onConfirm)
      socket.off('join_error', onErr)
    }
  }, [socket])
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex flex-col items-center justify-center p-6">
      <button
        onClick={requestFullscreen}
        className="fixed top-4 right-4 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm flex items-center gap-2 z-10"
      >
        <Maximize2 className="w-4 h-4" /> 全螢幕
      </button>
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-xl">
        <button onClick={onBack} className="text-white/80 hover:text-white mb-4">
          ← 返回
        </button>
        <h2 className="text-xl font-bold text-white mb-4">加入遊戲</h2>
        <p className="text-white/70 text-sm mb-3">
          請輸入暱稱後，點擊「加入遊戲」以解鎖聲音
        </p>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="請輸入暱稱"
          className="w-full px-4 py-3 rounded-xl bg-black/40 text-white placeholder-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400 mb-4"
        />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button
          onClick={handleJoin}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700"
        >
          加入遊戲並開啟聲音
        </button>
      </div>
    </div>
  )
}

const TIMELINE_MAX_SEC = 600

function HostUI({ socket, onBack }) {
  const [videoId, setVideoId] = useState('')
  const [answers, setAnswers] = useState([])
  const [answerInput, setAnswerInput] = useState('')
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
  const [hintText, setHintText] = useState('')
  const [customHintOpen, setCustomHintOpen] = useState(false)
  const [sentHints, setSentHints] = useState([])
  const previewPlayerRef = useRef(null)
  const endTimerRef = useRef(null)
  const durationTimerRef = useRef(null)
  const answeredThisRoundRef = useRef(new Set())
  const answersRef = useRef([])
  const lastFetchedVideoIdRef = useRef('')

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  // 自動擷取 YouTube 標題並加入多重答案
  useEffect(() => {
    const id = extractVideoId(videoId)
    if (!id || id === lastFetchedVideoIdRef.current) return
    lastFetchedVideoIdRef.current = id
    try {
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.title) return
          const title = String(data.title).trim()
          if (!title) return
          const lower = title.toLowerCase()
          setAnswers((prev) => {
            if (prev.some((a) => a.trim().toLowerCase() === lower)) return prev
            return [...prev, title]
          })
        })
        .catch(() => {})
    } catch (_) {}
  }, [videoId])

  useEffect(() => {
    if (!socket) return
    const onJoinError = ({ message }) => {
      alert(message || '加入失敗')
      onBack()
    }
    socket.on('join_error', onJoinError)
    return () => {
      socket.off('join_error', onJoinError)
    }
  }, [socket, onBack])

  useEffect(() => {
    if (!socket) return
    const onSubmitted = ({ socketId, answer, playerName }) => {
      const playerAnswer = (answer || '').trim().toLowerCase()
      const isCorrect =
        playerAnswer &&
        answersRef.current.some(
          (a) => a && a.trim().toLowerCase() === playerAnswer
        )
      if (isCorrect && !answeredThisRoundRef.current.has(socketId)) {
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
      setCurrentSong(
        state.videoId ? { videoId: state.videoId, songTitle: state.songTitle } : null
      )
      setVideoId(state.videoId || '')
      if (state.songTitle) {
        setAnswers((prev) => (prev.length ? prev : [state.songTitle]))
      }
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
    const onSendHint = (hint) => {
      if (!hint || !hint.value) return
      setSentHints((prev) => [...prev, hint])
    }
    const onClearHints = () => {
      setSentHints([])
    }
    const onStopGame = () => {
      clearTimers()
      setIsPlaying(false)
      setCurrentSong(null)
      previewPlayerRef.current?.stopVideo?.()
    }

    socket.on('player_submitted_answer', onSubmitted)
    socket.on('update_leaderboard', onLeaderboard)
    socket.on('answer_correct_broadcast', onCorrect)
    socket.on('game_state', onGameState)
    socket.on('round_update', onRoundUpdate)
    socket.on('round_status_update', onRoundStatusUpdate)
    socket.on('game_ended', onGameEnded)
    socket.on('game_reset', onGameReset)
    socket.on('send_hint', onSendHint)
    socket.on('clear_hints', onClearHints)
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
      socket.off('send_hint', onSendHint)
      socket.off('clear_hints', onClearHints)
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
    const songTitleForServer = answersRef.current
      .map((a) => a.trim())
      .filter(Boolean)
      .join(' / ')
    socket.emit('play_song', {
      videoId: id,
      songTitle: songTitleForServer,
      startTime: st,
      endTime: et,
    })
    setCurrentSong({ videoId: id, songTitle: songTitleForServer })
    setIsPlaying(true)
    durationTimerRef.current = setTimeout(() => {
      socket.emit('control_player', 'pause')
      setIsPlaying(false)
    }, durationSec * 1000)
  }

  const handlePlay10Sec = () => handlePlayWithDuration(10)
  const handlePlayUnlimited = () => handlePlayWithDuration(3600)
  const handlePlayCustom = () =>
    handlePlayWithDuration(Math.max(1, Math.min(120, customDurationSec)))

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

  const handleRevealAnswer = () => {
    const songTitleForServer = answersRef.current
      .map((a) => a.trim())
      .filter(Boolean)
      .join(' / ')
    socket.emit('reveal_answer', songTitleForServer || undefined)
  }

  const handleNextRound = () => {
    answeredThisRoundRef.current.clear()
    socket.emit('next_round')
    socket.emit('clear_hints')
    setPendingAnswers([])
    setRoundLocked(false)
    setCorrectCount(0)
    setVideoId('')
    setAnswers([])
    setAnswerInput('')
    setStartTimeSeconds(0)
    setCurrentSong(null)
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

  const handleAnswerCorrect = (playerId) => {
    socket.emit('answer_correct', { playerId })
    setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId))
  }
  const handleAnswerWrong = (playerId) => {
    socket.emit('answer_wrong', { playerId })
    setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId))
  }
  const handleAddAnswer = () => {
    let ans = answerInput.trim()
    if (!ans) return

    // 檢查是否有前綴並自動發送提示
    if (ans.startsWith('作者:')) {
      ans = ans.replace('作者:', '').trim()
      socket.emit('send_hint', {
        label: '系統提示',
        value: '本題回答【作者】也算對喔！',
      })
    } else if (ans.startsWith('作品:')) {
      ans = ans.replace('作品:', '').trim()
      socket.emit('send_hint', {
        label: '系統提示',
        value: '本題回答【作品】也算對喔！',
      })
    }

    if (!ans) {
      setAnswerInput('')
      return
    }

    const lower = ans.toLowerCase()
    setAnswers((prev) => {
      if (prev.some((a) => a.trim().toLowerCase() === lower)) return prev
      return [...prev, ans]
    })
    setAnswerInput('')
  }

  const handleRemoveAnswer = (index) => {
    setAnswers((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSendCustomHint = () => {
    const text = hintText.trim()
    if (!text) return
    socket.emit('send_hint', { label: '提示', value: text })
    setHintText('')
  }

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
          <button onClick={onBack} className="text-white/80 hover:text-white">
            ← 返回
          </button>
          <button
            onClick={handleLeaveGame}
            className="px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-600 text-white font-medium flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> 結束／離開遊戲
          </button>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/10 border border-white/20 flex-1 max-w-xl min-w-0">
            <span className="text-white font-medium whitespace-nowrap">加入連結:</span>
            <span className="text-white/95 truncate text-sm" title={joinUrl}>
              {joinUrl}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(joinUrl)}
              className="flex-shrink-0 px-4 py-2 rounded-lg bg-cyan-500/80 hover:bg-cyan-500 text-white font-medium"
            >
              複製
            </button>
          </div>
          <button
            onClick={playTestSoundBeep}
            className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white"
          >
            🔊 測試聲音
          </button>
          <button
            onClick={requestFullscreen}
            className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white"
            title="全螢幕"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <span className="text-cyan-400 font-bold flex items-center gap-2">
            <Monitor className="w-5 h-5" /> 主持人
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-7xl mx-auto min-h-0">
        {/* 左欄 (操作區) */}
        <div className="flex flex-col gap-5 overflow-y-auto min-w-0">
          {/* 1. 播放控制區 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-5">
            <h3 className="text-white font-semibold mb-3">播放控制</h3>
            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">YouTube 影片</label>
                <input
                  type="text"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  placeholder="貼上網址或 ID"
                  className="w-full px-4 py-3 rounded-xl bg-black/40 text-white placeholder-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">正確答案（可多個）</label>
                <div className="flex gap-2 mb-2 flex-wrap md:flex-nowrap">
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="輸入歌名、作品名或別名後按加入"
                    className="flex-1 px-4 py-3 rounded-xl bg-black/40 text-white placeholder-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAnswer()}
                  />
                  <button
                    type="button"
                    onClick={() => setAnswerInput((prev) => `作者:${prev || ''}`)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-bold"
                  >
                    作者:
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerInput((prev) => `作品:${prev || ''}`)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-bold"
                  >
                    作品:
                  </button>
                  <button
                    onClick={handleAddAnswer}
                    className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
                  >
                    加入答案
                  </button>
                </div>
                {answers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {answers.map((a, idx) => (
                      <span
                        key={`${a}-${idx}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs shadow-sm"
                      >
                        <span>{a}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAnswer(idx)}
                          className="text-white/80 hover:text-white"
                          aria-label="移除答案"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">
                  影片進度條（拖曳決定開始時間）
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-xs w-10">
                    {Math.floor(startTimeSeconds / 60)}:
                    {String(startTimeSeconds % 60).padStart(2, '0')}
                  </span>
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

              {/* 播放控制按鈕區：Grid System (12格) */}
              <div className="grid grid-cols-12 gap-2">
                {/* 10秒：col-span-2, bg-amber-500 */}
                <button
                  onClick={handlePlay10Sec}
                  disabled={!extractVideoId(videoId)}
                  className="col-span-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-base flex items-center justify-center gap-1"
                  title="播放 10 秒"
                >
                  <span className="text-sm">10秒</span>
                </button>

                {/* 無限播放：col-span-2, bg-blue-500 */}
                <button
                  onClick={handlePlayUnlimited}
                  disabled={!extractVideoId(videoId)}
                  className="col-span-2 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-base flex items-center justify-center gap-1"
                  title="完整播放 (無限制)"
                >
                  <Infinity className="w-5 h-5" />
                </button>

                {/* 自訂秒數與播放：col-span-4 */}
                <div className="col-span-4 flex bg-black/40 rounded-xl p-1 gap-1 border border-white/10">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={customDurationSec}
                    onChange={(e) =>
                      setCustomDurationSec(
                        Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 30))
                      )
                    }
                    className="w-12 px-2 text-center bg-transparent text-white font-bold outline-none focus:ring-0 text-sm"
                  />
                  <span className="text-white/60 text-xs flex items-center mr-1">秒</span>
                  <button
                    onClick={handlePlayCustom}
                    disabled={!extractVideoId(videoId)}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm"
                  >
                    播放
                  </button>
                </div>

                {/* 暫停：col-span-2, bg-white/20 */}
                <button
                  onClick={handlePause}
                  disabled={!isPlaying}
                  className="col-span-2 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center"
                  title="暫停"
                >
                  <Pause className="w-5 h-5" />
                </button>

                {/* 停止：col-span-2, bg-red-500 */}
                <button
                  onClick={handleStop}
                  className="col-span-2 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl flex items-center justify-center"
                  title="停止"
                >
                  <Square className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-3">
              <button
                onClick={handleRevealAnswer}
                disabled={!currentSong}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-base"
              >
                公布答案
              </button>
              <button
                onClick={handleNextRound}
                className={`flex-1 py-3 text-white font-semibold rounded-xl text-base ${
                  roundLocked || correctCount >= 3
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                下一題
              </button>
              {gameEnded && (
                <button
                  onClick={handleResetGame}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl text-base"
                >
                  再來一局
                </button>
              )}
            </div>
          </div>

          {/* 1.5 輔助工具 (計時 & 提示) */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-5">
            <h3 className="text-white font-semibold mb-3">輔助工具（提示）</h3>

            {/* 提示功能 */}
            <div className="mb-2">
              <p className="text-white/80 text-sm mb-2">提示功能</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={() => setCustomHintOpen((v) => !v)}
                  className="flex-1 min-w-[80px] px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-semibold"
                >
                  自訂
                </button>
                {sentHints.length > 0 && (
                  <button
                    onClick={() => socket.emit('clear_hints')}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                  >
                    清空提示
                  </button>
                )}
              </div>
              {customHintOpen && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <input
                    type="text"
                    value={hintText}
                    onChange={(e) => setHintText(e.target.value)}
                    placeholder="輸入自訂提示內容..."
                    className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-black/40 text-white border border-white/20 text-sm placeholder-white/50 outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    onClick={handleSendCustomHint}
                    className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center gap-1"
                  >
                    <Send className="w-4 h-4" /> 發送提示
                  </button>
                </div>
              )}
              {sentHints.length > 0 && (
                <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                  {sentHints.map((h, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-100 text-xs mr-2 mb-1"
                    >
                      <span className="text-base">💡</span>
                      <span className="font-semibold">
                        {h.label ? `${h.label}：` : ''}
                      </span>
                      <span className="truncate">{h.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. 答案控制區 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-5">
            <h3 className="text-white font-semibold mb-3">答案控制</h3>
            <p className="text-white/70 text-sm mb-3">
              本回合答對人數：{correctCount} / 3{' '}
              {roundLocked && <span className="text-green-400">✓ 已滿員</span>}
            </p>
            {pendingAnswers.length === 0 ? (
              <p className="text-white/60 text-sm">等待玩家送出答案...</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pendingAnswers.map(({ socketId, answer, playerName }, index) => (
                  <div
                    key={socketId}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/10"
                  >
                    <p className="text-white flex-1 text-sm min-w-0">
                      <span className="font-bold text-red-400 mr-2 text-lg">
                        #{index + 1}
                      </span>
                      <span className="font-semibold text-cyan-300">
                        {playerName}
                      </span>
                      <span className="text-white/90">：{answer || '(空白)'}</span>
                    </p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleAnswerCorrect(socketId)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex itemscenter gap-0.5"
                      >
                        <Check className="w-3 h-3" /> 正確
                      </button>
                      <button
                        onClick={() => handleAnswerWrong(socketId)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex itemscenter gap-0.5"
                      >
                        <X className="w-3 h-3" /> 錯誤
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 遊戲設定 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-5">
            <h3 className="text-white font-semibold mb-3">遊戲設定</h3>
            <label className="text-white/70 text-sm block mb-2">總題數</label>
            <input
              type="number"
              min="1"
              value={totalRounds}
              onChange={(e) => handleSetTotalRounds(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/40 text-white placeholder-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <p className="text-white/60 text-sm mt-2">
              目前第 {currentRound} / {totalRounds} 題
            </p>
          </div>
        </div>

        {/* 右欄 (視覺與資訊區) */}
        <div className="flex flex-col gap-5 min-w-0 flex-1">
          {/* HOST: 強制 16:9 且絕對滿版 (Glassmorphism) */}
          <div className="relative w-full aspect-video bg-black overflow-hidden rounded-2xl shadow-xl border border-white/10">
            {extractVideoId(videoId) ? (
              <YouTube
                videoId={extractVideoId(videoId)}
                className="absolute top-0 left-0 w-full h-full"
                iframeClassName="w-full h-full object-cover"
                opts={HOST_YOUTUBE_OPTS}
                onReady={(e) => {
                  const p = e.target
                  previewPlayerRef.current = p
                  p.setVolume?.(100)
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50">
                輸入影片並播放
              </div>
            )}
          </div>

          {/* 排行榜 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-5 flex flex-col min-h-0 flex-1">
            <h3 className="text-white font-semibold mb-3">
              即時排行榜 · 玩家列表
            </h3>
            <div className="overflow-y-auto space-y-2 pr-1 h-[400px]">
              {leaderboard.length === 0 ? (
                <p className="text-white/60 text-sm">尚無玩家</p>
              ) : (
                leaderboard.map(({ socketId, name, score, rank }) => (
                  <div
                    key={socketId}
                    className="flex justify-between items-center py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-base"
                  >
                    <span className="font-medium">
                      #{rank} {name}
                    </span>
                    <span className="text-amber-400 font-bold">{score} 分</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {correctToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-green-600/90 text-white font-bold rounded-xl shadow-lg">
          {correctToast}
        </div>
      )}

      {/* 遊戲結束全屏排行榜 */}
      {gameEnded && finalLeaderboard.length > 0 && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-8">
              🎉 遊戲結束 🎉
            </h2>
            <h3 className="text-2xl font-bold text-white text-center mb-6">
              最終排行榜
            </h3>
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
                    <span
                      className={`text-2xl font-bold ${
                        rank === 1 ? 'text-yellow-400' : 'text-white/70'
                      }`}
                    >
                      #{rank}
                    </span>
                    <span
                      className={`text-xl font-semibold ${
                        rank === 1 ? 'text-yellow-300' : 'text-white'
                      }`}
                    >
                      {rank === 1 && '👑 '}
                      {name}
                    </span>
                  </div>
                  <span
                    className={`text-2xl font-bold ${
                      rank === 1 ? 'text-yellow-400' : 'text-amber-400'
                    }`}
                  >
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
  const [playTrigger, setPlayTrigger] = useState(0)
  const [answerInput, setAnswerInput] = useState('')
  const [answerStatus, setAnswerStatus] = useState(null)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [correctToast, setCorrectToast] = useState(null)
  const [volume, setVolume] = useState(100)
  const [gameEnded, setGameEnded] = useState(false)
  const [finalLeaderboard, setFinalLeaderboard] = useState([])
  const [hints, setHints] = useState([])
  const [isBrowserBlocked, setIsBrowserBlocked] = useState(false)
  const playerRef = useRef(null)
  const shouldPlayRef = useRef(false)
  const endTimerRef = useRef(null)
  const startTimeRef = useRef(0)
  const endTimeRef = useRef(0)
  const pendingCommandRef = useRef(null)
  const volumeRef = useRef(100)

  const myRank = leaderboard.find((p) => p.socketId === socket?.id)?.rank ?? null
  const myScore = leaderboard.find((p) => p.socketId === socket?.id)?.score ?? 0

  const clearEndTimer = () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    endTimerRef.current = null
  }

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  const tryPlay = (st = 0, et = 0) => {
    const p = playerRef.current
    if (p) {
      // 核心修正：確保在播放前先設定音量與靜音狀態
      try {
        // 使用 volumeRef.current 以確保拿到最新音量
        p.setVolume?.(volumeRef.current)
        p.unMute?.()
        p.seekTo?.(st, true)
        p.playVideo?.()
      } catch (err) {
        console.error('播放器操作失敗', err)
      }

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
      startTimeRef.current = st
      endTimeRef.current = et
      pendingCommandRef.current = { startTime: st, endTime: et }
      setVideoId(id)
      setStartTime(st)
      setEndTime(et)
      setRevealedAnswer(null)
      setAnswerStatus(null)

      // 如果播放器已經存在，強制重新定位並播放
      if (playerRef.current) {
        tryPlay(st, et)
      }
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
      if (action === 'play') {
        tryPlay(startTimeRef.current, endTimeRef.current)
      } else if (action === 'pause') {
        clearEndTimer()
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo()
        }
      } else if (action === 'stop') {
        clearEndTimer()
        setVideoId(null)
        setRevealedAnswer(null)
        setAnswerStatus(null)
        shouldPlayRef.current = false
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo()
        }
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
      setHints([])
    }

    const onSendHint = (hint) => {
      if (!hint || !hint.value) return
      setHints((prev) => [...prev, hint])
    }

    const onClearHints = () => {
      setHints([])
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
    socket.on('send_hint', onSendHint)
    socket.on('clear_hints', onClearHints)

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
      socket.off('send_hint', onSendHint)
      socket.off('clear_hints', onClearHints)
    }
  }, [socket])

  useEffect(() => () => clearEndTimer(), [])

  useEffect(() => {
    if (playTrigger > 0 && playerRef.current) {
      tryPlay(startTimeRef.current, endTimeRef.current)
    }
  }, [playTrigger])

  const handleSubmitAnswer = () => {
    const ans = answerInput.trim()
    if (!ans) return
    socket.emit('submit_answer', ans)
    setAnswerInput('')
    setAnswerStatus('pending')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="text-white/80 hover:text-white">
          ← 返回
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={playTestSoundBeep}
            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm"
          >
            🔊 測試聲音
          </button>
          <button
            onClick={requestFullscreen}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"
            title="全螢幕"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <span className="text-pink-400 font-bold flex items-center gap-2">
            <User className="w-5 h-5" /> 猜題者
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <p className="text-amber-400 font-bold">我的分數：{myScore}</p>
            {myRank != null && (
              <p className="text-cyan-400 font-bold">目前排名：第 {myRank} 名</p>
            )}
          </div>

          {/* PLAYER: 強制 16:9 且絕對滿版（單一 YouTube 播放器） */}
          <div className="relative w-full max-w-3xl mx-auto aspect-video bg-black overflow-hidden rounded-2xl shadow-xl border border-white/10">
            {!videoId && (
              <div className="w-full h-full flex items-center justify-center text-white/60">
                等待主持人播放音樂...
              </div>
            )}

            {/* 永遠掛載的單一 YouTube 播放器，僅透過 CSS 切換可見性 */}
            {videoId && (
              <YouTube
                videoId={videoId}
                className={`absolute top-0 left-0 w-full h-full transition-opacity duration-500 ${
                  revealedAnswer ? 'z-20 opacity-100' : 'z-0 opacity-0 pointer-events-none'
                }`}
                iframeClassName="w-full h-full object-cover"
                opts={{
                  height: '100%',
                  width: '100%',
                  playerVars: {
                    autoplay: 1,
                    mute: 0,
                    controls: 1,
                    playsinline: 1,
                    start: startTimeRef.current || 0,
                  },
                }}
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
                onStateChange={(e) => {
                  // -1 = 未開始, 2 = 暫停, 1 = 播放中
                  if (e.data === -1 || e.data === 2) {
                    setIsBrowserBlocked(true)
                  } else if (e.data === 1) {
                    setIsBrowserBlocked(false)
                  }
                }}
              />
            )}

            {/* 波形圖畫面：揭曉前完全遮擋影片，避免洩漏畫面 */}
            {videoId && !revealedAnswer && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center z-10 bg-gradient-to-b from-indigo-900/90 via-purple-900/95 to-black/95">
                <WaveformVisualizer />
              </div>
            )}
          </div>

          {/* 提示顯示區 */}
          {hints.length > 0 && (
            <div className="mt-3 space-y-2">
              <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                <span className="text-lg">💡</span> 提示
              </h4>
              <div className="flex flex-wrap gap-2">
                {hints.map((h, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-300/70 text-amber-100 text-xs flex items-center gap-1 shadow-sm"
                  >
                    <span className="text-base">✨</span>
                    <span className="font-semibold">
                      {h.label ? `${h.label}：` : ''}
                    </span>
                    <span className="truncate max-w-[160px]">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {videoId && !revealedAnswer && (
            <div className="space-y-2">
              <div>
                <label className="text-white/80 text-sm">音量</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setVolume(v)
                    volumeRef.current = v
                    playerRef.current?.setVolume?.(v)
                  }}
                  className="w-full h-2 rounded-lg accent-pink-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                  placeholder="輸入答案..."
                  disabled={answerStatus === 'pending' || answerStatus === 'correct'}
                  className="flex-1 px-4 py-3 rounded-xl bg-black/40 text-white placeholder-white/50 border border-white/20 outline-none disabled:opacity-70 focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answerInput.trim() || answerStatus === 'pending' || answerStatus === 'correct'}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-5 h-5" /> 送出
                </button>
              </div>
            </div>
          )}

          {videoId && revealedAnswer && (
            <div className="rounded-2xl p-5 text-center bg-green-600/90 border-2 border-green-400 shadow-lg">
              <p className="text-white/90 text-sm font-medium mb-1">正確答案</p>
              <p className="text-2xl font-bold text-white break-words">
                {revealedAnswer}
              </p>
            </div>
          )}

          {answerStatus === 'pending' && !revealedAnswer && (
            <p className="text-white/80">答案已送出，等待主持人判定...</p>
          )}
          {answerStatus === 'correct' && (
            <div className="bg-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-xl font-bold text-green-300">答對了！</p>
              {earnedPoints > 0 && (
                <p className="text-lg font-semibold text-yellow-300 mt-2">
                  獲得 {earnedPoints} 分
                </p>
              )}
            </div>
          )}
          {answerStatus === 'wrong' && !revealedAnswer && (
            <p className="text-red-300">答錯囉，請再試一次</p>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-4 lg:max-h-[calc(100vh-12rem)] flex flex-col">
          <h3 className="text-white font-semibold mb-2">即時排行榜</h3>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
            {leaderboard.length === 0 ? (
              <p className="text-white/60 text-sm">尚無玩家</p>
            ) : (
              leaderboard.map(({ socketId, name, score, rank }) => (
                <div
                  key={socketId}
                  className="flex justify-between text-white text-sm py-1"
                >
                  <span>
                    #{rank} {name}
                  </span>
                  <span className="text-amber-400 font-bold">{score} 分</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {correctToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-green-600/90 text-white font-bold rounded-xl shadow-lg">
          {correctToast}
        </div>
      )}

      {/* 遊戲結束全屏排行榜 */}
      {gameEnded && finalLeaderboard.length > 0 && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-8">
              🎉 遊戲結束 🎉
            </h2>
            <h3 className="text-2xl font-bold text-white text-center mb-6">
              最終排行榜
            </h3>
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
                    <span
                      className={`text-2xl font-bold ${
                        rank === 1 ? 'text-yellow-400' : 'text-white/70'
                      }`}
                    >
                      #{rank}
                    </span>
                    <span
                      className={`text-xl font-semibold ${
                        rank === 1 ? 'text-yellow-300' : 'text-white'
                      }`}
                    >
                      {rank === 1 && '👑 '}
                      {name}
                    </span>
                  </div>
                  <span
                    className={`text-2xl font-bold ${
                      rank === 1 ? 'text-yellow-400' : 'text-amber-400'
                    }`}
                  >
                    {score} 分
                  </span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-white/70 mb-4">等待主持人重新開始...</p>
              <button
                onClick={onGameReset}
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
    const s = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    setSocket(s)
    return () => s.disconnect()
  }, [])

  useEffect(() => {
    if (socket && role === 'host') socket.emit('join_game', 'host')
  }, [socket, role])

  useEffect(() => {
    if (role === null) return
    const preventContextMenu = (e) => e.preventDefault()
    const preventDevTools = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey &&
          e.shiftKey &&
          (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
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

  if (!socket)
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
        <p className="text-white">連線中...</p>
      </div>
    )

  if (role === null)
    return (
      <div className="relative">
        <RoleSelection onSelect={setRole} />
        <div
          className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm z-10 ${
            connected ? 'bg-green-500/80' : 'bg-red-500/80'
          } text-white`}
        >
          {connected ? '已連線' : '未連線'}
        </div>
      </div>
    )

  if (role === 'player' && !playerJoined)
    return (
      <PlayerJoinScreen
        socket={socket}
        onJoined={() => setPlayerJoined(true)}
        onBack={() => setRole(null)}
      />
    )

  return (
    <div className="relative">
      <div
        className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm z-10 ${
          connected ? 'bg-green-500/80' : 'bg-red-500/80'
        } text-white`}
      >
        {connected ? '已連線' : '未連線'}
      </div>
      {role === 'host' && <HostUI socket={socket} onBack={() => setRole(null)} />}
      {role === 'player' && (
        <PlayerUI
          socket={socket}
          onBack={() => {
            setRole(null)
            setPlayerJoined(false)
          }}
        />
      )}
    </div>
  )
}

export default App