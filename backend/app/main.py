import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

from app.hardening import FORCE_HTTPS, SecurityHeadersMiddleware
from app.ratelimit import RateLimitMiddleware
from app.routes.auth import router as auth_router
from app.routes.logs import router as logs_router
from app.routes.progress import router as progress_router
from app.routes.push import router as push_router
from app.routes.rewards import punishments_router, rewards_router
from app.routes.workouts import router as workouts_router
from app.scheduler import scheduler, start_scheduler

load_dotenv()

DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    start_scheduler()

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Solo Leveling Fitness API", lifespan=lifespan)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if FORCE_HTTPS:
    app.add_middleware(HTTPSRedirectMiddleware)

app.include_router(auth_router)
app.include_router(workouts_router)
app.include_router(logs_router)
app.include_router(progress_router)
app.include_router(rewards_router)
app.include_router(punishments_router)
app.include_router(push_router)


@app.get("/")
def root():
    return {"message": "Solo Leveling Fitness API running"}
