import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BatteryCharging,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  GitCompareArrows,
  House,
  Map,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Route,
  Share2,
  ShieldCheck,
  SkipForward,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import CityMap from './CityMap'
import type { Asset } from './CityMap'
import { districts, hospitals, population, roads, stations } from './simulation/city'
import {
  actionCosts,
  actionNames,
  BUDGET,
  eligibleTargets,
  HORIZON,
  simulate,
  spent,
  timeLabel,
} from './simulation/engine'
import { eventTypes } from './simulation/events'
import { getScenario, scenarios } from './simulation/scenarios'
import { readUrl, shareUrl, validateFile } from './simulation/sharing'
import type { ActionKind, Intervention, ScenarioFile, Snapshot } from './simulation/types'
const fmt = (n: number) => n.toLocaleString('en-US')
const initial = readUrl(window.location.search)
const icons = { restore: Zap, reroute: Route, shelter: House }
const descriptions = {
  restore: 'Repair a failed station and stop the cascade.',
  reroute: 'Clear a priority corridor. Ease hospital access.',
  shelter: 'Give displaced residents a safe place to go.',
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      aria-label={title}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
function TrendChart({
  history,
  baseline,
  small = false,
}: {
  history: Snapshot[]
  baseline?: Snapshot[]
  small?: boolean
}) {
  const width = 600,
    height = small ? 115 : 230
  const path = (data: Snapshot[]) =>
    data
      .map(
        (s, i) =>
          `${i ? 'H' : 'M'}${32 + (s.tick / HORIZON) * 548}${i ? 'V' : ','}${12 + ((100 - s.metrics.power) / 100) * (height - 42)}`,
      )
      .join(' ')
  return (
    <svg
      className={small ? 'trend small-trend' : 'trend'}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Grid power coverage over time. Your response: ${history.at(-1)!.metrics.power}% at ${timeLabel(history.at(-1)!.tick)}${baseline ? `; without intervention: ${baseline.at(-1)!.metrics.power}%` : ''}.`}
    >
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <path
            d={`M32 ${12 + ((100 - v) / 100) * (height - 42)}H580`}
            stroke="#27333c"
            strokeDasharray="3 5"
          />
          <text x="4" y={16 + ((100 - v) / 100) * (height - 42)}>
            {v}
          </text>
        </g>
      ))}
      {baseline && (
        <path
          d={path(baseline)}
          stroke="#e89173"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5 5"
        />
      )}
      <path
        d={`${path(history)} L${32 + (history.at(-1)!.tick / HORIZON) * 548},${height - 30} L32,${height - 30}Z`}
        fill="#bcdf77"
        opacity=".07"
      />
      <path
        d={path(history)}
        stroke="#c5ee8a"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx={32 + (history.at(-1)!.tick / HORIZON) * 548}
        cy={12 + ((100 - history.at(-1)!.metrics.power) / 100) * (height - 42)}
        r="3"
        fill="#c5ee8a"
      />
      {[0, 12, 24, 36].map((t) => (
        <text
          key={t}
          x={32 + (t / HORIZON) * 548}
          y={height - 5}
          textAnchor={t === 0 ? 'start' : t === 36 ? 'end' : 'middle'}
        >
          {timeLabel(t)}
        </text>
      ))}
    </svg>
  )
}
function AssetDetails({ asset, state }: { asset: Asset; state: Snapshot }) {
  let name: string, status: string, detail: string, tone: string
  if (asset.type === 'station') {
    const s = stations.find((s) => s.id === asset.id)!,
      data = state.stations[s.id]
    name = s.name
    status = data.online ? 'ONLINE' : 'OFFLINE'
    tone = data.online ? 'success' : 'danger'
    detail = data.online
      ? `${Math.round(data.stress)} load stress · ${data.reinforced ? 'Reinforced after repair' : 'Supplying local districts'}`
      : `${fmt(districts.filter((d) => d.station === s.id).reduce((n, d) => n + d.population, 0))} residents without grid power`
  } else if (asset.type === 'district') {
    const d = districts.find((d) => d.id === asset.id)!,
      data = state.districts[d.id]
    name = d.name
    status = data.powered ? 'CONNECTED' : 'OUTAGE'
    tone = data.powered ? 'success' : 'danger'
    detail = `${fmt(data.displaced)} displaced · ${fmt(data.sheltered)} sheltered`
  } else if (asset.type === 'road') {
    const r = roads.find((r) => r.id === asset.id)!,
      data = state.roads[r.id]
    name = r.name
    status = data.rerouted ? 'REROUTED' : `${data.congestion}% CONGESTION`
    tone = data.congestion > 65 ? 'warning' : 'success'
    detail = data.rerouted
      ? 'Priority corridor active · 45-point congestion reduction'
      : 'Select reroute traffic to create a priority corridor.'
  } else {
    const h = hospitals.find((h) => h.id === asset.id)!,
      data = state.hospitals[h.id]
    name = h.name
    status = data.powered ? 'OPERATING' : 'POWER LOST'
    tone = data.powered ? 'success' : 'danger'
    detail = `${data.pressure}% capacity pressure · ${data.backup}% backup reserve`
  }
  return (
    <div className="asset-details">
      <div className="asset-icon">
        {asset.type === 'station' ? (
          <Zap size={18} />
        ) : asset.type === 'hospital' ? (
          <Activity size={18} />
        ) : asset.type === 'road' ? (
          <Route size={18} />
        ) : (
          <House size={18} />
        )}
      </div>
      <div>
        <div className="asset-title">
          {name} <span className={`text-${tone}`}>{status}</span>
        </div>
        <p>{detail}</p>
      </div>
      <span className="asset-type">{asset.type}</span>
    </div>
  )
}
export default function App() {
  const [scenarioId, setScenarioId] = useState(initial.config.scenario)
  const [seed, setSeed] = useState(initial.config.seed)
  const [actions, setActions] = useState<Intervention[]>(initial.config.actions)
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [view, setView] = useState<'control' | 'compare'>('control')
  const [layer, setLayer] = useState<'all' | 'power' | 'mobility'>('all')
  const [selected, setSelected] = useState<Asset>({ type: 'station', id: 'west' })
  const [modal, setModal] = useState<'guide' | 'share' | ActionKind | null>(null)
  const [target, setTarget] = useState('')
  const [notice, setNotice] = useState(initial.warning)
  const [importing, setImporting] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
  const scenario = getScenario(scenarioId)
  const history = useMemo(() => simulate(scenario, seed, actions), [scenario, seed, actions])
  const baseline = useMemo(() => simulate(scenario, seed), [scenario, seed])
  const state = history[tick]
  const credits = BUDGET - spent(actions)
  const replayLocked = actions.some((a) => a.tick - 1 > tick)
  const config: ScenarioFile = { version: 1, scenario: scenarioId, seed, actions }
  const sharedUrl = shareUrl(config, window.location.href)
  useEffect(() => {
    if (!running || tick >= HORIZON) return
    const timer = window.setTimeout(() => {
      setTick((t) => t + 1)
      if (tick + 1 >= HORIZON) setRunning(false)
    }, 1500 / speed)
    return () => window.clearTimeout(timer)
  }, [running, tick, speed])
  const seek = (value: number) => {
    setRunning(false)
    setTick(value)
  }
  const reset = () => {
    setRunning(false)
    setTick(0)
    setActions([])
    setNotice('Simulation reset. All response resources restored.')
    window.history.replaceState(null, '', window.location.pathname)
  }
  const load = (data: ScenarioFile) => {
    setRunning(false)
    setTick(0)
    setActions(data.actions)
    setScenarioId(data.scenario)
    setSeed(data.seed)
    setSelected({ type: 'station', id: getScenario(data.scenario).initialFailures[0] })
    setView('control')
  }
  const beginAction = (kind: ActionKind) => {
    setRunning(false)
    const targets = eligibleTargets(kind, state, actions)
    const preferred =
      selected.type === 'hospital' && kind === 'shelter'
        ? hospitals.find((h) => h.id === selected.id)!.district
        : selected.id
    setTarget(targets.some((t) => t.id === preferred) ? preferred : (targets[0]?.id ?? ''))
    setModal(kind)
  }
  const dispatch = (kind: ActionKind) => {
    if (
      credits < actionCosts[kind] ||
      replayLocked ||
      tick >= HORIZON - (kind === 'restore' ? 1 : 0) ||
      !eligibleTargets(kind, state, actions).some((t) => t.id === target)
    )
      return
    setActions((prev) => {
      let index = prev.length + 1
      while (prev.some((a) => a.id === `a-${index}`)) index++
      return [...prev, { id: `a-${index}`, kind, target, tick: tick + 1 }]
    })
    setModal(null)
    setNotice(
      `${actionNames[kind]} dispatched. ${kind === 'restore' ? 'Repair completes' : 'Response activates'} at ${timeLabel(tick + (kind === 'restore' ? 2 : 1))}. Advance the simulation to see the effect.`,
    )
  }
  const exportFile = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `crisisos-${scenarioId}-${seed}.json`
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Scenario exported, including seed and all response decisions.')
  }
  const importFile = async (file?: File) => {
    if (!file) return
    setRunning(false)
    setImporting(true)
    try {
      if (file.size > 20000) throw new Error('Scenario files must be smaller than 20 KB.')
      const data = validateFile(JSON.parse(await file.text()))
      load(data)
      setNotice(
        `Loaded ${getScenario(data.scenario).name} with ${data.actions.length} saved interventions.`,
      )
    } catch (e) {
      setNotice(`Import failed: ${(e as Error).message}`)
    } finally {
      setImporting(false)
      if (upload.current) upload.current.value = ''
    }
  }
  const actionModal =
    modal === 'restore' || modal === 'reroute' || modal === 'shelter' ? modal : null
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to control room
      </a>
      <aside className="sidebar" aria-label="Primary navigation">
        <a className="brand-mark" href="#main" aria-label="CrisisOS home">
          <Zap size={25} fill="currentColor" />
        </a>
        <div className="rail-line" />
        <button
          className={`rail-button ${view === 'control' ? 'active' : ''}`}
          aria-label="Control room"
          title="Control room"
          onClick={() => setView('control')}
        >
          <Map size={21} />
          <span>Control</span>
        </button>
        <button
          className={`rail-button ${view === 'compare' ? 'active' : ''}`}
          aria-label="Compare outcomes"
          title="Compare outcomes"
          onClick={() => setView('compare')}
        >
          <GitCompareArrows size={21} />
          <span>Compare</span>
        </button>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="Simulation guide"
            title="Simulation guide"
            onClick={() => {
              setRunning(false)
              setModal('guide')
            }}
          >
            <CircleHelp size={21} />
            <span>Guide</span>
          </button>
          <span className="version">V 1.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="wordmark">
            CRISIS<span>OS</span>
            <span className="wordmark-divider" />
            <span className="topbar-caption">CITY RESPONSE CONSOLE</span>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span className="status-dot" /> Local simulation
            </span>
            <button
              className="button subtle"
              onClick={() => {
                setRunning(false)
                setModal('share')
              }}
            >
              <Share2 size={15} />
              <span>Share scenario</span>
            </button>
          </div>
        </header>
        <main id="main">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-cross">+</span> OPERATIONS / PORT MERIDIAN
              </div>
              <h1>
                {view === 'control' ? 'A city on the edge.' : 'Every decision leaves a mark.'}
              </h1>
              <p>
                {view === 'control'
                  ? 'One failure. A thousand connections. Take control of what happens next.'
                  : 'The same city. The same seed. Two very different possibilities.'}
              </p>
            </div>
            <div className="incident-tag">
              <span className="status-dot amber" /> FICTIONAL EXERCISE <span>NO. 004</span>
            </div>
          </section>
          {notice && (
            <div className="notice" role="status">
              <Radio size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <section className="scenario-toolbar" aria-label="Scenario configuration">
            <div className="scenario-picker">
              <span className="toolbar-label">SCENARIO</span>
              <select
                aria-label="Scenario"
                value={scenarioId}
                onChange={(e) => {
                  const s = getScenario(e.target.value)
                  load({ version: 1, scenario: s.id, seed: s.seed, actions: [] })
                  setNotice('New scenario loaded. Timeline and response plan reset.')
                }}
              >
                {scenarios.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    0{i + 1} / {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="seed-picker">
              <label htmlFor="seed">SEED</label>
              <input
                id="seed"
                type="number"
                min="0"
                max="4294967295"
                key={seed}
                defaultValue={seed}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (
                    e.target.value.trim() &&
                    Number.isInteger(value) &&
                    value >= 0 &&
                    value <= 4294967295
                  ) {
                    if (value !== seed) {
                      load({ ...config, seed: value, actions: [] })
                      setNotice('Seed changed. Response plan and timeline reset.')
                    }
                  } else {
                    e.target.value = String(seed)
                    setNotice('Enter a whole seed from 0 to 4294967295.')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
            </div>
            <span className="toolbar-note">
              <ShieldCheck size={14} /> Deterministic by design
            </span>
            <button
              className="text-button import-button"
              onClick={() => upload.current?.click()}
              disabled={importing}
            >
              <Upload size={15} />
              {importing ? 'Loading…' : 'Import JSON'}
            </button>
            <input
              ref={upload}
              type="file"
              accept=".json,application/json"
              aria-label="Import scenario file"
              className="sr-only"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </section>
          <section className="metrics" aria-label="Live city status">
            <Metric
              icon={<Zap size={17} />}
              label="GRID COVERAGE"
              value={state.metrics.power}
              suffix="%"
              detail={`${stations.filter((s) => state.stations[s.id].online).length} of 4 substations online`}
              tone={state.metrics.power < 80 ? 'warning' : 'success'}
              bars={history.slice(0, tick + 1).map((s) => s.metrics.power)}
            />
            <Metric
              icon={<Users size={17} />}
              label="RESIDENTS AFFECTED"
              value={fmt(state.metrics.affected)}
              detail={`of ${fmt(population)} city residents`}
              tone={state.metrics.affected ? 'danger' : 'success'}
              bars={history.slice(0, tick + 1).map((s) => (s.metrics.affected / population) * 100)}
            />
            <Metric
              icon={<Activity size={17} />}
              label="HOSPITAL PRESSURE"
              value={state.metrics.pressure}
              suffix="%"
              detail="Average capacity pressure"
              tone={state.metrics.pressure > 70 ? 'danger' : 'warning'}
              bars={history.slice(0, tick + 1).map((s) => s.metrics.pressure)}
            />
            <Metric
              icon={<Route size={17} />}
              label="TRAVEL DELAY"
              value={`+${state.metrics.delay}`}
              suffix="min"
              detail="Estimated network average"
              tone={state.metrics.delay > 25 ? 'danger' : 'muted'}
              bars={history.slice(0, tick + 1).map((s) => s.metrics.delay * 2.5)}
            />
          </section>
          {view === 'control' ? (
            <div className="control-grid">
              <section className="panel map-panel">
                <div className="panel-head">
                  <h2>
                    <span className="status-dot amber" /> City overview{' '}
                    <span className="small-tag">LIVE MODEL</span>
                  </h2>
                  <div className="segmented" role="group" aria-label="Map layers">
                    {(['all', 'power', 'mobility'] as const).map((l) => (
                      <button
                        key={l}
                        aria-pressed={layer === l}
                        className={layer === l ? 'selected' : ''}
                        onClick={() => setLayer(l)}
                      >
                        {l === 'all' ? 'All layers' : l === 'power' ? 'Power' : 'Mobility'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="map-wrap">
                  <div className="map-caption">
                    <span>PORT MERIDIAN</span>
                    <span>
                      SECTOR 07 · ESTUARY REGION <i> / fictional</i>
                    </span>
                  </div>
                  <CityMap state={state} selected={selected} onSelect={setSelected} layer={layer} />
                  <div className="map-legend">
                    <span>
                      <i className="legend-dot green" /> Connected
                    </span>
                    <span>
                      <i className="legend-dot coral" /> Power outage
                    </span>
                    <span>
                      <i className="legend-cross">+</i> Hospital
                    </span>
                    <span>
                      <i className="legend-line" /> Priority route
                    </span>
                  </div>
                </div>
                <div className="mobile-asset-picker">
                  <label htmlFor="city-asset">INSPECT ASSET</label>
                  <select
                    id="city-asset"
                    value={`${selected.type}:${selected.id}`}
                    onChange={(e) => {
                      const [type, id] = e.target.value.split(':')
                      setSelected({ type: type as Asset['type'], id })
                    }}
                  >
                    {(
                      [
                        ['station', stations],
                        ['district', districts],
                        ['road', roads],
                        ['hospital', hospitals],
                      ] as const
                    ).map(([type, assets]) => (
                      <optgroup key={type} label={type}>
                        {assets.map((a) => (
                          <option key={a.id} value={`${type}:${a.id}`}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <AssetDetails asset={selected} state={state} />
              </section>
              <aside className="panel response-panel">
                <div className="panel-head">
                  <h2>Response desk</h2>
                  <span className="small-tag">YOUR MOVE</span>
                </div>
                <div className="response-body">
                  <div className="response-intro">
                    <span className="eyebrow">
                      INCIDENT BRIEF / 0{scenarios.indexOf(scenario) + 1}
                    </span>
                    <h3>{scenario.subtitle}</h3>
                    <p>{scenario.description}</p>
                  </div>
                  <div className="resource-row">
                    <span>Response resources</span>
                    <strong>
                      {credits}
                      <small> / {BUDGET}</small>
                    </strong>
                  </div>
                  <div
                    className="resource-track"
                    role="img"
                    aria-label={`${credits} of ${BUDGET} resource units available`}
                  >
                    {Array.from({ length: BUDGET }, (_, i) => (
                      <span key={i} className={i < credits ? 'available' : ''} />
                    ))}
                  </div>
                  <div className="actions">
                    {(['restore', 'reroute', 'shelter'] as const).map((kind) => {
                      const Icon = icons[kind]
                      const targets = eligibleTargets(kind, state, actions)
                      const disabled =
                        credits < actionCosts[kind] ||
                        !targets.length ||
                        replayLocked ||
                        tick >= HORIZON - (kind === 'restore' ? 1 : 0)
                      return (
                        <button
                          className="action-card"
                          key={kind}
                          disabled={disabled}
                          onClick={() => beginAction(kind)}
                        >
                          <div className={`action-icon ${kind}`}>
                            <Icon size={19} />
                          </div>
                          <div>
                            <strong>{actionNames[kind]}</strong>
                            <p>{descriptions[kind]}</p>
                            <span>
                              {actionCosts[kind]} {actionCosts[kind] === 1 ? 'unit' : 'units'}{' '}
                              <i>·</i>{' '}
                              {kind === 'restore' ? '20 min to repair' : 'Active next step'}
                            </span>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      )
                    })}
                  </div>
                  <p className="response-hint">
                    {replayLocked
                      ? 'Viewing past decisions. Advance to your latest decision or reset to create a new response.'
                      : tick === HORIZON
                        ? 'Exercise complete. Compare outcomes or reset for another response.'
                        : credits === 0
                          ? 'All resources committed. Advance to observe your response.'
                          : 'Select an asset on the map, then choose a response. Dispatch pauses the simulation.'}
                  </p>
                  <button className="compare-link" onClick={() => setView('compare')}>
                    Compare possible outcomes <ArrowUpRight size={16} />
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            <section className="panel comparison-panel">
              <div className="panel-head">
                <h2>
                  <GitCompareArrows size={18} /> The response difference
                </h2>
                <span className="small-tag">6-HOUR PROJECTION</span>
              </div>
              <div className="comparison-body">
                <div className="comparison-intro">
                  <div>
                    <span className="eyebrow">SAME SCENARIO · SEED {seed}</span>
                    <h3>
                      {actions.length
                        ? 'A better outcome starts with a decision.'
                        : 'What will your response change?'}
                    </h3>
                    <p>
                      {actions.length
                        ? `${actions.length} committed ${actions.length === 1 ? 'intervention' : 'interventions'}, projected through ${timeLabel(HORIZON)}. No additional future decisions assumed.`
                        : 'Both runs are identical until you intervene. Return to the control room and dispatch a response.'}
                    </p>
                  </div>
                  <button className="button" onClick={() => setView('control')}>
                    <Map size={16} /> Control room
                  </button>
                </div>
                <div className="comparison-chart">
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot green" /> Your response
                    </span>
                    <span>
                      <i className="legend-dot coral" /> Without intervention
                    </span>
                    <span>GRID COVERAGE / %</span>
                  </div>
                  <TrendChart history={history} baseline={baseline} />
                </div>
                <div className="comparison-table-wrap">
                  <table className="comparison-table">
                    <caption className="sr-only">Projected outcomes at midnight</caption>
                    <thead>
                      <tr>
                        <th>AT {timeLabel(HORIZON)}</th>
                        <th>Without intervention</th>
                        <th>Your response</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Grid coverage', 'power', '%', true],
                          ['Residents affected', 'affected', '', false],
                          ['Hospital pressure', 'pressure', '%', false],
                          ['Travel delay', 'delay', ' min', false],
                          ['Residents sheltered', 'sheltered', '', true],
                        ] as const
                      ).map(([label, key, unit, up]) => {
                        const actual = history[HORIZON].metrics[key],
                          base = baseline[HORIZON].metrics[key],
                          difference = actual - base
                        const good = up ? difference > 0 : difference < 0
                        return (
                          <tr key={key}>
                            <th>{label}</th>
                            <td>
                              {fmt(base)}
                              {unit}
                            </td>
                            <td className="your-value">
                              {fmt(actual)}
                              {unit}
                            </td>
                            <td
                              className={
                                difference === 0
                                  ? 'text-muted'
                                  : good
                                    ? 'text-success'
                                    : 'text-danger'
                              }
                            >
                              {difference === 0
                                ? 'No change'
                                : `${difference > 0 ? '+' : '−'}${fmt(Math.abs(difference))}${unit === '%' ? ' pp' : unit}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="comparison-footnote">
                  A controlled counterfactual, not a forecast. Both runs use the same rules and
                  seeded variation. Percent differences are percentage points (pp).
                </p>
              </div>
            </section>
          )}
          <section className="panel timeline-panel" aria-label="Simulation timeline">
            <div className="playback-controls">
              <button
                className="play-button"
                aria-label={
                  running
                    ? 'Pause simulation'
                    : tick === HORIZON
                      ? 'Replay simulation'
                      : 'Start simulation'
                }
                onClick={() => {
                  if (tick === HORIZON) setTick(0)
                  setRunning(!running)
                }}
              >
                {running ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
                <span>{running ? 'Pause' : tick === HORIZON ? 'Replay' : 'Start'}</span>
              </button>
              <button
                className="icon-button"
                aria-label="Next step"
                title="Advance 10 simulated minutes"
                disabled={tick >= HORIZON}
                onClick={() => seek(tick + 1)}
              >
                <SkipForward size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Reset simulation"
                title="Reset simulation and clear interventions"
                onClick={reset}
              >
                <RotateCcw size={17} />
              </button>
              <select
                aria-label="Simulation speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={1}>1× speed</option>
                <option value={2}>2× speed</option>
                <option value={4}>4× speed</option>
              </select>
            </div>
            <div className="timeline">
              <div className="timeline-top">
                <span>
                  <Clock3 size={12} /> SIMULATION TIMELINE
                </span>
                <span>
                  {tick === HORIZON ? 'COMPLETE' : running ? 'RUNNING' : 'PAUSED'} <i>·</i> STEP{' '}
                  {String(tick).padStart(2, '0')} / {HORIZON}
                </span>
              </div>
              <div className="range-wrap">
                <input
                  type="range"
                  aria-label="Replay timeline"
                  aria-valuetext={`${timeLabel(tick)}, step ${tick} of ${HORIZON}`}
                  min="0"
                  max={HORIZON}
                  value={tick}
                  onChange={(e) => seek(Number(e.target.value))}
                  style={{ '--progress': `${(tick / HORIZON) * 100}%` } as React.CSSProperties}
                />
                <div className="timeline-markers">
                  {actions.map((a) => (
                    <span
                      key={a.id}
                      style={{ left: `${(a.tick / HORIZON) * 100}%` }}
                      title={`${actionNames[a.kind]} at ${timeLabel(a.tick)}`}
                    />
                  ))}
                </div>
              </div>
              <div className="timeline-labels">
                <span>18:00 / INCIDENT</span>
                <span>21:00</span>
                <span>24:00 / END</span>
              </div>
            </div>
            <div className="sim-clock">
              <strong data-testid="simulation-clock">{timeLabel(tick)}</strong>
              <span>+{tick * 10} MIN ELAPSED</span>
            </div>
          </section>
          <div className="intelligence-grid">
            <section className="panel event-panel">
              <div className="panel-head">
                <h2>
                  <Radio size={16} /> Event stream
                </h2>
                <span className="count-tag">{state.events.length}</span>
              </div>
              <ol className="event-list" aria-label="Simulation events">
                {[...state.events].reverse().map((e) => (
                  <li key={e.id}>
                    <time>{timeLabel(e.tick)}</time>
                    <span className={`event-dot ${eventTypes[e.kind].tone}`} />
                    <div>
                      <strong>{e.title}</strong>
                      <p>{e.detail}</p>
                    </div>
                    <span className={`event-kind text-${eventTypes[e.kind].tone}`}>
                      {eventTypes[e.kind].label}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="panel health-panel">
              <div className="panel-head">
                <h2>
                  <Activity size={16} /> Critical infrastructure
                </h2>
                <span className="small-tag">3 HOSPITALS</span>
              </div>
              <div className="hospital-list">
                {hospitals.map((h) => (
                  <button
                    key={h.id}
                    className="hospital-row"
                    onClick={() => {
                      setView('control')
                      setSelected({ type: 'hospital', id: h.id })
                      requestAnimationFrame(() =>
                        document
                          .querySelector('.map-panel')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                      )
                    }}
                  >
                    <div>
                      <strong>{h.name}</strong>
                      <span
                        className={
                          state.hospitals[h.id].pressure >= 85 ? 'text-danger' : 'text-muted'
                        }
                      >
                        {state.hospitals[h.id].pressure}% pressure
                      </span>
                    </div>
                    <div className="hospital-sub">
                      <span>
                        <BatteryCharging size={12} />
                        {state.hospitals[h.id].backup}% reserve
                      </span>
                      <span>
                        {state.districts[h.district].powered
                          ? 'GRID POWER'
                          : state.hospitals[h.id].backup > 0
                            ? 'ON BACKUP'
                            : 'POWER LOST'}
                      </span>
                    </div>
                    <div className="hospital-track">
                      <span
                        style={{
                          width: `${state.hospitals[h.id].pressure}%`,
                          background:
                            state.hospitals[h.id].pressure >= 85 ? 'var(--coral)' : 'var(--teal)',
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section className="panel trend-panel">
              <div className="panel-head">
                <h2>
                  <BarChart3 size={16} /> Grid pulse
                </h2>
                <span className="small-tag">COVERAGE</span>
              </div>
              <div className="trend-body">
                <div className="trend-value">
                  {state.metrics.power}
                  <span>%</span>
                  <span
                    className={
                      state.metrics.power >= history[0].metrics.power
                        ? 'text-success'
                        : 'text-danger'
                    }
                  >
                    {state.metrics.power >= history[0].metrics.power ? (
                      <ArrowUpRight size={19} />
                    ) : (
                      <ArrowDownRight size={19} />
                    )}
                  </span>
                </div>
                <p>Residents with grid power</p>
                <TrendChart history={history.slice(0, tick + 1)} small />
                <div className="sheltered-stat">
                  <House size={15} />
                  <strong>{fmt(state.metrics.sheltered)}</strong> residents sheltered
                </div>
              </div>
            </section>
          </div>
          <section className="panel decision-panel">
            <div className="panel-head">
              <h2>Response log</h2>
              <span className="small-tag">{actions.length} COMMITTED</span>
            </div>
            {actions.length ? (
              <div className="decision-list">
                {actions.map((a) => {
                  const name = [...stations, ...districts, ...roads].find(
                    (x) => x.id === a.target,
                  )?.name
                  const effective = a.tick + (a.kind === 'restore' ? 1 : 0)
                  return (
                    <div key={a.id}>
                      <span className="decision-check">
                        {tick >= effective ? <Check size={16} /> : <Clock3 size={16} />}
                      </span>
                      <div>
                        <strong>{actionNames[a.kind]}</strong>
                        <p>
                          {name} · {timeLabel(effective)}
                        </p>
                      </div>
                      <span className="small-tag">
                        {tick >= effective ? 'ACTIVE' : 'SCHEDULED'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">
                <ShieldCheck size={22} />
                <p>
                  No interventions yet.
                  <span>
                    Your decisions will appear here. You have six resource units to work with.
                  </span>
                </p>
              </div>
            )}
          </section>
          <footer>
            <span>
              <Zap size={12} /> CRISISOS <i>/</i> A FICTIONAL CITY. REAL CAUSE AND EFFECT.
            </span>
            <button
              className="text-button"
              onClick={() => {
                setRunning(false)
                setModal('guide')
              }}
            >
              Model assumptions & limitations <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {actionModal && (
        <Modal title={actionNames[actionModal]} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              dispatch(actionModal)
            }}
          >
            <p className="modal-description">
              {descriptions[actionModal]} This commits {actionCosts[actionModal]} of your {credits}{' '}
              remaining resource units.
            </p>
            <label className="field-label" htmlFor="response-target">
              {actionModal === 'restore'
                ? 'Failed substation'
                : actionModal === 'reroute'
                  ? 'Priority corridor'
                  : 'Shelter district'}
            </label>
            <select
              id="response-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            >
              {eligibleTargets(actionModal, state, actions).map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="dispatch-note">
              <Clock3 size={17} />
              <p>
                Effective at{' '}
                <strong>{timeLabel(tick + (actionModal === 'restore' ? 2 : 1))}</strong>
                <span>
                  {actionModal === 'restore'
                    ? 'Repairs take two steps. Restored stations are protected from further cascade failures.'
                    : actionModal === 'reroute'
                      ? 'Reduces this road’s congestion by 45 points for the rest of the exercise.'
                      : 'Shelter capacity grows by 750 residents per step, up to 3,000. Local unmet demand falls.'}
                </span>
              </p>
            </div>
            <button type="submit" className="button primary wide">
              Dispatch response <ArrowRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === 'share' && (
        <Modal title="Pass the controls." onClose={() => setModal(null)}>
          <p className="modal-description">
            Share the exact scenario, seed, and response plan. The recipient can replay every
            decision in their own browser.
          </p>
          <label className="field-label" htmlFor="share-url">
            Scenario link
          </label>
          <textarea
            id="share-url"
            readOnly
            value={sharedUrl}
            onFocus={(e) => e.currentTarget.select()}
            rows={3}
          />
          <div className="share-actions">
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(sharedUrl)
                  setNotice('Scenario link copied to clipboard.')
                  setModal(null)
                } catch {
                  setNotice('Clipboard unavailable. Select and copy the scenario link manually.')
                }
              }}
            >
              <Share2 size={16} /> Copy link
            </button>
            <button className="button" onClick={exportFile}>
              <Download size={16} /> Export JSON
            </button>
          </div>
          <p className="small-print">
            No account. No upload. The entire scenario lives in the link or file. Replay position
            and playback speed are not included.
          </p>
        </Modal>
      )}
      {modal === 'guide' && (
        <Modal title="Inside the simulation" onClose={() => setModal(null)}>
          <div className="guide">
            <p className="guide-intro">
              CrisisOS is a fictional systems exercise. It does not predict real emergencies and
              must not be used for operational decisions.
            </p>
            <h3>A connected city</h3>
            <p>
              Port Meridian has four substations, six districts, seven roads, three hospitals, and{' '}
              {fmt(population)} residents. Each step represents ten minutes, over a six-hour
              exercise.
            </p>
            <h3>How a failure spreads</h3>
            <p>
              Each failed neighboring station adds 4–6 stress points per step, multiplied by
              scenario demand. A station trips at the scenario’s threshold (
              {scenario.cascadeThreshold} in this exercise). Stress falls by 6 each step when no
              neighbors are offline.
            </p>
            <p>
              Each road gets 26 congestion points per unpowered endpoint, plus a scenario base and
              seeded variation. Average delay is congestion × 0.4 minutes. Hospitals lose{' '}
              {scenario.backupDrain} battery points per step without grid power and recharge 12 when
              it returns. Pressure combines traffic, unsheltered residents, outages, and depleted
              batteries.
            </p>
            <h3>Make a response</h3>
            <p>
              Repair costs 2 units, takes 20 minutes, and reinforces the station. Rerouting costs 1
              unit and reduces road congestion by 45 points. A shelter costs 1 unit and houses 750
              displaced residents per step, up to 3,000. Road and shelter responses start next step.
              Resources do not replenish.
            </p>
            <h3>Replay & compare</h3>
            <p>
              Drag the timeline or use its arrow keys to inspect any step, including future outcomes
              under your current plan. Seeking pauses playback. Responses are locked before your
              last decision; reset clears all decisions. Comparison projects both runs to midnight
              with no additional decisions.
            </p>
            <h3>Deterministic, deliberately simplified</h3>
            <p>
              The same preset, seed, and response timing always produce the same result. Speed only
              changes playback. There is no real geography, electrical flow model, individual
              routing, mortality estimate, or live data. Shelter demand disappears when grid power
              returns.
            </p>
            <div className="guide-facts">
              <span>100% browser local</span>
              <span>No external services</span>
              <span>Open source · MIT</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
function Metric({
  icon,
  label,
  value,
  suffix,
  detail,
  tone,
  bars,
}: {
  icon: ReactNode
  label: string
  value: string | number
  suffix?: string
  detail: string
  tone: string
  bars: number[]
}) {
  const recent = bars.slice(-18)
  const display = Array.from({ length: 18 }, (_, i) => recent[Math.min(i, recent.length - 1)] ?? 0)
  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-main">
        <strong>
          {value}
          <span>{suffix}</span>
        </strong>
        <div className="spark-bars" aria-hidden="true">
          {display.map((v, i) => (
            <i
              key={i}
              style={{ height: `${Math.max(8, v * 0.36)}px`, opacity: i < bars.length ? 1 : 0.25 }}
            />
          ))}
        </div>
      </div>
      <p>
        <span className="metric-dot" />
        {detail}
      </p>
    </article>
  )
}
