import { useState } from 'react'
import CircuitEditor from './components/CircuitEditor'
import Dashboard from './components/Dashboard'

function App() {
  const [activeTab, setActiveTab] = useState('editor')
  const [simulationResults, setSimulationResults] = useState(null)
  const [circuitPoints, setCircuitPoints] = useState([])

  const runSimulation = async () => {
      // Create segments from points
      if (circuitPoints.length < 2) {
          alert("Please draw a circuit first!")
          return
      }

      const segments = []
      for(let i=1; i<circuitPoints.length; i++) {
          const p1 = circuitPoints[i-1]
          const p2 = circuitPoints[i]
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
          // Simple heuristic: if angle change is high, it's a corner. 
          // For MVP, treat everything as straight or generic curve based on length?
          // Let's just say everything is a 'straight' unless we detect curvature.
          // Since we are clicking points, let's treat each segment as a straight section for now.
          segments.push({
              id: `seg-${i}`,
              type: 'straight',
              length: dist // pixels, map to meters? say 1px = 5meters
          })
      }
      
      const payload = {
            circuit: {
                name: "Custom Circuit",
                segments: segments.map(s => ({...s, length: s.length * 5})) // Scale
            },
            tire_compound: document.getElementById('tireSelect')?.value || 'soft',
            laps: 1
      }

      try {
          const res = await fetch('http://localhost:8000/api/v1/simulate', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
          })
          const data = await res.json()
          setSimulationResults(data)
          setActiveTab('analysis')
      } catch (err) {
          console.error(err)
          alert("Simulation failed. Is backend running?")
      }
  }

  return (
    <div className="app-container">
      <header>
        <h1>StarTrack F1</h1>
        <div className="nav">
          <button onClick={() => setActiveTab('editor')} style={{marginRight: '1rem'}}>
            Circuit Design
          </button>
          <button onClick={() => setActiveTab('analysis')}>
            Analysis
          </button>
        </div>
      </header>
      
      <main>
        <div className="sidebar">
          <div className="panel">
            <h3>Configuration</h3>
            <p>Design your circuit and run simulations.</p>
            <br/>
            <div className="control-group">
                <label>Tire Compound</label>
                <select id="tireSelect" style={{width: '100%', padding: '0.5rem', background: '#0a0a0f', color: 'white', border: '1px solid #2a2a40'}}>
                    <option value="soft">Soft C5</option>
                    <option value="medium">Medium C3</option>
                    <option value="hard">Hard C1</option>
                </select>
            </div>
            <br/>
            <button onClick={runSimulation}>Run Simulation</button>
          </div>
          
          {simulationResults && (
            <div className="panel">
                 <h3>Results</h3>
                 {simulationResults.map((res, i) => (
                    <div key={i}>
                        <p>Lap {res.lap_number}: {res.lap_time.toFixed(3)}s</p>
                    </div>
                 ))}
            </div>
          )}
        </div>
        
        <div className="canvas-area">
            {activeTab === 'editor' ? (
                <CircuitEditor points={circuitPoints} setPoints={setCircuitPoints} />
            ) : (
                <Dashboard data={simulationResults && simulationResults[0]?.telemetry} />
            )}
        </div>
      </main>

      <footer>
        <p className="disclaimer">
          "StarTrack F1 is an independent open-source project and is not affiliated with, 
          endorsed by, or connected to Formula 1, Formula One Management, or the FIA."
        </p>
      </footer>
    </div>
  )
}

export default App
