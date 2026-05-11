/**
 * Headless teleprompter state — drives the auto-scroll loop, elapsed timer,
 * keyboard shortcuts, and localStorage persistence. Use this when you want
 * full control over markup; use the `<Teleprompter />` component for the
 * batteries-included version.
 *
 * The hook returns a `scrollerRef` you must attach to the scroll container
 * — the auto-scroll loop reads `scrollTop` / `scrollHeight` directly off
 * that element via requestAnimationFrame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useVoicePaced, type VoicePacedOptions } from './useVoicePaced.js'

export interface Line {
  text: string
  isComment: boolean
}

export interface UseTeleprompterOptions {
  /** Initial script. Lines starting with `//` are rendered as section labels. */
  initialScript?: string
  /** localStorage key for persisting edits. Pass `null` to disable persistence. */
  storageKey?: string | null
  /** Initial scroll speed in px/sec. Default 60. */
  initialSpeed?: number
  /**
   * Initial font size (px). Default picks a reasonable size for the viewport
   * (32 / 44 / 56 based on screen width).
   */
  initialFontSize?: number
  /** Wire `Space` / arrow keys / +/- / M / R / E to playback. Default true. */
  enableKeyboard?: boolean
  /** Min/max bounds for speed. Default 10–300 px/sec. */
  speedRange?: { min: number; max: number; step?: number }
  /** Min/max bounds for font size. Default 20–120 px. */
  fontSizeRange?: { min: number; max: number; step?: number }
  /**
   * Voice-paced autoscroll. When enabled, the mic listens (Web Speech
   * API) and adjusts `speed` in real time to match the speaker's pace.
   * `true` opts in with defaults; pass an object to tune
   * `lang`, `targetWpm`, `baselineSpeed`, etc.
   *
   * Browser support: Chromium-based only. `supported: false` in the
   * returned `voicePaced` block when unavailable.
   */
  voicePaced?: boolean | VoicePacedOptions
}

export interface UseTeleprompterReturn {
  /** Parsed lines (comment vs body). */
  lines: Line[]
  /** Raw script text — set this to overwrite. */
  scriptText: string
  setScriptText: (script: string) => void

  /** Playback. */
  isPlaying: boolean
  play: () => void
  pause: () => void
  togglePlay: () => void
  reset: () => void

  /** Speed (px/sec). */
  speed: number
  setSpeed: (speed: number) => void
  bumpSpeed: (delta: number) => void

  /** Font size (px). */
  fontSize: number
  setFontSize: (size: number) => void
  bumpFontSize: (delta: number) => void

  /** Mirror horizontally (for use behind glass / mirror rigs). */
  mirror: boolean
  toggleMirror: () => void

  /** Elapsed playback time in milliseconds. */
  elapsedMs: number

  /** Attach to your scroll container. */
  scrollerRef: React.MutableRefObject<HTMLDivElement | null>

  /**
   * Voice-paced autoscroll state. `supported: false` on browsers without
   * Web Speech API; toggling does nothing in that case.
   */
  voicePaced: {
    supported: boolean
    active: boolean
    wpm: number
    toggle: () => void
    error: string | null
  }
}

const DEFAULT_OPTIONS: Required<Pick<UseTeleprompterOptions, 'storageKey' | 'enableKeyboard'>> & {
  speedRange: { min: number; max: number; step: number }
  fontSizeRange: { min: number; max: number; step: number }
} = {
  storageKey: '@datatechsolutions/teleprompter:v1',
  enableKeyboard: true,
  speedRange: { min: 10, max: 300, step: 10 },
  fontSizeRange: { min: 20, max: 120, step: 4 },
}

/**
 * Parse a script — split lines, mark `//` comments. Blank lines stay blank.
 */
export function parseScript(raw: string): Line[] {
  return raw.split('\n').map((line) => {
    const trimmed = line.trim()
    return {
      text: trimmed,
      isComment: trimmed.startsWith('//'),
    }
  })
}

function pickInitialFontSize(): number {
  if (typeof window === 'undefined') return 48
  const w = window.innerWidth
  if (w < 480) return 32
  if (w < 900) return 44
  return 56
}

export function useTeleprompter(options: UseTeleprompterOptions = {}): UseTeleprompterReturn {
  const storageKey = options.storageKey === undefined ? DEFAULT_OPTIONS.storageKey : options.storageKey
  const enableKeyboard = options.enableKeyboard ?? DEFAULT_OPTIONS.enableKeyboard
  const speedRange = { ...DEFAULT_OPTIONS.speedRange, ...options.speedRange }
  const fontSizeRange = { ...DEFAULT_OPTIONS.fontSizeRange, ...options.fontSizeRange }

  const [scriptText, setScriptText] = useState<string>(() => {
    if (typeof window === 'undefined' || !storageKey) return options.initialScript ?? ''
    return localStorage.getItem(storageKey) ?? options.initialScript ?? ''
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState<number>(options.initialSpeed ?? 60)
  const [fontSize, setFontSizeState] = useState<number>(options.initialFontSize ?? pickInitialFontSize())
  const [mirror, setMirror] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number | null>(null)

  const lines = useMemo(() => parseScript(scriptText), [scriptText])

  // Voice-paced autoscroll. Pass through user options (or empty when
  // they only said `true`); start listening immediately if requested.
  const voicePacedOpts: VoicePacedOptions =
    typeof options.voicePaced === 'object' ? options.voicePaced : {}
  const voicePacedShouldStart =
    options.voicePaced === true ||
    (typeof options.voicePaced === 'object' && (options.voicePaced as VoicePacedOptions))
  const voice = useVoicePaced(voicePacedOpts)
  useEffect(() => {
    if (voicePacedShouldStart && voice.supported && !voice.active) {
      voice.start()
    }
    // start is only called once on mount when the consumer opted in
    // declaratively; afterwards the user toggles via the returned API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voicePacedShouldStart])

  const setSpeed = useCallback(
    (v: number) => setSpeedState(Math.max(speedRange.min, Math.min(speedRange.max, v))),
    [speedRange.min, speedRange.max],
  )
  const setFontSize = useCallback(
    (v: number) => setFontSizeState(Math.max(fontSizeRange.min, Math.min(fontSizeRange.max, v))),
    [fontSizeRange.min, fontSizeRange.max],
  )
  const bumpSpeed = useCallback(
    (delta: number) => setSpeedState((s) => Math.max(speedRange.min, Math.min(speedRange.max, s + delta))),
    [speedRange.min, speedRange.max],
  )
  const bumpFontSize = useCallback(
    (delta: number) =>
      setFontSizeState((s) => Math.max(fontSizeRange.min, Math.min(fontSizeRange.max, s + delta))),
    [fontSizeRange.min, fontSizeRange.max],
  )

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => setIsPlaying(false), [])
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), [])
  const toggleMirror = useCallback(() => setMirror((m) => !m), [])

  const reset = useCallback(() => {
    setIsPlaying(false)
    setElapsedMs(0)
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [])

  // Persist script
  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return
    localStorage.setItem(storageKey, scriptText)
  }, [scriptText, storageKey])

  // Auto-scroll loop + elapsed timer
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTickRef.current = null
      return
    }
    const tick = (now: number) => {
      const last = lastTickRef.current ?? now
      const dt = (now - last) / 1000
      lastTickRef.current = now
      // Use the voice-derived speed when the mic is actively listening;
      // otherwise fall back to the manual `speed` state. This means a
      // single source-of-truth `effectiveSpeed` flows through the scroll
      // loop without the consumer needing to wire anything.
      const effectiveSpeed = voice.active ? voice.derivedSpeed : speed
      const el = scrollerRef.current
      if (el) {
        el.scrollTop += effectiveSpeed * dt
        const reachedEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        if (reachedEnd) {
          setIsPlaying(false)
          return
        }
      }
      setElapsedMs((m) => m + dt * 1000)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, speed, voice.active, voice.derivedSpeed])

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboard) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          setIsPlaying((p) => !p)
          break
        case 'ArrowUp':
          e.preventDefault()
          bumpSpeed(speedRange.step ?? 10)
          break
        case 'ArrowDown':
          e.preventDefault()
          bumpSpeed(-(speedRange.step ?? 10))
          break
        case '+':
        case '=':
          e.preventDefault()
          bumpFontSize(fontSizeRange.step ?? 4)
          break
        case '-':
        case '_':
          e.preventDefault()
          bumpFontSize(-(fontSizeRange.step ?? 4))
          break
        case 'm':
        case 'M':
          setMirror((m) => !m)
          break
        case 'r':
        case 'R':
          reset()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enableKeyboard, bumpSpeed, bumpFontSize, reset, speedRange.step, fontSizeRange.step])

  return {
    lines,
    scriptText,
    setScriptText,
    isPlaying,
    play,
    pause,
    togglePlay,
    reset,
    speed,
    setSpeed,
    bumpSpeed,
    fontSize,
    setFontSize,
    bumpFontSize,
    mirror,
    toggleMirror,
    elapsedMs,
    scrollerRef,
    voicePaced: {
      supported: voice.supported,
      active: voice.active,
      wpm: voice.wpm,
      toggle: voice.toggle,
      error: voice.error,
    },
  }
}
