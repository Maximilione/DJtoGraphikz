import type { ReactNode } from 'react'
import { NumberInput } from '../NumberInput/NumberInput'

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  title?: string
  /** A read-only percentage instead of the editable number field. */
  percent?: boolean
  suffix?: string
  /** Tooltip for the label, when the short label needs explaining. */
  labelTitle?: string
  /** One extra affordance after the readout — a mapping chip, and no more. */
  children?: ReactNode
}

/**
 * The one label · slider · number row.
 *
 * There were three: `.slider-row` with a `<NumberInput>`, a `SliderRow`
 * wrapper local to the media panel with its own `.media-slider-row` class, and
 * a bare range next to a `<span class="u-value">` percentage. Same three
 * pieces, three markups, two label widths — so the same control was 74px of
 * label in one panel and 52px in another, on the same screen.
 *
 * A row that carries one extra affordance after the readout — the audio
 * mapping chip — passes it as a child. A row built out of something else
 * entirely (the post-FX chain, with its reorder arrows and no readout) is not
 * this pattern and keeps its own markup.
 */
export function SliderRow({
  label, value, min, max, step, onChange, title, percent = false, suffix = '',
  labelTitle, children,
}: SliderRowProps) {
  return (
    <div className="slider-row">
      <span className="label" title={labelTitle}>{label}</span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        title={title}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      {percent
        ? <span className="u-value">{Math.round(value * 100)}%</span>
        : <NumberInput value={value} min={min} max={max} step={step} onChange={onChange} suffix={suffix} />}
      {children}
    </div>
  )
}
