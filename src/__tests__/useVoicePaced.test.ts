/**
 * Tests for useVoicePaced — mocks the Web Speech API and drives WPM
 * scenarios end-to-end.
 *
 * The strategy: a `MockSpeechRecognition` class captures `onresult` and
 * lets us synthesise interim + final transcripts at controlled times.
 * Combined with `vi.useFakeTimers()` we get deterministic windowed-WPM
 * assertions without flakiness.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useVoicePaced } from '../useVoicePaced.js'

// ── Mock SpeechRecognition ──────────────────────────────────────────

interface MockResult {
  transcript: string
  isFinal: boolean
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = []

  lang = 'en-US'
  continuous = false
  interimResults = false
  started = false
  aborted = false

  // Cumulative results, like the real API: each onresult event passes
  // the full results array + a resultIndex marking where new entries
  // start. We accumulate here.
  private results: MockResult[] = []

  onresult: ((e: { results: MockResult[]; resultIndex: number }) => void) | null = null
  onerror: ((e: { error?: string; message?: string }) => void) | null = null
  onend: (() => void) | null = null

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }

  start() {
    this.started = true
    this.aborted = false
  }

  stop() {
    if (!this.started) return
    this.started = false
    this.onend?.()
  }

  abort() {
    this.started = false
    this.aborted = true
  }

  /** Test helper — push a new final/interim transcript and fire onresult. */
  emit(transcripts: MockResult[]) {
    const resultIndex = this.results.length
    this.results.push(...transcripts)
    // Promote the trailing interim entry to mutable: pop and rebuild
    // on next emit (real API mutates the last entry). We simulate that
    // by re-emitting the same array — the hook reads resultIndex to
    // know where to start.
    const payload = {
      // jsdom-compat: numeric indexer + isFinal + length is what the
      // hook actually reads off each result item.
      results: this.results.map((r) => ({
        0: { transcript: r.transcript },
        isFinal: r.isFinal,
        length: 1,
      })) as unknown as MockResult[],
      resultIndex,
    }
    this.onresult?.(payload)
  }

  /** Force an error event. */
  failWith(error: string) {
    this.onerror?.({ error })
  }
}

// Install the mock globally before importing the hook.
beforeEach(() => {
  vi.useFakeTimers()
  ;(window as unknown as { SpeechRecognition: typeof MockSpeechRecognition }).SpeechRecognition =
    MockSpeechRecognition
  ;(window as unknown as { webkitSpeechRecognition?: typeof MockSpeechRecognition }).webkitSpeechRecognition =
    undefined
  MockSpeechRecognition.instances = []
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
})

const latestRec = () =>
  MockSpeechRecognition.instances[MockSpeechRecognition.instances.length - 1]!

// ── Tests ───────────────────────────────────────────────────────────

describe('useVoicePaced', () => {
  it('reports supported=true when window.SpeechRecognition exists', () => {
    const { result } = renderHook(() => useVoicePaced())
    expect(result.current.supported).toBe(true)
    expect(result.current.active).toBe(false)
  })

  it('falls back to webkit-prefixed name', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    ;(window as unknown as { webkitSpeechRecognition: typeof MockSpeechRecognition }).webkitSpeechRecognition =
      MockSpeechRecognition
    const { result } = renderHook(() => useVoicePaced())
    expect(result.current.supported).toBe(true)
  })

  it('reports supported=false when neither is present', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    const { result } = renderHook(() => useVoicePaced())
    expect(result.current.supported).toBe(false)
  })

  it('start() flips active and creates a recognition instance', () => {
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.start())
    expect(result.current.active).toBe(true)
    expect(MockSpeechRecognition.instances).toHaveLength(1)
    expect(latestRec().started).toBe(true)
  })

  it('start() does nothing when unsupported', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.start())
    expect(result.current.active).toBe(false)
    expect(MockSpeechRecognition.instances).toHaveLength(0)
  })

  it('stop() aborts recognition and resets state', () => {
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.start())
    act(() => result.current.stop())
    expect(result.current.active).toBe(false)
    expect(result.current.wpm).toBe(0)
    expect(latestRec().aborted).toBe(true)
  })

  it('toggle() alternates between start and stop', () => {
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.toggle())
    expect(result.current.active).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.active).toBe(false)
  })

  it('measures WPM from final transcripts in the sliding window', () => {
    // 5s window, target 150 WPM, baseline 60 px/s.
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.start())

    // 12 final words emitted → at 5s window: 12 * 60/5 = 144 wpm.
    act(() => {
      latestRec().emit([
        {
          transcript: 'one two three four five six seven eight nine ten eleven twelve',
          isFinal: true,
        },
      ])
    })
    expect(result.current.wpm).toBeCloseTo(144, 0)
  })

  it('rolls the window forward and drops old word events', () => {
    const { result } = renderHook(() => useVoicePaced({ windowMs: 1000 }))
    act(() => result.current.start())

    // T=0: 10 words emitted → 10 * 60 = 600 wpm at 1s window.
    act(() => latestRec().emit([{ transcript: 'one two three four five six seven eight nine ten', isFinal: true }]))
    expect(result.current.wpm).toBeCloseTo(600, 0)

    // Advance the clock past the window — the next emit should not see the old words.
    act(() => vi.advanceTimersByTime(2000))
    act(() => latestRec().emit([{ transcript: 'eleven twelve', isFinal: true }]))
    // Only the 2 new words remain in the window → 2 * 60 = 120 wpm.
    expect(result.current.wpm).toBeCloseTo(120, 0)
  })

  it('interim transcripts add to live wpm without polluting history', () => {
    const { result } = renderHook(() => useVoicePaced({ windowMs: 5000 }))
    act(() => result.current.start())

    // Interim 5 words → 5 * 12 = 60 wpm in the live readout
    // (5000/60_000 ratio → 5 * 60_000/5000 = 60 wpm).
    act(() => latestRec().emit([{ transcript: 'one two three four five', isFinal: false }]))
    expect(result.current.wpm).toBeCloseTo(60, 0)

    // Next emit replaces the interim with empty — wpm goes to 0 since
    // no finals locked in.
    act(() => latestRec().emit([{ transcript: '', isFinal: false }]))
    expect(result.current.wpm).toBe(0)
  })

  it('derivedSpeed scales linearly around targetWpm', () => {
    const { result } = renderHook(() =>
      useVoicePaced({ windowMs: 5000, targetWpm: 150, baselineSpeed: 60, maxSpeed: 999 }),
    )
    act(() => result.current.start())

    // At 0 wpm → falls back to baselineSpeed.
    expect(result.current.derivedSpeed).toBe(60)

    // 12.5 final words / 5s → 150 wpm exactly → 60 px/s baseline.
    act(() =>
      latestRec().emit([
        { transcript: 'a b c d e f g h i j k l m', isFinal: true },
      ]),
    )
    // 13 words / 5s * 60 = 156 wpm → 156/150 * 60 ≈ 62.4 px/s
    expect(result.current.derivedSpeed).toBeCloseTo(62.4, 1)
  })

  it('derivedSpeed clamps to min/max bounds', () => {
    const { result } = renderHook(() =>
      useVoicePaced({
        windowMs: 1000,
        targetWpm: 100,
        baselineSpeed: 50,
        minSpeed: 20,
        maxSpeed: 200,
      }),
    )
    act(() => result.current.start())

    // 1 word / 1s → 60 wpm → 60/100 * 50 = 30 px/s (above min, below max)
    act(() => latestRec().emit([{ transcript: 'word', isFinal: true }]))
    expect(result.current.derivedSpeed).toBeCloseTo(30, 0)

    // Push past max: 100 words / 1s → 6000 wpm → clamps to 200.
    const manyWords = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ')
    act(() => latestRec().emit([{ transcript: manyWords, isFinal: true }]))
    expect(result.current.derivedSpeed).toBe(200)
  })

  it('captures error events without crashing', () => {
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.start())
    act(() => latestRec().failWith('not-allowed'))
    expect(result.current.error).toBe('not-allowed')
  })

  it('passes lang config to recognition instance', () => {
    const { result } = renderHook(() => useVoicePaced({ lang: 'pt-BR' }))
    act(() => result.current.start())
    expect(latestRec().lang).toBe('pt-BR')
    expect(latestRec().continuous).toBe(true)
    expect(latestRec().interimResults).toBe(true)
  })

  it('cleans up recognition on unmount', () => {
    const { result, unmount } = renderHook(() => useVoicePaced())
    act(() => result.current.start())
    const rec = latestRec()
    unmount()
    expect(rec.aborted).toBe(true)
  })

  it('does not start twice when start() is called while active', () => {
    const { result } = renderHook(() => useVoicePaced())
    act(() => result.current.start())
    act(() => result.current.start())
    expect(MockSpeechRecognition.instances).toHaveLength(1)
  })

  it('returns derivedSpeed=baselineSpeed while inactive', () => {
    const { result } = renderHook(() => useVoicePaced({ baselineSpeed: 80 }))
    expect(result.current.active).toBe(false)
    expect(result.current.derivedSpeed).toBe(80)
  })
})
