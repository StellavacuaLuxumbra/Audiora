/**
 * Canvas 2D 可视化渲染器集合
 * - nebula  星云粒子
 * - halo    光环频谱
 * - wave    流光波纹
 * - tunnel  星际隧道
 */
import { rgba, samplePalette } from './palettes'
import type { RenderContext, VisualizerRenderer } from './types'

const TAU = Math.PI * 2

/** 用半透明底色覆盖, 形成拖影 */
function fade(rc: RenderContext, alpha: number) {
  const { ctx, width, height, palette } = rc
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = hexA(palette.bg, alpha)
  ctx.fillRect(0, 0, width, height)
}

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 径向渐变光晕 */
function glow(rc: RenderContext, x: number, y: number, radius: number, colorT: number, alpha: number) {
  const { ctx, palette } = rc
  const c = samplePalette(palette, colorT)
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
  g.addColorStop(0, rgba(c, alpha))
  g.addColorStop(0.45, rgba(c, alpha * 0.35))
  g.addColorStop(1, rgba(c, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

/* ------------------------------------------------------------------ */
/* 星云粒子                                                            */
/* ------------------------------------------------------------------ */

interface NebulaP {
  angle: number
  radius: number // 0~1 相对短边
  speed: number
  size: number // 基础像素(按 800px 基准)
  bin: number
  colorT: number
  twinkle: number
  rgbStr: string
}

interface BurstP {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  rgbStr: string
}

class NebulaRenderer implements VisualizerRenderer {
  private ps: NebulaP[] = []
  private bursts: BurstP[] = []
  private w = 0
  private h = 0

  init(w: number, h: number) {
    this.w = w
    this.h = h
    this.ps = []
    const N = 360
    for (let i = 0; i < N; i++) {
      const t = i / N
      this.ps.push({
        angle: Math.random() * TAU,
        radius: 0.1 + Math.pow(Math.random(), 0.7) * 0.5,
        speed: (0.25 + Math.random() * 0.8) * (Math.random() < 0.12 ? -1 : 1),
        size: 1.2 + Math.random() * 2.6,
        bin: 3 + Math.floor(Math.pow(Math.random(), 0.8) * 300),
        colorT: (t + Math.random() * 0.08) % 1,
        twinkle: 2 + Math.random() * 5,
        rgbStr: '',
      })
    }
    this.bursts = []
  }

  render(rc: RenderContext) {
    const { ctx, width: w, height: h, palette } = rc
    if (this.w !== w || this.h !== h) this.init(w, h)
    fade(rc, 0.3)
    const cx = w / 2
    const cy = h / 2
    const m = Math.min(w, h)
    const { spectrum, bass, mid, energy, beat, beatIntensity, time } = rc

    ctx.globalCompositeOperation = 'lighter'

    // 背景星云雾团
    for (let i = 0; i < 3; i++) {
      const a = time * (0.06 + i * 0.025) + i * 2.1
      const bx = cx + Math.cos(a) * m * 0.2
      const by = cy + Math.sin(a * 1.3) * m * 0.16
      glow(rc, bx, by, m * (0.3 + bass * 0.12), i / 3 + 0.1, 0.05 + energy * 0.07)
    }

    // 中心核心
    glow(rc, cx, cy, m * (0.1 + bass * 0.16), 0.08, 0.32 + bass * 0.4)

    // 环绕粒子
    for (const p of this.ps) {
      p.angle += rc.dt * p.speed * (0.3 + energy * 1.9) * (1 + beatIntensity * 0.9)
      const v = spectrum[p.bin] ?? 0
      const rr = p.radius * m * (1 + mid * 0.24 + Math.sin(time * 0.4 + p.twinkle) * 0.015)
      const x = cx + Math.cos(p.angle) * rr
      const y = cy + Math.sin(p.angle) * rr * 0.92
      const s = p.size * (m / 800) * (0.55 + v * 2.4)
      if (!p.rgbStr) {
        const c = samplePalette(palette, p.colorT)
        p.rgbStr = `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`
      }
      const alpha = clamp01(0.22 + v * 0.65 + Math.sin(time * p.twinkle) * 0.08)
      ctx.fillStyle = `rgba(${p.rgbStr},${alpha * 0.22})`
      ctx.beginPath()
      ctx.arc(x, y, s * 3, 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(${p.rgbStr},${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, s, 0, TAU)
      ctx.fill()
    }

    // 节拍爆发
    if (beat) {
      const c = samplePalette(palette, Math.random())
      const col = `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`
      const n = 26
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.5
        const sp = m * (0.28 + Math.random() * 0.5)
        this.bursts.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          rgbStr: col,
        })
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]
      b.x += b.vx * rc.dt
      b.y += b.vy * rc.dt
      b.vx *= 0.96
      b.vy *= 0.96
      b.life -= rc.dt * 1.25
      if (b.life <= 0) {
        this.bursts.splice(i, 1)
        continue
      }
      ctx.strokeStyle = `rgba(${b.rgbStr},${b.life * 0.85})`
      ctx.lineWidth = 1.6 * (m / 800) + b.life
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - b.vx * 0.05, b.y - b.vy * 0.05)
      ctx.stroke()
    }

    // 节拍闪光
    if (beatIntensity > 0.02) {
      glow(rc, cx, cy, m * 0.55, 0.5, beatIntensity * 0.12)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

/* ------------------------------------------------------------------ */
/* 光环频谱                                                            */
/* ------------------------------------------------------------------ */

class HaloRenderer implements VisualizerRenderer {
  private N = 144
  private smooth = new Float32Array(0)
  private pulses: { r: number; life: number; colorT: number }[] = []
  private rot = 0
  private w = 0
  private h = 0

  init(w: number, h: number) {
    this.w = w
    this.h = h
    this.smooth = new Float32Array(this.N)
    this.pulses = []
  }

  render(rc: RenderContext) {
    const { ctx, width: w, height: h, palette } = rc
    if (this.w !== w || this.h !== h) this.init(w, h)
    fade(rc, 0.34)
    const cx = w / 2
    const cy = h / 2
    const m = Math.min(w, h)
    const { spectrum, bass, energy, beat, beatIntensity, time, wave } = rc
    const N = this.N

    this.rot += rc.dt * (0.14 + energy * 0.6)
    const innerR = m * 0.17 * (1 + bass * 0.12)
    const maxLen = m * 0.3

    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'

    // 外圈频谱刺
    for (let i = 0; i < N; i++) {
      // 左右镜像映射频点
      const mi = i < N / 2 ? i : N - 1 - i
      const bin = 3 + Math.floor(Math.pow(mi / (N / 2), 1.4) * 320)
      const raw = spectrum[bin] ?? 0
      const s = this.smooth[i]
      this.smooth[i] = s + (raw - s) * (raw > s ? 0.55 : 0.14)
      const v = this.smooth[i]

      const ang = this.rot + (i / N) * TAU
      const len = maxLen * (0.05 + v * 1.05)
      const c = samplePalette(palette, (i / N + this.rot * 0.06) % 1)
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      ctx.strokeStyle = rgba(c, 0.3 + v * 0.7)
      ctx.lineWidth = m * 0.0075 * (0.65 + v * 0.9)
      ctx.beginPath()
      ctx.moveTo(cx + ca * innerR, cy + sa * innerR)
      ctx.lineTo(cx + ca * (innerR + len), cy + sa * (innerR + len))
      ctx.stroke()
      if (v > 0.55) {
        ctx.fillStyle = rgba(c, (v - 0.5) * 1.6)
        ctx.beginPath()
        ctx.arc(cx + ca * (innerR + len + m * 0.008), cy + sa * (innerR + len + m * 0.008), m * 0.0045 * v, 0, TAU)
        ctx.fill()
      }
    }

    // 中心核心
    glow(rc, cx, cy, innerR * 1.7, 0.15, 0.28 + bass * 0.45)
    ctx.strokeStyle = rgba(samplePalette(palette, 0.35), 0.5 + bass * 0.5)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, innerR * 1.22, 0, TAU)
    ctx.stroke()

    // 内圈实时波形环
    ctx.strokeStyle = rgba(samplePalette(palette, 0.8), 0.6)
    ctx.lineWidth = m * 0.0035
    ctx.beginPath()
    const M = 128
    for (let j = 0; j <= M; j++) {
      const idx = (j % M) * 16
      const wv = wave[idx] ?? 0
      const r = innerR * 0.8 * (1 + wv * 0.22)
      const a = (j / M) * TAU - this.rot * 0.5
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // 节拍冲击波
    if (beat) this.pulses.push({ r: innerR * 1.25, life: 1, colorT: Math.random() })
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]
      p.r += rc.dt * m * 0.6
      p.life -= rc.dt * 1.5
      if (p.life <= 0) {
        this.pulses.splice(i, 1)
        continue
      }
      ctx.strokeStyle = rgba(samplePalette(palette, p.colorT), p.life * 0.35 + beatIntensity * 0.15)
      ctx.lineWidth = 1.5 + p.life * 3
      ctx.beginPath()
      ctx.arc(cx, cy, p.r, 0, TAU)
      ctx.stroke()
    }

    // 呼吸提示文字 (仅待机时)
    ctx.globalCompositeOperation = 'source-over'
    if (!rc.active) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(time * 2) * 0.1})`
      ctx.font = `${Math.max(12, m * 0.024)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('等待音频输入…', cx, cy + innerR * 2.9)
    }
  }
}

/* ------------------------------------------------------------------ */
/* 流光波纹                                                            */
/* ------------------------------------------------------------------ */

class WaveRenderer implements VisualizerRenderer {
  private COLS = 480
  private history: Float32Array[] = []
  private acc = 0
  private w = 0
  private h = 0

  init(w: number, h: number) {
    this.w = w
    this.h = h
    this.history = []
    this.acc = 0
  }

  render(rc: RenderContext) {
    const { ctx, width: w, height: h, palette } = rc
    if (this.w !== w || this.h !== h) this.init(w, h)
    fade(rc, 0.38)
    const { wave, bass, energy, beatIntensity, time, spectrum } = rc
    const COLS = this.COLS

    // 每两帧快照一次波形 → 丝绸拖尾
    this.acc += rc.dt
    if (this.acc > 1 / 30) {
      this.acc = 0
      const snap = new Float32Array(COLS)
      for (let i = 0; i < COLS; i++) {
        const wi = Math.floor((i / COLS) * wave.length)
        const sv = spectrum[8 + Math.floor(Math.pow(i / COLS, 1.3) * 260)] ?? 0
        snap[i] = (wave[wi] ?? 0) * (0.6 + energy * 0.8) + (sv - 0.25) * 0.35
      }
      this.history.unshift(snap)
      if (this.history.length > 6) this.history.pop()
    }

    const cy = h * 0.5
    const amp = h * 0.2 * (1 + bass * 0.7 + beatIntensity * 0.3)

    ctx.globalCompositeOperation = 'lighter'

    // 历史丝绸层 (旧 → 新)
    for (let k = this.history.length - 1; k >= 1; k--) {
      const snap = this.history[k]
      const t = 1 - k / this.history.length
      ctx.strokeStyle = rgba(samplePalette(palette, 0.15 + t * 0.4), 0.05 + t * 0.14)
      ctx.lineWidth = 1 + t * 1.4
      ctx.beginPath()
      const off = Math.sin(time * 0.7 + k * 1.1) * h * 0.015 * k
      for (let i = 0; i < COLS; i++) {
        const x = (i / (COLS - 1)) * w
        const y = cy + off + snap[i] * amp * (1 + k * 0.06)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // 主波形
    const main = this.history[0]
    if (main) {
      const grad = ctx.createLinearGradient(0, 0, w, 0)
      const stops = [0, 0.33, 0.66, 1]
      stops.forEach((s, i) => {
        grad.addColorStop(s, rgba(samplePalette(palette, s), 0.95))
      })
      ctx.strokeStyle = grad
      ctx.lineWidth = 2.4
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < COLS; i++) {
        const x = (i / (COLS - 1)) * w
        const y = cy + main[i] * amp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // 波形下方能量填充
      const fill = ctx.createLinearGradient(0, cy - amp, 0, h * 0.85)
      fill.addColorStop(0, rgba(samplePalette(palette, 0.2), 0.16))
      fill.addColorStop(1, rgba(samplePalette(palette, 0.6), 0))
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.moveTo(0, cy + main[0] * amp)
      for (let i = 1; i < COLS; i++) ctx.lineTo((i / (COLS - 1)) * w, cy + main[i] * amp)
      ctx.lineTo(w, h * 0.9)
      ctx.lineTo(0, h * 0.9)
      ctx.closePath()
      ctx.fill()

      // 倒影
      ctx.strokeStyle = rgba(samplePalette(palette, 0.45), 0.14)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i < COLS; i++) {
        const x = (i / (COLS - 1)) * w
        const y = cy + h * 0.16 - main[i] * amp * 0.45
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // 高频火花: 沿顶部散布的闪烁点
    const sparks = 22
    for (let i = 0; i < sparks; i++) {
      const bin = 200 + Math.floor(Math.pow(Math.random(), 1.6) * 300)
      const v = spectrum[bin] ?? 0
      if (v > 0.4) {
        const x = Math.random() * w
        const y = h * 0.12 + Math.random() * h * 0.2
        const c = samplePalette(palette, Math.random())
        ctx.fillStyle = rgba(c, (v - 0.35) * 0.9)
        const s = 1 + v * 2.4
        ctx.fillRect(x, y, s, s)
      }
    }

    ctx.globalCompositeOperation = 'source-over'
  }
}

/* ------------------------------------------------------------------ */
/* 星际隧道                                                            */
/* ------------------------------------------------------------------ */

interface Ring {
  z: number
  rot: number
  hue: number
  spd: number
}
interface Star {
  x: number
  y: number
  z: number
}

class TunnelRenderer implements VisualizerRenderer {
  private rings: Ring[] = []
  private stars: Star[] = []
  private w = 0
  private h = 0

  init(w: number, h: number) {
    this.w = w
    this.h = h
    this.rings = []
    for (let i = 0; i < 22; i++) {
      this.rings.push({
        z: 0.12 + (i / 22) * 2.9,
        rot: Math.random() * TAU,
        hue: Math.random(),
        spd: 0.85 + Math.random() * 0.3,
      })
    }
    this.stars = []
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 1.6,
        y: (Math.random() - 0.5) * 1.6,
        z: 0.1 + Math.random() * 2.8,
      })
    }
  }

  render(rc: RenderContext) {
    const { ctx, width: w, height: h, palette } = rc
    if (this.w !== w || this.h !== h) this.init(w, h)
    fade(rc, 0.45)
    const m = Math.min(w, h)
    const { spectrum, bass, energy, beat, beatIntensity, wave, time } = rc

    // 摄像机漂移 + 节拍震动
    const ox = (wave[64] ?? 0) * m * 0.03 + Math.sin(time * 47) * beatIntensity * m * 0.006
    const oy = (wave[960] ?? 0) * m * 0.03 + Math.cos(time * 41) * beatIntensity * m * 0.006
    const cx = w / 2 + ox
    const cy = h / 2 + oy

    const speed = rc.dt * (0.28 + energy * 1.6 + beatIntensity * 1.4)

    ctx.globalCompositeOperation = 'lighter'

    // 透视圆环
    const SEG = 52
    for (const ring of this.rings) {
      ring.z -= speed * ring.spd
      ring.rot += rc.dt * 0.4 * (0.4 + energy)
      if (ring.z < 0.09) {
        ring.z += 2.9
        ring.rot = Math.random() * TAU
        ring.hue = Math.random()
      }
      const scale = 0.42 / ring.z
      const baseR = m * 0.5 * scale * (0.55 + bass * 0.35)
      if (baseR > m * 1.6) continue
      const alpha = clamp01((3 - ring.z) / 3) * 0.8
      const c = samplePalette(palette, ring.hue)
      ctx.strokeStyle = rgba(c, alpha)
      ctx.lineWidth = Math.min(5, Math.max(0.6, scale * m * 0.008))
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let s = 0; s <= SEG; s++) {
        const seg = s % SEG
        const bin = 4 + Math.floor((seg / SEG) * 240)
        const v = spectrum[bin] ?? 0
        const r = baseR * (1 + v * 0.42 * clamp01(2.4 - ring.z))
        const a = ring.rot + (seg / SEG) * TAU
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r * 0.94
        if (s === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    // 超空间星流
    ctx.lineCap = 'round'
    for (const st of this.stars) {
      st.z -= speed * 1.6
      if (st.z < 0.08) {
        st.z += 2.8
        st.x = (Math.random() - 0.5) * 1.6
        st.y = (Math.random() - 0.5) * 1.6
      }
      const k = 0.42 / st.z
      const px = cx + st.x * k * m
      const py = cy + st.y * k * m * 0.94
      if (px < -40 || px > w + 40 || py < -40 || py > h + 40) continue
      const k2 = 0.42 / (st.z + speed * 2.2)
      const qx = cx + st.x * k2 * m
      const qy = cy + st.y * k2 * m * 0.94
      const alpha = clamp01((2.8 - st.z) / 2.8) * 0.7
      ctx.strokeStyle = rgba(samplePalette(palette, 0.5 + st.x * 0.4), alpha)
      ctx.lineWidth = Math.max(0.5, k * m * 0.004)
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(qx, qy)
      ctx.stroke()
    }

    // 隧道尽头光源
    glow(rc, cx, cy, m * (0.08 + bass * 0.1), 0.6, 0.3 + bass * 0.4 + beatIntensity * 0.2)

    if (beat) {
      glow(rc, cx, cy, m * 0.4, Math.random(), beatIntensity * 0.18)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

/* ------------------------------------------------------------------ */

export function createRenderer(mode: 'nebula' | 'halo' | 'wave' | 'tunnel'): VisualizerRenderer {
  switch (mode) {
    case 'halo':
      return new HaloRenderer()
    case 'wave':
      return new WaveRenderer()
    case 'tunnel':
      return new TunnelRenderer()
    default:
      return new NebulaRenderer()
  }
}
