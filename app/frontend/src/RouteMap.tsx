import { lazy, Suspense, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { LocateFixed, Minus, Plus, Truck as TruckIcon } from 'lucide-react';
import type { Network, Simulation } from './types';
import { stateLabels, truckColors } from './types';
import { blockProgress } from './mapGeometry';
import { useTruckAnimation } from './useTruckAnimation';
const GeographicMap = lazy(() => import('./GeographicMap'));

export interface MapProps { network: Network; simulation: Simulation; selected: string | null; select: (id: string | null) => void; selectTask: (id: string) => void; selectBlock: (id: string) => void }

export default function RouteMap(props: MapProps) {
  const { network, simulation, selected, select, selectTask, selectBlock } = props;
  const [zoom, setZoom] = useState(1);
  const [geographic, setGeographic] = useState(Boolean(import.meta.env.VITE_MAPBOX_TOKEN));
  const [mapError, setMapError] = useState('');
  const positions = useTruckAnimation(network, simulation);
  const nodes = new Map(network.nodes.map(node => [node.id, node]));
  const states = new Map(simulation.tasks.map(task => [task.id, task]));
  const activate = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  };
  return <>
    <div className="map-wrap">
      <div className="map-tag"><span className="tag-dot" />{network.source === 'openstreetmap' ? 'Manzanas OSM' : 'Red demostrativa'} · {network.blocks.features.length} polígonos</div>
      {geographic ? <Suspense fallback={<div className="map-loading">Cargando mapa…</div>}>
        <GeographicMap {...props} positions={positions} onError={() => { setMapError('No se pudo cargar el mapa base. Se muestra el esquema de la misma red vial.'); setGeographic(false); }} />
      </Suspense> : <>
        <svg className="schematic-map" viewBox={`${410 - 410 / zoom} ${290 - 290 / zoom} ${820 / zoom} ${580 / zoom}`} role="group" aria-label="Esquema interactivo de manzanas y rutas de recolección">
          <defs>
            <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ced8d4" /></pattern>
            <marker id="direction" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 1 1 L 9 5 L 1 9 z" fill="#667b70" /></marker>
          </defs>
          <rect width="820" height="580" fill="url(#dots)" />
          {network.edges.map(edge => {
            const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
            return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth="8" />;
          })}
          {network.blocks.features.map(block => {
            const progress = blockProgress(block.properties.task_ids, states);
            const fill = progress.state === 'visited' ? '#f0c7c7' : progress.state === 'partial' ? '#f1dfa5' : '#d8e9dc';
            return <g key={block.properties.id} className="map-block" role="button" tabIndex={0} aria-label={`Ver manzana ${block.properties.id}, ${progress.visited} de ${progress.total} lados visitados`} onClick={() => selectBlock(block.properties.id)} onKeyDown={event => activate(event, () => selectBlock(block.properties.id))}>
              <polygon data-block-id={block.properties.id} points={block.properties.screen_coordinates[0].map(point => point.join(',')).join(' ')} fill={fill} stroke="#718e77" strokeWidth=".8" />
              <text x={block.properties.screen_centroid[0]} y={block.properties.screen_centroid[1]} textAnchor="middle" className="block-label">{block.properties.id}</text>
            </g>;
          })}
          {simulation.trucks.flatMap((truck, truckIndex) => truck.route.map((leg, index) => {
            const edge = network.edges.find(item => item.id === leg.edge_id)!;
            const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
            return <line key={`${truck.id}-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={truckColors[truckIndex]} strokeWidth={selected === truck.id ? 4 : 2} strokeOpacity={!selected ? .25 : selected === truck.id ? .7 : .05} />;
          }))}
          {network.tasks.map(task => {
            const state = states.get(task.id)!;
            const points = task.screen_coordinates.map(point => point.join(',')).join(' ');
            return <g key={task.id} role="button" tabIndex={0} className="map-side" aria-label={`${task.block_id}, ${task.side}, ${stateLabels[state.state]}`} onClick={() => selectTask(task.id)} onKeyDown={event => activate(event, () => selectTask(task.id))}>
              <title>{task.block_id} · {task.side} · {stateLabels[state.state]}</title>
              <polyline points={points} fill="none" stroke="transparent" strokeWidth="12" />
              <polyline points={points} fill="none" stroke={state.state === 'visited' ? '#b95050' : state.state === 'in_progress' ? '#b17a06' : '#398160'} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={state.state === 'pending' ? '4 3' : state.state === 'in_progress' ? '1 2' : undefined} />
            </g>;
          })}
          <g transform={`translate(${nodes.get(network.depot)!.x - 25} ${nodes.get(network.depot)!.y - 32})`}><rect width="50" height="24" rx="5" fill="#153d37" /><text x="25" y="17" textAnchor="middle" fill="white" fontSize="12">Base</text></g>
          {positions.map((truck, index) => {
            const atDepot = truck.status === 'at_depot' || truck.status === 'finished';
            const spread = atDepot ? 1 : Math.max(0, 1 - truck.travelled_m / 20);
            const x = truck.x + (index - 2) * 17 * spread, y = truck.y + 20 * spread;
            return <g key={truck.id} transform={`translate(${x} ${y})`} className="map-truck" data-truck-id={truck.id} data-route-distance={truck.travelled_m.toFixed(2)} role="button" tabIndex={0} aria-label={`Ver ruta del camión ${truck.id}`} onClick={() => select(selected === truck.id ? null : truck.id)} onKeyDown={event => activate(event, () => select(selected === truck.id ? null : truck.id))}>
              <circle r={selected === truck.id ? 17 : 14} fill={truckColors[index]} stroke="white" strokeWidth="2" />
              <g transform={`rotate(${truck.bearing - 90})`}><path d="M-8-5h9v10h-9z M1-2h4l3 3v4H1z" fill="white" /><circle cx="-5" cy="6" r="1.6" fill="white" /><circle cx="5" cy="6" r="1.6" fill="white" /></g>
              <text y="-18" textAnchor="middle" fill={truckColors[index]} stroke="white" strokeWidth="3" paintOrder="stroke" fontSize="12" fontWeight="700">{index + 1}</text>
            </g>;
          })}
        </svg>
        <div className="map-controls"><button aria-label="Acercar mapa" disabled={zoom >= 1.7} onClick={() => setZoom(value => Math.min(1.7, value + .2))}><Plus size={18} /></button><button aria-label="Alejar mapa" disabled={zoom <= .9} onClick={() => setZoom(value => Math.max(.9, value - .2))}><Minus size={18} /></button><button aria-label="Centrar mapa" onClick={() => setZoom(1)}><LocateFixed size={18} /></button></div>
      </>}
      <div className="map-note"><TruckIcon size={14} />Movimiento simulado · sin GPS real</div>
      {!geographic && <span className="map-north" aria-hidden="true">N<br />▲</span>}
    </div>
    {mapError && <p className="map-warning" role="status">{mapError}<button className="text-button" onClick={() => { setMapError(''); setGeographic(true); }}>Reintentar mapa</button></p>}
    <div className="block-selector" aria-label="Consultar manzanas"><span>Manzanas</span>{network.blocks.features.map(block => <button key={block.properties.id} aria-label={`Ver manzana ${block.properties.id}`} onClick={() => selectBlock(block.properties.id)}>{block.properties.id}</button>)}</div>
    {network.attribution && <p className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{network.attribution}</a> · Polígonos inferidos, no catastrales</p>}
  </>;
}
