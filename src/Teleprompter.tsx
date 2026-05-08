/**
 * Drop-in teleprompter — full chrome (controls, timer, edit modal). Wraps
 * `useTeleprompter` so consumers get auto-scroll, mirror, keyboard control,
 * and localStorage persistence with one tag.
 *
 * Tailwind requirement: this component uses Tailwind utility classes. Make
 * sure your project's Tailwind config scans the package output:
 *
 *     content: [
 *       "./node_modules/@datatechsolutions/teleprompter/dist/**\/*.{js,mjs,cjs}"
 *     ]
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CheckIcon,
  MinusIcon,
  PauseIcon,
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
} from './icons.js'
import { useTeleprompter, type UseTeleprompterOptions } from './useTeleprompter.js'

export interface TeleprompterProps extends UseTeleprompterOptions {
  /**
   * Target run duration. Rendered next to the elapsed timer as `MM:SS / MM:SS`
   * so the speaker can pace themselves. Pass `null` to hide.
   * Default `'01:00'`.
   */
  targetDuration?: string | null
  /**
   * Show the in-built edit modal (pencil button + textarea overlay). When
   * disabled, scripts are read-only and the host app is responsible for
   * mutating `scriptText` via the hook. Default `true`.
   */
  enableEditing?: boolean
  /**
   * Optional content rendered at the top-right of the control bar. Use this
   * to inject app-specific UI (logout, settings, link to docs, …).
   */
  controlsAccessory?: ReactNode
  /** Override the keyboard hint string. Pass `null` to hide. */
  keyboardHint?: string | null
  /**
   * Accent colour driving the active controls, section labels, reader marker,
   * and progress bar. Any CSS colour string. Default violet-500.
   */
  accentColor?: string
  /**
   * Render a thin progress bar at the bottom of the viewport (above the
   * control bar) showing how far through the script the user has scrolled.
   * Default `true`.
   */
  showProgressBar?: boolean
  /**
   * Soft fade gradients at the top + bottom of the scroller so text
   * materialises and dissolves at the edges instead of being hard-cut.
   * Default `true`.
   */
  fadeEdges?: boolean
  /**
   * Disable the playing-state pulse on the reader marker + smooth easing on
   * size/speed transitions. Auto-enabled when the OS reports
   * `prefers-reduced-motion: reduce`.
   */
  reducedMotion?: boolean
  /**
   * When `true` (default) the teleprompter takes the entire viewport
   * (`h-screen w-screen`). Set `false` to make it fill its containing block
   * instead — the parent must have an explicit height. Useful for embedded
   * previews on landing pages or modal overlays.
   */
  fullscreen?: boolean
}

const DEFAULT_KEYBOARD_HINT =
  'Space play · ↑↓ speed · ± size · M mirror · E edit · R reset'

const DEFAULT_ACCENT = '#8b5cf6' // violet-500

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Hex colour → rgba string with the given alpha (0-1). Falls back to the
 *  literal hex if it doesn't look like #RGB / #RRGGBB so any CSS colour
 *  (oklch, named, etc.) still works at full opacity. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim()
  const m6 = /^#([0-9a-f]{6})$/i.exec(hex)
  if (m6) {
    const v = parseInt(m6[1]!, 16)
    return `rgba(${(v >> 16) & 0xff}, ${(v >> 8) & 0xff}, ${v & 0xff}, ${alpha})`
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(hex)
  if (m3) {
    const r = parseInt(m3[1]![0]! + m3[1]![0]!, 16)
    const g = parseInt(m3[1]![1]! + m3[1]![1]!, 16)
    const b = parseInt(m3[1]![2]! + m3[1]![2]!, 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function Teleprompter({
  targetDuration = '01:00',
  enableEditing = true,
  controlsAccessory,
  keyboardHint = DEFAULT_KEYBOARD_HINT,
  accentColor = DEFAULT_ACCENT,
  showProgressBar = true,
  fadeEdges = true,
  reducedMotion,
  fullscreen = true,
  ...hookOptions
}: TeleprompterProps) {
  const t = useTeleprompter(hookOptions)
  const {
    lines,
    scriptText,
    setScriptText,
    isPlaying,
    togglePlay,
    reset,
    speed,
    bumpSpeed,
    fontSize,
    bumpFontSize,
    mirror,
    toggleMirror,
    elapsedMs,
    scrollerRef,
  } = t

  const osReducedMotion = usePrefersReducedMotion()
  const motionReduced = reducedMotion ?? osReducedMotion

  const [editing, setEditing] = useState(false)
  const [editBuffer, setEditBuffer] = useState(scriptText)
  const [progress, setProgress] = useState(0) // 0..1

  const openEditor = useCallback(() => {
    setEditBuffer(scriptText)
    setEditing(true)
  }, [scriptText])

  const saveEdit = useCallback(() => {
    setScriptText(editBuffer)
    setEditing(false)
    reset()
  }, [editBuffer, reset, setScriptText])

  const cancelEdit = useCallback(() => {
    setEditBuffer(scriptText)
    setEditing(false)
  }, [scriptText])

  // Track scroll progress for the bottom progress bar. Reads scrollTop on
  // every scroll event — cheap because the scroller is the one DOM node
  // that already drives the auto-scroll loop.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !showProgressBar) return
    const update = () => {
      const max = el.scrollHeight - el.clientHeight
      setProgress(max > 0 ? el.scrollTop / max : 0)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [scrollerRef, showProgressBar, scriptText])

  // E key opens the editor (kept here, not in the hook, because the hook
  // is supposed to be UI-agnostic — only the component knows about the
  // edit modal).
  useEditShortcut(enableEditing && !editing, openEditor)

  // CSS variables for accent-driven styling. Tailwind classes that need
  // this colour read it via `var(--tp-accent)` in inline style props.
  const rootStyle: CSSProperties & Record<string, string> = {
    ['--tp-accent' as string]: accentColor,
    ['--tp-accent-soft' as string]: withAlpha(accentColor, 0.4),
    ['--tp-accent-softer' as string]: withAlpha(accentColor, 0.1),
    ['--tp-accent-text' as string]: withAlpha(accentColor, 0.7),
  }

  // Smooth font-size transition unless user opted out / OS reduced motion.
  const lineTransition = motionReduced ? undefined : 'font-size 200ms ease-out'

  // In fullscreen mode the scroller pads to 50vh (viewport units) so the
  // first line aligns with the centre reader marker. Embedded mode (e.g.
  // a 560 px box on a landing page) needs container-relative padding —
  // 50vh would leave half the viewport of empty space and squash the
  // visible text below the box. CSS container query units (`cqh`) solve
  // this: 50cqh = 50% of the nearest size container's height. We mark
  // the outer wrapper as a size container only when embedded so that the
  // scroller pads relative to the box, not the viewport.
  const containerStyle: CSSProperties = fullscreen
    ? rootStyle
    : { ...rootStyle, containerType: 'size' }
  const scrollerPadding: CSSProperties = fullscreen
    ? { paddingTop: '50vh', paddingBottom: '50vh' }
    : { paddingTop: '50cqh', paddingBottom: '50cqh' }

  return (
    <div
      className={
        fullscreen
          ? 'relative h-screen w-screen overflow-hidden bg-black text-white'
          : 'relative h-full w-full overflow-hidden bg-black text-white'
      }
      style={containerStyle}
    >
      {/* Scroller — pt aligns first script line with the reader marker
          (centre of viewport in fullscreen mode, centre of the embedding
          box in embedded mode). */}
      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-auto px-4 sm:px-8"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          ...scrollerPadding,
        }}
        onClick={() => {
          if (!editing) togglePlay()
        }}
      >
        <style>{`
          .teleprompter-scroller::-webkit-scrollbar { display: none; }
          @keyframes teleprompter-marker-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.85; }
          }
        `}</style>
        <div
          className="teleprompter-scroller mx-auto max-w-[1100px]"
          style={mirror ? { transform: 'scaleX(-1)' } : undefined}
        >
          {lines.map((line, i) => {
            if (line.text === '') {
              return <div key={i} style={{ height: fontSize * 0.6 }} />
            }
            if (line.isComment) {
              return (
                <p
                  key={i}
                  className="my-3 select-none font-semibold uppercase tracking-[0.25em]"
                  style={{
                    fontSize: Math.max(14, fontSize * 0.32),
                    color: 'var(--tp-accent-text)',
                    transition: lineTransition,
                  }}
                >
                  {line.text.replace(/^\/\/\s*/, '')}
                </p>
              )
            }
            return (
              <p
                key={i}
                className="mb-6 leading-[1.25] text-white"
                style={{
                  fontSize,
                  fontWeight: 600,
                  textWrap: 'balance',
                  transition: lineTransition,
                }}
              >
                {line.text}
              </p>
            )
          })}
        </div>
      </div>

      {/* Edge fade gradients — pointer-events:none so clicks still hit the
          scroller below. Top fades from solid black to transparent so text
          enters/exits the visible area gracefully. */}
      {fadeEdges && (
        <>
          <div
            data-testid="teleprompter-fade-top"
            className="pointer-events-none absolute left-0 right-0 top-0 z-10"
            style={{
              height: '25vh',
              background: 'linear-gradient(to bottom, #000 10%, rgba(0,0,0,0) 100%)',
            }}
          />
          <div
            data-testid="teleprompter-fade-bottom"
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
            style={{
              // Sits above the control bar — generous height so the
              // bottom area also fades cleanly.
              height: '28vh',
              background: 'linear-gradient(to top, #000 35%, rgba(0,0,0,0) 100%)',
            }}
          />
        </>
      )}

      {/* Center reader marker — gradient line at the focus zone. Pulses
          softly while playing so the speaker has a peripheral cue that
          the script is moving, even before the text itself shifts. */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-px -translate-y-1/2"
        style={{
          background: `linear-gradient(to right, transparent, ${withAlpha(accentColor, 0.5)}, transparent)`,
          animation:
            isPlaying && !motionReduced
              ? 'teleprompter-marker-pulse 2.4s ease-in-out infinite'
              : undefined,
        }}
      />
      <div
        className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 flex -translate-y-1/2 justify-between"
        style={{ color: 'var(--tp-accent-text)' }}
      >
        <span className="text-[10px] font-bold tracking-widest">▶</span>
        <span className="text-[10px] font-bold tracking-widest">◀</span>
      </div>

      {/* Progress bar — sits just above the control bar, tracks scrollTop. */}
      {showProgressBar && (
        <div
          data-testid="teleprompter-progress-track"
          className="pointer-events-none absolute bottom-[var(--tp-controlbar-h,3.25rem)] left-0 right-0 z-20 h-[2px]"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            data-testid="teleprompter-progress-bar"
            className="h-full"
            style={{
              width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
              background: accentColor,
              transition: motionReduced ? undefined : 'width 120ms linear',
            }}
          />
        </div>
      )}

      {/* Bottom control bar — wraps to multi-row on narrow screens */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/80 px-2 py-2 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors ${
            isPlaying
              ? 'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
              : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
          }`}
        >
          {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button
          type="button"
          onClick={reset}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
          title="Reset (R)"
          aria-label="Reset"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleMirror}
          className={
            mirror
              ? 'flex h-9 w-9 items-center justify-center rounded-full border transition-colors sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm sm:font-semibold'
              : 'flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm sm:font-semibold'
          }
          style={
            mirror
              ? {
                  borderColor: withAlpha(accentColor, 0.5),
                  background: 'var(--tp-accent-softer)',
                  color: 'var(--tp-accent-text)',
                }
              : undefined
          }
          title="Mirror (M)"
          aria-label="Mirror"
        >
          <ArrowsRightLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Mirror</span>
        </button>

        {enableEditing && (
          <button
            type="button"
            onClick={openEditor}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm sm:font-semibold"
            title="Edit (E)"
            aria-label="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-emerald-300">
          {formatTime(elapsedMs)}
          {targetDuration !== null && (
            <span className="ml-1 text-[11px] text-emerald-500/70">/ {targetDuration}</span>
          )}
        </span>

        {controlsAccessory}

        {/* Speed + Size — wrap to a second row on narrow screens */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex flex-1 items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 sm:flex-initial">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Speed</span>
            <button
              onClick={() => bumpSpeed(-10)}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Decrease speed"
            >
              <MinusIcon className="h-3 w-3" />
            </button>
            <span className="w-9 text-center font-mono text-sm tabular-nums text-white">{speed}</span>
            <button
              onClick={() => bumpSpeed(10)}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Increase speed"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 sm:flex-initial">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Size</span>
            <button
              onClick={() => bumpFontSize(-4)}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Decrease font size"
            >
              <MinusIcon className="h-3 w-3" />
            </button>
            <span className="w-9 text-center font-mono text-sm tabular-nums text-white">{fontSize}</span>
            <button
              onClick={() => bumpFontSize(4)}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Increase font size"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          </div>
        </div>

        {keyboardHint !== null && (
          <span className="hidden w-full text-center text-[10px] text-gray-500 lg:block lg:w-auto">
            {keyboardHint}
          </span>
        )}
      </div>

      {/* Edit modal */}
      {enableEditing && editing && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6">
          <div className="flex h-full max-h-[90vh] w-full max-w-[820px] flex-col rounded-2xl border border-white/10 bg-gray-950 sm:max-h-[700px]">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white sm:text-lg">Edit script</h2>
                <p className="mt-0.5 text-[11px] text-gray-500 sm:text-xs">
                  Lines starting with <code className="rounded bg-white/5 px-1">//</code> become section labels. Blank lines = visual gaps.
                </p>
              </div>
            </div>
            <textarea
              value={editBuffer}
              onChange={(e) => setEditBuffer(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none bg-gray-950 px-5 py-4 font-mono text-sm leading-relaxed text-gray-200 focus:outline-none"
            />
            <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white hover:shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${accentColor}, ${accentColor})`,
                  boxShadow: `0 0 0 0 ${withAlpha(accentColor, 0)}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 10px 25px -5px ${withAlpha(accentColor, 0.4)}`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 0 ${withAlpha(accentColor, 0)}`
                }}
              >
                <CheckIcon className="h-4 w-4" /> Save & reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Wires the `E` key to open the edit modal — only when the modal isn't already open. */
function useEditShortcut(active: boolean, onOpen: () => void) {
  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'e' || e.key === 'E') onOpen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onOpen])
}
