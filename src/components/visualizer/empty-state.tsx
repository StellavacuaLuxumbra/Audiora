'use client'

import { Music4, Play, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onPick: () => void
  onDemo: () => void
}

export function EmptyState({ onPick, onDemo }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-7 px-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-3xl bg-fuchsia-500/20 [animation-duration:2.2s]" />
        <div
          className="absolute -inset-6 rounded-full opacity-60 blur-2xl"
          style={{ background: 'radial-gradient(circle,rgba(217,70,239,.35),transparent 70%)' }}
        />
        <div className="relative grid size-20 place-items-center rounded-3xl border border-white/20 bg-gradient-to-br from-fuchsia-500/90 via-rose-500/80 to-amber-400/90 shadow-2xl shadow-fuchsia-500/40">
          <Music4 className="size-9 text-white" />
        </div>
      </div>

      <div>
        <h1 className="bg-gradient-to-r from-amber-200 via-rose-300 to-fuchsia-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          声之形
        </h1>
        <p className="mt-3 text-sm text-white/55 sm:text-base">
          导入一首音乐，开启沉浸式音频可视化之旅
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          onClick={onPick}
          className="h-12 gap-2 rounded-full bg-white px-7 text-zinc-900 shadow-xl shadow-fuchsia-500/20 hover:bg-white/90"
        >
          <Upload className="size-4" />
          选择音频文件
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onDemo}
          className="h-12 gap-2 rounded-full border-white/20 bg-white/5 px-7 text-white/85 backdrop-blur hover:bg-white/10 hover:text-white"
        >
          <Play className="size-4 fill-current" />
          演示模式
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-white/35">
        支持 MP3 / WAV / OGG / FLAC / M4A · 可拖拽文件到页面任意位置
        <br />
        空格键播放暂停 · ← → 快进快退 · F 全屏沉浸
      </p>
    </div>
  )
}

export function DropOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-3 rounded-3xl border-2 border-dashed border-fuchsia-400/70" />
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-2xl shadow-fuchsia-500/50">
          <Upload className="size-9 text-white" />
        </div>
        <p className="text-xl font-medium text-white">松开以导入音频</p>
      </div>
    </div>
  )
}
