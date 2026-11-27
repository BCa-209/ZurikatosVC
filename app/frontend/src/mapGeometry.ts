import type { Network, Simulation, TaskState } from './types';

export function blockProgress(taskIds: string[], tasks: Map<string, TaskState>) {
  const visited = taskIds.filter(id => tasks.get(id)?.state === 'visited').length;
  const active = taskIds.some(id => tasks.get(id)?.state === 'in_progress');
  return { visited, total: taskIds.length, state: visited === taskIds.length ? 'visited' : visited || active ? 'partial' : 'pending' };
}

// Interpolar distancia sobre la ruta evita atajos diagonales entre dos posiciones.
export function routePosition(network: Network, truck: Simulation['trucks'][number], distance: number) {
  const nodes = new Map(network.nodes.map(node => [node.id, node]));
  const edges = new Map(network.edges.map(edge => [edge.id, edge]));
  let remaining = Math.max(0, distance);
  for (let index = 0; index < truck.route.length; index++) {
    const edge = edges.get(truck.route[index].edge_id)!;
    if (remaining <= edge.distance_m || index === truck.route.length - 1) {
      const a = nodes.get(edge.source)!, b = nodes.get(edge.target)!;
      const fraction = Math.min(1, remaining / edge.distance_m);
      return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction,
        longitude: a.longitude + (b.longitude - a.longitude) * fraction,
        latitude: a.latitude + (b.latitude - a.latitude) * fraction,
        bearing: Math.atan2(b.x - a.x, a.y - b.y) * 180 / Math.PI };
    }
    remaining -= edge.distance_m;
  }
  const depot = nodes.get(network.depot)!;
  return { x: depot.x, y: depot.y, longitude: depot.longitude, latitude: depot.latitude, bearing: 0 };
}
