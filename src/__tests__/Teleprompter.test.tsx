import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Teleprompter } from '../Teleprompter.js'

const SCRIPT = `// 0–5s · Hook
Body line one.
Body line two.

// 5–10s · Section two
Body line three.`

describe('<Teleprompter />', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders body lines and uppercased section labels', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    expect(screen.getByText('Body line one.')).toBeInTheDocument()
    // Section labels are uppercased via Tailwind `uppercase` — assert the
    // raw text after the `//` strip, which is then visually uppercased by CSS.
    expect(screen.getByText('0–5s · Hook')).toBeInTheDocument()
    expect(screen.getByText('5–10s · Section two')).toBeInTheDocument()
  })

  it('shows the Play button initially', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    expect(screen.getByRole('button', { name: /^Play$/ })).toBeInTheDocument()
  })

  it('flips Play → Pause when clicked', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    fireEvent.click(screen.getByRole('button', { name: /^Play$/ }))
    expect(screen.getByRole('button', { name: /^Pause$/ })).toBeInTheDocument()
  })

  it('opens the edit modal via the pencil button', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Edit script' })).toBeInTheDocument()
  })

  it('closes the edit modal on Cancel', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Edit script' })).not.toBeInTheDocument()
  })

  it('hides editing UI when enableEditing=false', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} enableEditing={false} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('renders the elapsed timer and target duration', () => {
    render(
      <Teleprompter initialScript={SCRIPT} storageKey={null} targetDuration="00:30" />,
    )
    expect(screen.getByText(/00:00/)).toBeInTheDocument()
    expect(screen.getByText(/00:30/)).toBeInTheDocument()
  })

  it('hides target duration when targetDuration={null}', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} targetDuration={null} />)
    expect(screen.queryByText(/\/ \d{2}:\d{2}/)).not.toBeInTheDocument()
  })

  it('hides keyboard hint when keyboardHint={null}', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} keyboardHint={null} />)
    expect(screen.queryByText(/Space play/)).not.toBeInTheDocument()
  })

  it('renders a custom keyboardHint when provided', () => {
    render(
      <Teleprompter
        initialScript={SCRIPT}
        storageKey={null}
        keyboardHint="custom hint here"
      />,
    )
    expect(screen.getByText('custom hint here')).toBeInTheDocument()
  })

  it('renders fade gradients by default', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    expect(screen.getByTestId('teleprompter-fade-top')).toBeInTheDocument()
    expect(screen.getByTestId('teleprompter-fade-bottom')).toBeInTheDocument()
  })

  it('hides fade gradients when fadeEdges={false}', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} fadeEdges={false} />)
    expect(screen.queryByTestId('teleprompter-fade-top')).not.toBeInTheDocument()
    expect(screen.queryByTestId('teleprompter-fade-bottom')).not.toBeInTheDocument()
  })

  it('renders the progress bar by default', () => {
    render(<Teleprompter initialScript={SCRIPT} storageKey={null} />)
    expect(screen.getByTestId('teleprompter-progress-track')).toBeInTheDocument()
    expect(screen.getByTestId('teleprompter-progress-bar')).toBeInTheDocument()
  })

  it('hides the progress bar when showProgressBar={false}', () => {
    render(
      <Teleprompter initialScript={SCRIPT} storageKey={null} showProgressBar={false} />,
    )
    expect(screen.queryByTestId('teleprompter-progress-track')).not.toBeInTheDocument()
  })

  it('renders an accessory passed via controlsAccessory', () => {
    render(
      <Teleprompter
        initialScript={SCRIPT}
        storageKey={null}
        controlsAccessory={<button>my-accessory</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'my-accessory' })).toBeInTheDocument()
  })

  it('applies fontColor to body lines', () => {
    const { container } = render(
      <Teleprompter initialScript={SCRIPT} storageKey={null} fontColor="#a7f3d0" />,
    )
    const body = Array.from(container.querySelectorAll('p')).find(
      (p) => p.textContent === 'Body line one.',
    )
    expect(body).toBeDefined()
    expect((body as HTMLElement).style.color).toBe('rgb(167, 243, 208)')
  })

  it('applies fontFamily to body lines', () => {
    const { container } = render(
      <Teleprompter initialScript={SCRIPT} storageKey={null} fontFamily="ui-serif, Georgia" />,
    )
    const body = Array.from(container.querySelectorAll('p')).find(
      (p) => p.textContent === 'Body line one.',
    )
    expect((body as HTMLElement).style.fontFamily).toContain('ui-serif')
  })

  it('applies backgroundColor to the wrapper and fade gradients', () => {
    const { container } = render(
      <Teleprompter initialScript={SCRIPT} storageKey={null} backgroundColor="#1e1b4b" />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.background).toContain('rgb(30, 27, 75)')
    const fadeTop = container.querySelector('[data-testid="teleprompter-fade-top"]') as HTMLElement
    expect(fadeTop.style.background).toContain('rgb(30, 27, 75)')
  })

  it('Save & reset writes editor buffer back to scriptText', () => {
    render(<Teleprompter initialScript="original" storageKey={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '// new\nmodified body' } })
    fireEvent.click(screen.getByRole('button', { name: /Save & reset/ }))
    expect(screen.getByText('modified body')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Edit script' })).not.toBeInTheDocument()
  })
})
