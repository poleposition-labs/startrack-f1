from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="StarTrack F1 API",
    description="Open-Source Motorsport Analytics Engine. NOT affiliated with Formula 1.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Legal Disclaimer Injection
DISCLAIMER = "StarTrack F1 is an independent open-source project and is not affiliated with, endorsed by, or connected to Formula 1, Formula One Management, or the FIA."

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to StarTrack F1 API",
        "disclaimer": DISCLAIMER,
        "status": "active"
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
