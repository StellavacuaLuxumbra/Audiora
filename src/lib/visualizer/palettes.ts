/**
 * 可视化调色板与颜色工具
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface Palette {
  id: string
  name: string
  /** 环形渐变色标 */
  stops: RGB[]
  /** 画布底色 */
  bg: string
  /** UI 强调色 (tailwind 类名用) */
  accent: string
  /** 色点预览 */
  swatch: string
}

const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b })

export const PALETTES: Palette[] = [
  {
    id: 'aurora',
    name: '极光',
    stops: [rgb(52, 211, 153), rgb(45, 212, 191), rgb(167, 139, 250), rgb(236, 72, 153)],
    bg: '#04040c',
    accent: 'text-emerald-300',
    swatch: 'linear-gradient(135deg,#34d399,#a78bfa,#ec4899)',
  },
  {
    id: 'sunset',
    name: '霞光',
    stops: [rgb(251, 146, 60), rgb(244, 63, 94), rgb(232, 121, 249), rgb(168, 85, 247)],
    bg: '#0a0410',
    accent: 'text-amber-300',
    swatch: 'linear-gradient(135deg,#fb923c,#f43f5e,#c084fc)',
  },
  {
    id: 'lava',
    name: '熔岩',
    stops: [rgb(250, 204, 21), rgb(249, 115, 22), rgb(239, 68, 68), rgb(190, 18, 60)],
    bg: '#0b0404',
    accent: 'text-orange-300',
    swatch: 'linear-gradient(135deg,#facc15,#f97316,#be123c)',
  },
  {
    id: 'neon',
    name: '霓虹',
    stops: [rgb(244, 114, 182), rgb(192, 132, 252), rgb(74, 222, 128), rgb(250, 204, 21)],
    bg: '#070310',
    accent: 'text-fuchsia-300',
    swatch: 'linear-gradient(135deg,#f472b6,#4ade80,#facc15)',
  },
]

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/** 两个颜色插值 */
export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

/**
 * 在调色板环形色标上取样
 * @param t 0~1 (会自动循环)
 */
export function samplePalette(p: Palette, t: number): RGB {
  const stops = p.stops
  const n = stops.length
  let u = t % 1
  if (u < 0) u += 1
  const x = u * n
  const i = Math.floor(x) % n
  const f = x - Math.floor(x)
  return mixRGB(stops[i], stops[(i + 1) % n], f)
}

export function rgba(c: RGB, a: number): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`
}
