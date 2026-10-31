'use client'

import {
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface PlayerBarProps {
  trackLabel: string
  statusLabel: string
  isPlaying: boolean
  onTogglePlay: () => void
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  trackIndex: number
  trackCount: number
  currentTime: number
  duration: number
  canSeek: boolean
  onSeek: (t: number) => void
  volume: number
  muted: boolean
  onVolume: (v: number) => void
  onToggleMute: () => void
  micActive: boolean
  demoActive: boolean
  onToggleMic: () => void
  onUpload: () => void
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  active,
  className,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'size-9 shrink-0 rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30',
        active && 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200',
        className
      )}
    >
      {children}
    </Button>
  )
}

export function PlayerBar(props: PlayerBarProps) {
  const {
    trackLabel,
    statusLabel,
    isPlaying,
    onTogglePlay,
    canPrev,
    canNext,
    onPrev,
    onNext,
    trackIndex,
    trackCount,
    currentTime,
    duration,
    canSeek,
    onSeek,
    volume,
    muted,
    onVolume,
    onToggleMute,
    micActive,
    demoActive,
    onToggleMic,
    onUpload,
  } = props

  return (
    <footer className="relative z-20 mt-auto px-3 pb-3 sm:px-4 sm:pb-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-black/45 p-3 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          {/* 曲目信息 */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 shadow-lg shadow-fuchsia-500/30',
                isPlaying && 'animate-spin [animation-duration:3.5s]'
              )}
            >
              <div className="grid size-4 place-items-center rounded-full bg-black/70">
                <div className="size-1 rounded-full bg-white/80" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white/95" title={trackLabel}>
                {trackLabel}
              </div>
              <div className="flex items-center gap-1.5 truncate text-xs text-white/50">
                {micActive && <span className="size-1.5 animate-pulse rounded-full bg-rose-400" />}
                {demoActive && <Radio className="size-3 text-emerald-300" />}
                <span className="truncate">{statusLabel}</span>
                {trackCount > 1 && (
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[10px] tabular-nums">
                    {trackIndex + 1}/{trackCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 播放控制 + 进度 */}
          <div className="flex flex-col gap-1.5 lg:flex-[2]">
            <div className="flex items-center justify-center gap-1.5">
              <IconButton label="上一曲" onClick={onPrev} disabled={!canPrev}>
                <SkipBack className="size-4 fill-current" />
              </IconButton>
              <button
                onClick={onTogglePlay}
                aria-label={isPlaying ? '暂停' : '播放'}
                title={isPlaying ? '暂停' : '播放'}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-zinc-900 shadow-lg transition-all duration-200 hover:scale-105 hover:bg-white/90 active:scale-95"
              >
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
              </button>
              <IconButton label="下一曲" onClick={onNext} disabled={!canNext}>
                <SkipForward className="size-4 fill-current" />
              </IconButton>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-white/45">
                {formatTime(currentTime)}
              </span>
              <Slider
                aria-label="播放进度"
                className="flex-1 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-fuchsia-400 [&_[data-slot=slider-range]]:via-rose-400 [&_[data-slot=slider-range]]:to-amber-300 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white/70 [&_[data-slot=slider-thumb]]:bg-white"
                disabled={!canSeek}
                value={[canSeek ? (currentTime / Math.max(duration, 0.01)) * 100 : 0]}
                max={100}
                step={0.1}
                onValueChange={(v) => canSeek && onSeek((v[0] / 100) * duration)}
              />
              <span className="w-9 shrink-0 text-[11px] tabular-nums text-white/45">
                {canSeek ? formatTime(duration) : '∞'}
              </span>
            </div>
          </div>

          {/* 音量 + 输入源 */}
          <div className="flex flex-1 items-center justify-end gap-1">
            <div className="hidden items-center gap-2 sm:flex">
              <IconButton label={muted ? '取消静音' : '静音'} onClick={onToggleMute}>
                {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </IconButton>
              <Slider
                aria-label="音量"
                className="w-20 [&_[data-slot=slider-range]]:bg-white/80 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white/70 [&_[data-slot=slider-thumb]]:bg-white"
                value={[muted ? 0 : Math.round(volume * 100)]}
                max={100}
                onValueChange={(v) => onVolume(v[0] / 100)}
              />
            </div>
            <IconButton
              label={micActive ? '关闭麦克风' : '麦克风可视化'}
              onClick={onToggleMic}
              active={micActive}
            >
              {micActive ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </IconButton>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUpload}
              aria-label="导入音频文件"
              className="gap-1.5 rounded-full px-2.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">导入</span>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
