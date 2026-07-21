from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(
    title="AI Weather Intelligence Platform Backend API",
    description="Scalable enterprise API backend for global weather monitoring, GIS overlays, and AI prediction models.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WeatherQuery(BaseModel):
    latitude: float
    longitude: float
    target_date: Optional[str] = None

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": "AI Weather Intelligence Platform Backend",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/v1/weather/prediction")
def get_weather_prediction(query: WeatherQuery):
    return {
        "success": True,
        "latitude": query.latitude,
        "longitude": query.longitude,
        "target_date": query.target_date,
        "prediction": {
            "probability": 15,
            "risk_level": "LOW",
            "confidence": 92,
            "message": "Atmospheric pressure and gradient remain stable."
        }
    }
