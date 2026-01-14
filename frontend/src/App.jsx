import { useState } from 'react'
import CircuitEditor from './components/CircuitEditor'
import Dashboard from './components/Dashboard'

function App() {
  const [activeTab, setActiveTab] = useState('editor')
  const [simulationResults, setSimulationResults] = useState(null)
  const [circuitPoints, setCircuitPoints] = useState([])
  const [circuitName, setCircuitName] = useState("My Track")
  const [savedCircuits, setSavedCircuits] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('startrack_circuits') || '{}');
    return Object.keys(saved);
  });
  // State for Strategy
  const [tireCompound, setTireCompound] = useState('soft')
  const [weather, setWeather] = useState('dry')

  // Helper: Calculate radius of circle passing through 3 points
  const calculateRadius = (p1, p2, p3) => {
      const x1 = p1.x, y1 = p1.y;
      const x2 = p2.x, y2 = p2.y;
      const x3 = p3.x, y3 = p3.y;
      
      const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
      if (Math.abs(D) < 1e-5) return 0; // Collinear = Straight
      
      const Ux = ((x1**2 + y1**2) * (y2 - y3) + (x2**2 + y2**2) * (y3 - y1) + (x3**2 + y3**2) * (y1 - y2)) / D;
      const Uy = ((x1**2 + y1**2) * (x3 - x2) + (x2**2 + y2**2) * (x1 - x3) + (x3**2 + y3**2) * (x2 - x1)) / D;
      
      const R = Math.hypot(x1 - Ux, y1 - Uy);
      return Math.min(R, 1000); // Cap radius at 1000m
  }

  const runSimulation = async () => {
      if (circuitPoints.length < 3) {
          alert("Please draw at least 3 points to form a circuit!")
          return
      }

      const segments = []
      // We interpret triplets as corners. 
      // Point i -> i+1 is a segment. We look at i-1, i, i+1 to see curvature at i.
      
      for(let i=1; i<circuitPoints.length; i++) {
          const pPrev = circuitPoints[i-1]
          const pCurr = circuitPoints[i]
          const pNext = circuitPoints[(i+1) % circuitPoints.length] // Loop for closed circuit assumption
          
          const dist = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y)
          
          // Calculate radius at this vertex
          // If we are just drawing lines, the 'corner' is at the vertex.
          // For simulation, let's treat the segment leading to the vertex as having that radius if it's curved.
          
          const radius = calculateRadius(circuitPoints[Math.max(0, i-2)], pPrev, pCurr);
          const isCorner = radius > 0 && radius < 500; // Threshold for corner
          
          segments.push({
              id: `seg-${i}`,
              type: isCorner ? 'corner' : 'straight',
              length: dist,
              radius: isCorner ? radius * 5 : 0 // Scale radius too
          })
      }
      
      const payload = {
            circuit: {
                name: circuitName,
                segments: segments.map(s => ({...s, length: s.length * 5})) // Scale length
            },
            tire_compound: tireCompound,
            weather: weather,
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

  const saveCircuit = () => {
    if (circuitPoints.length < 3) {
      alert("Please draw at least 3 points before saving!");
      return;
    }
    const circuits = JSON.parse(localStorage.getItem('startrack_circuits') || '{}');
    circuits[circuitName] = circuitPoints;
    localStorage.setItem('startrack_circuits', JSON.stringify(circuits));
    setSavedCircuits(Object.keys(circuits));
    alert(`Circuit "${circuitName}" saved!`);
  };

  const loadCircuit = (name) => {
    const circuits = JSON.parse(localStorage.getItem('startrack_circuits') || '{}');
    if (circuits[name]) {
      setCircuitPoints(circuits[name]);
      setCircuitName(name);
    }
  };

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
                <h3>Circuit Management</h3>
                <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                    <input 
                        type="text" 
                        value={circuitName} 
                        onChange={(e)=>setCircuitName(e.target.value)}
                        placeholder="Circuit Name"
                        style={{
                            background: 'rgba(0,0,0,0.3)', 
                            border: '1px solid var(--border-color)', 
                            padding:'0.5rem', 
                            color:'white', 
                            borderRadius:'4px'
                        }}
                    />
                    <button onClick={saveCircuit} style={{width:'100%'}}>💾 Save Track</button>
                    
                    {savedCircuits.length > 0 && (
                        <div style={{marginTop:'0.5rem'}}>
                            <small style={{color:'var(--text-secondary)'}}>Load:</small>
                            <select 
                                onChange={(e) => loadCircuit(e.target.value)} 
                                style={{
                                    width:'100%', 
                                    padding:'0.5rem', 
                                    marginTop:'0.2rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    color:'var(--text-primary)',
                                    border:'1px solid var(--border-color)'
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>Select a track...</option>
                                {savedCircuits.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button onClick={() => setCircuitPoints([])} style={{background: 'rgba(255, 59, 59, 0.2)', color:'#ff3b3b', borderColor:'#ff3b3b', marginTop:'0.5rem'}}>🗑 Clear</button>
                </div>
            </div>

          <div className="panel">
            <h3>Configuration</h3>
            <p>Design your circuit and run simulations.</p>
            <br/>
            <div className="control-group">
                <label>Tire Compound</label>
                <select 
                    value={tireCompound}
                    onChange={(e) => setTireCompound(e.target.value)}
                    style={{width: '100%', padding: '0.5rem', background: '#0a0a0f', color: 'white', border: '1px solid #2a2a40'}}
                >
                    <option value="soft">Soft C5</option>
                    <option value="medium">Medium C3</option>
                    <option value="hard">Hard C1</option>
                </select>
            </div>

            <div className="control-group" style={{marginTop:'1rem'}}>
                <label>Weather Conditions (Strategy)</label>
                <select 
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    style={{width: '100%', padding: '0.5rem', background: '#0a0a0f', color: 'white', border: '1px solid #2a2a40'}}
                >
                    <option value="dry">Dry (Optimal)</option>
                    <option value="hot">Hot (High Deg)</option>
                    <option value="rain">Rain (Low Grip)</option>
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
