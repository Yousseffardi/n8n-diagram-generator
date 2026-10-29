import { useEffect, useMemo, useState } from 'react'
import { generateDiagram } from './webhook.js'

const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || ''

const TABS = [
  { id: 'text', label: 'Text' },
  { id: 'n8n-json', label: 'n8n JSON' },
]

const STYLES = {
  flat_corporate: {
    label: 'Flat Corporate',
    description:
      'Clean professional flat-design infographic. White or light gray background, navy blue primary elements, orange accents, rounded boxes, simple crisp line icons.',
    swatch: 'linear-gradient(145deg, #f3f5f8 42%, #1b3a5f 42% 72%, #e07a2f 72%)',
    recommended: true,
  },
  dark_neon: {
    label: 'Dark Neon',
    description:
      'Modern dark-mode tech diagram. Near-black background (#0B0F1A), glowing neon cyan and magenta accent lines, rounded dark-gray boxes with thin glowing borders, minimal glow line icons, white bold text.',
    swatch: 'linear-gradient(145deg, #0b0f1a 40%, #22d3ee 40% 46%, #0b0f1a 46% 70%, #e879f9 70% 76%, #0b0f1a 76%)',
  },
  minimal_mono: {
    label: 'Minimal Mono',
    description:
      'Ultra-minimal monochrome diagram. Pure white background, black thin outlines, a single accent color (orange), lots of whitespace, simple geometric icons, thin elegant arrows.',
    swatch: 'linear-gradient(145deg, #ffffff 55%, #111111 55% 62%, #ffffff 62% 78%, #e07a2f 78%)',
  },
  hand_drawn: {
    label: 'Hand Drawn',
    description:
      'Whiteboard sketch style. Off-white paper background, hand-drawn marker outlines, slightly imperfect boxes and arrows, doodle icons, blue and orange marker colors, large handwritten-style but clearly legible text.',
    swatch: 'linear-gradient(160deg, #f6f1e6 50%, #2f6fed 50% 58%, #f6f1e6 58% 74%, #e07a2f 74% 82%, #f6f1e6 82%)',
  },
  isometric: {
    label: 'Isometric 3D',
    description:
      'Isometric 3D-style diagram. Light gradient background, small isometric blocks for each step, soft shadows, blue and orange palette, clean isometric icons, arrows flowing between blocks.',
    swatch: 'linear-gradient(135deg, #eef3fb, #7aa2e3 46%, #f4b183 46%, #f7d7be)',
    recommended: true,
  },
  blueprint: {
    label: 'Blueprint',
    description:
      'Technical blueprint style. Deep blue background with white thin grid lines, white line-art boxes and icons, engineering-drawing look, monospace-style text, dashed connectors.',
    swatch:
      'repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 7px), #123a73',
  },
  pastel_soft: {
    label: 'Pastel Soft',
    description:
      'Friendly soft pastel infographic. Cream background, pastel mint, peach and lavender rounded boxes, soft shadows, cute simple line icons, dark gray text for contrast.',
    swatch: 'linear-gradient(135deg, #f7f1e6 30%, #b7e4d4 30% 52%, #f3c7b0 52% 74%, #d9c7ef 74%)',
  },
}

const STYLE_IDS = [
  ...Object.keys(STYLES).filter((id) => STYLES[id].recommended),
  ...Object.keys(STYLES).filter((id) => !STYLES[id].recommended),
]

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export default function App() {
  const [tab, setTab] = useState('text')
  const [description, setDescription] = useState('')
  const [workflowJson, setWorkflowJson] = useState('')
  const [workflowFileName, setWorkflowFileName] = useState('')
  const [jsonDragOver, setJsonDragOver] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [style, setStyle] = useState('flat_corporate')
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('diagram-theme', theme)
    } catch {
      // Ignore storage failures in private browsing.
    }
  }, [theme])

  const canSubmit = useMemo(() => {
    if (status === 'loading') return false
    if (tab === 'text') return description.trim().length > 0
    return workflowJson.trim().length > 0
  }, [tab, description, workflowJson, status])

  const hint = useMemo(() => {
    if (tab === 'text') {
      return description.length === 0
        ? 'Free-form project or workflow description'
        : `${description.length.toLocaleString()} characters`
    }
    if (tab === 'n8n-json') {
      if (workflowJson.length === 0) return 'Paste JSON or drop a .json workflow export'
      const source = workflowFileName ? ` from ${workflowFileName}` : ''
      return `${workflowJson.length.toLocaleString()} characters${source}`
    }
    return 'Paste JSON or drop a .json workflow export'
  }, [tab, description, workflowJson, workflowFileName])

  function parseWorkflowJson(raw) {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('n8n JSON is not valid JSON.')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.nodes)) {
      throw new Error('That JSON does not look like an n8n workflow. It needs a "nodes" array.')
    }
    return parsed
  }

  async function onPickWorkflowFile(nextFile) {
    if (!nextFile) return
    const okType =
      nextFile.type === 'application/json' ||
      nextFile.type === 'text/json' ||
      /\.json$/i.test(nextFile.name)
    if (!okType) {
      setError('Drop an n8n workflow export (.json).')
      return
    }
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError('File is larger than 12 MB.')
      return
    }
    try {
      const text = await nextFile.text()
      parseWorkflowJson(text)
      setWorkflowJson(text)
      setWorkflowFileName(nextFile.name)
      setError('')
    } catch (err) {
      setError(err?.message || 'Could not read that JSON file.')
    }
  }

  function buildPayload() {
    if (tab === 'text') {
      const content = description.trim()
      return { type: 'text', content, description: content, style }
    }

    if (tab === 'n8n-json') {
      const parsed = parseWorkflowJson(workflowJson)
      return { type: 'n8n-json', content: parsed, description: JSON.stringify(parsed), style }
    }

    return null
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return

    if (imageUrl) URL.revokeObjectURL(imageUrl)

    if (!WEBHOOK_URL) {
      setStatus('error')
      setError('Add VITE_WEBHOOK_URL to your local .env file. That file stays on this computer.')
      return
    }

    setStatus('loading')
    setError('')
    setImageUrl('')

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 180000)

    try {
      const payload = buildPayload()
      const blob = await generateDiagram(WEBHOOK_URL, payload, controller.signal)
      const url = URL.createObjectURL(blob)
      setImageUrl(url)
      setStatus('done')
    } catch (err) {
      const aborted = err?.name === 'AbortError'
      setError(
        aborted
          ? 'The webhook took too long (3 minutes). Image generation can take a while; keep the workflow Active and use the production webhook.'
          : err?.message || 'Could not generate the diagram.',
      )
      setStatus('error')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  function onDownload() {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = 'n8n-diagram.png'
    link.click()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-fg">
      <div aria-hidden="true" className="theme-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="theme-noise pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <rect x="9.5" y="1.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <rect x="5.5" y="9.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4 6.5V8a1 1 0 0 0 1 1h2.5M12 6.5V8a1 1 0 0 1-1 1H9" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <div>
              <p className="font-display text-[15px] font-semibold tracking-tight">Diagram</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">n8n workflow images</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-muted sm:block">Text or JSON. Get a PNG back.</p>
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'light'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-sunken py-1 pr-3 pl-1 text-sm font-medium text-soft"
            >
              <span className="relative h-7 w-12 rounded-full bg-canvas">
                <span
                  className={`absolute top-0.5 grid h-6 w-6 place-items-center rounded-full bg-amber text-ink transition-transform ${
                    theme === 'light' ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                >
                  {theme === 'light' ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.4" />
                      <path
                        d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M10.2 2.2A5.6 5.6 0 1 0 13.8 9 4.3 4.3 0 0 1 10.2 2.2Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </span>
              {theme === 'light' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        <main className="mt-8 grid flex-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <form
            onSubmit={onSubmit}
            className="shadow-panel flex flex-col rounded-3xl border border-line bg-panel p-5 sm:p-7"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Writer</p>
            <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Describe the workflow.
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Paste notes or drop an n8n export. We send the type and content to your webhook.
            </p>

            <div className="mt-7 flex rounded-full border border-line bg-sunken p-1" role="tablist" aria-label="Input type">
              {TABS.map((item) => {
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTab(item.id)
                      setError('')
                    }}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
                      active ? 'bg-amber text-ink' : 'text-muted hover:text-fg'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {tab === 'text' ? (
              <>
                <label className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-muted" htmlFor="description">
                  Free description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="A customer-support workflow: webhook intake, classify the ticket, route VIP requests to Slack, and log everything in Airtable…"
                  className="mt-2 min-h-[240px] flex-1 resize-none rounded-2xl border border-line bg-sunken px-4 py-3 text-[15px] leading-relaxed text-fg outline-none placeholder:text-placeholder focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
              </>
            ) : null}

            {tab === 'n8n-json' ? (
              <>
                <label
                  className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-5 text-center transition ${
                    jsonDragOver ? 'border-accent bg-accent/10' : 'border-line-strong bg-sunken hover:border-accent/50'
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setJsonDragOver(true)
                  }}
                  onDragLeave={() => setJsonDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setJsonDragOver(false)
                    onPickWorkflowFile(event.dataTransfer.files?.[0])
                  }}
                >
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => onPickWorkflowFile(event.target.files?.[0])}
                  />
                  <p className="text-sm font-medium text-soft">
                    {workflowFileName ? workflowFileName : 'Drop a workflow .json file'}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    n8n export like diagram generator.json · click or drop
                  </p>
                </label>

                <label className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted" htmlFor="workflow-json">
                  Or paste JSON
                </label>
                <textarea
                  id="workflow-json"
                  value={workflowJson}
                  onChange={(event) => {
                    setWorkflowJson(event.target.value)
                    setWorkflowFileName('')
                  }}
                  spellCheck={false}
                  placeholder='{ "name": "My workflow", "nodes": [ ... ], "connections": { ... } }'
                  className="mt-2 min-h-[200px] flex-1 resize-none rounded-2xl border border-line bg-sunken px-4 py-3 font-mono text-[12px] leading-relaxed text-soft outline-none placeholder:text-placeholder focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
              </>
            ) : null}

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted" id="diagram-style-label">
                Diagram style
              </p>
              <div
                className="mt-2 grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-labelledby="diagram-style-label"
              >
                {STYLE_IDS.map((id) => {
                  const item = STYLES[id]
                  const selected = style === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setStyle(id)}
                      className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-sunken hover:border-accent/50'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-black/20"
                        style={{ background: item.swatch }}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-fg">{item.label}</span>
                          {item.recommended ? (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                              Recommended
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-faint">{item.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-faint">
              <span>{hint}</span>
              <span>
                type: {tab} · style: {style}
              </span>
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-amber px-5 py-3 text-sm font-semibold text-ink transition hover:bg-amber-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'loading' ? (
                <>
                  <span className="spin inline-block h-4 w-4 rounded-full border-2 border-ink/20 border-t-ink" />
                  Generating diagram…
                </>
              ) : (
                'Generate diagram'
              )}
            </button>
          </form>

          <section className="shadow-panel flex flex-col rounded-3xl border border-line bg-panel p-5 sm:p-7 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Stage</p>
                <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">Diagram output</h2>
              </div>
              <button
                type="button"
                onClick={onDownload}
                disabled={!imageUrl}
                className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-soft transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
              >
                Download PNG
              </button>
            </div>

            <div className="mt-5 flex h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-sunken">
              {status === 'loading' ? (
                <div className="px-8 text-center">
                  <span className="spin mx-auto mb-4 block h-8 w-8 rounded-full border-2 border-amber/20 border-t-amber" />
                  <p className="font-display text-lg">Waiting on n8n</p>
                  <p className="mt-1 text-sm text-faint">Extract, prompt, then generate image.</p>
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt="Generated workflow diagram" className="fade-in h-full w-full object-contain p-4" />
              ) : (
                <div className="px-8 text-center text-faint">
                  <p className="font-display text-xl text-soft">No image yet</p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed">
                    The generated PNG will land here. Make sure n8n responds with the file from Respond to Webhook.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
