import { useEffect, useRef } from 'react'

/**
 * 裝飾性波形動畫 - 中央顯示，不依賴實際音訊
 * 玩家端使用，因 YouTube iframe 隱藏無法取得音訊流
 */
export function WaveformVisualizer() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let phase = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const { width, height } = canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, width, height)

      const centerY = height / 2
      const barCount = 64
      const barWidth = Math.max(2, (width / barCount) * 0.6)
      const gap = width / barCount
      const maxHeight = height * 0.35

      for (let i = 0; i < barCount; i++) {
        const x = i * gap + (gap - barWidth) / 2
        const wave = Math.sin(phase + i * 0.2) * 0.5 + Math.sin(phase * 0.7 + i * 0.15) * 0.5
        const barHeight = Math.abs(wave) * maxHeight + 4

        const gradient = ctx.createLinearGradient(0, centerY - maxHeight, 0, centerY + maxHeight)
        gradient.addColorStop(0, '#a78bfa')
        gradient.addColorStop(0.5, '#ec4899')
        gradient.addColorStop(1, '#a78bfa')

        ctx.fillStyle = gradient
        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight)
      }

      phase += 0.08
      animationId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-2xl"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    />
  )
}
