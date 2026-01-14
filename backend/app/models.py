from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CircuitSegment(BaseModel):
    id: str
    type: str  # 'straight', 'corner'
    length: float  # meters
    radius: Optional[float] = 0  # meters, 0 if straight
    
class Circuit(BaseModel):
    name: str
    segments: List[CircuitSegment]

class PitStop(BaseModel):
    lap: int
    tire: str

class RaceStrategy(BaseModel):
    total_laps: int = 1
    starting_tire: str = "soft"
    starting_fuel: float = 100.0
    pit_stops: List[PitStop] = []

class SimulationRequest(BaseModel):
    circuit: Circuit
    tire_compound: str = "soft"
    weather: str = "dry"
    laps: int = 1

class RaceRequest(BaseModel):
    circuit: Circuit
    strategy: RaceStrategy
    weather: str = "dry"

class TelemetryPoint(BaseModel):
    time: float
    dist: float
    speed: float
    battery: float
    tire_life: float
    tire_temp: float
    brake_temp: float
    fuel: float
    g_lateral: float
    g_longitudinal: float
    segment_type: str
    sector: int

class LapResult(BaseModel):
    lap_number: int
    lap_time: float
    pure_lap_time: Optional[float] = None
    pit_stop: bool = False
    pit_time: float = 0
    cumulative_time: Optional[float] = None
    tire_compound: Optional[str] = None
    tire_life: Optional[float] = None
    fuel: Optional[float] = None
    sector_times: Optional[List[float]] = None
    telemetry: List[Dict[str, Any]]

class ApexPoint(BaseModel):
    segment_id: str
    segment_index: int
    recommended_speed: float
    radius: float
    tip: str

class StrategyRecommendation(BaseModel):
    recommendation: str
    starting_tire: str
    pit_stops: List[Dict[str, Any]]
    explanation: str

class TrackTemplate(BaseModel):
    id: str
    name: str
    length_km: float
    preview_points: Optional[List[Dict[str, float]]] = None

class ComparisonRequest(BaseModel):
    circuit: Circuit
    strategy_a: RaceStrategy
    strategy_b: RaceStrategy
    weather: str = "dry"
