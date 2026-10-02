import type { Engine, PostId } from '@engine/Engine'
import { GENRE_CONFIGS } from '@engine/AutoVJ'
import { ALL_EFFECTS, POST_CATEGORIES } from './catalog'

/**
 * Release sweep (DJG_SELFTEST_SWEEP): walk every effect, every post at two
 * amounts, and every post combination the Auto VJ can put up, and ask the
 * output window what it is really painting after each one. A white or a
 * black projector is the one failure a club does not forgive, and only the
 * real pipeline — real GPU, real post chain, real feedback accumulation —
 * can say it will not happen. scripts/check-sweep.py reads the lines.
 */
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function runSweep(engine: Engine) {
  const log = (m: string) => window.api?.logToFile?.('sweep', m)
  const probe = async (kind: string, id: string) => {
    const p = await window.api?.probeOutput?.()
    log(p
      ? `[Sweep] kind=${kind} id=${id} mean=${p.mean.toFixed(3)} std=${p.std.toFixed(3)} bright=${p.bright.toFixed(3)} fps=${p.fps.toFixed(0)} now=${engine.getCurrentEffect()}/${engine.getActivePosts().join('+') || '-'}`
      : `[Sweep] kind=${kind} id=${id} NOPROBE`)
  }
  engine.setTransitionDuration(0)
  engine.setIntensity(1)
  log(`[Sweep] start effects=${ALL_EFFECTS.length}`)

  for (const fx of ALL_EFFECTS) {
    engine.setActivePosts([])
    engine.setEffect(fx.id)
    await wait(700)
    await probe('effect', fx.id)
  }

  // every post alone, half and full, over a mid-bright effect; 1.5 s lets the
  // feedback-type posts accumulate to whatever they converge to
  const posts = POST_CATEGORIES.flatMap(c => c.effects.map(p => p.id))
  engine.setEffect('plasma')
  for (const id of posts) for (const a of [0.5, 1]) {
    engine.setActivePosts([id], { [id]: a } as Partial<Record<PostId, number>>)
    await wait(1500)
    await probe('post', `${id}@${a}`)
  }

  // every post set the Auto VJ uses, at the amount it uses (1), over a bright
  // scene and a strobing one — the two that push a chain toward white
  const sets = [...new Set(Object.values(GENRE_CONFIGS).flatMap(g => g.scenes.map(s => s.posts.join('+'))))].filter(Boolean)
  for (const set of sets) for (const fx of ['plasma', 'strobegrid'] as const) {
    engine.setEffect(fx)
    engine.setActivePosts(set.split('+') as PostId[])
    await wait(1500)
    await probe('set', `${fx}:${set}`)
  }
  engine.setActivePosts([])
  log('[Sweep] done')
}
