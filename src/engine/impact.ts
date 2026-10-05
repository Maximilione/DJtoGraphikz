/**
 * Impact layer: global audio reactivity applied to the whole frame, after the
 * scene and before the post chain. Pure maths (no THREE, no DOM) so the same
 * code runs in both windows and can be tested offline.
 *
 *   bass  -> camera shake + elastic punch-zoom
 *   mid   -> slow wobble distortion
 *   high  -> chromatic split + sparkle, soft flash on hits and on the drop
 *   phase -> a slow "energy chaser" scales everything (break quiet, peak hot)
 */
export interface ImpactState {
  on: boolean
  /** master amount, 0..1 */
  intensity: number
  shake: number
  punch: number
  flash: number
  /** mid-band distortion */
  warp: number
  /** high-band chromatic / sparkle */
  spark: number
  /** let the Auto VJ phase modulate the overall amount */
  follow: boolean
}

export const IMPACT_DEFAULT: ImpactState = {
  on: true, intensity: 0.5, shake: 0.5, punch: 0.5, flash: 0.4, warp: 0.4, spark: 0.5, follow: true,
}

export type ImpactPhase = 'break' | 'build' | 'groove' | 'peak'

/** hard ceilings, whatever the sliders say */
export const IMPACT_LIMITS = {
  shake: 0.03,    // fraction of the screen width
  zoom: 0.12,     // punch-zoom, +/- fraction
  flash: 0.2,     // fraction lifted towards white: never a full white frame
  warp: 0.02,
  chroma: 0.008,
  gain: 1.3,
}

const PHASE_GAIN: Record<ImpactPhase, number> = { break: 0.5, build: 0.85, groove: 1, peak: 1.25 }

export interface ImpactRuntime {
  t: number
  shakeEnv: number
  punchPos: number
  punchVel: number
  flashEnv: number
  gain: number
  prevPhase: ImpactPhase
  prevHigh: number
}

export interface ImpactInput {
  dt: number
  /** a kick landed this frame */
  beat: boolean
  /** 0..1 */
  mid: number
  high: number
  highHit: number
  phase: ImpactPhase
}

export interface ImpactOut {
  shakeX: number
  shakeY: number
  zoom: number
  flash: number
  warp: number
  chroma: number
  sparkle: number
}

export const IMPACT_NEUTRAL: ImpactOut = { shakeX: 0, shakeY: 0, zoom: 1, flash: 0, warp: 0, chroma: 0, sparkle: 0 }

export function newImpactRuntime(): ImpactRuntime {
  return { t: 0, shakeEnv: 0, punchPos: 0, punchVel: 0, flashEnv: 0, gain: 1, prevPhase: 'groove', prevHigh: 0 }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function sanitizeImpact(s: Partial<ImpactState> | undefined): ImpactState {
  const o = { ...IMPACT_DEFAULT, ...(s || {}) }
  const n = (v: number, d: number) => (Number.isFinite(v) ? clamp(v, 0, 1) : d)
  return {
    on: !!o.on, follow: !!o.follow,
    intensity: n(o.intensity, IMPACT_DEFAULT.intensity), shake: n(o.shake, IMPACT_DEFAULT.shake),
    punch: n(o.punch, IMPACT_DEFAULT.punch), flash: n(o.flash, IMPACT_DEFAULT.flash),
    warp: n(o.warp, IMPACT_DEFAULT.warp), spark: n(o.spark, IMPACT_DEFAULT.spark),
  }
}

/** Is there anything to draw? Lets the caller skip the pass in a silent room. */
export function impactActive(o: ImpactOut): boolean {
  return o.shakeX !== 0 || o.shakeY !== 0 || Math.abs(o.zoom - 1) > 1e-4
    || o.flash > 1e-4 || o.warp > 1e-5 || o.chroma > 1e-5 || o.sparkle > 1e-4
}

export function stepImpact(rt: ImpactRuntime, st: ImpactState, inp: ImpactInput): ImpactOut {
  const dt = clamp(inp.dt, 0, 0.1)
  rt.t += dt
  if (!st.on || st.intensity <= 0) {
    rt.shakeEnv = rt.punchPos = rt.punchVel = rt.flashEnv = 0
    rt.prevPhase = inp.phase
    return IMPACT_NEUTRAL
  }
  const k = st.intensity

  // Energy chaser: a slow one-pole (~2 s) towards the phase's gain
  const target = st.follow ? PHASE_GAIN[inp.phase] : 1
  rt.gain += (target - rt.gain) * (1 - Math.exp(-dt / 2))
  const g = Math.min(rt.gain, IMPACT_LIMITS.gain) * k

  // Kick: shake envelope + spring impulse
  if (inp.beat) { rt.shakeEnv = 1; rt.punchVel += 0.8 }
  rt.shakeEnv *= Math.exp(-dt * 14)
  // underdamped spring (zeta ~0.5): overshoots, then settles back elastically
  const acc = -180 * rt.punchPos - 14 * rt.punchVel
  rt.punchVel += acc * dt
  rt.punchPos += rt.punchVel * dt

  // Flash: highs rising edge (soft) and the drop (build/break -> peak)
  const drop = inp.phase === 'peak' && (rt.prevPhase === 'build' || rt.prevPhase === 'break')
  if (drop) rt.flashEnv = 1
  else if (inp.highHit > 0.6 && rt.prevHigh <= 0.6) rt.flashEnv = Math.max(rt.flashEnv, 0.45)
  rt.prevHigh = inp.highHit
  rt.prevPhase = inp.phase
  rt.flashEnv *= Math.exp(-dt * 9)

  const L = IMPACT_LIMITS
  const amp = clamp(rt.shakeEnv * st.shake * g * 0.02, 0, L.shake)
  return {
    shakeX: amp * Math.sin(rt.t * 91),
    shakeY: amp * Math.cos(rt.t * 113),
    zoom: 1 + clamp(rt.punchPos * st.punch * g * 2, -L.zoom, L.zoom),
    flash: clamp(rt.flashEnv * st.flash * g * 0.3, 0, L.flash),
    warp: clamp(inp.mid * st.warp * g * 0.02, 0, L.warp),
    chroma: clamp(inp.high * st.spark * g * 0.008, 0, L.chroma),
    sparkle: clamp(inp.high * st.spark * g * 0.06, 0, 0.08),
  }
}
