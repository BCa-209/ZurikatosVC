"""Red dirigida SINTÉTICA. No contiene cartografía ni restricciones OSM reales."""
from dataclasses import asdict, dataclass, replace
from functools import lru_cache
from heapq import heappop, heappush
from math import hypot
from pathlib import Path
import json


@dataclass(frozen=True)
class Node:
    id: str
    x: float
    y: float
    longitude: float
    latitude: float


@dataclass(frozen=True)
class Edge:
    id: str
    source: str
    target: str
    distance_m: float
    name: str
    allowed: bool = True


@dataclass(frozen=True)
class Task:
    id: str
    block_id: str
    side: str
    edge_id: str
    geometry: dict | None = None
    screen_coordinates: list | None = None


class Network:
    def __init__(self, nodes: list[Node], edges: list[Edge], tasks: list[Task], depot: str,
                 blocks: list[dict] | None = None, metadata: dict | None = None):
        self.nodes = {item.id: item for item in nodes}
        self.edges = {item.id: item for item in edges}
        self.tasks = {item.id: item for item in tasks}
        self.depot = depot
        self.blocks = blocks or []
        self.metadata = metadata or {'source': 'synthetic_demo', 'description': 'Red sintética de demostración.'}
        self.outgoing: dict[str, list[Edge]] = {node.id: [] for node in nodes}
        for edge in edges:
            if edge.allowed:
                self.outgoing[edge.source].append(edge)

    @lru_cache(maxsize=8192)
    def shortest_path(self, source: str, target: str) -> tuple[float, list[str]]:
        queue: list[tuple[float, str, list[str]]] = [(0.0, source, [])]
        visited: set[str] = set()
        while queue:
            distance, current, path = heappop(queue)
            if current in visited:
                continue
            if current == target:
                return distance, path
            visited.add(current)
            for edge in self.outgoing[current]:
                if edge.target not in visited:
                    heappush(queue, (distance + edge.distance_m, edge.target, path + [edge.id]))
        raise ValueError(f'No existe conexión vial permitida de {source} a {target}.')

    def snapshot(self) -> dict:
        return {**self.metadata, 'depot': self.depot,
                'blocks': {'type': 'FeatureCollection', 'features': self.blocks},
                'nodes': [asdict(item) for item in self.nodes.values()],
                'edges': [asdict(item) for item in self.edges.values()],
                'tasks': [asdict(item) for item in self.tasks.values()]}


def demo_network() -> Network:
    nodes = [Node(f'n{x}{y}', 105 + x * 205, 100 + y * 190,
                  -70.028 + x * .0019, -15.838 - y * .0017)
             for y in range(3) for x in range(4)]
    by_id = {node.id: node for node in nodes}
    edges: list[Edge] = []

    def connect(a: str, b: str, name: str):
        start, end = by_id[a], by_id[b]
        edges.append(Edge(f'{a}-{b}', a, b, hypot(end.x - start.x, end.y - start.y), name))

    for y in range(3):
        for x in range(3):
            a, b = f'n{x}{y}', f'n{x + 1}{y}'
            connect(a if y % 2 == 0 else b, b if y % 2 == 0 else a, f'Vía {chr(65 + y)}')
    for x in range(4):
        for y in range(2):
            a, b = f'n{x}{y}', f'n{x}{y + 1}'
            connect(a, b, f'Vía {x + 1}')
            connect(b, a, f'Vía {x + 1}')
    tasks: list[Task] = []
    for y in range(2):
        for x in range(3):
            block = f'M{y * 3 + x + 1:02d}'
            north = (f'n{x}{y}', f'n{x + 1}{y}') if y % 2 == 0 else (f'n{x + 1}{y}', f'n{x}{y}')
            south = (f'n{x}{y + 1}', f'n{x + 1}{y + 1}') if (y + 1) % 2 == 0 else (f'n{x + 1}{y + 1}', f'n{x}{y + 1}')
            for side, pair in [('Norte', north), ('Este', (f'n{x + 1}{y}', f'n{x + 1}{y + 1}')),
                               ('Sur', south), ('Oeste', (f'n{x}{y + 1}', f'n{x}{y}'))]:
                tasks.append(Task(f'{block}-{side.lower()}', block, side, f'{pair[0]}-{pair[1]}'))
    blocks = []
    geographic = lambda x, y: [-70.028 + (x - 105) / 205 * .0019, -15.838 - (y - 100) / 190 * .0017]
    for y in range(2):
        for x in range(3):
            block_id = f'M{y * 3 + x + 1:02d}'
            left, top = 118 + x * 205, 113 + y * 190
            ring = [[left, top], [left + 179, top], [left + 179, top + 164], [left, top + 164], [left, top]]
            blocks.append({'type': 'Feature', 'id': block_id, 'properties': {
                'id': block_id, 'task_ids': [task.id for task in tasks if task.block_id == block_id],
                'screen_coordinates': [ring], 'screen_centroid': [left + 89.5, top + 82],
                'centroid': geographic(left + 89.5, top + 82), 'area_m2': 179 * 164,
            }, 'geometry': {'type': 'Polygon', 'coordinates': [[geographic(*point) for point in ring]]}})
    for index, task in enumerate(tasks):
        edge = next(item for item in edges if item.id == task.edge_id)
        a, b = by_id[edge.source], by_id[edge.target]
        ox = -13 if task.side == 'Este' else 13 if task.side == 'Oeste' else 0
        oy = 13 if task.side == 'Norte' else -13 if task.side == 'Sur' else 0
        line = [[a.x + ox, a.y + oy], [b.x + ox, b.y + oy]]
        tasks[index] = replace(task, screen_coordinates=line,
                               geometry={'type': 'LineString', 'coordinates': [geographic(*point) for point in line]})
    return Network(nodes, edges, tasks, 'n00', blocks)


DATA_PATH = Path(__file__).resolve().parents[2] / 'data' / 'puno-network.json'


def load_network() -> Network:
    if not DATA_PATH.exists():
        return demo_network()
    data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    metadata = {key: value for key, value in data.items() if key not in {'nodes', 'edges', 'tasks', 'blocks', 'depot'}}
    return Network([Node(**item) for item in data['nodes']], [Edge(**item) for item in data['edges']],
                   [Task(**item) for item in data['tasks']], data['depot'], data['blocks']['features'], metadata)
