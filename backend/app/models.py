from pydantic import BaseModel
from typing import List, Optional

class CircuitSegment(BaseModel):
    id: str
    type: str  # 'straight', 'corner'
    length: float # meters
    radius: Optional[float] = 0 # meters, 0 if straight
    
class Circuit(BaseModel):
    name: str
    segments: List[CircuitSegment]

class SimulationRequest(BaseModel):
    circuit: Circuit
    tire_compound: str = "soft"
    laps: int = 1

class LapResult(BaseModel):
    lap_number: int
    lap_time: float
    telemetry: List[dict] # time, speed points
