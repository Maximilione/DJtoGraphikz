import React from 'react'

// D6 — inline SVG icon set: 16px, stroke 1.6, currentColor.
// ponytail: factory + static children, no props beyond size — add variants only when needed.
function icon(children: React.ReactNode) {
  return function Icon({ size = 16 }: { size?: number }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: 'block', flexShrink: 0 }}
      >
        {children}
      </svg>
    )
  }
}

export const IconCamera = icon(
  <>
    <path d="M5.6 4.2 6.5 2.8h3l.9 1.4" />
    <rect x="1.6" y="4.2" width="12.8" height="9" rx="1.5" />
    <circle cx="8" cy="8.7" r="2.4" />
  </>
)

export const IconRecord = icon(
  <circle cx="8" cy="8" r="4.5" fill="currentColor" stroke="none" />
)

export const IconStop = icon(
  <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
)

export const IconPhone = icon(
  <>
    <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" />
    <path d="M7 12.4h2" />
  </>
)

export const IconFullscreen = icon(
  <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
)

export const IconHelp = icon(
  <>
    <circle cx="8" cy="8" r="6.4" />
    <path d="M6.2 6.1a1.8 1.8 0 1 1 2.7 1.6c-.6.35-.9.75-.9 1.4" />
    <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
  </>
)

// Mini versione dell'occhio del logo: mandorla + iride
export const IconEye = icon(
  <>
    <path d="M1.5 8C3.4 4.9 5.6 3.3 8 3.3s4.6 1.6 6.5 4.7c-1.9 3.1-4.1 4.7-6.5 4.7S3.4 11.1 1.5 8Z" />
    <circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" />
  </>
)

export const IconPanic = icon(
  <>
    <path d="M8 2.2 14.6 13.6H1.4Z" />
    <path d="M8 6.4v3.4" />
    <circle cx="8" cy="11.7" r="0.6" fill="currentColor" stroke="none" />
  </>
)

export const IconMonitor = icon(
  <>
    <rect x="1.6" y="2.5" width="12.8" height="8.8" rx="1" />
    <path d="M5.5 14h5M8 11.3V14" />
  </>
)
