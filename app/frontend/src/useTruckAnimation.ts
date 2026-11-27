import { useEffect, useRef, useState } from 'react';
import type { Network, Simulation, Truck } from './types';
import { routePosition } from './mapGeometry';
export type AnimatedTruck = Truck & { bearing: number };

export function useTruckAnimation(network: Network, simulation: Simulation) {
  const immediate = () => simulation.trucks.map(truck => ({ ...truck, bearing: routePosition(network, truck, truck.travelled_m).bearing }));
  const [positions, setPositions] = useState<AnimatedTruck[]>(immediate);
  const current = useRef(positions);
  const generation = useRef(simulation.generation_id);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const reset = generation.current !== simulation.generation_id;
    generation.current = simulation.generation_id;
    if (reset || simulation.status !== 'running' || reducedMotion) {
      const next = immediate(); current.current = next; setPositions(next); return;
    }
    const from = new Map(current.current.map(truck => [truck.id, truck.travelled_m]));
    const started = performance.now();
    let frame: number;
    const animate = (now: number) => {
      const fraction = Math.min(1, (now - started) / 1000);
      const next = simulation.trucks.map(truck => {
        const start = Math.min(from.get(truck.id) ?? truck.travelled_m, truck.travelled_m);
        const distance = start + (truck.travelled_m - start) * fraction;
        return { ...truck, ...routePosition(network, truck, distance), travelled_m: distance };
      });
      current.current = next; setPositions(next);
      if (fraction < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [network, simulation, reducedMotion]);
  return positions;
}
