import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Feature, LineString } from 'geojson';
import type { MapProps } from './RouteMap';
import type { AnimatedTruck } from './useTruckAnimation';
import { truckColors } from './types';
import { blockProgress } from './mapGeometry';

type Props = MapProps & { positions: AnimatedTruck[]; onError: () => void };

export default function GeographicMap(props: Props) {
  const { network, simulation, selected, positions } = props;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const loaded = useRef(false);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  latest.current = props;

  function updateLayers() {
    const instance = map.current;
    if (!instance || !loaded.current) return;
    const current = latest.current;
    const states = new Map(current.simulation.tasks.map(task => [task.id, task]));
    const blocks = { ...network.blocks, features: network.blocks.features.map(block => ({ ...block,
      properties: { ...block.properties, ...blockProgress(block.properties.task_ids, states) },
    })) };
    (instance.getSource('city-blocks') as mapboxgl.GeoJSONSource).setData(blocks);
    (instance.getSource('service-sides') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: network.tasks.map(task => ({
      type: 'Feature', properties: { id: task.id, state: states.get(task.id)?.state }, geometry: task.geometry,
    })) });
    const nodes = new Map(network.nodes.map(node => [node.id, node]));
    const edges = new Map(network.edges.map(edge => [edge.id, edge]));
    const routes: Feature<LineString>[] = current.simulation.trucks.flatMap((truck, index) => truck.route.map(leg => {
      const edge = edges.get(leg.edge_id)!, a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
      return { type: 'Feature', properties: { truck_id: truck.id, color: truckColors[index], opacity: !current.selected ? .3 : current.selected === truck.id ? .85 : .05 },
        geometry: { type: 'LineString', coordinates: [[a.longitude, a.latitude], [b.longitude, b.latitude]] } };
    }));
    (instance.getSource('truck-routes') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: routes });
  }

  function updateMarkers() {
    const instance = map.current;
    if (!instance || !loaded.current) return;
    if (!markers.current.length) {
      markers.current = latest.current.positions.map((truck, index) => {
        const button = document.createElement('button');
        button.className = 'geographic-truck';
        button.style.background = truckColors[index];
        button.dataset.truckId = truck.id;
        button.setAttribute('aria-label', `Ver ruta del camión ${truck.id}`);
        button.innerHTML = '<svg class="truck-glyph" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5h12v12H2z M14 9h4l4 4v4h-8z" fill="none" stroke="white" stroke-width="1.8"/><circle cx="6" cy="18" r="2" fill="white"/><circle cx="18" cy="18" r="2" fill="white"/></svg>';
        const label = document.createElement('span');
        label.className = 'truck-marker-label';
        label.textContent = truck.id;
        button.append(label);
        button.onclick = () => latest.current.select(latest.current.selected === truck.id ? null : truck.id);
        return new mapboxgl.Marker({ element: button }).setLngLat([truck.longitude, truck.latitude]).addTo(instance);
      });
    }
    latest.current.positions.forEach((truck, index) => {
      const marker = markers.current[index], button = marker.getElement();
      const spread = truck.status === 'at_depot' || truck.status === 'finished' ? 1 : Math.max(0, 1 - truck.travelled_m / 20);
      marker.setLngLat([truck.longitude, truck.latitude]).setOffset([(index - 2) * 28 * spread, 12 * spread]);
      button.dataset.routeDistance = truck.travelled_m.toFixed(2);
      button.setAttribute('aria-pressed', String(truck.id === latest.current.selected));
      (button.querySelector('.truck-glyph') as SVGElement).style.transform = `rotate(${truck.bearing - 90}deg)`;
    });
  }

  useEffect(() => {
    let instance: mapboxgl.Map;
    try {
      instance = new mapboxgl.Map({ container: container.current!, accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
        style: 'mapbox://styles/mapbox/light-v11', center: [-70.0235, -15.8402], zoom: 15.7, attributionControl: false });
    } catch { latest.current.onError(); return; }
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('error', () => { if (!loaded.current) latest.current.onError(); });
    instance.on('load', () => {
      const empty = { type: 'FeatureCollection' as const, features: [] };
      for (const id of ['city-blocks', 'service-sides', 'truck-routes']) instance.addSource(id, { type: 'geojson', data: empty });
      instance.addLayer({ id: 'blocks-fill', type: 'fill', source: 'city-blocks', paint: {
        'fill-color': ['match', ['get', 'state'], 'visited', '#b95050', 'partial', '#c28c20', '#398160'], 'fill-opacity': .22,
      } });
      instance.addLayer({ id: 'blocks-outline', type: 'line', source: 'city-blocks', paint: { 'line-color': '#4a6756', 'line-width': 1 } });
      instance.addLayer({ id: 'routes', type: 'line', source: 'truck-routes', paint: { 'line-width': 4, 'line-color': ['get', 'color'], 'line-opacity': ['get', 'opacity'] } });
      for (const style of [{ state: 'pending', color: '#398160', dash: [2, 2] }, { state: 'in_progress', color: '#b17a06', dash: [1, 1] }, { state: 'visited', color: '#b95050', dash: [1, 0] }]) {
        instance.addLayer({ id: `sides-${style.state}`, type: 'line', source: 'service-sides', filter: ['==', ['get', 'state'], style.state],
          paint: { 'line-width': 4, 'line-color': style.color, 'line-dasharray': style.dash } });
      }
      instance.addLayer({ id: 'block-labels', type: 'symbol', source: 'city-blocks', layout: { 'text-field': ['get', 'id'], 'text-size': 14 },
        paint: { 'text-color': '#244332', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      const depot = network.nodes.find(node => node.id === network.depot)!;
      instance.addSource('depot', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [depot.longitude, depot.latitude] } } });
      instance.addLayer({ id: 'depot-label', type: 'symbol', source: 'depot', layout: { 'text-field': 'Depósito', 'text-size': 13, 'text-offset': [0, -2] }, paint: { 'text-color': '#153d37', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      const layers = ['sides-pending', 'sides-in_progress', 'sides-visited', 'blocks-fill'];
      instance.on('click', event => {
        const feature = instance.queryRenderedFeatures(event.point, { layers })[0];
        if (feature?.layer.id === 'blocks-fill') latest.current.selectBlock(String(feature.properties!.id));
        else if (feature) latest.current.selectTask(String(feature.properties!.id));
      });
      instance.on('mousemove', event => { instance.getCanvas().style.cursor = instance.queryRenderedFeatures(event.point, { layers }).length ? 'pointer' : ''; });
      loaded.current = true;
      updateLayers(); updateMarkers(); setReady(true);
      const bounds = network.bounds ?? [[Math.min(...network.nodes.map(node => node.longitude)), Math.min(...network.nodes.map(node => node.latitude))], [Math.max(...network.nodes.map(node => node.longitude)), Math.max(...network.nodes.map(node => node.latitude))]];
      instance.fitBounds(bounds as [[number, number], [number, number]], { padding: { top: 70, bottom: 60, left: 45, right: 50 }, duration: 0 });
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current!);
    return () => { resize.disconnect(); loaded.current = false; markers.current.forEach(marker => marker.remove()); markers.current = []; instance.remove(); map.current = null; };
  }, [network]);
  useEffect(updateLayers, [simulation, selected]);
  useEffect(updateMarkers, [positions, selected]);
  return <div ref={container} className="geographic-map" data-testid="geographic-map" data-map-ready={ready} aria-label="Mapa interactivo de Mapbox con polígonos de manzanas y camiones simulados" />;
}
