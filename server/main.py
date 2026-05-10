import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from routes.projects import router as projects_router
from routes.intake import router as intake_router
from routes.contact import router as contact_router
from routes.admin import router as admin_router

app = FastAPI(title="Cavalier Flooring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(projects_router, prefix="/api")
app.include_router(intake_router, prefix="/api")
app.include_router(contact_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/track/visit", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(payload: dict | None = None):
    return None
