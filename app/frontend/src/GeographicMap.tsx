import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Feature, LineString } from 'geojson';
import type { Network, Simulation } from './types';
import { truckColors } from './types';

export default function GeographicMap({ network, simulation, selected, select, selectTask, onError }: {
  network: Network; simulation: Simulation; selected: string | null;
  select: (id: string | null) => void; selectTask: (id: string) => void; onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const latest = useRef({ simulation, selected, select, selectTask });
  latest.current = { simulation, selected, select, selectTask };
  const render = () => {
    const instance = map.current;
    if (!instance?.isStyleLoaded()) return;
    const states = new Map(latest.current.simulation.tasks.map(task => [task.id, task]));
    const nodes = new Map(network.nodes.map(node => [node.id, node]));
    const features: Feature<LineString>[] = network.tasks.map(task => {
      const edge = network.edges.find(item => item.id === task.edge_id)!;
      const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
      const offsetX = task.side === 'Este' ? -.00008 : task.side === 'Oeste' ? .00008 : 0;
      const offsetY = task.side === 'Norte' ? -.00008 : task.side === 'Sur' ? .00008 : 0;
      return { type: 'Feature', properties: { id: task.id, state: states.get(task.id)?.state }, geometry: {
        type: 'LineString', coordinates: [[a.longitude + offsetX, a.latitude + offsetY], [b.longitude + offsetX, b.latitude + offsetY]],
      } };
    });
    const source = instance.getSource('service-sides') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({ type: 'FeatureCollection', features });
    const truck = latest.current.simulation.trucks.find(item => item.id === latest.current.selected);
    const route: Feature<LineString>[] = (truck?.route ?? []).map(leg => {
      const edge = network.edges.find(item => item.id === leg.edge_id)!;
      const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
      return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[a.longitude, a.latitude], [b.longitude, b.latitude]] } };
    });
    (instance.getSource('truck-route') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: route });
    instance.setPaintProperty('selected-route', 'line-color', truck ? truckColors[Number(truck.id.slice(1)) - 1] : '#2465ce');
    // Conservar los elementos evita perder el foco de teclado en cada actualización.
    if (!markers.current.length) {
      markers.current = latest.current.simulation.trucks.map((item, index) => {
        const element = document.createElement('button');
        element.className = 'geographic-truck';
        element.style.background = truckColors[index];
        element.textContent = String(index + 1);
        element.setAttribute('aria-label', `Ver ruta del camión ${item.id}`);
        element.onclick = () => latest.current.select(latest.current.selected === item.id ? null : item.id);
        return new mapboxgl.Marker({ element }).setLngLat([item.longitude, item.latitude]).addTo(instance);
      });
    }
    latest.current.simulation.trucks.forEach((item, index) => {
      const atDepot = item.status === 'at_depot' || item.status === 'finished';
      markers.current[index].setLngLat([item.longitude, item.latitude]).setOffset(atDepot ? [(index - 2) * 24, 0] : [0, 0]);
    });
  };
  useEffect(() => {
    let instance: mapboxgl.Map;
    try {
      instance = new mapboxgl.Map({ container: container.current!, accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
        style: 'mapbox://styles/mapbox/light-v11', center: [-70.025, -15.84], zoom: 15.5 });
    } catch { onError(); return; }
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
    instance.on('error', onError);
    instance.on('load', () => {
      instance.addSource('service-sides', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addSource('truck-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addLayer({ id: 'selected-route', type: 'line', source: 'truck-route', paint: { 'line-width': 9, 'line-color': '#2465ce', 'line-opacity': .4 } });
      const styles = [{ state: 'pending', color: '#398160', dash: [2, 2] }, { state: 'in_progress', color: '#b17a06', dash: [1, 1] }, { state: 'visited', color: '#b95050', dash: [1, 0] }];
      for (const style of styles) {
        const id = `sides-${style.state}`;
        instance.addLayer({ id, type: 'line', source: 'service-sides', filter: ['==', ['get', 'state'], style.state], paint: { 'line-width': 5, 'line-color': style.color, 'line-dasharray': style.dash } });
        instance.on('click', id, event => { const taskId = event.features?.[0]?.properties?.id; if (taskId) latest.current.selectTask(String(taskId)); });
      }
      render();
    });
    return () => { markers.current.forEach(marker => marker.remove()); instance.remove(); map.current = null; };
  }, [network]);
  useEffect(render, [simulation, selected]);
  return <div ref={container} className="geographic-map" aria-label="Mapa de Mapbox con la red demostrativa superpuesta" />;
}
