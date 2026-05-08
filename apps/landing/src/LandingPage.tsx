/**
 * Standalone landing page for the @datatechsolutions/teleprompter package.
 * Lives in apps/landing/ — independent of any host site (no shared
 * routing, styles, or branding).
 *
 * Live preview strategy:
 *   - Renders the actual npm-installed Teleprompter inline via the new
 *     `fullscreen={false}` prop so it fits a styled box on the page.
 *   - "Open fullscreen" button replaces the inline embed with a real
 *     fullscreen overlay, exited with Escape or the close button.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Teleprompter } from '@datatechsolutions/teleprompter'

const SAMPLE_SCRIPT = `// 0–6s · Hook
This is your script. Click play, click anywhere again to pause.

// 6–14s · How it works
Lines starting with two slashes become section labels.
Body lines render as the large readable text — that's it.

// 14–22s · Try it
Press M to mirror, E to edit, R to reset.
The whole thing is one React component — MIT licensed, on npm right now.`

const INSTALL_CMD = 'npm install @datatechsolutions/teleprompter'

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Auto-scroll engine',
    body: '10–300 px/sec, adjustable live with arrows or buttons. Smooth ease-out on size changes.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h13.5m0 0L12 7.5m4.5 4.5L12 16.5" />
      </svg>
    ),
  },
  {
    title: 'Section labels',
    body: 'Comments like `// 0–5s · Hook` render as uppercase tracking, accent-coloured. Scriptable, scannable.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      </svg>
    ),
  },
  {
    title: 'Mirror mode',
    body: 'For autocue rigs that read off a beam-splitter glass. One keystroke (M) flips the text horizontally.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: 'Keyboard shortcuts',
    body: 'Space play/pause, ↑↓ speed, +/- font, M mirror, E edit, R reset. All disable-able via prop.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 19.5 19.5h-15a2.25 2.25 0 0 1-2.25-2.25V6.75ZM6.75 9.75h.008v.008H6.75V9.75Zm0 3.75h.008v.008H6.75v-.008ZM10.5 9.75h.008v.008H10.5V9.75Zm0 3.75h.008v.008H10.5v-.008ZM14.25 9.75h.008v.008h-.008V9.75Zm0 3.75h.008v.008h-.008v-.008Zm-7.5 3.75h10.5" />
      </svg>
    ),
  },
  {
    title: 'Brand it',
    body: 'One prop (`accentColor`) drives the whole accent system — controls, marker, progress bar, save button.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
      </svg>
    ),
  },
  {
    title: 'Zero runtime deps',
    body: 'React 18+ peer only. ESM + CJS + types bundled. Drop-in friendly. ~20 KB minified.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
]

const ACCENTS = [
  { name: 'violet', value: '#8b5cf6' },
  { name: 'emerald', value: '#10b981' },
  { name: 'orange', value: '#f97316' },
  { name: 'cyan', value: '#06b6d4' },
  { name: 'rose', value: '#f43f5e' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* noop */
        }
      }}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-white/10"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  )
}

export function LandingPage() {
  const [accent, setAccent] = useState<string>(ACCENTS[0]!.value)
  const [overlayOpen, setOverlayOpen] = useState(false)

  // Esc closes the fullscreen overlay.
  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlayOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0a0a0f] text-white">
      {/* Decorative gradient orb */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[600px] opacity-40"
        style={{
          background: `radial-gradient(900px circle at 50% 0%, ${accent}33, transparent 70%)`,
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Logo accent={accent} size={32} />
          <span className="text-white">teleprompter</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a
            href="https://github.com/kori-app/teleprompter"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold hover:bg-white/10"
          >
            GitHub ↗
          </a>
          <a
            href="https://www.npmjs.com/package/@datatechsolutions/teleprompter"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold hover:bg-white/10"
          >
            npm ↗
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-12 text-center sm:pt-16">
        <div
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-black/80 ring-1 ring-white/10"
          style={{ boxShadow: `0 0 40px ${accent}66` }}
        >
          <Logo accent={accent} size={48} />
        </div>

        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          The teleprompter <br className="hidden sm:block" />
          <span style={{ color: accent }}>your scripts deserve.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-gray-400">
          A drop-in React teleprompter with auto-scroll, section labels, mirror mode, and keyboard
          control. Beautiful, free, MIT licensed.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <code className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-5 py-3 font-mono text-sm">
            <span className="text-gray-500">$</span>
            <span className="text-white">{INSTALL_CMD}</span>
            <CopyButton text={INSTALL_CMD} />
          </code>
        </div>

        <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-2 text-xs text-gray-500">
          <span className="uppercase tracking-widest">accent:</span>
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              aria-label={a.name}
              className="h-7 w-7 rounded-full border border-white/10 transition-all hover:border-white/30"
              style={{
                background: a.value,
                boxShadow: accent === a.value ? `0 0 0 3px ${a.value}55, 0 0 12px ${a.value}` : undefined,
              }}
            />
          ))}
        </div>
      </section>

      {/* Live preview — auto-loaded, embedded in a styled frame */}
      <section className="relative z-10 mx-auto mb-20 max-w-6xl px-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            live preview · running the actual npm package
          </div>
          <button
            onClick={() => setOverlayOpen(true)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
          >
            Open fullscreen ↗
          </button>
        </div>
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
          style={{ height: 'min(70vh, 560px)' }}
        >
          <Teleprompter
            initialScript={SAMPLE_SCRIPT}
            storageKey={null}
            targetDuration="00:22"
            accentColor={accent}
            keyboardHint={null}
            fullscreen={false}
          />
        </div>
        <p className="mt-3 text-center text-xs text-gray-500">
          Click anywhere to play. Same component you'd ship in your app.
        </p>
      </section>

      {/* Fullscreen overlay */}
      {overlayOpen && (
        <div className="fixed inset-0 z-50 bg-black">
          <Teleprompter
            initialScript={SAMPLE_SCRIPT}
            storageKey={null}
            targetDuration="00:22"
            accentColor={accent}
          />
          <button
            onClick={() => setOverlayOpen(false)}
            aria-label="Close fullscreen preview"
            className="fixed right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-gray-300 backdrop-blur-md hover:bg-black/90 hover:text-white"
            title="Close (Esc)"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Features grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a teleprompter should be.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-400">
            Built once, shipped publicly with types, zero runtime deps, and a real roadmap.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${accent}22`, color: accent }}
              >
                {f.icon}
              </div>
              <h3 className="text-base font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Code example */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">One component. One script. Done.</h2>
            <p className="mt-4 text-gray-400">
              No setup. No config. Tailwind-friendly out of the box. Works in any modern React app —
              Next.js, Remix, Vite, plain CRA.
            </p>
            <p className="mt-4 text-gray-400">
              Need full control? Use the underlying{' '}
              <code className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm">useTeleprompter()</code>{' '}
              hook and bring your own UI.
            </p>
          </div>
          <pre
            className="overflow-x-auto rounded-2xl border border-white/10 bg-black/60 p-6 text-xs leading-relaxed"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
          >
            <code className="text-gray-300">
              <span className="text-pink-400">import</span>
              {` { Teleprompter } `}
              <span className="text-pink-400">from</span>
              <span className="text-emerald-300">{` '@datatechsolutions/teleprompter'`}</span>
              {`\n\n`}
              <span className="text-pink-400">const</span>
              <span className="text-blue-300">{` SCRIPT `}</span>={' '}
              <span className="text-emerald-300">{`\``}</span>
              {`\n`}
              <span className="text-emerald-300">{`// 0–5s · Hook`}</span>
              {`\n`}
              <span className="text-emerald-300">{`Hello from your script.`}</span>
              {`\n\n`}
              <span className="text-emerald-300">{`// 5–13s · Body`}</span>
              {`\n`}
              <span className="text-emerald-300">{`Auto-scrolls, mirrors, keyboard-driven.`}</span>
              <span className="text-emerald-300">{`\``}</span>
              {`\n\n`}
              <span className="text-pink-400">export default function</span>
              <span className="text-blue-300">{` Page`}</span>() {`{`}
              {`\n  `}
              <span className="text-pink-400">return</span> {`<`}
              <span className="text-orange-300">Teleprompter</span>{' '}
              <span className="text-blue-300">initialScript</span>={'{'}SCRIPT{'}'}{' '}
              <span className="text-blue-300">targetDuration</span>=
              <span className="text-emerald-300">"01:00"</span> {`/>`}
              {`\n}`}
            </code>
          </pre>
        </div>
      </section>

      {/* Roadmap teaser */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-10">
          <h2 className="text-3xl font-bold tracking-tight">What's coming next.</h2>
          <p className="mt-3 max-w-2xl text-gray-400">
            Public roadmap. Vote with thumbs-up on{' '}
            <a
              href="https://github.com/kori-app/teleprompter/issues"
              className="underline hover:text-white"
            >
              GitHub issues
            </a>
            .
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
                v0.3.0 · next
              </div>
              <h3 className="mt-2 font-bold">Timing intelligence</h3>
              <p className="mt-2 text-sm text-gray-400">
                Per-section pacing indicator (you're 3s ahead / 2s behind). Word count + estimated
                duration in the editor. Touch gestures.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
                v0.4.0 · soon
              </div>
              <h3 className="mt-2 font-bold">AI Co-pilot</h3>
              <p className="mt-2 text-sm text-gray-400">
                Generate scripts from a prompt. Tone shift on selection. Auto-section detection.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
                v0.5.0 · later
              </div>
              <h3 className="mt-2 font-bold">Practice mode</h3>
              <p className="mt-2 text-sm text-gray-400">
                Mic-driven scroll matching your reading pace. Recording integration. Voice-coaching
                feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-10 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-6 text-xs">
          <a href="https://github.com/kori-app/teleprompter" className="hover:text-white">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@datatechsolutions/teleprompter" className="hover:text-white">
            npm
          </a>
          <a href="https://github.com/kori-app/teleprompter/issues" className="hover:text-white">
            Issues
          </a>
          <a href="https://github.com/kori-app/teleprompter/blob/main/LICENSE" className="hover:text-white">
            MIT License
          </a>
        </div>
      </footer>
    </div>
  )
}

function Logo({ accent, size }: { accent: string; size: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={`logo-accent-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={accent} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="56" fill="#0a0a0a" />
      <rect x="44" y="60" width="168" height="10" rx="5" fill="#fff" fillOpacity="0.35" />
      <rect x="44" y="84" width="120" height="10" rx="5" fill="#fff" fillOpacity="0.55" />
      <rect x="44" y="108" width="148" height="10" rx="5" fill="#fff" fillOpacity="0.85" />
      <rect x="44" y="160" width="132" height="10" rx="5" fill="#fff" fillOpacity="0.85" />
      <rect x="44" y="184" width="168" height="10" rx="5" fill="#fff" fillOpacity="0.55" />
      <rect x="44" y="208" width="100" height="10" rx="5" fill="#fff" fillOpacity="0.35" />
      <line
        x1="36"
        y1="134"
        x2="220"
        y2="134"
        stroke={`url(#logo-accent-${size})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="36" cy="134" r="6" fill={`url(#logo-accent-${size})`} />
      <circle cx="220" cy="134" r="6" fill={`url(#logo-accent-${size})`} />
    </svg>
  )
}
