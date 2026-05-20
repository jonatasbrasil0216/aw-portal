from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import clients, reports
from database import create_tables
import os

app = FastAPI(title="AW Portal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

create_tables()

app.include_router(clients.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}

# Serve built frontend in production.
# __file__ is /app/api/main.py, so ../web/dist = /app/web/dist
_frontend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "dist")
if os.path.exists(_frontend):
    app.mount("/", StaticFiles(directory=_frontend, html=True), name="static")
