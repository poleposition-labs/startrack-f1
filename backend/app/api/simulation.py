from fastapi import APIRouter
from typing import List
from app.models import SimulationRequest, LapResult
from app.simulation.physics import F1PhysicsEngine

router = APIRouter()
physics = F1PhysicsEngine()

@router.post("/simulate", response_model=List[LapResult])
async def simulate_race(request: SimulationRequest):
    results = []
    # Convert Pydantic models to dicts for physics engine
    segments_dict = [s.model_dump() for s in request.circuit.segments]
    
    for i in range(request.laps):
        time, telemetry = physics.simulate_lap(segments_dict, request.tire_compound, request.weather)
        results.append(LapResult(
            lap_number=i+1,
            lap_time=time,
            telemetry=telemetry
        ))
        
    return results
