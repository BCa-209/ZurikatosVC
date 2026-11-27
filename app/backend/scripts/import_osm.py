"""Descarga una zona acotada de OSM y genera manzanas inferidas de su red vial."""
import argparse
from dataclasses import asdict
from datetime import datetime, timezone
import json
from math import cos, hypot, radians
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import networkx as nx
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from zurikatos.network import Edge, Network, Node, Task

ROOT = Path(__file__).resolve().parents[1]
BBOX = (-15.845, -70.029, -15.836, -70.018)  # sur, oeste, norte, este
CENTER = (-70.0235, -15.8402)
QUERY = f'''[out:json][timeout:45];
way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street)$"]["area"!="yes"]({','.join(map(str, BBOX))});
(._;>;);out body;'''


def convert_osm(data: dict, max_blocks: int = 8) -> Network:
    south, west, north, east = BBOX
    scale_x, scale_y = 111320 * cos(radians(CENTER[1])), 111320
    project = lambda lon, lat: ((lon - CENTER[0]) * scale_x, (lat - CENTER[1]) * scale_y)
    unproject = lambda x, y: [CENTER[0] + x / scale_x, CENTER[1] + y / scale_y]
    osm_nodes = {str(item['id']): item for item in data['elements'] if item['type'] == 'node'}
    coordinates = {key: project(item['lon'], item['lat']) for key, item in osm_nodes.items()}
    edges = []
    for way in (item for item in data['elements'] if item['type'] == 'way'):
        tags = way.get('tags', {})
        if (any(tags.get(key) in {'no', 'private'} for key in ('access', 'vehicle', 'motor_vehicle', 'motorcar'))
                or tags.get('service') == 'alley' or tags.get('tunnel') == 'yes'
                or tags.get('bridge') == 'yes' or tags.get('layer', '0') != '0'
                or tags.get('name', '').lower().startswith(('pasaje', 'callejón'))):
            continue
        one_way = tags.get('oneway', 'yes' if tags.get('junction') == 'roundabout' else 'no')
        for index, (start_id, end_id) in enumerate(zip(way['nodes'], way['nodes'][1:])):
            a, b = str(start_id), str(end_id)
            if a not in coordinates or b not in coordinates:
                continue
            if not all(south <= osm_nodes[key]['lat'] <= north and west <= osm_nodes[key]['lon'] <= east for key in (a, b)):
                continue
            distance = hypot(coordinates[a][0] - coordinates[b][0], coordinates[a][1] - coordinates[b][1])
            if distance < .1:
                continue
            directions = [(b, a)] if one_way == '-1' else [(a, b)] if one_way in {'yes', '1', 'true'} else [(a, b), (b, a)]
            for direction, (source, target) in enumerate(directions):
                edges.append(Edge(f'w{way["id"]}:{index}:{direction}', source, target, distance,
                                  tags.get('name', tags.get('ref', 'Vía sin nombre'))))
    graph = nx.DiGraph((edge.source, edge.target) for edge in edges)
    if not graph:
        raise ValueError('OSM no devolvió una red vial utilizable.')
    component = max(nx.strongly_connected_components(graph), key=len)
    edges = [edge for edge in edges if edge.source in component and edge.target in component]
    physical = {tuple(sorted((edge.source, edge.target))): edge for edge in edges}
    lines = [LineString([coordinates[a], coordinates[b]]) for a, b in physical]
    candidates = [polygon for polygon in polygonize(unary_union(lines))
                  if 800 <= polygon.area <= 50000 and not polygon.interiors]
    candidates.sort(key=lambda polygon: polygon.centroid.distance(Point(0, 0)))
    lookup = {(round(point[0], 5), round(point[1], 5)): key for key, point in coordinates.items() if key in component}
    by_pair = {(edge.source, edge.target): edge for edge in edges}
    min_x = min(coordinates[key][0] for key in component)
    max_x = max(coordinates[key][0] for key in component)
    min_y = min(coordinates[key][1] for key in component)
    max_y = max(coordinates[key][1] for key in component)
    screen_scale = min(700 / (max_x - min_x), 420 / (max_y - min_y))
    screen = lambda x, y: [410 + (x - (min_x + max_x) / 2) * screen_scale,
                           290 - (y - (min_y + max_y) / 2) * screen_scale]
    tasks, blocks = [], []
    for polygon in candidates:
        ring = list(polygon.exterior.coords)
        pairs = []
        for start, end in zip(ring, ring[1:]):
            a = lookup.get((round(start[0], 5), round(start[1], 5)))
            b = lookup.get((round(end[0], 5), round(end[1], 5)))
            edge = by_pair.get((a, b)) or by_pair.get((b, a))
            if edge is None:
                break
            pairs.append((start, end, edge))
        if len(pairs) != len(ring) - 1:
            continue  # No crear tareas que requieran conexiones inventadas.
        inset = polygon.buffer(-5, join_style=2)
        if not isinstance(inset, Polygon) or inset.is_empty or not inset.is_valid:
            continue
        block_id = f'M{len(blocks) + 1:02d}'
        block_tasks = []
        for index, (a, b, edge) in enumerate(pairs):
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = hypot(dx, dy)
            nx_, ny_ = -dy / length, dx / length
            midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            sign = 1 if polygon.contains(Point(midpoint[0] + nx_, midpoint[1] + ny_)) else -1
            offset = min(5, length / 5)
            service_line = [[a[0] + nx_ * sign * offset, a[1] + ny_ * sign * offset],
                            [b[0] + nx_ * sign * offset, b[1] + ny_ * sign * offset]]
            task_id = f'{block_id}-lado-{index + 1:02d}'
            tasks.append(Task(task_id, block_id, f'Lado {index + 1:02d}', edge.id,
                              {'type': 'LineString', 'coordinates': [unproject(*point) for point in service_line]},
                              [screen(*point) for point in service_line]))
            block_tasks.append(task_id)
        display_ring = list(inset.exterior.coords)
        blocks.append({'type': 'Feature', 'id': block_id, 'properties': {
            'id': block_id, 'task_ids': block_tasks, 'area_m2': round(polygon.area),
            'screen_coordinates': [[screen(*point) for point in display_ring]],
            'screen_centroid': screen(polygon.centroid.x, polygon.centroid.y),
            'centroid': unproject(polygon.centroid.x, polygon.centroid.y),
        }, 'geometry': {'type': 'Polygon', 'coordinates': [[unproject(*point) for point in display_ring]]}})
        if len(blocks) >= max_blocks:
            break
    if not blocks:
        raise ValueError('No se encontraron manzanas cerradas conectadas con la red dirigida.')
    nodes = [Node(key, *screen(*coordinates[key]), osm_nodes[key]['lon'], osm_nodes[key]['lat']) for key in sorted(component)]
    depot = min(component, key=lambda key: hypot(*coordinates[key]))
    return Network(nodes, edges, tasks, depot, blocks, {
        'source': 'openstreetmap', 'description': 'Manzanas inferidas de la red vial de OpenStreetMap en Puno; no son límites catastrales.',
        'attribution': '© OpenStreetMap contributors · ODbL 1.0',
        'license_url': 'https://www.openstreetmap.org/copyright',
        'fetched_at': datetime.now(timezone.utc).isoformat(), 'bbox': list(BBOX),
        'bounds': [[min(node.longitude for node in nodes), min(node.latitude for node in nodes)],
                   [max(node.longitude for node in nodes), max(node.latitude for node in nodes)]],
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Reutilizar la descarga OSM local.')
    parser.add_argument('--blocks', type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.blocks <= 30:
        parser.error('--blocks debe estar entre 1 y 30')
    directory = ROOT / 'data'
    directory.mkdir(exist_ok=True)
    cache = directory / 'puno.osm.json'
    if not args.offline:
        request = Request('https://overpass-api.de/api/interpreter', data=urlencode({'data': QUERY}).encode(),
                          headers={'User-Agent': 'Zurikatos-academic-simulation/0.2', 'Content-Type': 'application/x-www-form-urlencoded'})
        with urlopen(request, timeout=75) as response:
            payload = json.load(response)
        if payload.get('remark'):
            raise RuntimeError(f'Overpass devolvió una respuesta parcial: {payload["remark"]}')
        cache.write_text(json.dumps(payload), encoding='utf-8')
    payload = json.loads(cache.read_text(encoding='utf-8'))
    network = convert_osm(payload, args.blocks)
    # Validar cobertura, direcciones y capacidad antes de sustituir los datos locales.
    from zurikatos.simulation import Simulation
    Simulation(network=network)
    (directory / 'puno-network.json').write_text(json.dumps(network.snapshot(), ensure_ascii=False, indent=2), encoding='utf-8')
    (directory / 'puno-query.overpass').write_text(QUERY + '\n', encoding='utf-8')
    print(f'Red lista: {len(network.nodes)} nodos, {len(network.edges)} aristas, {len(network.blocks)} manzanas, {len(network.tasks)} lados/tramos.')


if __name__ == '__main__':
    main()
