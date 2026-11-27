export type SideStatus = 'pending' | 'in_progress' | 'visited';
export interface RoadNode { id: string; x: number; y: number; longitude: number; latitude: number }
export interface RoadEdge { id: string; source: string; target: string; distance_m: number; name: string; allowed: boolean }
export interface ServiceTask { id: string; block_id: string; side: string; edge_id: string; geometry: import('geojson').LineString; screen_coordinates: number[][] }
export interface BlockProperties { id: string; task_ids: string[]; area_m2: number; screen_coordinates: number[][][]; screen_centroid: number[]; centroid: number[] }
export type BlockFeature = import('geojson').Feature<import('geojson').Polygon, BlockProperties>;
export interface Network { source: string; description: string; depot: string; nodes: RoadNode[]; edges: RoadEdge[]; tasks: ServiceTask[]; blocks: import('geojson').FeatureCollection<import('geojson').Polygon, BlockProperties>; bounds?: [[number, number], [number, number]]; attribution?: string; fetched_at?: string }
export interface TaskState { id: string; truck_id: string; state: SideStatus; collected_kg: number; started_at: string | null; completed_at: string | null }
export interface Truck { id: string; x: number; y: number; longitude: number; latitude: number; status: string; current_task: string | null; travelled_m: number; leg_index: number; progress_m: number; collected_kg: number; completed_sides: number; assigned_sides: number; capacity_kg: number; distance_m: number; route: { edge_id: string; task_id: string | null }[] }
export interface Simulation { status: 'ready' | 'running' | 'paused' | 'completed'; speed: number; capacity_kg: number; elapsed_seconds: number; updated_at: string; generation_id: string; planner: string; trucks: Truck[]; tasks: TaskState[]; summary: { total: number; visited: number; in_progress: number; pending: number; collected_kg: number; distance_m: number } }
export const stateLabels: Record<SideStatus, string> = { pending: 'No visitado', in_progress: 'En recorrido', visited: 'Visitado' };
export const truckLabels: Record<string, string> = { at_depot: 'En el depósito', traveling: 'En traslado', collecting: 'Recolectando', paused: 'En pausa', finished: 'En el depósito' };
export const statusLabels: Record<Simulation['status'], string> = { ready: 'Lista para iniciar', running: 'En curso', paused: 'En pausa', completed: 'Completada' };
export const truckColors = ['#2465ce', '#8252bb', '#087d86', '#ad4c0c', '#b13c83'];
