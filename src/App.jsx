import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import YouTube from 'react-youtube'
import { QRCodeSVG } from 'qrcode.react'
import { Music2, Play, Square, Pause, Monitor, User, Check, X, Send } from 'lucide-react'
import { WaveformVisualizer } from './components/WaveformVisualizer'

const SOCKET_URL = window.location.origin

// 已移除 EXAMPLE_SONGS 陣列

function unlockAudio() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
    audio.play().catch(() => {})
  } catch (_) {}
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

function HostUI({ socket, onBack }) {
  const [videoId, setVideoId] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [startMin, setStartMin] = useState('0')
  const [startSec, setStartSec] = useState('0')
  const [endMin, setEndMin] = useState('0')
  const [endSec, setEndSec] = useState('0')
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pendingAnswers, setPendingAnswers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [correctToast, setCorrectToast] = useState(null)
  const previewPlayerRef = useRef(null)
  const endTimerRef = useRef(null)
  const fiveSecTimerRef = useRef(null)
  const songTitleRef = useRef('')
  const answeredThisRoundRef = useRef(new Set())

  useEffect(() => { songTitleRef.current = songTitle }, [songTitle])

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
    const onCorrect = ({ playerId, playerName }) => {
      setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId))
      setCorrectToast(`${playerName} 答對了！`)
      setTimeout(() => setCorrectToast(null), 3000)
    }
    const onGameState = (state) => {
      setCurrentSong(state.videoId ? { videoId: state.videoId, songTitle: state.songTitle } : null)
      setVideoId(state.videoId || '')
      setSongTitle(state.songTitle || '')
      setIsPlaying(state.isPlaying || false)
    }
    socket.on('player_submitted_answer', onSubmitted)
    socket.on('update_leaderboard', onLeaderboard)
    socket.on('answer_correct_broadcast', onCorrect)
    socket.on('game_state', onGameState)
    return () => {
      socket.off('player_submitted_answer', onSubmitted)
      socket.off('update_leaderboard', onLeaderboard)
      socket.off('answer_correct_broadcast', onCorrect)
      socket.off('game_state', onGameState)
    }
  }, [socket])

  const clearTimers = () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    endTimerRef.current = null
    if (fiveSecTimerRef.current) clearTimeout(fiveSecTimerRef.current)
    fiveSecTimerRef.current = null
  }

  const toTotalSeconds = (min, sec) => (parseInt(min, 10) || 0) * 60 + (parseInt(sec, 10) || 0)

  const handlePlay = () => {
    setPendingAnswers([])
    answeredThisRoundRef.current.clear()
    clearTimers()
    const id = extractVideoId(videoId)
    if (!id) return
    let st
    if (previewPlayerRef.current) {
      st = Math.floor(previewPlayerRef.current.getCurrentTime?.() || 0)
      setStartMin(String(Math.floor(st / 60)))
      setStartSec(String(Math.floor(st % 60)))
    } else {
      st = toTotalSeconds(startMin, startSec)
    }
    const et = toTotalSeconds(endMin, endSec)
    socket.emit('play_song', { videoId: id, songTitle: songTitle.trim(), startTime: st, endTime: et })
    setCurrentSong({ videoId: id, songTitle: songTitle.trim() })
    setIsPlaying(true)
    if (et > st) {
      endTimerRef.current = setTimeout(() => {
        socket.emit('control_player', 'pause')
        setIsPlaying(false)
      }, (et - st) * 1000)
    }
  }

  const handlePlay5Sec = () => {
    setPendingAnswers([])
    answeredThisRoundRef.current.clear()
    clearTimers()
    const id = extractVideoId(videoId)
    if (!id) return
    let st
    if (previewPlayerRef.current) {
      st = Math.floor(previewPlayerRef.current.getCurrentTime?.() || 0)
      setStartMin(String(Math.floor(st / 60)))
      setStartSec(String(Math.floor(st % 60)))
    } else {
      st = toTotalSeconds(startMin, startSec)
    }
    const et = st + 5
    socket.emit('play_song', { videoId: id, songTitle: songTitle.trim(), startTime: st, endTime: et })
    setCurrentSong({ videoId: id, songTitle: songTitle.trim() })
    setIsPlaying(true)
    fiveSecTimerRef.current = setTimeout(() => {
      socket.emit('control_player', 'pause')
      setIsPlaying(false)
    }, 5000)
  }

  const handlePause = () => {
    clearTimers()
    socket.emit('control_player', 'pause')
    setIsPlaying(false)
  }

  const handleStop = () => {
    clearTimers()
    socket.emit('control_player', 'stop')
    setIsPlaying(false)
    setCurrentSong(null)
  }

  const handleRevealAnswer = () => socket.emit('reveal_answer', songTitle.trim() || undefined)

  // 修改：下一題時清空所有欄位
  const handleNextRound = () => { 
    answeredThisRoundRef.current.clear(); 
    socket.emit('next_round'); 
    setPendingAnswers([]);
    
    // 清空欄位
    setVideoId('');
    setSongTitle('');
    setStartMin('0');
    setStartSec('0');
    setEndMin('0');
    setEndSec('0');
    setCurrentSong(null);
  }

  const handleAnswerCorrect = (playerId) => { socket.emit('answer_correct', { playerId }); setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId)) }
  const handleAnswerWrong = (playerId) => { socket.emit('answer_wrong', { playerId }); setPendingAnswers((prev) => prev.filter((a) => a.socketId !== playerId)) }
  // 已移除 pickExample 函式

  const hostYoutubeOpts = (id) => ({
    height: '360',
    width: '100%',
    playerVars: { autoplay: 0, mute: 0, controls: 1, playsinline: 1 },
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="text-white/80 hover:text-white">← 返回</button>
        <div className="flex items-center gap-2">
          <button onClick={() => { previewPlayerRef.current?.unMute?.(); previewPlayerRef.current?.setVolume?.(100); previewPlayerRef.current?.playVideo?.() }} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm">🔊 測試聲音</button>
          <span className="text-cyan-400 font-bold flex items-center gap-2"><Monitor className="w-5 h-5" /> 主持人</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 lg:gap-6 max-w-7xl mx-auto">
        {/* 左欄：操作區 */}
        <div className="space-y-4 overflow-y-auto">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4">
            <h3 className="text-white font-semibold mb-3">加入遊戲 QR Code</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : ''} size={128} level="M" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-white font-medium mb-1">掃描加入遊戲</p>
                <p className="text-white/70 text-sm break-all">{typeof window !== 'undefined' ? window.location.href : ''}</p>
                <button onClick={() => navigator.clipboard?.writeText(window.location.href)} className="mt-2 text-cyan-400 text-sm hover:underline">複製網址</button>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4">
            <h3 className="text-white font-semibold mb-3">YouTube 影片</h3>
            <input type="text" value={videoId} onChange={(e) => setVideoId(e.target.value)} placeholder="貼上網址或 ID" className="w-full px-4 py-2 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20 mb-2" />
            <input type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="歌名 (Correct Answer，用於自動對答案)" className="w-full px-4 py-2 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20 mb-2" />
            {/* 已移除範例歌曲按鈕區塊 */}
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4">
            <h3 className="text-white font-semibold mb-3">播放片段</h3>
            <p className="text-white/60 text-sm mb-2">播放時將同步右側影片進度</p>
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-white/70 text-sm block mb-1">開始</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" inputMode="numeric" value={startMin} onChange={(e) => setStartMin((e.target.value.replace(/\D/g, '') || '0'))} className="w-16 px-2 py-2 rounded-lg bg-white/20 text-white text-center" placeholder="0" />
                  <span className="text-white/80">分</span>
                  <span className="text-white/60">:</span>
                  <input type="number" min="0" inputMode="numeric" value={startSec} onChange={(e) => setStartSec((e.target.value.replace(/\D/g, '') || '0'))} className="w-16 px-2 py-2 rounded-lg bg-white/20 text-white text-center" placeholder="00" />
                  <span className="text-white/80">秒</span>
                </div>
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-1">結束 (0:00 = 不限制)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" inputMode="numeric" value={endMin} onChange={(e) => setEndMin((e.target.value.replace(/\D/g, '') || '0'))} className="w-16 px-2 py-2 rounded-lg bg-white/20 text-white text-center" placeholder="0" />
                  <span className="text-white/80">分</span>
                  <span className="text-white/60">:</span>
                  <input type="number" min="0" inputMode="numeric" value={endSec} onChange={(e) => setEndSec((e.target.value.replace(/\D/g, '') || '0'))} className="w-16 px-2 py-2 rounded-lg bg-white/20 text-white text-center" placeholder="00" />
                  <span className="text-white/80">秒</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handlePlay} disabled={!extractVideoId(videoId)} className="flex-1 min-w-[80px] py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-1"><Play className="w-4 h-4" /> 播放</button>
              <button onClick={handlePlay5Sec} disabled={!extractVideoId(videoId)} className="flex-1 min-w-[80px] py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-1">⚡ 只播 5 秒</button>
              <button onClick={handlePause} disabled={!isPlaying} className="py-2 px-4 bg-amber-700 hover:bg-amber-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center gap-1"><Pause className="w-4 h-4" /> 暫停</button>
              <button onClick={handleStop} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl flex items-center gap-1"><Square className="w-4 h-4" /> 停止</button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4">
            <h3 className="text-white font-semibold mb-2">答案控制</h3>
            <div className="flex gap-2">
              <button onClick={handleRevealAnswer} disabled={!currentSong} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl">公布答案</button>
              <button onClick={handleNextRound} className="flex-1 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl">下一題</button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4">
            <h3 className="text-white font-semibold mb-2">搶答區</h3>
            {pendingAnswers.length === 0 ? <p className="text-white/60 text-sm">等待玩家送出答案...</p> : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pendingAnswers.map(({ socketId, answer, playerName }) => (
                  <div key={socketId} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/10">
                    <p className="text-white truncate flex-1 text-sm">{playerName}：{answer}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleAnswerCorrect(socketId)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-0.5"><Check className="w-3 h-3" /> 正確</button>
                      <button onClick={() => handleAnswerWrong(socketId)} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-0.5"><X className="w-3 h-3" /> 錯誤</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右欄：監控區 */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="bg-black/30 rounded-2xl overflow-hidden flex-1 min-h-[280px]" style={{ width: '100%', opacity: 1, pointerEvents: 'auto', display: 'block' }}>
            {extractVideoId(videoId) ? (
              <YouTube
                videoId={extractVideoId(videoId)}
                opts={hostYoutubeOpts()}
                onReady={(e) => { const p = e.target; previewPlayerRef.current = p; p.unMute?.(); p.setVolume?.(100) }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50">輸入影片並播放</div>
            )}
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 flex-shrink-0" style={{ maxHeight: 240 }}>
            <h3 className="text-white font-semibold mb-2">即時排行榜</h3>
            <div className="overflow-y-auto space-y-1" style={{ maxHeight: 180 }}>
              {leaderboard.length === 0 ? <p className="text-white/60 text-sm">尚無玩家</p> : leaderboard.map(({ socketId, name, score, rank }) => (
                <div key={socketId} className="flex justify-between text-white text-sm"><span>#{rank} {name}</span><span className="text-amber-400 font-bold">{score} 分</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {correctToast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-green-600/90 text-white font-bold rounded-xl shadow-lg">{correctToast}</div>}
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
  const [leaderboard, setLeaderboard] = useState([])
  const [correctToast, setCorrectToast] = useState(null)
  const [volume, setVolume] = useState(100)
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
    const onGameState = (state) => { if (state.videoId) setVideoId(state.videoId); if (state.answerRevealed) setRevealedAnswer(state.songTitle) }
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
    const onAnswerResult = ({ correct }) => setAnswerStatus(correct ? 'correct' : 'wrong')
    const onLeaderboard = (data) => setLeaderboard(Array.isArray(data) ? data : [])
    const onCorrectBroadcast = ({ playerId, playerName }) => { if (playerId !== socket.id) { setCorrectToast(`${playerName} 答對了！`); setTimeout(() => setCorrectToast(null), 3000) } }
    const onControl = (action) => {
      if (action === 'play') tryPlay(startTimeRef.current, endTimeRef.current)
      else if (action === 'pause' && playerRef.current) { clearEndTimer(); playerRef.current.pauseVideo?.() }
      else if (action === 'stop') { clearEndTimer(); setVideoId(null); setRevealedAnswer(null); setAnswerStatus(null); shouldPlayRef.current = false }
    }
    const onReveal = (songTitle) => setRevealedAnswer(songTitle || '')
    const onNextRound = () => setAnswerStatus(null)

    socket.on('game_state', onGameState)
    socket.on('play_song', onPlaySong)
    socket.on('your_answer_result', onAnswerResult)
    socket.on('update_leaderboard', onLeaderboard)
    socket.on('answer_correct_broadcast', onCorrectBroadcast)
    socket.on('control_player', onControl)
    socket.on('reveal_answer', onReveal)
    socket.on('next_round', onNextRound)

    return () => {
      socket.off('game_state', onGameState)
      socket.off('play_song', onPlaySong)
      socket.off('your_answer_result', onAnswerResult)
      socket.off('update_leaderboard', onLeaderboard)
      socket.off('answer_correct_broadcast', onCorrectBroadcast)
      socket.off('control_player', onControl)
      socket.off('reveal_answer', onReveal)
      socket.off('next_round', onNextRound)
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
          <button onClick={() => { playerRef.current?.unMute?.(); playerRef.current?.setVolume?.(100); playerRef.current?.playVideo?.() }} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm">🔊 測試聲音</button>
          <span className="text-pink-400 font-bold flex items-center gap-2"><User className="w-5 h-5" /> 猜題者</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-6 max-w-4xl mx-auto">
        {/* 左欄 */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <p className="text-amber-400 font-bold">我的分數：{myScore}</p>
            {myRank != null && <p className="text-cyan-400 font-bold">目前排名：第 {myRank} 名</p>}
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4">
            <WaveformVisualizer />
          </div>
          {videoId && (
            <div className="space-y-2">
              <div><label className="text-white/80 text-sm">音量</label><input type="range" min="0" max="100" value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); playerRef.current?.setVolume?.(v) }} className="w-full h-2 rounded-lg accent-pink-500" /></div>
              <div className="flex gap-2">
                <input type="text" value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()} placeholder="輸入答案..." disabled={answerStatus === 'pending' || answerStatus === 'correct'} className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20 disabled:opacity-70" />
                <button onClick={handleSubmitAnswer} disabled={!answerInput.trim() || answerStatus === 'pending' || answerStatus === 'correct'} className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Send className="w-5 h-5" /> 送出</button>
              </div>
            </div>
          )}
          {answerStatus === 'pending' && <p className="text-white/80">答案已送出，等待主持人判定...</p>}
          {answerStatus === 'correct' && <div className="bg-green-500/30 rounded-2xl p-4 text-center"><p className="text-xl font-bold text-green-300">答對了！</p></div>}
          {answerStatus === 'wrong' && <p className="text-red-300">答錯囉，請再試一次</p>}
          {revealedAnswer && <div className="bg-white/20 backdrop-blur-xl rounded-2xl p-4 text-center"><p className="text-white/70 text-sm">答案</p><p className="text-xl font-bold text-amber-400">{revealedAnswer}</p></div>}
          {!videoId && <p className="text-white/60 text-center">等待主持人播放音樂...</p>}
        </div>

        {/* 右欄：排行榜 */}
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
  if (!socket) return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center"><p className="text-white">連線中...</p></div>
  if (role === null) return <div className="relative"><RoleSelection onSelect={setRole} /><div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm z-10 ${connected ? 'bg-green-500/80' : 'bg-red-500/80'} text-white`}>{connected ? '已連線' : '未連線'}</div></div>
  if (role === 'player' && !playerJoined) return <PlayerJoinScreen socket={socket} onJoined={() => setPlayerJoined(true)} onBack={() => setRole(null)} /> 
  return <div className="relative"><div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-sm z-10 ${connected ? 'bg-green-500/80' : 'bg-red-500/80'} text-white`}>{connected ? '已連線' : '未連線'}</div>{role === 'host' && <HostUI socket={socket} onBack={() => setRole(null)} />}{role === 'player' && <PlayerUI socket={socket} onBack={() => { setRole(null); setPlayerJoined(false) }} />}</div>
}

export default App