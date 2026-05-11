/**
 * Voice-paced autoscroll — listens to the user's mic via the Web Speech
 * API, measures words-per-minute in a sliding window, and emits a
 * scroll speed (in px/sec) that follows the speaking pace.
 *
 * Zero deps. Pure browser APIs. No backend, no model download.
 *
 * Browser support: Chromium-based desktops + Android Chrome. Safari has
 * `webkitSpeechRecognition` but it's flaky (sends interim results
 * inconsistently). Returns `supported: false` outside those.
 *
 * The hook is intentionally narrow: it computes one number (`derivedSpeed`)
 * for the scroll loop to consume. UI surfaces (mic indicator, WPM
 * readout, error banner) are the caller's responsibility — wire from
 * the returned `{ active, wpm, error }`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface VoicePacedOptions {
  /** Locale for recognition. Default 'en-US'. 'pt-BR' verified to work. */
  lang?: string
  /**
   * Sliding window over which WPM is averaged, in ms. Shorter = snappier,
   * longer = smoother. Default 5000 (5s).
   */
  windowMs?: number
  /**
   * The speaking pace (WPM) that should map to `baselineSpeed`. Default
   * 150 — average natural pitch pace.
   */
  targetWpm?: number
  /** Scroll speed (px/sec) when speaker is at exactly `targetWpm`. Default 60. */
  baselineSpeed?: number
  /** Minimum derived speed in px/sec. Default 10. */
  minSpeed?: number
  /** Maximum derived speed in px/sec. Default 300. */
  maxSpeed?: number
}

export interface VoicePacedReturn {
  /** True when the runtime exposes a SpeechRecognition implementation. */
  supported: boolean
  /** Mic is currently listening. */
  active: boolean
  /** Words per minute over the configured window. 0 when not listening. */
  wpm: number
  /**
   * Speed in px/sec derived from `wpm`. Use this as the scroll rate when
   * voice pacing is on. Falls back to `baselineSpeed` while warming up
   * (during the first window).
   */
  derivedSpeed: number
  /** Most recent error from SpeechRecognition. null when healthy. */
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

const DEFAULTS: Required<VoicePacedOptions> = {
  lang: 'en-US',
  windowMs: 5000,
  targetWpm: 150,
  baselineSpeed: 60,
  minSpeed: 10,
  maxSpeed: 300,
}

// SpeechRecognition isn't in the standard TS lib in every config, so we
// type-narrow against the global lookup ourselves.
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string; message?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean; length: number }>
  resultIndex: number
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return (w.SpeechRecognition || w.webkitSpeechRecognition) ?? null
}

/**
 * Count words in a transcript fragment. Trims, splits on whitespace,
 * filters empties. Works for any space-separated language; for CJK we'd
 * need a different segmentation but those aren't supported by
 * SpeechRecognition WPM anyway.
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function useVoicePaced(opts: VoicePacedOptions = {}): VoicePacedReturn {
  const cfg = { ...DEFAULTS, ...opts }
  const supported = useMemo(() => getSpeechRecognition() !== null, [])

  const [active, setActive] = useState(false)
  const [wpm, setWpm] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Each entry is `[timestampMs, wordsAdded]` so we can roll the window
  // by dropping the front when entries fall outside `windowMs`.
  const wordEventsRef = useRef<Array<[number, number]>>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Track the highest resultIndex we've already counted so re-emits of
  // interim results don't double-count. We re-key on `isFinal` boundaries
  // since interim transcripts mutate before settling.
  const lastFinalIndexRef = useRef(0)
  const lastInterimWordsRef = useRef(0)

  const stop = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) {
      try {
        rec.abort()
      } catch {
        /* already stopped */
      }
    }
    recognitionRef.current = null
    setActive(false)
    setWpm(0)
    wordEventsRef.current = []
    lastFinalIndexRef.current = 0
    lastInterimWordsRef.current = 0
  }, [])

  const start = useCallback(() => {
    if (!supported || active) return
    const Ctor = getSpeechRecognition()
    if (!Ctor) return

    const rec = new Ctor()
    rec.lang = cfg.lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
      // Walk results from the current resultIndex forward. Each item is
      // either interim (mutable) or final (locked in). We count words on
      // the final-locked path and approximate WPM with the latest
      // interim chunk so the readout feels live.
      const now = Date.now()
      let newFinalWords = 0
      let latestInterim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i]
        const transcript = item[0].transcript
        if (item.isFinal && i >= lastFinalIndexRef.current) {
          newFinalWords += countWords(transcript)
          lastFinalIndexRef.current = i + 1
        } else if (!item.isFinal) {
          latestInterim = transcript
        }
      }

      if (newFinalWords > 0) {
        wordEventsRef.current.push([now, newFinalWords])
        lastInterimWordsRef.current = 0
      }

      // Recompute WPM. Add interim words as a "soft" addition so the
      // readout reacts mid-utterance without polluting the history.
      const interimWords = countWords(latestInterim)
      lastInterimWordsRef.current = interimWords

      // Drop events older than the window.
      const cutoff = now - cfg.windowMs
      while (
        wordEventsRef.current.length > 0 &&
        wordEventsRef.current[0]![0] < cutoff
      ) {
        wordEventsRef.current.shift()
      }

      const windowedWords =
        wordEventsRef.current.reduce((sum, [, n]) => sum + n, 0) + interimWords
      const measured = (windowedWords * 60_000) / cfg.windowMs
      setWpm(measured)
    }

    rec.onerror = (e) => {
      setError(e.error ?? e.message ?? 'unknown error')
    }

    rec.onend = () => {
      // Some browsers stop the recognizer after silence. Auto-restart if
      // we're still meant to be active.
      if (recognitionRef.current === rec) {
        try {
          rec.start()
        } catch {
          /* user revoked permission or stopped */
        }
      }
    }

    try {
      rec.start()
      recognitionRef.current = rec
      setActive(true)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to start recognition')
    }
  }, [supported, active, cfg.lang, cfg.windowMs])

  const toggle = useCallback(() => {
    if (active) stop()
    else start()
  }, [active, start, stop])

  // Cleanup on unmount.
  useEffect(() => () => stop(), [stop])

  // Derive a px/sec scroll rate from the current WPM. The mapping is
  // linear within the speed band: at `targetWpm` the result is exactly
  // `baselineSpeed`; doubling WPM doubles speed (subject to bounds).
  const derivedSpeed = useMemo(() => {
    if (!active || wpm <= 0) return cfg.baselineSpeed
    const ratio = wpm / cfg.targetWpm
    const raw = cfg.baselineSpeed * ratio
    return Math.max(cfg.minSpeed, Math.min(cfg.maxSpeed, raw))
  }, [active, wpm, cfg.baselineSpeed, cfg.targetWpm, cfg.minSpeed, cfg.maxSpeed])

  return { supported, active, wpm, derivedSpeed, error, start, stop, toggle }
}
