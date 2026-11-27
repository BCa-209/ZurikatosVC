# Arquitectura inicial

El frontend consume `/api` y no decide rutas, cargas ni estados. FastAPI mantiene el estado autoritativo de una simulación compartida. Vite redirige `/api` al puerto 8000 durante el desarrollo; para otro despliegue, configura `VITE_API_BASE_URL` y `CORS_ORIGINS`.

## Backend

- `network.py`: nodos, aristas dirigidas y tareas por lado; rutas mínimas con Dijkstra. `allowed=False` excluye una arista. La fábrica actual genera una red sintética explícita.
- `planner.py`: contrato `Planner` y heurística reemplazable. Asigna las 24 tareas una sola vez, une cada servicio con traslados permitidos y reserva capacidad usando 8 kg por lado. Rechaza planes inviables antes de modificar la sesión.
- `simulation.py`: avances por tramo, posiciones interpoladas, carga y tiempos UTC. Un bloqueo protege el estado frente a consultas y operaciones concurrentes. El reloj usa tiempo monotónico; solo avanza cuando está en curso. La velocidad 1× representa 15 segundos simulados por segundo real.
- `api.py`: validación de solicitudes, CORS, lectura pública y operaciones con `X-Operator-Token`. Si no hay clave configurada, las escrituras están deshabilitadas.

## Contrato HTTP

| Método | Ruta | Permiso / propósito |
| --- | --- | --- |
| GET | `/api/health` | Público; disponibilidad |
| GET | `/api/network` | Público; red y lados |
| GET | `/api/simulation` | Público; posiciones, tareas y totales |
| POST | `/api/operator/session` | Validar clave operativa |
| POST | `/api/simulation/start` | Operador; iniciar o reanudar |
| POST | `/api/simulation/pause` | Operador; pausar |
| POST | `/api/simulation/speed` | Operador; `{ "speed": 1, 2, 4 u 8 }` |
| POST | `/api/simulation/reset` | Operador; `{ "capacity_kg": 64 }` |

## Integración geográfica futura

La importación OSM deberá producir una red dirigida y asociar cada lado real con una arista de servicio permitida. No basta con conectar puntos: deben conservarse sentidos únicos, restricciones de acceso, exclusiones y relaciones de giro. El motor actual no modela giros prohibidos; esa capa debe añadirse antes de usar datos operativos.

Una implementación de B. Solver deberá cumplir `Planner.plan(network, capacity_kg)` y devolver cinco listas de `Leg`. Cada tramo distingue `task_id` (servicio) de `None` (traslado). Las pruebas de cobertura, continuidad, dirección y capacidad son requisitos para cualquier nuevo planificador.

La persistencia futura debe guardar geometrías, planes, eventos de atención y permisos de usuarios. No debe utilizarse la memoria de varios procesos como fuente compartida de verdad.
