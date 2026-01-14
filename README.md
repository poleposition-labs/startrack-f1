# StarTrack F1

**StarTrack F1** is an open-source, multi-platform motorsport analytics and simulation engine designed to provide Formula 1–style analysis, strategy modeling, and circuit design capabilities. This project is intended as an educational reference platform for race analytics, completely independent of official Formula 1 entities.

## ⚠️ Legal Disclaimer

> **"StarTrack F1 is an independent open-source project and is not affiliated with, endorsed by, or connected to Formula 1, Formula One Management, or the FIA."**

This project uses strictly open data, synthetic datasets, and physics-based models. No official trademarks, logos, or proprietary data from Formula 1 are used. Use of the term "F1" is strictly for descriptive and educational purposes (e.g., "Formula 1–style physics").

## 🏁 Core Features

### 1. Circuit Design Studio

- Interactive editor to draw F1-style circuits using mouse/touch.
- Intelligent detection of cornery geometry, braking zones, and straights.
- Export to standard formats for simulation.

### 2. Physics & Performance Simulation

- Advanced vehicle dynamics model simulating downforce, grip, and tire degradation.
- Lap time estimation based on theoretical vehicle performance.
- Sector-by-sector analysis.

### 3. Race Strategy Engine

- Modeling of soft/medium/hard tire compounds (generic/unbranded).
- Pit stop scenarios (undercut/overcut).
- Weather impact simulations (Dry/Wet/Mixed).

### 4. Telemetry Visualization

- Professional-grade telemetry dashboards.
- Speed traces, throttle/brake maps, and G-force plots.
- Real-time websocket data streaming.

## 🛠 Tech Stack

- **Frontend**: React (Vite), HTML5 Canvas, D3.js
- **Backend**: Python (FastAPI)
- **Simulation**: NumPy, SciPy
- **Infrastructure**: Docker, GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Python (3.10+)
- Docker (optional)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/poleposition-labs/startrack-f1.git
   cd startrack-f1
   ```

2. Install Backend Dependencies:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Install Frontend Dependencies:

   ```bash
   cd frontend
   npm install
   ```

4. Run the Application:
   - Backend: `uvicorn main:app --reload`
   - Frontend: `npm run dev`

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Check out our [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) to see the roadmap for taking this project to the next level (UI/UX overhaul, 3D, and more).

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
