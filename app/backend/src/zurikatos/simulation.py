from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from random import Random
from threading import RLock
from math import ceil
from uuid import uuid4
from .network import Network, load_network
from .planner import GreedyPlanner, Planner


@dataclass
class TaskState:
    id: str
    truck_id: str
    state: str = 'pending'
    collected_kg: int = 0
    started_at: str | None = None
    completed_at: str | None = None


@dataclass
class Truck:
    id: str
    leg_index: int = 0
    progress_m: float = 0
    collected_kg: int = 0
    completed_sides: int = 0
    travelled_m: float = 0


class Simulation:
    def __init__(self, network: Network | None = None, planner: Planner | None = None, seed: int | None = None):
        self.network = network or load_network()
        self.planner = planner or GreedyPlanner()
        self.random = Random(seed)
        self.lock = RLock()
        self.reset(max(64, ceil(len(self.network.tasks) / 5) * 8))

    def reset(self, capacity_kg: int):
        with self.lock:
            routes = self.planner.plan(self.network, capacity_kg)
            self.routes = routes
            self.generation_id = str(uuid4())
            self.capacity_kg = capacity_kg
            self.speed = 1
            self.elapsed_seconds = 0.0
            self.status = 'ready'
            self.trucks = [Truck(f'T{i + 1:02d}') for i in range(5)]
            self.tasks = {leg.task_id: TaskState(leg.task_id, self.trucks[index].id)
                          for index, route in enumerate(routes) for leg in route if leg.task_id}
            self.updated_at = self.timestamp()

    @staticmethod
    def timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()

    def start(self):
        with self.lock:
            if self.status == 'completed':
                raise ValueError('La simulación terminó. Reiníciala para comenzar otro recorrido.')
            self.status = 'running'
            self.updated_at = self.timestamp()

    def pause(self):
        with self.lock:
            if self.status != 'running':
                raise ValueError('Solo puedes pausar una simulación en curso.')
            self.status = 'paused'
            self.updated_at = self.timestamp()

    def set_speed(self, speed: int):
        with self.lock:
            self.speed = speed
            self.updated_at = self.timestamp()

    def tick(self, wall_seconds: float):
        with self.lock:
            if self.status != 'running':
                return
            simulated = max(0, wall_seconds) * self.speed * 15
            self.elapsed_seconds += simulated
            for index, truck in enumerate(self.trucks):
                budget = simulated * 5
                route = self.routes[index]
                while budget > 0 and truck.leg_index < len(route):
                    leg = route[truck.leg_index]
                    edge = self.network.edges[leg.edge_id]
                    task = self.tasks[leg.task_id] if leg.task_id else None
                    if task and task.state == 'pending':
                        task.state = 'in_progress'
                        task.started_at = self.timestamp()
                    remaining = edge.distance_m - truck.progress_m
                    moved = min(budget, remaining)
                    truck.progress_m += moved
                    truck.travelled_m += moved
                    budget -= moved
                    if truck.progress_m + 1e-8 < edge.distance_m:
                        break
                    if task and task.state != 'visited':
                        task.collected_kg = self.random.randint(5, 8)
                        task.state = 'visited'
                        task.completed_at = self.timestamp()
                        truck.collected_kg += task.collected_kg
                        truck.completed_sides += 1
                    truck.leg_index += 1
                    truck.progress_m = 0
            if all(truck.leg_index == len(self.routes[index]) for index, truck in enumerate(self.trucks)):
                self.status = 'completed'
            self.updated_at = self.timestamp()

    def snapshot(self) -> dict:
        with self.lock:
            trucks = []
            for index, truck in enumerate(self.trucks):
                route = self.routes[index]
                node = self.network.nodes[self.network.depot]
                x, y, lon, lat = node.x, node.y, node.longitude, node.latitude
                current_task = None
                truck_status = 'at_depot' if self.status == 'ready' else 'finished'
                if truck.leg_index < len(route) and self.status != 'ready':
                    leg = route[truck.leg_index]
                    edge = self.network.edges[leg.edge_id]
                    start, end = self.network.nodes[edge.source], self.network.nodes[edge.target]
                    fraction = truck.progress_m / edge.distance_m
                    x, y = start.x + (end.x - start.x) * fraction, start.y + (end.y - start.y) * fraction
                    lon = start.longitude + (end.longitude - start.longitude) * fraction
                    lat = start.latitude + (end.latitude - start.latitude) * fraction
                    current_task = leg.task_id
                    truck_status = 'collecting' if current_task and truck.progress_m > 0 else 'traveling'
                    if self.status == 'paused':
                        truck_status = 'paused'
                trucks.append({**asdict(truck), 'x': x, 'y': y, 'longitude': lon, 'latitude': lat,
                               'status': truck_status, 'current_task': current_task,
                               'capacity_kg': self.capacity_kg,
                               'assigned_sides': sum(1 for leg in route if leg.task_id),
                               'distance_m': round(sum(self.network.edges[leg.edge_id].distance_m for leg in route)),
                               'route': [asdict(leg) for leg in route]})
            states = list(self.tasks.values())
            return {'status': self.status, 'speed': self.speed, 'capacity_kg': self.capacity_kg,
                    'elapsed_seconds': round(self.elapsed_seconds), 'updated_at': self.updated_at,
                    'generation_id': self.generation_id,
                    'planner': self.planner.name, 'data_source': self.network.metadata['source'],
                    'trucks': trucks, 'tasks': [asdict(task) for task in states],
                    'summary': {'total': len(states), 'visited': sum(task.state == 'visited' for task in states),
                                'in_progress': sum(task.state == 'in_progress' for task in states),
                                'pending': sum(task.state == 'pending' for task in states),
                                'collected_kg': sum(task.collected_kg for task in states),
                                'distance_m': sum(item['distance_m'] for item in trucks)}}
