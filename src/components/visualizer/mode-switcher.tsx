'use client'

import { Orbit, Rocket, Sparkles, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModeId } from '@/lib/visualizer/types'

export const VISUAL_MODES: { id: ModeId; name: string; icon: typeof Sparkles }[] = [
  { id: 'nebula', name: '星云粒子', icon: Sparkles },
  { id: 'halo', name: '光环频谱', icon: Orbit },
  { id: 'wave', name: '流光波纹', icon: Waves },
  { id: 'tunnel', name: '星际隧道', icon: Rocket },
]

interface ModeSwitcherProps {
  mode: ModeId
  onChange: (m: ModeId) => void
}

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="可视化模式"
      className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-xl"
    >
      {VISUAL_MODES.map((m) => {
        const Icon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            title={m.name}
            onClick={() => onChange(m.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-all duration-300 sm:px-3.5',
              active
                ? 'bg-white/90 font-medium text-zinc-900 shadow-lg'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden md:inline">{m.name}</span>
          </button>
        )
      })}
    </div>
  )
}

interface PalettePickerProps {
  value: string
  onChange: (id: string) => void
  palettes: { id: string; name: string; swatch: string }[]
}

export function PalettePicker({ value, onChange, palettes }: PalettePickerProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 backdrop-blur-xl"
      role="radiogroup"
      aria-label="配色主题"
    >
      {palettes.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={value === p.id}
          title={p.name}
          onClick={() => onChange(p.id)}
          className={cn(
            'size-4 rounded-full transition-all duration-300',
            value === p.id
              ? 'scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-black/60'
              : 'opacity-55 hover:scale-110 hover:opacity-90'
          )}
          style={{ background: p.swatch }}
        />
      ))}
    </div>
  )
}
