import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Activity, Check, CheckCheck, CircleHelp, Clock3, Eye, Leaf, LockKeyhole, LogOut, MapPinned, Pause, Play, Recycle, RefreshCw, RotateCcw, Route, Search, Settings2, ShieldCheck, Truck as TruckIcon, Weight, X } from 'lucide-react';
import { ApiError, request } from './api';
import RouteMap from './RouteMap';
import type { Network, Simulation, SideStatus } from './types';
import { stateLabels, statusLabels, truckColors, truckLabels } from './types';
import { blockProgress } from './mapGeometry';

function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = element.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={element} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="dialog-title">
    <header className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Cerrar diálogo" onClick={close}><X size={20} /></button></header>
    {children}
  </dialog>;
}

const formatNumber = (value: number) => new Intl.NumberFormat('es-PE').format(value);
const formatTime = (value: string) => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' }).format(new Date(value));
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error. Vuelve a intentarlo.';

export default function App() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [lastSync, setLastSync] = useState('');
  const [section, setSection] = useState<'map' | 'fleet'>('map');
  const [token, setToken] = useState('');
  const [operating, setOperating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'login' | 'help' | 'reset' | 'settings' | null>(null);
  const [loginKey, setLoginKey] = useState('');
  const [capacity, setCapacity] = useState(64);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const revision = useRef(0);
  const mutation = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      const version = revision.current;
      try {
        if (!network) {
          const data = await request<Network>('/network', { signal: controller.signal });
          if (stopped) return;
          setNetwork(data);
        }
        const state = await request<Simulation>('/simulation', { signal: controller.signal });
        if (!stopped && version === revision.current && !mutation.current) {
          setSimulation(state);
          setLastSync(new Date().toISOString());
          setNetworkError('');
        }
      } catch (error) {
        if (!stopped) setNetworkError(errorMessage(error));
      } finally {
        if (!stopped) timer = setTimeout(poll, 1000);
      }
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [retry, Boolean(network)]);

  useEffect(() => {
    const openHelp = (event: KeyboardEvent) => {
      if (event.key === '?' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) setModal('help');
    };
    window.addEventListener('keydown', openHelp);
    return () => window.removeEventListener('keydown', openHelp);
  }, []);

  async function action(path: string, message: string, body?: unknown) {
    if (mutation.current) return false;
    mutation.current = true;
    revision.current += 1;
    setBusy(true); setActionError(''); setNotice('');
    try {
      const state = await request<Simulation>(`/simulation/${path}`, { token, body, method: 'POST' });
      setSimulation(state); setNotice(message); setLastSync(new Date().toISOString());
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      if (error instanceof ApiError && error.status === 401) { setToken(''); setOperating(false); }
      return false;
    } finally { mutation.current = false; setBusy(false); }
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setActionError('');
    try {
      await request('/operator/session', { token: loginKey, method: 'POST' });
      setToken(loginKey); setLoginKey(''); setOperating(true); setModal(null); setNotice('Acceso operativo habilitado.');
    } catch (error) { setActionError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function openModal(value: typeof modal) { setActionError(''); setCapacity(simulation?.capacity_kg ?? 64); setModal(value); }
  const closeModal = () => { if (!busy) { setModal(null); setActionError(''); setLoginKey(''); } };
  const progress = simulation ? Math.round(simulation.summary.visited / simulation.summary.total * 100) : 0;
  const activeTrucks = simulation?.trucks.filter(truck => ['traveling', 'collecting'].includes(truck.status)).length ?? 0;
  const selectedState = simulation?.tasks.find(task => task.id === selectedTask);
  const selectedDefinition = network?.tasks.find(task => task.id === selectedTask);
  const blockDefinition = network?.blocks.features.find(block => block.properties.id === selectedBlock);
  const blockState = blockDefinition && simulation ? blockProgress(blockDefinition.properties.task_ids, new Map(simulation.tasks.map(task => [task.id, task]))) : null;
  const filtered = network?.tasks.filter(task => {
    const state = simulation?.tasks.find(item => item.id === task.id);
    return (!query || `${task.block_id} ${task.side} ${state?.truck_id}`.toLowerCase().includes(query.toLowerCase())) &&
      (statusFilter === 'all' || state?.state === statusFilter);
  }) ?? [];

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <aside className="sidebar" aria-label="Navegación principal">
      <a className="brand" href="/" aria-label="Zurikatos, inicio"><span className="brand-icon"><Recycle size={27} /></span><span>Zurikatos<small>Rutas que cuidan</small></span></a>
      <div className="workspace-label"><span className="location-mark" />Puno, Perú <span className="small-chip">DEMO</span></div>
      <p className="nav-heading">Espacio de trabajo</p>
      <nav>
        <button className={section === 'map' ? 'nav-item active' : 'nav-item'} aria-current={section === 'map' ? 'page' : undefined} onClick={() => setSection('map')}><MapPinned size={19} />Mapa de recolección</button>
        <button className={section === 'fleet' ? 'nav-item active' : 'nav-item'} aria-current={section === 'fleet' ? 'page' : undefined} onClick={() => setSection('fleet')}><TruckIcon size={19} />Flota de camiones<span className="nav-count">5</span></button>
        <button className="nav-item" onClick={() => openModal('help')}><CircleHelp size={19} />Guía de uso</button>
      </nav>
      <div className="sidebar-bottom"><div className="leaf-icon"><Leaf size={21} /></div><strong>Una ciudad más limpia.</strong><p>Planificamos cada recorrido, un lado de manzana a la vez.</p><div className="sidebar-footer">Proyecto académico · v0.1</div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><span className="topbar-title"><span className="online-dot" />Simulación de recolección</span><div className="topbar-actions">
        <span className="access-badge">{operating ? <ShieldCheck size={15} /> : <Eye size={15} />}{operating ? 'Modo operativo' : 'Consulta ciudadana'}</span>
        <button className="icon-button help-button" aria-label="Abrir ayuda" onClick={() => openModal('help')}><CircleHelp size={20} /></button>
        {operating ? <button className="text-button" onClick={() => { setOperating(false); setToken(''); setNotice('Sesión cerrada. Estás en la consulta de solo lectura.'); }}><LogOut size={16} />Salir</button> : <button className="text-button" onClick={() => openModal('login')}><LockKeyhole size={16} />Acceso operativo</button>}
      </div></header>

      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">GESTIÓN DE RESIDUOS · PUNO</p><h1>{section === 'fleet' ? 'Nuestra flota, en detalle' : operating ? 'Centro de operaciones' : 'Recolección, a la vista.'}</h1><p>{operating ? 'Planifica, simula y supervisa cada recorrido de la flota.' : 'Consulta las rutas y el avance de la recolección simulada en tu sector.'}</p></div><span className="date-chip"><Activity size={16} />Simulación académica</span></div>
        <div className="demo-banner"><span className="demo-icon"><Route size={18} /></span><p><strong>Simulación de recolección.</strong> {network?.source === 'openstreetmap' ? 'Mapa y manzanas inferidas de calles OSM de Puno. ' : 'Red sintética de demostración. '}El movimiento y los kilogramos son simulados; no representan el servicio municipal real.</p></div>
        {networkError && <div className="error-banner" role="alert"><span>{networkError}{simulation && ' Los datos mostrados pueden estar desactualizados.'}</span><button className="text-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} />Reintentar</button></div>}
        <div role="status" className={notice ? 'notice' : 'sr-only'}>{notice}</div>
        {actionError && !modal && <div role="alert" className="error-banner">{actionError}<button className="icon-button" aria-label="Cerrar aviso" onClick={() => setActionError('')}><X size={16} /></button></div>}
        {!simulation || !network ? <section className="loading-panel" aria-busy="true"><RefreshCw size={28} className="spin" /><h2>{networkError ? 'Esperando conexión' : 'Preparando la vista de recolección'}</h2><p>{networkError ? 'El servicio no está disponible. Volveremos a intentar la conexión.' : 'Estamos consultando las rutas y el estado de los camiones.'}</p></section> : <>
          <section className="metrics" aria-label="Resumen de la recolección">
            <article className="metric-card"><div className="metric-label">Avance de recolección<CheckCheck size={18} /></div><div className="metric-value">{progress}<span>%</span></div><div className="mini-progress" role="progressbar" aria-label="Lados de manzana visitados" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><p>{simulation.summary.visited} de {simulation.summary.total} lados visitados</p></article>
            <article className="metric-card"><div className="metric-label">Camiones en recorrido<TruckIcon size={18} /></div><div className="metric-value">{activeTrucks}<span>/ 5</span></div><p><span className="metric-dot" />Un único punto de partida</p></article>
            <article className="metric-card"><div className="metric-label">Residuos recolectados<Weight size={18} /></div><div className="metric-value">{formatNumber(simulation.summary.collected_kg)}<span>kg</span></div><p>Entre 5 y 8 kg por lado atendido</p></article>
            <article className="metric-card"><div className="metric-label">Lados pendientes<Route size={18} /></div><div className="metric-value">{simulation.summary.pending}<span>lados</span></div><p>{simulation.summary.in_progress} en recorrido en este momento</p></article>
          </section>

          {operating && <section className="operator-bar" aria-label="Controles de simulación"><div className="operator-buttons"><button className="primary-button" disabled={busy || Boolean(networkError) || simulation.status === 'completed'} onClick={() => void action(simulation.status === 'running' ? 'pause' : 'start', simulation.status === 'running' ? 'Simulación pausada.' : 'Simulación en curso.')}>
            {simulation.status === 'running' ? <Pause size={17} /> : <Play size={17} />}{busy ? 'Procesando…' : simulation.status === 'running' ? 'Pausar' : simulation.status === 'paused' ? 'Reanudar' : 'Iniciar simulación'}</button>
            <button className="secondary-button" disabled={busy || Boolean(networkError)} onClick={() => openModal('reset')}><RotateCcw size={16} />Reiniciar</button></div>
            <div className="operator-options"><label htmlFor="speed">Velocidad</label><select id="speed" value={simulation.speed} disabled={busy || Boolean(networkError)} onChange={event => void action('speed', 'Velocidad actualizada.', { speed: Number(event.target.value) })}>{[1, 2, 4, 8].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select><button className="icon-button" aria-label="Configurar capacidad" disabled={busy || Boolean(networkError)} onClick={() => openModal('settings')}><Settings2 size={19} /></button></div>
          </section>}

          {section === 'map' ? <section className="operations-grid" aria-label="Mapa y flota">
            <article className="map-card"><header className="card-header"><div><h2>Mapa de recolección</h2><p>Área de estudio · Puno</p></div><span className={`simulation-badge ${simulation.status}`}><span />{statusLabels[simulation.status]}</span></header>
              <RouteMap network={network} simulation={simulation} selected={selectedTruck} select={setSelectedTruck} selectTask={id => { setSelectedBlock(null); setSelectedTask(id); }} selectBlock={id => { setSelectedTask(null); setSelectedBlock(id); }} />
              <footer className="map-legend" aria-label="Leyenda de estados"><span><i className="legend-line pending" />No visitado</span><span><i className="legend-line in_progress" />En recorrido</span><span><i className="legend-line visited" />Visitado</span></footer>
              {selectedTruck && <div className="route-selection">Ruta de {selectedTruck} seleccionada<button className="text-button" onClick={() => setSelectedTruck(null)}>Mostrar todas</button></div>}
              <p className="map-instruction">{simulation.status === 'ready' ? operating ? 'Inicia la simulación para ver los camiones en movimiento.' : 'El operador debe iniciar la simulación para ver los camiones en movimiento.' : simulation.status === 'paused' ? 'Simulación en pausa: las posiciones se mantienen.' : simulation.status === 'completed' ? 'Recorrido completado. Los camiones regresaron al depósito.' : 'Los camiones se desplazan por sus rutas. Selecciona una manzana para consultar sus lados.'}</p>
            </article>
            <article className="fleet-card"><header className="card-header"><div><h2>Flota en campo</h2><p>5 camiones · 1 depósito</p></div><TruckIcon size={19} /></header><div className="truck-list">
              {simulation.trucks.map((truck, index) => <button className={`truck-item ${selectedTruck === truck.id ? 'selected' : ''}`} key={truck.id} aria-pressed={selectedTruck === truck.id} onClick={() => setSelectedTruck(selectedTruck === truck.id ? null : truck.id)}><div className="truck-item-top"><span className="truck-icon" style={{ color: truckColors[index], background: `${truckColors[index]}10` }}><TruckIcon size={21} /></span><span className="truck-name">Camión {truck.id}<small>{truckLabels[truck.status] ?? truck.status}</small></span><span className="truck-weight">{truck.collected_kg}<small>kg</small></span></div><div className="truck-item-bottom"><span>{truck.completed_sides} / {truck.assigned_sides} lados</span><span>{Math.round(truck.collected_kg / truck.capacity_kg * 100)}% de carga</span></div><div className="truck-progress"><span style={{ width: `${truck.collected_kg / truck.capacity_kg * 100}%`, background: truckColors[index] }} /></div></button>)}
            </div><footer className="fleet-note"><Clock3 size={15} />1 s real equivale a {15 * simulation.speed} s simulados</footer></article>
          </section> : <section className="table-card"><header className="card-header"><div><h2>Detalle de los camiones</h2><p>Selecciona un camión para ver su ruta en el mapa.</p></div></header><div className="table-scroll"><table><thead><tr><th>Camión</th><th>Estado</th><th>Lados atendidos</th><th>Carga</th><th>Distancia planificada</th><th>Recorrido</th></tr></thead><tbody>{simulation.trucks.map(truck => <tr key={truck.id}><td><strong>{truck.id}</strong></td><td>{truckLabels[truck.status]}</td><td>{truck.completed_sides} de {truck.assigned_sides}</td><td>{truck.collected_kg} / {truck.capacity_kg} kg</td><td>{(truck.distance_m / 1000).toFixed(2)} km</td><td><button className="text-button" onClick={() => { setSelectedTruck(truck.id); setSection('map'); }}>Ver ruta</button></td></tr>)}</tbody></table></div></section>}

          <section className="table-card"><header className="card-header table-heading"><div><h2>Recolección por lado de manzana</h2><p>Cada lado se atiende una sola vez, por un único camión.</p></div><div className="table-tools"><label className="search-field"><Search size={17} /><span className="sr-only">Buscar manzana, lado o camión</span><input value={query} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder="Buscar manzana o camión" /></label><label><span className="sr-only">Filtrar por estado</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setShowAll(false); }}><option value="all">Todos los estados</option>{Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></header>
            <div className="table-scroll"><table><thead><tr><th>Manzana / lado</th><th>Estado</th><th>Camión asignado</th><th>Recolectado</th><th>Detalle</th></tr></thead><tbody>{filtered.slice(0, showAll ? undefined : 6).map(task => { const state = simulation.tasks.find(item => item.id === task.id)!; return <tr key={task.id}><td><strong>{task.block_id}</strong><span className="side-name">{task.side}</span></td><td><span className={`side-badge ${state.state}`}>{state.state === 'visited' ? <Check size={13} /> : <span className="state-mark" />}{stateLabels[state.state]}</span></td><td><span className="table-truck"><TruckIcon size={15} />{state.truck_id}</span></td><td>{state.state === 'visited' ? `${state.collected_kg} kg` : 'Por recolectar'}</td><td><button className="text-button" aria-label={`Ver detalle de ${task.block_id}, lado ${task.side}`} onClick={() => setSelectedTask(task.id)}>Ver detalle</button></td></tr>; })}</tbody></table></div>
            {filtered.length === 0 && <div className="empty-state"><Search size={24} /><h3>No encontramos lados con esos filtros</h3><button className="text-button" onClick={() => { setQuery(''); setStatusFilter('all'); }}>Limpiar filtros</button></div>}
            <footer className="table-footer"><span>{Math.min(filtered.length, showAll ? filtered.length : 6)} de {filtered.length} lados</span>{filtered.length > 6 && <button className="text-button" onClick={() => setShowAll(value => !value)}>{showAll ? 'Mostrar menos' : 'Mostrar todos los lados'}</button>}</footer>
          </section>
          <footer className="page-footer"><span><span className={networkError ? 'offline-dot' : 'online-dot'} />{networkError ? 'Sin conexión' : `Sincronizado ${lastSync ? formatTime(lastSync) : ''} · hora de Lima`}</span><span>Datos de simulación · consulta de {operating ? 'operación' : 'solo lectura'}</span></footer>
        </>}
      </main>
    </div>

    {modal && <Dialog title={modal === 'login' ? 'Acceso operativo' : modal === 'reset' ? '¿Reiniciar la simulación?' : modal === 'settings' ? 'Configurar simulación' : 'Guía de uso'} close={closeModal}>
      {modal === 'login' ? <form onSubmit={login}><p>Introduce tu clave para iniciar, pausar y configurar la simulación. La consulta ciudadana está disponible sin clave.</p><label className="form-label" htmlFor="operator-key">Clave de acceso</label><input id="operator-key" autoFocus type="password" autoComplete="current-password" required value={loginKey} onChange={event => setLoginKey(event.target.value)} /><p className="field-hint">Solicita la clave al responsable del proyecto.</p>{actionError && <p role="alert" className="field-error">{actionError}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={closeModal}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</button></div></form> : modal === 'help' ? <div className="help-content"><p>Consulta el avance de cada lado de manzana y la ubicación simulada de los cinco camiones.</p><ol><li><strong>Explora el mapa.</strong> Selecciona un camión para destacar su ruta o un lado para ver su detalle. Usa el teclado con Tab y Enter.</li><li><strong>Consulta los estados.</strong> Verde discontinuo: no visitado. Amarillo punteado: en recorrido. Rojo continuo: visitado.</li><li><strong>Encuentra tu manzana.</strong> Usa el buscador y los filtros de la tabla.</li></ol><h3>Para operadores</h3><p>Accede con tu clave, inicia la simulación y páusala cuando necesites. La configuración permite cambiar la capacidad y generar otro recorrido. Reiniciar elimina el avance actual y requiere confirmación.</p><p className="help-note">La demostración utiliza una red sintética y una heurística inicial. No representa rutas municipales reales. Los valores de 5 a 8 kg por lado son aleatorios.</p><p className="field-hint">Atajo: pulsa ? para abrir esta guía. Escape cierra los diálogos.</p></div> : <form onSubmit={async event => { event.preventDefault(); if (await action('reset', 'Simulación reiniciada. Las rutas están listas.', { capacity_kg: modal === 'settings' ? capacity : simulation?.capacity_kg })) { setSelectedTruck(null); setModal(null); } }}>
        <p>{modal === 'settings' ? 'La capacidad se aplica a cada uno de los cinco camiones. Al aplicarla se generan nuevas rutas y se reinicia el avance.' : 'Los camiones volverán al depósito y se borrarán los lados atendidos y los kilogramos de esta simulación.'}</p>
        {modal === 'settings' && <><label className="form-label" htmlFor="capacity">Capacidad por camión (kg)</label><input id="capacity" type="number" min={Math.ceil((simulation?.summary.total ?? 24) / 5) * 8} max={5000} step={1} required value={capacity} onChange={event => setCapacity(Number(event.target.value))} /><p className="field-hint">Mínimo {Math.ceil((simulation?.summary.total ?? 24) / 5) * 8} kg para esta zona; máximo 5000 kg. Se reservan hasta 8 kg por tramo para evitar sobrecargas.</p></>}
        {actionError && <p role="alert" className="field-error">{actionError}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={closeModal}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Procesando…' : modal === 'settings' ? 'Aplicar y reiniciar' : 'Reiniciar simulación'}</button></div>
      </form>}
    </Dialog>}
    {blockDefinition && blockState && !modal && <Dialog title={`Manzana ${blockDefinition.properties.id}`} close={() => setSelectedBlock(null)}><p>{blockState.visited} de {blockState.total} lados/tramos visitados. La manzana se completa cuando todos han sido atendidos.</p><p className="field-hint">Polígono inferido de calles OSM; no representa un límite catastral oficial.</p><div className="block-detail-list">{blockDefinition.properties.task_ids.map(id => { const task = network!.tasks.find(item => item.id === id)!; const state = simulation!.tasks.find(item => item.id === id)!; return <button key={id} onClick={() => { setSelectedBlock(null); setSelectedTask(id); }}><span>{task.side}</span><span className={`side-badge ${state.state}`}>{stateLabels[state.state]}</span></button>; })}</div><button className="primary-button" onClick={() => setSelectedBlock(null)}>Cerrar detalle</button></Dialog>}
    {selectedState && selectedDefinition && !modal && <Dialog title={`${selectedDefinition.block_id} · ${selectedDefinition.side}`} close={() => setSelectedTask(null)}><dl className="detail-list"><div><dt>Estado</dt><dd>{stateLabels[selectedState.state as SideStatus]}</dd></div><div><dt>Vía</dt><dd>{network?.edges.find(edge => edge.id === selectedDefinition.edge_id)?.name}</dd></div><div><dt>Camión asignado</dt><dd>{selectedState.truck_id}</dd></div><div><dt>Residuos simulados</dt><dd>{selectedState.collected_kg} kg</dd></div><div><dt>Inicio</dt><dd>{selectedState.started_at ? formatTime(selectedState.started_at) : 'Todavía no iniciado'}</dd></div><div><dt>Finalización</dt><dd>{selectedState.completed_at ? formatTime(selectedState.completed_at) : 'Pendiente'}</dd></div></dl><button className="primary-button" onClick={() => setSelectedTask(null)}>Entendido</button></Dialog>}
  </div>;
}
