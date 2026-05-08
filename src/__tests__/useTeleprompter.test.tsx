import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTeleprompter } from '../useTeleprompter.js'

describe('useTeleprompter', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('initialises with the provided script and parses lines', () => {
    const { result } = renderHook(() =>
      useTeleprompter({ initialScript: '// Hook\nbody', storageKey: null }),
    )
    expect(result.current.scriptText).toBe('// Hook\nbody')
    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines[0]!.isComment).toBe(true)
    expect(result.current.lines[1]!.text).toBe('body')
  })

  it('starts paused with elapsed=0', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.elapsedMs).toBe(0)
  })

  it('togglePlay flips isPlaying', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    act(() => result.current.togglePlay())
    expect(result.current.isPlaying).toBe(true)
    act(() => result.current.togglePlay())
    expect(result.current.isPlaying).toBe(false)
  })

  it('play() / pause() set state directly', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    act(() => result.current.play())
    expect(result.current.isPlaying).toBe(true)
    act(() => result.current.pause())
    expect(result.current.isPlaying).toBe(false)
  })

  it('bumpSpeed clamps within range', () => {
    const { result } = renderHook(() =>
      useTeleprompter({ storageKey: null, initialSpeed: 60 }),
    )
    act(() => result.current.bumpSpeed(100))
    expect(result.current.speed).toBeLessThanOrEqual(300)
    act(() => result.current.bumpSpeed(-10000))
    expect(result.current.speed).toBeGreaterThanOrEqual(10)
  })

  it('setSpeed clamps within range', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    act(() => result.current.setSpeed(9999))
    expect(result.current.speed).toBe(300)
    act(() => result.current.setSpeed(-1))
    expect(result.current.speed).toBe(10)
  })

  it('respects custom speedRange option', () => {
    const { result } = renderHook(() =>
      useTeleprompter({ storageKey: null, initialSpeed: 50, speedRange: { min: 20, max: 80 } }),
    )
    act(() => result.current.setSpeed(200))
    expect(result.current.speed).toBe(80)
    act(() => result.current.setSpeed(0))
    expect(result.current.speed).toBe(20)
  })

  it('bumpFontSize clamps within range', () => {
    const { result } = renderHook(() =>
      useTeleprompter({ storageKey: null, initialFontSize: 56 }),
    )
    act(() => result.current.bumpFontSize(1000))
    expect(result.current.fontSize).toBeLessThanOrEqual(120)
    act(() => result.current.bumpFontSize(-1000))
    expect(result.current.fontSize).toBeGreaterThanOrEqual(20)
  })

  it('toggleMirror flips mirror state', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    expect(result.current.mirror).toBe(false)
    act(() => result.current.toggleMirror())
    expect(result.current.mirror).toBe(true)
    act(() => result.current.toggleMirror())
    expect(result.current.mirror).toBe(false)
  })

  it('reset returns elapsed to 0 and pauses', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    act(() => result.current.play())
    act(() => result.current.reset())
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.elapsedMs).toBe(0)
  })

  it('persists scriptText to localStorage when storageKey is set', () => {
    const { result } = renderHook(() =>
      useTeleprompter({ storageKey: 'tp-test', initialScript: 'first' }),
    )
    expect(localStorage.getItem('tp-test')).toBe('first')
    act(() => result.current.setScriptText('updated'))
    expect(localStorage.getItem('tp-test')).toBe('updated')
  })

  it('does NOT touch localStorage when storageKey is null', () => {
    localStorage.setItem('@datatechsolutions/teleprompter:v1', 'leaked')
    const { result } = renderHook(() =>
      useTeleprompter({ storageKey: null, initialScript: 'fresh' }),
    )
    expect(result.current.scriptText).toBe('fresh')
    // The default key wasn't touched.
    expect(localStorage.getItem('@datatechsolutions/teleprompter:v1')).toBe('leaked')
  })

  it('rehydrates scriptText from localStorage on mount', () => {
    localStorage.setItem('tp-test', 'cached')
    const { result } = renderHook(() =>
      useTeleprompter({ storageKey: 'tp-test', initialScript: 'will be ignored' }),
    )
    expect(result.current.scriptText).toBe('cached')
  })

  it('exposes a scrollerRef ready to attach to a div', () => {
    const { result } = renderHook(() => useTeleprompter({ storageKey: null }))
    expect(result.current.scrollerRef).toBeDefined()
    expect('current' in result.current.scrollerRef).toBe(true)
  })
})
