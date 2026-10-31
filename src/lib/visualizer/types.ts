import type { Palette } from './palettes'

export type ModeId = 'nebula' | 'halo' | 'wave' | 'tunnel'
export type SourceKind = 'none' | 'file' | 'demo' | 'mic'

/** 音频引擎每帧输出的分析数据 */
export interface AudioFrame {
  /** 频谱 (1024 bins, 已做频率加权与平滑, 0~1) */
  spectrum: Float32Array
  /** 时域波形 (2048 samples, -1~1) */
  wave: Float32Array
  bass: number
  mid: number
  treble: number
  /** 综合能量 0~1 */
  energy: number
  /** 本帧是否检测到节拍 */
  beat: boolean
  /** 节拍冲击强度 (触发后指数衰减, 0~1) */
  beatIntensity: number
  /** 是否有真实音频输入 (false = 待机的呼吸动画) */
  active: boolean
}

/** 渲染器每帧接收的上下文 */
export interface RenderContext extends AudioFrame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  /** 秒 */
  time: number
  /** 秒 */
  dt: number
  palette: Palette
}

export interface VisualizerRenderer {
  /** 尺寸变化时重新初始化内部状态 */
  init(width: number, height: number): void
  render(rc: RenderContext): void
}
