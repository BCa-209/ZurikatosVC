# Zurikatos · aplicación

Base funcional del sistema propuesto en [02_prupuesta.md](../docs/results/02_prupuesta.md). El código del proyecto se desarrolla dentro de esta carpeta.

## Estructura

```text
app/
├── frontend/                 React + TypeScript + Vite
│   ├── src/                  Interfaz pública y controles operativos
│   └── tests/                Pruebas de navegador con Playwright
├── backend/                  Python + FastAPI
│   ├── .venv/                Entorno virtual local, ignorado por Git
│   ├── src/zurikatos/         Red dirigida, planificador, simulación y API
│   └── tests/                Invariantes del modelo y permisos
├── docs/                     Arquitectura y evaluación de Nielsen
└── scripts/                  Preparación y ejecución local
```

## Iniciar en Windows / terminal de VS Code

Requisitos: Node.js 22.12 o superior y Python 3.11 o superior. La instalación inicial se verificó con Node 24 y Python 3.14. Los archivos de bloqueo fijan las versiones utilizadas. Windows debe permitir escribir dentro de `app`.

Desde `C:\Program Files\Zuricatos\app`:

```powershell
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-backend.ps1
```

El script crea `backend/.venv`, instala las dependencias bloqueadas y genera una clave aleatoria en `backend/.env` si todavía no existe. `-ExecutionPolicy Bypass` solo afecta a ese proceso; no cambia la configuración de Windows.

En una terminal, inicia el backend:

```powershell
cd "C:\Program Files\Zuricatos\app"
npm run dev:backend
```

En otra terminal, inicia el frontend:

```powershell
cd "C:\Program Files\Zuricatos\app"
npm run dev
```

Abre [http://127.0.0.1:5173](http://127.0.0.1:5173). La documentación interactiva de la API está en [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

La consulta pública funciona sin clave y es de solo lectura. Para operar, abre `backend/.env` en VS Code, copia el valor de `OPERATOR_TOKEN` y úsalo en **Acceso operativo**. La clave se conserva únicamente en la memoria de la pestaña; salir o recargar requiere autenticarse de nuevo. No publiques `.env`.

### Preparación manual con venv

Como alternativa al script:

```powershell
cd "C:\Program Files\Zuricatos\app\backend"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
Copy-Item .env.example .env
```

Edita `OPERATOR_TOKEN` en `.env` y establece una clave antes de operar. No necesitas activar el entorno: los comandos usan directamente su ejecutable. En Linux/macOS, usa `python3 -m venv .venv` y `.venv/bin/python`.

## Qué incluye esta base

- Cinco camiones parten de un depósito común y regresan a él.
- Red demostrativa dirigida con seis manzanas y 24 lados independientes.
- Asignación única de tareas; recorridos continuos por aristas habilitadas.
- Traslados diferenciados de tramos de servicio: pasar por una calle no marca todos sus lados como atendidos.
- Transiciones **no visitado → en recorrido → visitado**. Al finalizar cada lado se asignan entre 5 y 8 kg enteros, una sola vez.
- Capacidad configurable para los cinco vehículos; se reserva el peor caso de 8 kg por tarea.
- Inicio, pausa, reanudación, velocidades y reinicio con confirmación; seguimiento público mediante consulta periódica a la API.
- Mapa esquemático accesible sin token; integración opcional con Mapbox.
- Filtros, detalle por lado, estado de conexión, errores recuperables y ayuda contextual.

### Mapbox opcional

Copia `frontend/.env.example` como `frontend/.env` y configura `VITE_MAPBOX_TOKEN` con un token público restringido por URL. Reinicia Vite. Nunca utilices un token privado en variables `VITE_*`, porque se incluyen en el frontend. Si Mapbox no carga, se muestra el esquema.

Aunque se active Mapbox, la red superpuesta sigue siendo sintética. Los fondos de Mapbox no convierten esta red en datos OSM reales.

## Validación

```powershell
# Desde app
npm run build
npm run test:e2e

# Desde app/backend
.\.venv\Scripts\python.exe -m pytest -q
```

Playwright inicia sus propios servidores en los puertos 5174 y 8001 y los detiene al terminar. En Windows usa Microsoft Edge instalado. En otros sistemas, instala el navegador con `npx playwright install chromium` desde `app/frontend`. Las capturas de escritorio y móvil se guardan en `frontend/test-results/` y se ignoran en Git.

Los criterios de interfaz están documentados en [heuristicas-nielsen.md](docs/heuristicas-nielsen.md).

## Alcance pendiente de la propuesta

Esta entrega es una base ejecutable, no el optimizador geográfico final. El planificador actual es una heurística de vecino cercano con balance de distancia; **no es B. Solver y no garantiza distancia mínima global**. El contrato `Planner` permite sustituirlo cuando se identifique la herramienta y su API.

Faltan la importación y validación de OSM para el área real de Puno, extracción de lados de manzana reales, filtros de acceso y relaciones de restricciones de giro. La demostración respeta las direcciones de sus propias aristas, pero no valida restricciones viales reales.

El estado está en memoria y se pierde al reiniciar el backend. Usa un solo proceso de servidor para esta versión. Antes de un despliegue público operativo, incorpora persistencia y cuentas con permisos individuales. La clave compartida sirve para el desarrollo local.
