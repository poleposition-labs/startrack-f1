from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.models import (
    SimulationRequest, RaceRequest, LapResult, 
    ApexPoint, StrategyRecommendation, TrackTemplate,
    ComparisonRequest
)
from app.simulation.physics import F1PhysicsEngine

router = APIRouter()
physics = F1PhysicsEngine()

@router.post("/simulate", response_model=List[LapResult])
async def simulate_single(request: SimulationRequest):
    """Run a quick single or multi-lap simulation."""
    results = []
    segments_dict = [s.model_dump() for s in request.circuit.segments]
    
    physics.reset_state(fuel_kg=100.0, tire_compound=request.tire_compound)
    physics.current_speed = 60.0
    
    for i in range(request.laps):
        lap_data = physics.simulate_lap(
            segments_dict, 
            tire_compound=request.tire_compound,
            weather=request.weather,
            lap_number=i+1
        )
        results.append(LapResult(
            lap_number=i+1,
            lap_time=lap_data["lap_time"],
            sector_times=lap_data["sector_times"],
            tire_life=lap_data["final_tire_life"],
            fuel=lap_data["final_fuel"],
            telemetry=lap_data["telemetry"]
        ))
        
    return results

@router.post("/race", response_model=List[LapResult])
async def simulate_race(request: RaceRequest):
    """Run a full race simulation with pit strategy."""
    segments_dict = [s.model_dump() for s in request.circuit.segments]
    
    strategy = {
        "total_laps": request.strategy.total_laps,
        "starting_tire": request.strategy.starting_tire,
        "starting_fuel": request.strategy.starting_fuel,
        "pit_stops": [{"lap": p.lap, "tire": p.tire} for p in request.strategy.pit_stops]
    }
    
    race_results = physics.simulate_race(segments_dict, strategy, request.weather)
    
    return [LapResult(
        lap_number=r["lap_number"],
        lap_time=r["lap_time"],
        pure_lap_time=r["pure_lap_time"],
        pit_stop=r["pit_stop"],
        pit_time=r["pit_time"],
        cumulative_time=r["cumulative_time"],
        tire_compound=r["tire_compound"],
        tire_life=r["tire_life"],
        fuel=r["fuel"],
        sector_times=r["sector_times"],
        telemetry=r["telemetry"]
    ) for r in race_results]

@router.post("/compare")
async def compare_strategies(request: ComparisonRequest):
    """Compare two different strategies on the same circuit."""
    segments_dict = [s.model_dump() for s in request.circuit.segments]
    
    # Strategy A
    strategy_a = {
        "total_laps": request.strategy_a.total_laps,
        "starting_tire": request.strategy_a.starting_tire,
        "starting_fuel": request.strategy_a.starting_fuel,
        "pit_stops": [{"lap": p.lap, "tire": p.tire} for p in request.strategy_a.pit_stops]
    }
    results_a = physics.simulate_race(segments_dict, strategy_a, request.weather)
    
    # Strategy B
    strategy_b = {
        "total_laps": request.strategy_b.total_laps,
        "starting_tire": request.strategy_b.starting_tire,
        "starting_fuel": request.strategy_b.starting_fuel,
        "pit_stops": [{"lap": p.lap, "tire": p.tire} for p in request.strategy_b.pit_stops]
    }
    results_b = physics.simulate_race(segments_dict, strategy_b, request.weather)
    
    total_a = results_a[-1]["cumulative_time"] if results_a else 0
    total_b = results_b[-1]["cumulative_time"] if results_b else 0
    
    return {
        "strategy_a": {
            "name": f"{request.strategy_a.starting_tire.title()} Start",
            "total_time": total_a,
            "laps": results_a
        },
        "strategy_b": {
            "name": f"{request.strategy_b.starting_tire.title()} Start", 
            "total_time": total_b,
            "laps": results_b
        },
        "winner": "A" if total_a < total_b else "B",
        "time_difference": abs(total_a - total_b)
    }

@router.post("/optimal-line", response_model=List[ApexPoint])
async def get_optimal_line(request: SimulationRequest):
    """Calculate optimal racing line apex points."""
    segments_dict = [s.model_dump() for s in request.circuit.segments]
    apexes = physics.calculate_optimal_line(segments_dict)
    return [ApexPoint(**a) for a in apexes]

@router.post("/recommend-strategy", response_model=StrategyRecommendation)
async def recommend_strategy(request: SimulationRequest):
    """Get AI-powered strategy recommendation."""
    segments_dict = [s.model_dump() for s in request.circuit.segments]
    recommendation = physics.recommend_strategy(
        segments_dict, 
        request.laps, 
        request.weather
    )
    return StrategyRecommendation(**recommendation)

@router.get("/tracks", response_model=List[TrackTemplate])
async def get_track_templates():
    """Get available track templates."""
    templates = F1PhysicsEngine.get_track_templates()
    return [TrackTemplate(id=k, **v) for k, v in templates.items()]

@router.get("/tracks/{track_id}")
async def get_track_segments(track_id: str):
    """Get segments for a specific track template."""
    segments = F1PhysicsEngine.get_track_segments(track_id)
    if not segments:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"track_id": track_id, "segments": segments}

@router.get("/tires")
async def get_tire_compounds():
    """Get available tire compounds with their properties."""
    return {
        "compounds": [
            {"id": "soft", "name": "Soft (C5)", "color": "#ff3b3b", "grip": 1.25, "durability": "Low"},
            {"id": "medium", "name": "Medium (C3)", "color": "#ffd600", "grip": 1.15, "durability": "Medium"},
            {"id": "hard", "name": "Hard (C1)", "color": "#ffffff", "grip": 1.0, "durability": "High"},
            {"id": "intermediate", "name": "Intermediate", "color": "#4caf50", "grip": 0.9, "durability": "Medium"},
            {"id": "wet", "name": "Full Wet", "color": "#2196f3", "grip": 0.75, "durability": "High"},
        ]
    }
