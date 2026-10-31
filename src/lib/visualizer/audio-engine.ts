/**
 * 音频引擎: 文件播放 / 麦克风 / 内置演示合成器 的统一频谱分析
 * 所有源并联 tap 到同一个 AnalyserNode; 音量通过 volGain 控制
 */
import type { AudioFrame, SourceKind } from './types'

const FFT_SIZE = 2048
const BINS = FFT_SIZE / 2

/** BPM 112 的 16 分音符时长 */
const SPB = 60 / 112 / 4

function midi2f(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

/* ------------------------------------------------------------------ */
/* 演示合成器 (Synthwave 风格生成音乐)                                  */
/* ------------------------------------------------------------------ */

export class DemoSynth {
  running = false
  private master: GainNode
  private delaySend: GainNode
  private noise: AudioBuffer
  private timer: ReturnType<typeof setInterval> | null = null
  private step = 0
  private nextT = 0

  constructor(private actx: AudioContext, taps: AudioNode[]) {
    this.master = actx.createGain()
    this.master.gain.value = 0
    // 回声总线
    const delay = actx.createDelay(1)
    delay.delayTime.value = SPB * 3
    const fb = actx.createGain()
    fb.gain.value = 0.32
    const wet = actx.createGain()
    wet.gain.value = 0.5
    this.delaySend = actx.createGain()
    this.delaySend.gain.value = 1
    this.delaySend.connect(delay)
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(this.master)
    // 输出: tap 分析器 + 主音量
    for (const t of taps) this.master.connect(t)
    // 白噪声 buffer
    const len = actx.sampleRate
    this.noise = actx.createBuffer(1, len, actx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }

  start() {
    if (this.running) return
    this.running = true
    this.step = 0
    this.nextT = this.actx.currentTime + 0.08
    this.master.gain.cancelScheduledValues(this.actx.currentTime)
    this.master.gain.setTargetAtTime(0.8, this.actx.currentTime, 0.1)
    this.timer = setInterval(() => this.tick(), 40)
  }

  stop() {
    if (!this.running) return
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.master.gain.setTargetAtTime(0.0001, this.actx.currentTime, 0.08)
  }

  private tick() {
    while (this.nextT < this.actx.currentTime + 0.18) {
      this.schedule(this.step, this.nextT)
      this.nextT += SPB
      this.step++
    }
  }

  /** 和弦进行 Am - F - C - G */
  private schedule(s: number, t: number) {
    const bar = Math.floor(s / 16) % 4
    const i = s % 16
    const roots = [33, 29, 36, 31]
    const chords = [
      [57, 60, 64, 69],
      [53, 57, 60, 65],
      [60, 64, 67, 72],
      [55, 59, 62, 67],
    ]
    // 鼓组
    if (i % 4 === 0) this.kick(t)
    if (i === 4 || i === 12) this.clap(t)
    if (i % 2 === 1) this.hat(t, i % 4 === 3 ? 0.16 : 0.08)
    // 贝斯 (8分音符)
    if (i % 2 === 0) {
      const patt = [0, 0, 12, 0, 7, 0, 12, 7]
      this.bass(midi2f(roots[bar] + patt[i / 2]), t)
    }
    // 琶音 (16分音符)
    const arp = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
    const tones = chords[bar]
    const note = tones[arp[i] % tones.length] + 12 + (i % 8 >= 4 ? 12 : 0)
    this.arp(midi2f(note), t)
    // 长音铺底 (每小节)
    if (i === 0) this.pad([tones[0] + 12, tones[2] + 12], t)
  }

  private kick(t: number) {
    const o = this.actx.createOscillator()
    const g = this.actx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12)
    g.gain.setValueAtTime(0.95, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + 0.32)
  }

  private clap(t: number) {
    const src = this.actx.createBufferSource()
    src.buffer = this.noise
    const bp = this.actx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1600
    bp.Q.value = 0.9
    const g = this.actx.createGain()
    g.gain.setValueAtTime(0.4, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start(t, Math.random() * 0.4, 0.2)
  }

  private hat(t: number, vol: number) {
    const src = this.actx.createBufferSource()
    src.buffer = this.noise
    const hp = this.actx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7800
    const g = this.actx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
    src.connect(hp)
    hp.connect(g)
    g.connect(this.master)
    src.start(t, Math.random() * 0.4, 0.06)
  }

  private bass(f: number, t: number) {
    const o = this.actx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = this.actx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(700, t)
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.2)
    const g = this.actx.createGain()
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    o.connect(lp)
    lp.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + 0.26)
  }

  private arp(f: number, t: number) {
    const o = this.actx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = this.actx.createGain()
    g.gain.setValueAtTime(0.11, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17)
    o.connect(g)
    g.connect(this.master)
    g.connect(this.delaySend)
    o.start(t)
    o.stop(t + 0.2)
  }

  private pad(midis: number[], t: number) {
    const dur = SPB * 16
    const lp = this.actx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(600, t)
    lp.frequency.linearRampToValueAtTime(1400, t + dur * 0.6)
    lp.frequency.linearRampToValueAtTime(500, t + dur)
    const g = this.actx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.5)
    g.gain.setValueAtTime(0.05, t + dur - 0.4)
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6)
    lp.connect(g)
    g.connect(this.master)
    for (const m of midis) {
      for (const det of [-5, 5]) {
        const o = this.actx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midi2f(m)
        o.detune.value = det
        o.connect(lp)
        o.start(t)
        o.stop(t + dur + 0.8)
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 音频引擎                                                            */
/* ------------------------------------------------------------------ */

export class AudioEngine {
  readonly audioEl: HTMLAudioElement
  mode: SourceKind = 'none'

  private actx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private volGain: GainNode | null = null
  private elSource: MediaElementAudioSourceNode | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private demo: DemoSynth | null = null

  private freqRaw = new Uint8Array(BINS)
  private waveRaw = new Uint8Array(FFT_SIZE)
  private spectrum = new Float32Array(BINS)
  private waveNorm = new Float32Array(FFT_SIZE)
  private beatHist = new Float32Array(48)
  private beatIdx = 0
  private lastBeat = 0
  private beatIntensity = 0
  private frame: AudioFrame = {
    spectrum: this.spectrum,
    wave: this.waveNorm,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    beat: false,
    beatIntensity: 0,
    active: false,
  }

  private volume = 0.85

  constructor() {
    this.audioEl = new Audio()
    this.audioEl.preload = 'auto'
    this.audioEl.crossOrigin = 'anonymous'
  }

  /** 惰性创建 AudioContext (需要在用户手势中调用) */
  private ensureGraph() {
    if (typeof window === 'undefined') return
    if (!this.actx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.actx = new AC()
      this.analyser = this.actx.createAnalyser()
      this.analyser.fftSize = FFT_SIZE
      this.analyser.smoothingTimeConstant = 0.78
      this.volGain = this.actx.createGain()
      this.volGain.gain.value = this.volume
      this.volGain.connect(this.actx.destination)
    }
    if (this.actx.state === 'suspended') void this.actx.resume()
    if (!this.elSource) {
      this.elSource = this.actx.createMediaElementSource(this.audioEl)
      // tap 分析器 + 输出扬声器
      if (this.analyser) this.elSource.connect(this.analyser)
      if (this.volGain) this.elSource.connect(this.volGain)
    }
  }

  get active(): boolean {
    if (this.mode === 'file') return !this.audioEl.paused
    if (this.mode === 'demo') return this.demo?.running ?? false
    if (this.mode === 'mic') return true
    return false
  }

  /* ---------- 文件播放 ---------- */

  async playFile(url: string) {
    this.stopMic()
    this.stopDemo()
    this.ensureGraph()
    if (this.audioEl.src !== url) {
      this.audioEl.src = url
      this.audioEl.load()
    }
    await this.audioEl.play()
    this.mode = 'file'
  }

  pause() {
    if (this.mode === 'file') this.audioEl.pause()
  }

  async resumeOrPlay(url?: string) {
    if (this.mode === 'file' && this.audioEl.src) {
      await this.audioEl.play()
      return
    }
    if (url) await this.playFile(url)
  }

  seek(t: number) {
    if (isFinite(this.audioEl.duration)) {
      this.audioEl.currentTime = Math.max(0, Math.min(t, this.audioEl.duration))
    }
  }

  setVolume(v: number) {
    this.volume = v
    if (this.volGain) this.volGain.gain.value = v
    this.audioEl.volume = 1
  }

  /* ---------- 麦克风 ---------- */

  async startMic(): Promise<boolean> {
    try {
      this.stopDemo()
      this.audioEl.pause()
      this.ensureGraph()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      this.micStream = stream
      this.micSource = this.actx!.createMediaStreamSource(stream)
      // 只进分析器, 不进扬声器 (避免啸叫)
      if (this.analyser) this.micSource.connect(this.analyser)
      this.mode = 'mic'
      return true
    } catch {
      return false
    }
  }

  stopMic() {
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((tr) => tr.stop())
      this.micStream = null
    }
    if (this.mode === 'mic') this.mode = 'none'
  }

  /* ---------- 演示合成器 ---------- */

  startDemo() {
    this.stopMic()
    this.audioEl.pause()
    this.ensureGraph()
    if (!this.demo) {
      const taps: AudioNode[] = []
      if (this.analyser) taps.push(this.analyser)
      if (this.volGain) taps.push(this.volGain)
      this.demo = new DemoSynth(this.actx!, taps)
    }
    this.demo.start()
    this.mode = 'demo'
  }

  stopDemo() {
    if (this.demo) {
      this.demo.stop()
      this.demo = null
    }
    if (this.mode === 'demo') this.mode = 'none'
  }

  /* ---------- 每帧分析 ---------- */

  update(t: number, dt: number): AudioFrame {
    const f = this.frame
    const isActive = this.active
    f.active = isActive

    if (isActive && this.analyser) {
      this.analyser.getByteFrequencyData(this.freqRaw)
      this.analyser.getByteTimeDomainData(this.waveRaw)
      for (let i = 0; i < BINS; i++) {
        const x = i / BINS
        const boost = 0.85 + 2.1 * Math.pow(x, 1.35)
        const target = clamp01((this.freqRaw[i] / 255) * boost * 1.18)
        this.spectrum[i] += (target - this.spectrum[i]) * 0.5
      }
      for (let i = 0; i < FFT_SIZE; i++) {
        this.waveNorm[i] = (this.waveRaw[i] - 128) / 128
      }
    } else {
      // 待机呼吸动画: 合成柔和伪频谱
      for (let i = 0; i < BINS; i++) {
        const x = i / BINS
        const tilt = Math.exp(-x * 4.2)
        const a = Math.sin(t * 0.9 + x * 26) * 0.5 + 0.5
        const b = Math.sin(t * 0.63 + x * 9 + 2.1) * 0.5 + 0.5
        const c = Math.sin(t * 1.7 + x * 47 + 0.5) * 0.5 + 0.5
        const target = (a * 0.5 + b * 0.35 + c * 0.15) * tilt * 0.5 + 0.02
        this.spectrum[i] += (target - this.spectrum[i]) * 0.12
      }
      for (let i = 0; i < FFT_SIZE; i++) {
        const ph = (i / FFT_SIZE) * TAU
        this.waveNorm[i] =
          0.3 * Math.sin(ph * 3 + t * 2.1) * (0.6 + 0.4 * Math.sin(t * 0.8)) +
          0.16 * Math.sin(ph * 7 - t * 1.3)
      }
    }

    // 频段能量
    let bass = 0
    for (let i = 1; i <= 23; i++) bass += this.spectrum[i]
    bass /= 23
    let mid = 0
    for (let i = 24; i <= 185; i++) mid += this.spectrum[i]
    mid /= 162
    let treble = 0
    for (let i = 186; i <= 682; i++) treble += this.spectrum[i]
    treble /= 497

    // 节拍检测 (低频能量 vs 滑动均值)
    const hist = this.beatHist
    let avg = 0
    for (let i = 0; i < hist.length; i++) avg += hist[i]
    avg /= hist.length
    let beat = false
    if (isActive && bass > 0.3 && bass > avg * 1.32 && t - this.lastBeat > 0.28) {
      beat = true
      this.lastBeat = t
      this.beatIntensity = 1
    }
    hist[this.beatIdx] = bass
    this.beatIdx = (this.beatIdx + 1) % hist.length
    this.beatIntensity *= Math.exp(-dt * 5)

    f.bass = bass
    f.mid = mid
    f.treble = treble
    f.energy = clamp01(bass * 0.45 + mid * 0.35 + treble * 0.2) * (isActive ? 1 : 0.45)
    f.beat = beat
    f.beatIntensity = this.beatIntensity
    return f
  }

  dispose() {
    this.stopMic()
    this.stopDemo()
    this.audioEl.pause()
    this.audioEl.src = ''
    void this.actx?.close()
  }
}

const TAU = Math.PI * 2

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
