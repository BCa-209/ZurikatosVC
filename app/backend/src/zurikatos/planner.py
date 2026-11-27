"""La heurística inicial NO es B. Solver ni garantiza un óptimo global."""
from dataclasses import dataclass
from typing import Protocol
from .network import Network


@dataclass(frozen=True)
class Leg:
    edge_id: str
    task_id: str | None = None


class Planner(Protocol):
    name: str

    def plan(self, network: Network, capacity_kg: int) -> list[list[Leg]]: ...


class GreedyPlanner:
    name = 'Heurística demostrativa de vecino cercano'

    def plan(self, network: Network, capacity_kg: int) -> list[list[Leg]]:
        routes: list[list[Leg]] = [[] for _ in range(5)]
        positions = [network.depot] * 5
        distances = [0.0] * 5
        counts = [0] * 5
        pending = set(network.tasks)
        while pending:
            candidates = []
            for truck in range(5):
                if (counts[truck] + 1) * 8 > capacity_kg:
                    continue
                for task_id in sorted(pending):
                    task = network.tasks[task_id]
                    edge = network.edges[task.edge_id]
                    if not edge.allowed:
                        continue
                    try:
                        distance, path = network.shortest_path(positions[truck], edge.source)
                        network.shortest_path(edge.target, network.depot)
                    except ValueError:
                        continue
                    candidates.append((distance + edge.distance_m + distances[truck] * .5,
                                       truck, task_id, path, distance))
            if not candidates:
                raise ValueError('La capacidad o la red vial no permiten atender todos los lados. Aumenta la capacidad y vuelve a intentarlo.')
            _, truck, task_id, path, distance = min(candidates)
            task = network.tasks[task_id]
            edge = network.edges[task.edge_id]
            routes[truck].extend(Leg(edge_id) for edge_id in path)
            routes[truck].append(Leg(edge.id, task_id))
            positions[truck] = edge.target
            distances[truck] += distance + edge.distance_m
            counts[truck] += 1
            pending.remove(task_id)
        for truck in range(5):
            _, path = network.shortest_path(positions[truck], network.depot)
            routes[truck].extend(Leg(edge_id) for edge_id in path)
        return routes
