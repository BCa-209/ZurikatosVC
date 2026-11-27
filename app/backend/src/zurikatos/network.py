"""Red dirigida SINTÉTICA. No contiene cartografía ni restricciones OSM reales."""
from dataclasses import asdict, dataclass
from heapq import heappop, heappush
from math import hypot


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


class Network:
    def __init__(self, nodes: list[Node], edges: list[Edge], tasks: list[Task], depot: str):
        self.nodes = {item.id: item for item in nodes}
        self.edges = {item.id: item for item in edges}
        self.tasks = {item.id: item for item in tasks}
        self.depot = depot
        self.outgoing: dict[str, list[Edge]] = {node.id: [] for node in nodes}
        for edge in edges:
            if edge.allowed:
                self.outgoing[edge.source].append(edge)

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
        return {'source': 'synthetic_demo', 'depot': self.depot,
                'description': 'Red demostrativa de 6 manzanas; no es cartografía real de Puno.',
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
    return Network(nodes, edges, tasks, 'n00')
