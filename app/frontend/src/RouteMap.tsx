import { lazy, Suspense, useState } from 'react';
import { LocateFixed, Minus, Plus, Truck as TruckIcon } from 'lucide-react';
import type { Network, Simulation } from './types';
import { stateLabels, truckColors } from './types';
const GeographicMap = lazy(() => import('./GeographicMap'));

interface Props { network: Network; simulation: Simulation; selected: string | null; select: (id: string | null) => void; selectTask: (id: string) => void }

export default function RouteMap(props: Props) {
  const { network, simulation, selected, select, selectTask } = props;
  const [zoom, setZoom] = useState(1);
  const [geographic, setGeographic] = useState(Boolean(import.meta.env.VITE_MAPBOX_TOKEN));
  const nodes = new Map(network.nodes.map(node => [node.id, node]));
  const states = new Map(simulation.tasks.map(task => [task.id, task]));
  return <div className="map-wrap">
    <div className="map-tag"><span className="tag-dot" />Red demostrativa · 6 manzanas</div>
    {geographic ? <Suspense fallback={<div className="map-loading">Cargando mapa…</div>}>
      <GeographicMap {...props} onError={() => setGeographic(false)} />
    </Suspense> : <>
      <svg className="schematic-map" viewBox={`${410 - 410 / zoom} ${290 - 290 / zoom} ${820 / zoom} ${580 / zoom}`} role="group" aria-label="Esquema interactivo de las rutas de recolección; red sintética, no cartografía real">
        <defs>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ced8d4" /></pattern>
          <marker id="direction" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 1 1 L 9 5 L 1 9 z" fill="#71847d" /></marker>
        </defs>
        <rect width="820" height="580" fill="url(#dots)" />
        {[0, 1].flatMap(y => [0, 1, 2].map(x => <g key={`${x}${y}`}>
          <rect x={125 + x * 205} y={120 + y * 190} width="165" height="150" rx="12" fill={(x + y) % 2 ? '#e6ede8' : '#e0e9e3'} stroke="#cedcd1" />
          <rect x={139 + x * 205} y={134 + y * 190} width="58" height="45" rx="5" fill="#d4e0d6" />
          <rect x={218 + x * 205} y={209 + y * 190} width="58" height="45" rx="5" fill="#d4e0d6" />
          <text x={207 + x * 205} y={200 + y * 190} textAnchor="middle" className="block-label">M{String(y * 3 + x + 1).padStart(2, '0')}</text>
        </g>))}
        {network.edges.map(edge => {
          const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
          return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth="25" />;
        })}
        {[0, 1, 2].map(y => <text key={y} x="50" y={105 + y * 190} className="road-label">Vía {String.fromCharCode(65 + y)}</text>)}
        {[0, 1, 2, 3].map(x => <text key={x} x={105 + x * 205} y="60" textAnchor="middle" className="road-label">Vía {x + 1}</text>)}
        {network.edges.filter(edge => edge.source[2] === edge.target[2]).map(edge => {
          const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
          return <line key={edge.id} x1={(a.x + b.x) / 2 - (b.x > a.x ? 7 : -7)} y1={a.y} x2={(a.x + b.x) / 2} y2={b.y} stroke="#71847d" markerEnd="url(#direction)" />;
        })}
        {selected && simulation.trucks.find(truck => truck.id === selected)?.route.map((leg, index) => {
          const edge = network.edges.find(item => item.id === leg.edge_id)!;
          const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
          return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={truckColors[Number(selected.slice(1)) - 1]} strokeWidth="9" strokeOpacity=".3" />;
        })}
        {network.tasks.map(task => {
          const edge = network.edges.find(item => item.id === task.edge_id)!, a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
          const state = states.get(task.id)!;
          const offsetX = task.side === 'Este' ? -13 : task.side === 'Oeste' ? 13 : 0;
          const offsetY = task.side === 'Norte' ? 13 : task.side === 'Sur' ? -13 : 0;
          const style = state.state === 'visited' ? '#b95050' : state.state === 'in_progress' ? '#b17a06' : '#398160';
          return <g key={task.id} role="button" tabIndex={0} className="map-side" aria-label={`${task.block_id}, lado ${task.side}, ${stateLabels[state.state]}`} onClick={() => selectTask(task.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTask(task.id); } }}>
            <title>{task.block_id} · {task.side} · {stateLabels[state.state]}</title>
            <line x1={a.x + offsetX} y1={a.y + offsetY} x2={b.x + offsetX} y2={b.y + offsetY} stroke="transparent" strokeWidth="18" />
            <line x1={a.x + offsetX} y1={a.y + offsetY} x2={b.x + offsetX} y2={b.y + offsetY} stroke={style} strokeWidth="5" strokeLinecap="round" strokeDasharray={state.state === 'pending' ? '6 5' : state.state === 'in_progress' ? '2 3' : undefined} />
          </g>;
        })}
        <g transform="translate(76 82)"><rect width="58" height="37" rx="8" fill="#153d37" /><text x="29" y="24" textAnchor="middle" fill="white" fontSize="14">Base</text></g>
        {simulation.trucks.map((truck, index) => {
          const depot = truck.status === 'at_depot' || truck.status === 'finished';
          const x = truck.x + (depot ? (index - 2) * 21 : 0), y = truck.y + (depot ? 34 : 0);
          return <g key={truck.id} transform={`translate(${x} ${y})`} className="map-truck" role="button" tabIndex={0} aria-label={`Ver ruta del camión ${truck.id}`} onClick={() => select(selected === truck.id ? null : truck.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(selected === truck.id ? null : truck.id); } }}>
            <circle r={selected === truck.id ? 20 : 16} fill={truckColors[index]} stroke="white" strokeWidth="3" />
            <text y="5" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{index + 1}</text>
          </g>;
        })}
      </svg>
      <div className="map-controls">
        <button aria-label="Acercar mapa" disabled={zoom >= 1.7} onClick={() => setZoom(value => Math.min(1.7, value + .2))}><Plus size={18} /></button>
        <button aria-label="Alejar mapa" disabled={zoom <= .9} onClick={() => setZoom(value => Math.max(.9, value - .2))}><Minus size={18} /></button>
        <button aria-label="Centrar mapa" onClick={() => setZoom(1)}><LocateFixed size={18} /></button>
      </div>
    </>}
    <div className="map-note"><TruckIcon size={14} /> Posiciones simuladas · sin seguimiento GPS real</div>
    <span className="map-north" aria-hidden="true">N<br />▲</span>
  </div>;
}
