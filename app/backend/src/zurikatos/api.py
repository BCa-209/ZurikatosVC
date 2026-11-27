import asyncio
import secrets
from contextlib import asynccontextmanager, suppress
from time import monotonic
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from .simulation import Simulation


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    operator_token: str = ''
    cors_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'


class ResetRequest(BaseModel):
    capacity_kg: int = Field(default=64, ge=8, le=500, strict=True)


class SpeedRequest(BaseModel):
    speed: Literal[1, 2, 4, 8]


def create_app(settings: Settings | None = None, simulation: Simulation | None = None, auto_tick: bool = True) -> FastAPI:
    settings = settings or Settings()
    simulation = simulation or Simulation()

    async def clock():
        previous = monotonic()
        while True:
            await asyncio.sleep(.25)
            now = monotonic()
            simulation.tick(now - previous)
            previous = now

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        task = asyncio.create_task(clock()) if auto_tick else None
        yield
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title='Zurikatos · API de simulación', version='0.1.0', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in settings.cors_origins.split(',')],
                       allow_methods=['GET', 'POST'], allow_headers=['Content-Type', 'X-Operator-Token'])
    router = APIRouter(prefix='/api')

    def operator(x_operator_token: Annotated[str | None, Header()] = None):
        if not settings.operator_token:
            raise HTTPException(503, detail='El acceso operativo aún no está configurado.')
        if not x_operator_token or not secrets.compare_digest(x_operator_token.encode(), settings.operator_token.encode()):
            raise HTTPException(401, detail='Clave de acceso incorrecta. Compruébala e inténtalo otra vez.')

    def execute(action):
        try:
            action()
        except ValueError as error:
            raise HTTPException(409, detail=str(error)) from error
        return simulation.snapshot()

    @router.get('/health')
    def health():
        return {'status': 'ok', 'version': '0.1.0'}

    @router.get('/network')
    def network():
        return simulation.network.snapshot()

    @router.get('/simulation')
    def state():
        return simulation.snapshot()

    @router.post('/operator/session', dependencies=[Depends(operator)])
    def session():
        return {'authorized': True}

    @router.post('/simulation/start', dependencies=[Depends(operator)])
    def start():
        return execute(simulation.start)

    @router.post('/simulation/pause', dependencies=[Depends(operator)])
    def pause():
        return execute(simulation.pause)

    @router.post('/simulation/reset', dependencies=[Depends(operator)])
    def reset(body: ResetRequest):
        return execute(lambda: simulation.reset(body.capacity_kg))

    @router.post('/simulation/speed', dependencies=[Depends(operator)])
    def speed(body: SpeedRequest):
        return execute(lambda: simulation.set_speed(body.speed))

    app.include_router(router)
    return app


app = create_app()
