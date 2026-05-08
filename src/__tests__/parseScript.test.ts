import { describe, it, expect } from 'vitest'
import { parseScript } from '../useTeleprompter.js'

describe('parseScript', () => {
  it('returns one line per newline-separated entry', () => {
    expect(parseScript('a\nb\nc')).toEqual([
      { text: 'a', isComment: false },
      { text: 'b', isComment: false },
      { text: 'c', isComment: false },
    ])
  })

  it('marks lines starting with `//` as comments and trims them', () => {
    const out = parseScript('// 0-5s · Hook\nbody line')
    expect(out[0]).toEqual({ text: '// 0-5s · Hook', isComment: true })
    expect(out[1]).toEqual({ text: 'body line', isComment: false })
  })

  it('treats leading whitespace as trim-and-still-recognise comments', () => {
    const out = parseScript('   // padded comment\n   body  ')
    expect(out[0]).toEqual({ text: '// padded comment', isComment: true })
    expect(out[1]).toEqual({ text: 'body', isComment: false })
  })

  it('keeps blank lines as empty entries (visual gaps)', () => {
    const out = parseScript('first\n\n\nlast')
    expect(out).toHaveLength(4)
    expect(out[1]!.text).toBe('')
    expect(out[2]!.text).toBe('')
  })

  it('handles an empty script', () => {
    expect(parseScript('')).toEqual([{ text: '', isComment: false }])
  })

  it('handles a single-line script', () => {
    expect(parseScript('only line')).toEqual([{ text: 'only line', isComment: false }])
  })

  it('does NOT match `//` mid-line (URLs, comments after content)', () => {
    const out = parseScript('visit https://example.com')
    expect(out[0]!.isComment).toBe(false)
  })

  it('preserves Unicode in body lines', () => {
    const out = parseScript('Olá! Vou apresentar à equipe — vamos lá. 🚀')
    expect(out[0]!.text).toBe('Olá! Vou apresentar à equipe — vamos lá. 🚀')
    expect(out[0]!.isComment).toBe(false)
  })

  it('handles tabs and multiple spaces in body', () => {
    const out = parseScript('one\ttwo  three')
    // Trimmed but inner whitespace preserved.
    expect(out[0]!.text).toBe('one\ttwo  three')
  })
})
