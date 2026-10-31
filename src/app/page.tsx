'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioWaveform, Maximize, Minimize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, DropOverlay } from '@/components/visualizer/empty-state'
import { ModeSwitcher, PalettePicker } from '@/components/visualizer/mode-switcher'
import { PlayerBar } from '@/components/visualizer/player-bar'
import { AudioEngine } from '@/lib/visualizer/audio-engine'
import { PALETTES, getPalette, type Palette } from '@/lib/visualizer/palettes'
import { createRenderer } from '@/lib/visualizer/renderers'
import type { ModeId, SourceKind, VisualizerRenderer } from '@/lib/visualizer/types'

interface Track {
  name: string
  url: string
}

const DEMO_LABEL = '演示音轨 · Neon Drift'
const INITIAL_VOLUME = 0.85

function isAudioFile(f: File): boolean {
  return (
    f.type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm|weba|mp4)$/i.test(f.name)
  )
}

function formatRecTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function Page() {
  /* ---------- refs ---------- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const rendererRef = useRef<VisualizerRenderer | null>(null)
  const paletteRef = useRef<Palette>(PALETTES[0])
  const clearRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragCountRef = useRef(0)
  const tracksRef = useRef<Track[]>([])
  const indexRef = useRef(0)
  const endedRef = useRef<() => void>(() => {})
  const volumeRef = useRef(INITIAL_VOLUME)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false)

  /* ---------- state ---------- */
  const [mode, setMode] = useState<ModeId>('nebula')
  const [paletteId, setPaletteId] = useState(PALETTES[0].id)
  const [source, setSource] = useState<SourceKind>('none')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(INITIAL_VOLUME)
  const [muted, setMuted] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [trackIndex, setTrackIndex] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hint, setHint] = useState('')
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)

  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new AudioEngine()
    return engineRef.current
  }, [])

  /* ---------- 渲染器 / 调色板切换 ---------- */
  useEffect(() => {
    rendererRef.current = createRenderer(mode)
    clearRef.current = true
  }, [mode])

  useEffect(() => {
    paletteRef.current = getPalette(paletteId)
    clearRef.current = true
  }, [paletteId])

  /* ---------- 主渲染循环 ---------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!rendererRef.current) rendererRef.current = createRenderer('nebula')

    let raf = 0
    let last = performance.now() / 1000
    let lastUi = 0

    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const engine = getEngine()

      // 录制时降到 1x 分辨率, 保证导出体量与编码稳定
      const dpr = recordingRef.current ? 1 : Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        rendererRef.current?.init(w, h)
        clearRef.current = true
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (clearRef.current) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = paletteRef.current.bg
        ctx.fillRect(0, 0, w, h)
        clearRef.current = false
      }

      const t = nowMs / 1000
      const dt = Math.min(0.05, Math.max(0.001, t - last))
      last = t
      const frame = engine.update(t, dt)
      rendererRef.current?.render({
        ...frame,
        ctx,
        width: w,
        height: h,
        time: t,
        dt,
        palette: paletteRef.current,
      })

      if (t - lastUi > 0.25) {
        lastUi = t
        if (engine.mode === 'file') {
          setCurrentTime(engine.audioEl.currentTime)
          const d = engine.audioEl.duration
          setDuration(isFinite(d) ? d : 0)
        } else {
          setCurrentTime(0)
          setDuration(0)
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getEngine])

  /* ---------- <audio> 元素事件 ---------- */
  useEffect(() => {
    const engine = getEngine()
    const el = engine.audioEl
    const onPlay = () => {
      setPlaying(true)
      setSource('file')
    }
    const onPause = () => setPlaying(false)
    const onTime = () => {
      setCurrentTime(el.currentTime)
      const d = el.duration
      setDuration(isFinite(d) ? d : 0)
    }
    const onEnded = () => endedRef.current()
    const onError = () => {
      if (engine.mode === 'file') {
        setHint('音频加载失败，请尝试其他文件')
        setPlaying(false)
      }
    }
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onTime)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onTime)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [getEngine])

  /* ---------- 播放控制 ---------- */
  const playTrack = useCallback(
    async (i: number) => {
      const list = tracksRef.current
      if (!list.length) return
      const idx = ((i % list.length) + list.length) % list.length
      indexRef.current = idx
      setTrackIndex(idx)
      try {
        await getEngine().playFile(list[idx].url)
        setSource('file')
        setPlaying(true)
      } catch {
        setHint('播放失败，请重试')
      }
    },
    [getEngine]
  )

  // 播放结束自动切下一曲 (循环播放列表)
  useEffect(() => {
    if (!tracks.length) {
      endedRef.current = () => {}
      return
    }
    endedRef.current = () => {
      void playTrack((trackIndex + 1) % tracks.length)
    }
  }, [tracks, trackIndex, playTrack])

  const loadFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter(isAudioFile)
      if (!arr.length) {
        setHint('未识别到音频文件，请选择 MP3 / WAV / OGG 等格式')
        return
      }
      const list = arr.map((f) => ({
        name: f.name.replace(/\.[^.]+$/, ''),
        url: URL.createObjectURL(f),
      }))
      tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url))
      tracksRef.current = list
      setTracks(list)
      void playTrack(0)
    },
    [playTrack]
  )

  const startDemo = useCallback(() => {
    const engine = getEngine()
    engine.startDemo()
    engine.setVolume(volumeRef.current)
    setSource('demo')
    setPlaying(true)
  }, [getEngine])

  const togglePlay = useCallback(() => {
    const engine = getEngine()
    if (engine.mode === 'demo') {
      engine.stopDemo()
      setSource(tracksRef.current.length ? 'file' : 'none')
      setPlaying(false)
      return
    }
    if (engine.mode === 'file') {
      engine.pause()
      return
    }
    if (tracksRef.current.length) {
      void playTrack(indexRef.current)
      return
    }
    startDemo()
  }, [getEngine, playTrack, startDemo])

  const toggleMic = useCallback(async () => {
    const engine = getEngine()
    if (engine.mode === 'mic') {
      engine.stopMic()
      setSource(tracksRef.current.length ? 'file' : 'none')
      setPlaying(false)
      return
    }
    const ok = await engine.startMic()
    if (ok) {
      setSource('mic')
      setPlaying(true)
    } else {
      setHint('无法访问麦克风，请检查浏览器权限')
    }
  }, [getEngine])

  const changeVolume = useCallback(
    (v: number) => {
      volumeRef.current = v
      setVolume(v)
      setMuted(v === 0)
      getEngine().setVolume(v)
    },
    [getEngine]
  )

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      getEngine().setVolume(next ? 0 : volumeRef.current || INITIAL_VOLUME)
      return next
    })
  }, [getEngine])

  /* ---------- 视频录制 ---------- */
  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setHint('当前浏览器不支持视频录制')
      return
    }
    if (recordingRef.current) return
    try {
      // 先同步切到 1x 分辨率并等两帧, 避免 H.264 编码器遇到录制中分辨率变更
      recordingRef.current = true
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.round(w)
      canvas.height = Math.round(h)
      rendererRef.current?.init(w, h)
      clearRef.current = true
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

      const videoStream = canvas.captureStream(60)
      const audioTrack = getEngine().getRecordAudioTrack()
      const tracks = [...videoStream.getVideoTracks()]
      if (audioTrack) tracks.push(audioTrack)
      else if (getEngine().mode === 'none') setHint('当前没有音频输入，将录制无声画面')
      const stream = new MediaStream(tracks)

      const mime = [
        'video/mp4;codecs="avc1.640028,mp4a.40.2"',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm',
      ].find((t) => MediaRecorder.isTypeSupported(t))
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 } : undefined
      )
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        if (blob.size) {
          const ext = type.includes('mp4') ? 'mp4' : 'webm'
          const eng = getEngine()
          const raw =
            eng.mode === 'demo'
              ? '演示音轨'
              : eng.mode === 'mic'
                ? '麦克风'
                : (tracksRef.current[indexRef.current]?.name ?? '可视化')
          const safe = raw.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '可视化'
          const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `观声-${safe}-${stamp}.${ext}`
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
          setHint(`视频已导出 (${(blob.size / 1048576).toFixed(1)} MB) · 已开始下载`)
        }
      }
      rec.start(1000)
      recorderRef.current = rec
      setRecording(true)
      setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch {
      recordingRef.current = false
      setHint('录制启动失败，请重试')
    }
  }, [getEngine])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    recorderRef.current = null
    recordingRef.current = false
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current)
      recTimerRef.current = null
    }
    setRecording(false)
  }, [])

  const toggleRecord = useCallback(() => {
    if (recordingRef.current) stopRecording()
    else void startRecording()
  }, [startRecording, stopRecording])

  /* ---------- 全屏 ---------- */
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen().catch(() => setHint('当前环境不支持全屏'))
    }
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* ---------- 拖放导入 ---------- */
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragCountRef.current++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = () => {
      dragCountRef.current = Math.max(0, dragCountRef.current - 1)
      if (!dragCountRef.current) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCountRef.current = 0
      setDragging(false)
      if (e.dataTransfer?.files.length) loadFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [loadFiles])

  /* ---------- 键盘快捷键 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable ||
          el.closest('[role="slider"]'))
      )
        return
      const engine = engineRef.current
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          if (engine?.mode === 'file') engine.seek(engine.audioEl.currentTime - 5)
          break
        case 'ArrowRight':
          if (engine?.mode === 'file') engine.seek(engine.audioEl.currentTime + 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(Math.min(1, volumeRef.current + 0.05))
          break
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(Math.max(0, volumeRef.current - 0.05))
          break
        case 'KeyM':
          toggleMute()
          break
        case 'KeyF':
          toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, changeVolume, toggleMute, toggleFullscreen])

  /* ---------- 提示自动消失 & 卸载清理 ---------- */
  useEffect(() => {
    if (!hint) return
    const timer = setTimeout(() => setHint(''), 2800)
    return () => clearTimeout(timer)
  }, [hint])

  useEffect(() => {
    const engine = getEngine()
    engine.setVolume(INITIAL_VOLUME)
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      if (recTimerRef.current) clearInterval(recTimerRef.current)
      tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url))
      engine.dispose()
    }
  }, [getEngine])

  /* ---------- 派生展示数据 ---------- */
  const hasMedia = source !== 'none' || tracks.length > 0
  const trackLabel =
    source === 'demo'
      ? DEMO_LABEL
      : source === 'mic'
        ? '麦克风输入'
        : (tracks[trackIndex]?.name ?? '暂无曲目')
  const statusLabel =
    source === 'mic'
      ? '麦克风收音中 · 尽情发出声音'
      : source === 'demo'
        ? playing
          ? '内置合成器演奏中'
          : '演示已停止'
        : source === 'file'
          ? playing
            ? '正在播放'
            : '已暂停'
          : tracks.length
            ? '已就绪 · 按播放继续'
            : '未加载音频'
  const canSeek = source === 'file' && duration > 0

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#04040c] text-white">
      {/* 可视化画布 */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 h-full w-full" aria-hidden="true" />
      {/* 暗角增强沉浸感 */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.52) 100%)' }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) loadFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {/* 顶栏 */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 backdrop-blur">
            <AudioWaveform className="size-5 text-fuchsia-300" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">观声</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">audiora · see sound</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeSwitcher mode={mode} onChange={setMode} />
          <PalettePicker value={paletteId} onChange={setPaletteId} palettes={PALETTES} />
          <Button
            variant="ghost"
            size="icon"
            aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
            title={isFullscreen ? '退出全屏' : '进入全屏 (F)'}
            onClick={toggleFullscreen}
            className="size-9 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur hover:bg-white/10 hover:text-white"
          >
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </Button>
        </div>
      </header>

      {/* 主区域 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-2 py-6">
        {!hasMedia ? <EmptyState onPick={() => fileInputRef.current?.click()} onDemo={startDemo} /> : null}
      </main>

      {/* 操作提示 */}
      {hint ? (
        <div
          className={`pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4 ${
            recording ? 'bottom-48' : 'bottom-32'
          }`}
        >
          <div className="rounded-full border border-rose-400/30 bg-rose-500/15 px-4 py-1.5 text-xs text-rose-200 backdrop-blur">
            {hint}
          </div>
        </div>
      ) : null}

      {/* 录制指示器 */}
      {recording ? (
        <div className="fixed inset-x-0 bottom-32 z-40 flex justify-center px-4">
          <button
            onClick={stopRecording}
            className="flex items-center gap-2.5 rounded-full border border-rose-400/40 bg-rose-500/20 px-5 py-2 text-sm font-medium text-rose-100 shadow-lg shadow-rose-500/20 backdrop-blur-xl transition hover:bg-rose-500/30"
          >
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
            </span>
            REC {formatRecTime(recSeconds)} · 点击停止
          </button>
        </div>
      ) : null}

      {/* 底部播放栏 */}
      <PlayerBar
        trackLabel={trackLabel}
        statusLabel={statusLabel}
        isPlaying={playing}
        onTogglePlay={togglePlay}
        canPrev={tracks.length > 1}
        canNext={tracks.length > 1}
        onPrev={() => void playTrack(trackIndex - 1)}
        onNext={() => void playTrack(trackIndex + 1)}
        trackIndex={trackIndex}
        trackCount={tracks.length}
        currentTime={currentTime}
        duration={duration}
        canSeek={canSeek}
        onSeek={(t) => getEngine().seek(t)}
        volume={volume}
        muted={muted}
        onVolume={changeVolume}
        onToggleMute={toggleMute}
        micActive={source === 'mic'}
        demoActive={source === 'demo'}
        onToggleMic={() => void toggleMic()}
        onUpload={() => fileInputRef.current?.click()}
        recording={recording}
        onToggleRecord={toggleRecord}
      />

      {dragging ? <DropOverlay /> : null}
    </div>
  )
}
