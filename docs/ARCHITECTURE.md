# StarTrack F1 - System Architecture

## Overview

StarTrack F1 is a decoupled web application designed for motorsport analytics. It separates the User Interface (Client) from the Physics Simulation (Server) to ensure modularity and extensibility.

## System Components

### 1. Frontend (Client)

- **Framework**: React (Vite)
- **Role**: Render UI, capture user input (circuit drawing), visualize data.
- **Key Modules**:
  - `CircuitEditor`: HTML5 Canvas interactions.
  - `Dashboard`: Telemetry visualization (D3/SVG).
  - `StrategyPlanner`: Form inputs for race config.

### 2. Backend (Server)

- **Framework**: FastAPI (Python)
- **Role**: Serve API, run heavy physics calculations, manage sessions.
- **Key Modules**:
  - `PhysicsEngine`: Simulates vehicle dynamics.
  - `RaceStrategy`: Simulates generic pit stops and weather.
  - `API`: REST endpoints for data exchange.

### 3. Data Flow

1. **User Action**: User draws a circuit segment on `CircuitEditor`.
2. **Data Model**: Frontend converts drawing to `CircuitSegment` list (JSON).
3. **Request**: POST `/api/v1/simulate` with Circuit JSON + Car Setup.
4. **Processing**:
   - Backend receives payload.
   - `PhysicsEngine` discretizes the circuit.
   - Calculates velocity profiles, braking points, and sector times.
5. **Response**: Backend returns `LapResult` (Simulated Lap Time, Telemetry Series).
6. **Visualization**: `Dashboard` renders Speed Trace from Telemetry Series.

## Technology Stack Justification

- **React**: Ideal for interactive, state-heavy UI components like the editor.
- **FastAPI**: High-performance Python framework, native support for async, perfect for binding with NumPy/SciPy.
- **NumPy/SciPy**: Industry standard for numerical computing, allowing accurate physics modeling.

## Future Roadmap

- **WebSocket**: For real-time "live race" simulation.
- **Database**: PostgreSQL to save user circuits and lap records.
- **AI Models**: TensorFlow integration to predict strategy outcomes.
