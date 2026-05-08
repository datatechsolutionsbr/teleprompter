# @datatechsolutions/teleprompter

Drop-in React teleprompter — auto-scroll, mirror, section labels, keyboard
control. Extracted from the [Astrlabe / Datatech pitch deck](https://github.com/kori-app/pitch-deck)
where it powered our YC pitch dry-runs.

```sh
npm install @datatechsolutions/teleprompter
```

## Quick start

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

That's it. You get a fullscreen teleprompter with:

- Auto-scroll loop (10–300 px/sec, adjustable live)
- Section labels via `// comment` syntax
- Click-anywhere play/pause
- Keyboard shortcuts (Space, ↑↓, +/-, M, E, R)
- Mirror mode for behind-glass rigs
- Built-in edit modal (toggle off with `enableEditing={false}`)
- localStorage persistence (configurable storage key)
- Elapsed timer + target duration display

## Tailwind required

This package uses Tailwind utility classes verbatim — there's no CSS file
to import. Make sure your project's Tailwind config scans the package
output so the classes get generated:

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@datatechsolutions/teleprompter/dist/**/*.{js,mjs,cjs}',
  ],
}
```

Without that line, the teleprompter will render unstyled.

## Headless usage

If you want full control over the markup (custom controls, your own theme,
embedded inside an existing layout), use the underlying hook:

```tsx
import { useTeleprompter } from '@datatechsolutions/teleprompter'

function CustomTeleprompter() {
  const { lines, isPlaying, togglePlay, scrollerRef, fontSize, mirror } =
    useTeleprompter({ initialScript: 'Hello world' })

  return (
    <div ref={scrollerRef} onClick={togglePlay} style={{ overflow: 'auto' }}>
      {lines.map((line, i) => (
        <p key={i} style={{ fontSize, transform: mirror ? 'scaleX(-1)' : undefined }}>
          {line.text}
        </p>
      ))}
      <button onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
    </div>
  )
}
```

The hook handles the requestAnimationFrame loop, keyboard shortcuts,
localStorage persistence, and elapsed timer — you decide how to render.

## Props

### `<Teleprompter />`

| Prop                | Type                 | Default                    | Notes |
|---------------------|----------------------|----------------------------|-------|
| `initialScript`     | `string`             | `''`                       | Lines starting with `//` render as section labels. Blank lines = visual gaps. |
| `storageKey`        | `string \| null`     | `@datatechsolutions/teleprompter:v1` | Pass `null` to disable persistence. |
| `initialSpeed`      | `number`             | `60`                       | Scroll speed in px/sec. |
| `initialFontSize`   | `number`             | `32` / `44` / `56`         | Auto-picks based on viewport width. |
| `enableKeyboard`    | `boolean`            | `true`                     | Wire Space / ↑↓ / +/- / M / E / R. |
| `speedRange`        | `{ min, max, step }` | `{ 10, 300, 10 }`          | Bounds for speed bumps. |
| `fontSizeRange`     | `{ min, max, step }` | `{ 20, 120, 4 }`           | Bounds for font size bumps. |
| `targetDuration`    | `string \| null`     | `'01:00'`                  | Shown next to elapsed timer. |
| `enableEditing`     | `boolean`            | `true`                     | Show the in-built edit modal. |
| `controlsAccessory` | `ReactNode`          | —                          | Extra UI in the control bar. |
| `keyboardHint`      | `string \| null`     | (default hint string)      | Override or hide the hint at the bottom. |

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

## License

MIT — see [LICENSE](./LICENSE).
