<div align="center">
  <img src="./assets/wordmark.svg" alt="@datatechsolutions/teleprompter" width="520">

  <p>
    <strong>Drop-in React teleprompter</strong> — voice-paced auto-scroll, mirror, section labels, keyboard control.
  </p>

  <!--
    Hero demo GIF — record a 15-20s loop with QuickTime / OBS showing
    voice pacing + mirror + section labels. Export at 1280×720, 18fps,
    optimize via ezgif.com to ~1.5 MB. Save as ./assets/hero.gif.
  -->
  <img src="./assets/hero.gif" alt="Teleprompter demo" width="720">

  <p>
    <a href="https://www.npmjs.com/package/@datatechsolutions/teleprompter"><img src="https://img.shields.io/npm/v/@datatechsolutions/teleprompter.svg?color=8b5cf6&label=npm&style=flat-square" alt="npm"></a>
    <a href="https://github.com/datatechsolutionsbr/teleprompter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@datatechsolutions/teleprompter.svg?color=8b5cf6&style=flat-square" alt="license"></a>
    <img src="https://img.shields.io/badge/bundle-33%20KB-8b5cf6?style=flat-square" alt="bundle size">
    <img src="https://img.shields.io/badge/zero-runtime%20deps-8b5cf6?style=flat-square" alt="zero deps">
    <img src="https://img.shields.io/badge/react-18%20%7C%2019-8b5cf6?style=flat-square" alt="react 18 or 19">
    <img src="https://img.shields.io/badge/tests-59%20passing-8b5cf6?style=flat-square" alt="tests">
  </p>
</div>

---

## Why I built this

I needed a teleprompter for my YC pitch. Existing options were either
$400 desktop apps, ad-walled freemium sites, or browser tools that
couldn't mirror text for an autocue rig without paying. So I shipped this
in a weekend and used it live.

Open-sourced because every founder doing a demo needs this, and nobody
should have to learn FFmpeg to get text scrolling on screen.

```sh
npm install @datatechsolutions/teleprompter
```

```tsx
import { Teleprompter } from '@datatechsolutions/teleprompter'

const SCRIPT = `// 0–5s · Hook
Hey YC. I'm Natalia, building Astrlabe.

// 5–13s · Credibility
Brazilian. Electrical engineer. Ten years as a data scientist.`

export default function PitchPage() {
  return <Teleprompter initialScript={SCRIPT} targetDuration="01:00" />
}
```

That's the whole thing. Click anywhere to play, click to pause, edit the
script with the pencil button, hit `M` to mirror the text for behind-glass
rigs.

## What you get

- 🎤 **Voice-paced auto-scroll** — mic listens, WPM is measured, scroll
  follows your speaking pace in real time. Pure Web Speech API,
  zero backend
- 🎬 **Manual auto-scroll** — 10–300 px/sec, adjustable live (fallback
  when voice pacing is off or unsupported)
- 🎨 **Section labels** — `// 0–5s · Hook` syntax for free
- 🔄 **Mirror mode** — for autocue rigs that read off a beam-splitter
- ⌨️ **Keyboard shortcuts** — Space, ↑↓, +/-, M, E, R
- 🌗 **Edge fade gradients** — text materialises and dissolves cinema-style
- 📊 **Progress bar + elapsed/target timer** — pace yourself live
- 🎯 **Configurable accent colour** — match your brand in one prop
- 💾 **localStorage persistence** — drafts survive reload (opt-out via prop)
- 📦 **ESM + CJS + types** — works in any modern React app
- ♿ **`prefers-reduced-motion` aware** — respects OS setting automatically
- 🚫 **Zero runtime dependencies** — only React as peer

<details>
<summary><strong>Headless variant — full control over markup</strong></summary>

```tsx
import { useTeleprompter } from '@datatechsolutions/teleprompter'

function MyTeleprompter() {
  const { lines, isPlaying, togglePlay, scrollerRef, fontSize, mirror } =
    useTeleprompter({ initialScript: 'Hello world' })

  return (
    <div ref={scrollerRef} onClick={togglePlay} style={{ overflow: 'auto' }}>
      {lines.map((line, i) => (
        <p key={i} style={{ fontSize, transform: mirror ? 'scaleX(-1)' : undefined }}>
          {line.text}
        </p>
      ))}
    </div>
  )
}
```

The hook handles requestAnimationFrame, keyboard, localStorage, elapsed
timer — you decide how to render.
</details>

<details>
<summary><strong>Voice-paced autoscroll — how it works</strong></summary>

Enable from the component:

```tsx
<Teleprompter initialScript={SCRIPT} voicePaced />
```

…or tune the pacing model:

```tsx
<Teleprompter
  initialScript={SCRIPT}
  voicePaced={{
    lang: 'pt-BR',
    windowMs: 5000,        // sliding window for WPM averaging
    targetWpm: 150,        // pace that maps to baselineSpeed
    baselineSpeed: 60,     // px/sec at targetWpm
  }}
/>
```

Mid-talk, the controls show a live `142 WPM` readout. Click the mic
button (or remove `voicePaced` prop) to fall back to manual speed.

Browser support: Chromium-based browsers (Chrome, Edge, Brave, Arc) on
desktop + Android Chrome. The mic button auto-hides on unsupported
browsers — you don't need to gate the prop yourself.

Standalone hook (use without the component):

```tsx
import { useVoicePaced } from '@datatechsolutions/teleprompter'

const { supported, active, wpm, derivedSpeed, toggle } = useVoicePaced({
  lang: 'en-US',
})
```

Returns a speed in px/sec that follows the speaker's WPM — wire it into
whatever scroll loop you already have.

</details>

## Tailwind required

This package uses Tailwind utility classes. Add the dist path to your
project's `tailwind.config.js` content array so the classes get generated:

```js
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@datatechsolutions/teleprompter/dist/**/*.{js,mjs,cjs}',
  ],
}
```

Without that line, the teleprompter renders unstyled. We picked Tailwind
because the package is small and Tailwind classes mean zero CSS to ship —
your bundle stays lean.

## Props

### `<Teleprompter />`

| Prop                | Type                 | Default                                | Notes |
|---------------------|----------------------|----------------------------------------|-------|
| `initialScript`     | `string`             | `''`                                   | Lines starting with `//` render as section labels. Blank lines = visual gaps. |
| `storageKey`        | `string \| null`     | `@datatechsolutions/teleprompter:v1`   | Pass `null` to disable persistence. |
| `initialSpeed`      | `number`             | `60`                                   | Scroll speed in px/sec. |
| `initialFontSize`   | `number`             | `32` / `44` / `56`                     | Auto-picks based on viewport width. |
| `enableKeyboard`    | `boolean`            | `true`                                 | Wire Space / ↑↓ / +/- / M / E / R. |
| `speedRange`        | `{ min, max, step }` | `{ 10, 300, 10 }`                      | Bounds for speed bumps. |
| `fontSizeRange`     | `{ min, max, step }` | `{ 20, 120, 4 }`                       | Bounds for font size bumps. |
| `targetDuration`    | `string \| null`     | `'01:00'`                              | Shown next to elapsed timer. |
| `voicePaced`        | `boolean \| VoicePacedOptions` | `false`                      | Enable mic-driven autoscroll. See [voice-paced section](#voice-paced-autoscroll--how-it-works). |
| `enableEditing`     | `boolean`            | `true`                                 | Show the in-built edit modal. |
| `controlsAccessory` | `ReactNode`          | —                                      | Extra UI in the control bar. |
| `keyboardHint`      | `string \| null`     | (default hint string)                  | Override or hide the hint at the bottom. |
| `accentColor`       | `string`             | `#8b5cf6` (violet-500)                 | Accent driving controls, marker, progress bar. |
| `showProgressBar`   | `boolean`            | `true`                                 | Thin accent line at viewport bottom. |
| `fadeEdges`         | `boolean`            | `true`                                 | Soft fade gradients top + bottom. |
| `reducedMotion`     | `boolean`            | OS preference                          | Disable marker pulse + smooth easing. |

### `useTeleprompter()`

Returns:

- `lines` — parsed script (comment vs body)
- `scriptText` / `setScriptText`
- `isPlaying` / `play` / `pause` / `togglePlay` / `reset`
- `speed` / `setSpeed` / `bumpSpeed`
- `fontSize` / `setFontSize` / `bumpFontSize`
- `mirror` / `toggleMirror`
- `elapsedMs`
- `scrollerRef` — attach to your scroll container

## Script syntax

```
// Section label — uppercase tracking, smaller font, accent color
Body line one — large body text, what the speaker reads.
Body line two.

// Next section (blank lines above add a gap)
Another section.
```

That's it. No markdown, no escaping. The `//` prefix is matched after
trimming, so leading whitespace is fine.

## Keyboard shortcuts

| Key       | Action                |
|-----------|-----------------------|
| `Space`   | Play / pause          |
| `↑` / `↓` | Speed +10 / -10 px/s  |
| `+` / `-` | Font size +4 / -4 px  |
| `M`       | Toggle mirror         |
| `E`       | Open edit modal       |
| `R`       | Reset to top          |

Shortcuts are disabled while typing in `<input>` / `<textarea>`.

## Brand it

Match your accent in one prop:

```tsx
<Teleprompter accentColor="#10b981" />   {/* emerald */}
<Teleprompter accentColor="#f97316" />   {/* orange */}
<Teleprompter accentColor="#06b6d4" />   {/* cyan */}
```

The colour drives section labels, the centre reader marker, the progress
bar, the active mirror button, and the Save & reset gradient — so the
whole UI shifts in sync.

## FAQ

**Does it work without Tailwind?**
Not yet. v1.0.0 will optionally ship a vanilla CSS sheet — see [#4](https://github.com/datatechsolutionsbr/teleprompter/issues/4).

**Is the AI version free?**
v0.4.0 will add AI script generation + tone shift via a hosted proxy. Free
tier capped. See [RFC #14](https://github.com/datatechsolutionsbr/teleprompter/issues/14).

**Mobile?**
Works today (responsive control bar, viewport-aware font size). Touch
gestures (swipe / pinch) coming in v0.3.0 — [#12](https://github.com/datatechsolutionsbr/teleprompter/issues/12).

**SSR?**
Yes — `parseScript` and the hook short-circuit on `typeof window === 'undefined'`,
so Next.js / Remix work without `'use client'` directives at the import
level. The component itself uses `useEffect` so wrap it in client boundary
if your framework demands it.

## Development

```sh
npm install
npm test           # vitest run — 39 unit tests
npm run build      # tsup → ESM + CJS + types
npm run type-check
```

End-to-end Playwright tests live in `examples/playground/` and run against
a real Vite dev server consuming the package via npm link.

## Contributing

Issues + PRs welcome. The roadmap is public:

- [v0.2.0](https://github.com/datatechsolutionsbr/teleprompter/issues/1) — visual polish (current release)
- [v0.3.0](https://github.com/datatechsolutionsbr/teleprompter/issues/7) — timing intelligence
- [v0.4.0](https://github.com/datatechsolutionsbr/teleprompter/issues/15) — AI Co-pilot

## License

MIT — see [LICENSE](./LICENSE).
