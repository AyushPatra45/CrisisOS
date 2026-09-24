import { districts, hospitals, roads, stations } from './simulation/city'
import type { Snapshot } from './simulation/types'
export type Asset = { type: 'station' | 'district' | 'road' | 'hospital'; id: string }
interface Props {
  state: Snapshot
  selected: Asset
  onSelect: (asset: Asset) => void
  layer: 'all' | 'power' | 'mobility'
}
const polygons = [
  '70,180 238,170 280,230 253,326 75,317',
  '92,355 272,355 332,470 280,522 131,506',
  '277,80 445,76 454,205 400,248 289,210',
  '429,236 590,149 638,263 588,334 430,329',
  '352,378 582,351 636,481 571,531 379,516',
  '646,278 798,273 844,452 689,478 630,395',
]
export default function CityMap({ state, selected, onSelect, layer }: Props) {
  const selectKey = (e: React.KeyboardEvent, asset: Asset) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(asset)
    }
  }
  return (
    <svg
      className="city-svg"
      viewBox="0 0 900 590"
      role="group"
      aria-label="Interactive map of the fictional city of Port Meridian"
    >
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="#192630" strokeWidth=".6" />
        </pattern>
        <pattern
          id="buildings"
          width="40"
          height="34"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          <rect x="4" y="4" width="12" height="23" rx="1" fill="#25333b" />
          <rect x="21" y="4" width="14" height="12" rx="1" fill="#24323a" />
          <rect x="21" y="20" width="14" height="8" rx="1" fill="#223039" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="900" height="590" fill="url(#grid)" />
      <path
        d="M-20 109C164 61 196 91 253 216S295 340 355 334 430 270 503 295 590 395 616 483 681 577 941 538"
        stroke="#101f2b"
        strokeWidth="52"
        fill="none"
      />
      <path
        d="M-20 109C164 61 196 91 253 216S295 340 355 334 430 270 503 295 590 395 616 483 681 577 941 538"
        stroke="#29404c"
        strokeWidth="1"
        strokeDasharray="3 8"
        fill="none"
      />
      <text x="42" y="123" className="water-label" transform="rotate(-8 42 123)">
        MERIDIAN RIVER
      </text>
      {districts.map((d, i) => {
        const powered = state.districts[d.id].powered
        const active = selected.type === 'district' && selected.id === d.id
        return (
          <g
            key={d.id}
            className="map-control"
            role="button"
            tabIndex={0}
            aria-label={`${d.name}, ${powered ? 'power connected' : 'power outage'}`}
            onClick={() => onSelect({ type: 'district', id: d.id })}
            onKeyDown={(e) => selectKey(e, { type: 'district', id: d.id })}
          >
            <polygon
              points={polygons[i]}
              fill={powered ? '#19272c' : '#38292a'}
              stroke={active ? '#d0f58c' : powered ? '#34463e' : '#76504a'}
              strokeWidth={active ? 2 : 1}
            />
            <polygon points={polygons[i]} fill="url(#buildings)" opacity={powered ? '.8' : '.35'} />
            {!powered && <polygon points={polygons[i]} fill="#ed7152" opacity=".055" />}
          </g>
        )
      })}
      <g opacity=".5" fill="none" stroke="#43505a" strokeWidth="3">
        <path d="M85 235 244 227 360 151 543 188 740 307 774 442" />
        <path d="M155 285 199 413 479 404 716 382" />
        <path d="M363 90 388 228 490 308 541 505" />
      </g>
      {roads.map((r) => {
        const from = districts.find((d) => d.id === r.from)!,
          to = districts.find((d) => d.id === r.to)!,
          data = state.roads[r.id]
        const path = `M${from.x} ${from.y} L${to.x} ${to.y}`
        return (
          <g
            key={r.id}
            opacity={layer === 'power' ? 0.25 : 1}
            role="button"
            tabIndex={0}
            className="map-control"
            aria-label={`${r.name}, ${data.congestion}% congestion`}
            onClick={() => onSelect({ type: 'road', id: r.id })}
            onKeyDown={(e) => selectKey(e, { type: 'road', id: r.id })}
          >
            <path d={path} fill="none" stroke="transparent" strokeWidth="18" />
            <path
              d={path}
              fill="none"
              stroke={data.rerouted ? '#bfe98b' : data.congestion > 65 ? '#e59557' : '#667580'}
              strokeWidth={selected.type === 'road' && selected.id === r.id ? 4 : 2}
              strokeDasharray={data.rerouted ? '6 4' : undefined}
            />
          </g>
        )
      })}
      {layer !== 'mobility' && (
        <g fill="none" strokeWidth="1" strokeDasharray="4 5">
          {stations.flatMap((s) =>
            s.neighbors
              .filter((n) => n > s.id)
              .map((n) => {
                const other = stations.find((x) => x.id === n)!
                return (
                  <path
                    key={`${s.id}-${n}`}
                    d={`M${s.x} ${s.y}L${other.x} ${other.y}`}
                    stroke={
                      state.stations[s.id].online && state.stations[n].online
                        ? '#b3d976'
                        : '#bf6d58'
                    }
                    opacity=".5"
                  />
                )
              }),
          )}
        </g>
      )}
      {districts.map((d) => (
        <g key={d.id} pointerEvents="none">
          <text x={d.x} y={d.y - 20} textAnchor="middle" className="district-label">
            {d.name.toUpperCase()}
          </text>
          <text x={d.x} y={d.y - 5} textAnchor="middle" className="district-pop">
            {(d.population / 1000).toFixed(1)}k residents
          </text>
          {state.districts[d.id].sheltered > 0 && (
            <g transform={`translate(${d.x - 12},${d.y + 8})`}>
              <rect width="24" height="24" rx="6" fill="#b8dd80" />
              <path d="m4 13 8-7 8 7M7 11v9h10v-9" fill="none" stroke="#17251b" strokeWidth="2" />
            </g>
          )}
        </g>
      ))}
      {layer !== 'mobility' &&
        stations.map((s) => {
          const online = state.stations[s.id].online
          const active = selected.type === 'station' && selected.id === s.id
          return (
            <g
              key={s.id}
              transform={`translate(${s.x},${s.y})`}
              className="map-control"
              tabIndex={0}
              role="button"
              aria-label={`${s.name} substation, ${online ? 'online' : 'offline'}`}
              onClick={() => onSelect({ type: 'station', id: s.id })}
              onKeyDown={(e) => selectKey(e, { type: 'station', id: s.id })}
            >
              {!online && <circle r="30" fill="#ef805d" opacity=".08" />}
              <circle
                r={active ? 25 : 21}
                fill="none"
                stroke={online ? '#94b873' : '#e99070'}
                opacity={active ? '.8' : '.25'}
              />
              <rect
                x="-14"
                y="-14"
                width="28"
                height="28"
                rx="7"
                fill={online ? '#223b2c' : '#512f2c'}
                stroke={online ? '#a2ca78' : '#f39576'}
              />
              <path d="m2-9-8 11h6l-2 8L7-2H1z" fill={online ? '#c1e696' : '#ffad8b'} />
              <text textAnchor="middle" y={s.id === 'north' ? -30 : 43} className="station-label">
                {s.name}
              </text>
            </g>
          )
        })}
      {hospitals.map((h) => (
        <g
          key={h.id}
          transform={`translate(${h.x},${h.y})`}
          className="map-control"
          role="button"
          tabIndex={0}
          aria-label={`${h.name}, ${state.hospitals[h.id].pressure}% capacity pressure`}
          onClick={() => onSelect({ type: 'hospital', id: h.id })}
          onKeyDown={(e) => selectKey(e, { type: 'hospital', id: h.id })}
        >
          <rect
            x="-12"
            y="-12"
            width="24"
            height="24"
            rx="5"
            fill="#19343a"
            stroke={state.hospitals[h.id].pressure >= 85 ? '#ed9173' : '#86cbd0'}
            strokeWidth={selected.type === 'hospital' && selected.id === h.id ? 3 : 1}
          />
          <path d="M-6 0H6M0-6V6" stroke="#b4e5df" strokeWidth="2.5" />
        </g>
      ))}
      <g transform="translate(844 48)">
        <path d="m0-15-6 19 6-4 6 4z" fill="#9caab6" />
        <text y="22" textAnchor="middle" className="compass-label">
          N
        </text>
      </g>
      <g transform="translate(43 546)" className="scale">
        <path d="M0 0v5h80v-5M40 0v5" stroke="#7a8b94" fill="none" />
        <text y="21">0</text>
        <text x="63" y="21">
          1 km
        </text>
      </g>
      <text x="852" y="565" textAnchor="end" className="map-credit">
        FICTIONAL CITY · LOCAL SIMULATION
      </text>
    </svg>
  )
}
