import { useState, useCallback, useRef, useEffect } from 'react'
import CircuitEditor from './components/CircuitEditor'
import Dashboard from './components/Dashboard'
import { GeometryEngine } from './utils/GeometryEngine'
import './App.css'

// Audio Context for engine sounds
let audioContext = null;
let engineOscillator = null;

function App() {
  const [activeTab, setActiveTab] = useState('editor')
  const [simulationResults, setSimulationResults] = useState(null)
  const [circuitPoints, setCircuitPoints] = useState([])
  const [circuitName, setCircuitName] = useState("Monaco GP")
  const [isCircuitComplete, setIsCircuitComplete] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [raceProgress, setRaceProgress] = useState(0)
  const [currentTelemetry, setCurrentTelemetry] = useState(null)
  const [currentLap, setCurrentLap] = useState(1)
  
  // Track Templates
  const [trackTemplates, setTrackTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  
  const [showRacingLine, setShowRacingLine] = useState(false)
  const [ghostProgress, setGhostProgress] = useState(undefined)
  
  // Strategy Settings
  const [totalLaps, setTotalLaps] = useState(5)
  const [startingTire, setStartingTire] = useState('soft')
  const [weather, setWeather] = useState('dry')
  const [pitStops, setPitStops] = useState([])
  const [startingFuel, setStartingFuel] = useState(100)
  
  // AI Recommendation
  const [aiRecommendation, setAiRecommendation] = useState(null)
  
  // Comparison Mode
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonResults, setComparisonResults] = useState(null)
  
  // Audio Settings
  const [audioEnabled, setAudioEnabled] = useState(false)
  
  // Saved Circuits
  const [savedCircuits, setSavedCircuits] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('startrack_circuits') || '{}');
    return Object.keys(saved);
  });
  
  // Leaderboard
  const [leaderboard, setLeaderboard] = useState(() => {
    return JSON.parse(localStorage.getItem('startrack_leaderboard') || '[]');
  });

  // Load track templates on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/v1/tracks')
      .then(res => res.json())
      .then(data => setTrackTemplates(data))
      .catch(err => console.log('Backend not available'));
  }, []);

  // Check if circuit is closed (adaptive for Meters or Lat/Lon)
  const checkCircuitComplete = useCallback((points) => {
    if (points.length < 3) return false;
    const first = points[0];
    const last = points[points.length - 1];
    
    // Check if using Lat/Lon (has lat property)
    if (first.lat !== undefined) {
        const dist = GeometryEngine.getDistanceMeters(first.lat, first.lng, last.lat, last.lng);
        return dist < 40; // Increased tolerance for GPS points
    } else {
        const dist = Math.hypot(first.x - last.x, first.y - last.y);
        return dist < 30; // 30 pixels (approx)
    }
  }, []);

  // Update points and check completion
  const handlePointsChange = useCallback((newPoints) => {
    setCircuitPoints(newPoints);
    setIsCircuitComplete(checkCircuitComplete(newPoints));
  }, [checkCircuitComplete]);

  // Engine Sound Functions
  const startEngineSound = useCallback(() => {
    if (!audioEnabled) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      engineOscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      engineOscillator.type = 'sawtooth';
      engineOscillator.frequency.setValueAtTime(80, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      engineOscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      engineOscillator.start();
    } catch (e) {
      console.log('Audio not supported');
    }
  }, [audioEnabled]);
  
  const updateEngineSound = useCallback((speed) => {
    if (!audioEnabled || !engineOscillator) return;
    const freq = 80 + (speed / 350) * 400;
    engineOscillator.frequency.setValueAtTime(freq, audioContext?.currentTime || 0);
  }, [audioEnabled]);
  
  const stopEngineSound = useCallback(() => {
    if (engineOscillator) {
      engineOscillator.stop();
      engineOscillator = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  }, []);
  
  const playPitRadio = useCallback((message) => {
    if (!audioEnabled) return;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.2;
    utterance.pitch = 1.1;
    speechSynthesis.speak(utterance);
  }, [audioEnabled]);

  // Calculate radius helper (using XY meters)
  const calculateRadius = (p1, p2, p3) => {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    
    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(D) < 1e-5) return 0;
    
    const Ux = ((x1**2 + y1**2) * (y2 - y3) + (x2**2 + y2**2) * (y3 - y1) + (x3**2 + y3**2) * (y1 - y2)) / D;
    const Uy = ((x1**2 + y1**2) * (x3 - x2) + (x2**2 + y2**2) * (x1 - x3) + (x3**2 + y3**2) * (x2 - x1)) / D;
    
    const R = Math.hypot(x1 - Ux, y1 - Uy);
    return Math.min(R, 1000);
  }

  // Build segments from points (Handles both Lat/Lon and X/Y)
  const buildSegments = useCallback(() => {
    if (circuitPoints.length < 2) return [];

    let meterPoints = [];
    
    // Check if points are Lat/Lon
    if (circuitPoints[0].lat !== undefined) {
        const origin = circuitPoints[0];
        meterPoints = circuitPoints.map(p => 
            GeometryEngine.latLonToMeters(p.lat, p.lng, origin.lat, origin.lng)
        );
    } else {
        // Assume points are already generic units (e.g. from JSON import or simple mode)
        meterPoints = circuitPoints; 
    }

    const segments = [];
    for(let i=1; i < meterPoints.length; i++) {
      const pPrev = meterPoints[i-1];
      const pCurr = meterPoints[i];
      
      const dist = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y);
      
      // Calculate radius using 3 points (prev-1, prev, curr)
      const radius = calculateRadius(
          meterPoints[Math.max(0, i-2)], 
          pPrev, 
          pCurr
      );
      
      const isCorner = radius > 0 && radius < 500;
      
      segments.push({
        id: `seg-${i}`,
        type: isCorner ? 'corner' : 'straight',
        length: dist, // Now real meters
        radius: isCorner ? radius : 0
      });
    }
    return segments;
  }, [circuitPoints]);

  // Get AI Strategy Recommendation
  const getRecommendation = async () => {
    if (!isCircuitComplete) return;
    
    const segments = buildSegments();
    try {
      const res = await fetch('http://localhost:8000/api/v1/recommend-strategy', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          circuit: { name: circuitName, segments },
          laps: totalLaps,
          weather
        })
      });
      const data = await res.json();
      setAiRecommendation(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Apply AI Recommendation
  const applyRecommendation = () => {
    if (!aiRecommendation) return;
    setStartingTire(aiRecommendation.starting_tire);
    setPitStops(aiRecommendation.pit_stops.map(p => ({ lap: p.lap, tire: p.tire })));
  };

  // Run Race Simulation
  const runSimulation = async () => {
    if (circuitPoints.length < 3 || !isCircuitComplete) {
      alert("Please close the circuit first!");
      return;
    }

    const segments = buildSegments();
    
    const payload = {
      circuit: { name: circuitName, segments },
      strategy: {
        total_laps: totalLaps,
        starting_tire: startingTire,
        starting_fuel: startingFuel,
        pit_stops: pitStops
      },
      weather
    };

    setIsSimulating(true);
    setRaceProgress(0);
    setGhostProgress(undefined);
    setCurrentLap(1);
    startEngineSound();

    try {
      const res = await fetch('http://localhost:8000/api/v1/race', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSimulationResults(data);
      
      // Animate through laps
      for (let lapIdx = 0; lapIdx < data.length; lapIdx++) {
        const lapData = data[lapIdx];
        setCurrentLap(lapData.lap_number);
        
        if (lapData.pit_stop) {
          playPitRadio(`Box box! Pit stop lap ${lapData.lap_number}. Switching to ${lapData.tire_compound}.`);
          await new Promise(r => setTimeout(r, 1500));
        }
        
        const telemetry = lapData.telemetry;
        for (let i = 0; i < telemetry.length; i++) {
          await new Promise(r => setTimeout(r, 30));
          const progress = ((lapIdx + (i / telemetry.length)) / data.length) * 100;
          setRaceProgress(progress);
          setCurrentTelemetry(telemetry[i]);
          updateEngineSound(telemetry[i].speed);
        }
      }
      
      // Update leaderboard
      const totalTime = data[data.length - 1].cumulative_time;
      const entry = {
        name: circuitName,
        time: totalTime,
        laps: totalLaps,
        tire: startingTire,
        date: new Date().toISOString()
      };
      const newLeaderboard = [...leaderboard, entry]
        .sort((a, b) => a.time - b.time)
        .slice(0, 10);
      setLeaderboard(newLeaderboard);
      localStorage.setItem('startrack_leaderboard', JSON.stringify(newLeaderboard));
      
      playPitRadio("Chequered flag! Great race!");
      
      setIsSimulating(false);
      stopEngineSound();
      setActiveTab('analysis');
    } catch (err) {
      console.error(err);
      setIsSimulating(false);
      stopEngineSound();
      alert("Simulation failed. Is backend running?");
    }
  };

  // Compare Strategies
  const runComparison = async () => {
    if (!isCircuitComplete) return;
    
    // Setup Ghost Car Mode
    setShowComparison(true);
    setIsSimulating(true); // To lock canvas
    setActiveTab('editor'); // Force editor view
    
    const segments = buildSegments();
    
    const payload = {
      circuit: { name: circuitName, segments },
      strategy_a: {
        total_laps: totalLaps,
        starting_tire: 'soft',
        starting_fuel: startingFuel,
        pit_stops: [{ lap: Math.floor(totalLaps / 2), tire: 'hard' }]
      },
      strategy_b: {
        total_laps: totalLaps,
        starting_tire: 'hard',
        starting_fuel: startingFuel,
        pit_stops: []
      },
      weather
    };
    
    try {
      const res = await fetch('http://localhost:8000/api/v1/compare', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setComparisonResults(data);
      
      // Animate Comparison (Ghost Race)
      // We will normalize progress based on total time of slower car to keep them in sync on timeline
      const lapsA = data.strategy_a.laps;
      const lapsB = data.strategy_b.laps;
      const maxDuration = Math.max(data.strategy_a.total_time, data.strategy_b.total_time);
      
      // Use a fixed time step for smooth animation
      const dt = 0.1; // 100ms simulation steps
      let currentTime = 0;
      
      playPitRadio("Drivers ready... Lights out!");
      
      while (currentTime < maxDuration) {
        currentTime += dt * 4; // 4x speed
        await new Promise(r => setTimeout(r, 40)); 
        
        // Calculate progress for Car A (Red/Real)
        let progA = 0;
        const currentLapA = lapsA.find(l => l.cumulative_time > currentTime) || lapsA[lapsA.length-1];
        if (currentLapA) {
             const lapStartTime = currentLapA.cumulative_time - currentLapA.lap_time;
             const timeInLap = Math.max(0, currentTime - lapStartTime);
             // Approximate within lap (0-1)
             const lapProg = Math.min(1, timeInLap / currentLapA.lap_time);
             // Approximate within race (0-100)
             progA = ((currentLapA.lap_number - 1 + lapProg) / totalLaps) * 100;
        } else {
             progA = 100; // Finished
        }
        
        // Calculate progress for Car B (Ghost/Cyan)
        let progB = 0;
        const currentLapB = lapsB.find(l => l.cumulative_time > currentTime) || lapsB[lapsB.length-1];
        if (currentLapB) {
             const lapStartTime = currentLapB.cumulative_time - currentLapB.lap_time;
             const timeInLap = Math.max(0, currentTime - lapStartTime);
             const lapProg = Math.min(1, timeInLap / currentLapB.lap_time);
             progB = ((currentLapB.lap_number - 1 + lapProg) / totalLaps) * 100;
        } else {
             progB = 100;
        }

        setRaceProgress(Math.min(100, progA));
        setGhostProgress(Math.min(100, progB));
      }
      
      setGhostProgress(undefined);
      setIsSimulating(false);
      setActiveTab('strategy'); // Go to results
      
    } catch (err) {
      console.error(err);
      setIsSimulating(false);
      setGhostProgress(undefined);
    }
  };

  // Save Circuit
  const saveCircuit = () => {
    if (circuitPoints.length < 3) return;
    const circuits = JSON.parse(localStorage.getItem('startrack_circuits') || '{}');
    circuits[circuitName] = circuitPoints;
    localStorage.setItem('startrack_circuits', JSON.stringify(circuits));
    setSavedCircuits(Object.keys(circuits));
  };

  // Load Circuit  
  const loadCircuit = (name) => {
    const circuits = JSON.parse(localStorage.getItem('startrack_circuits') || '{}');
    if (circuits[name]) {
      setCircuitPoints(circuits[name]);
      setCircuitName(name);
      setIsCircuitComplete(checkCircuitComplete(circuits[name]));
    }
  };

  // Load Track Template
  const loadTemplate = async (trackId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/tracks/${trackId}`);
      const data = await res.json();
      // Use preview_points from backend if available for realistic layout
      if (data.segments) {
        // Fetch full template data (we need to get the template list again to access preview_points efficiently
        // or just rely on what we have. The /tracks/{id} endpoint should ideally return points
        // Let's refetch the list to get preview_points since /tracks/{id} returns segments
        const listRes = await fetch('http://localhost:8000/api/v1/tracks');
        const listData = await listRes.json();
        const template = listData.find(t => t.id === trackId);
        
        if (template && template.preview_points) {
           setCircuitPoints(template.preview_points);
        } else {
           // Fallback to circle if no preview points
            const points = [];
            let x = 200, y = 200;
            data.segments.forEach((seg, i) => {
              const angle = (i / data.segments.length) * Math.PI * 2;
              x += Math.cos(angle) * (seg.length / 10);
              y += Math.sin(angle) * (seg.length / 10);
              points.push({ x: Math.min(800, Math.max(50, x)), y: Math.min(500, Math.max(50, y)) });
            });
            points.push({ ...points[0] });
            setCircuitPoints(points);
        }
      }
      setCircuitName(trackTemplates.find(t => t.id === trackId)?.name || trackId);
      setIsCircuitComplete(true);
      setSelectedTemplate(trackId);
    } catch (err) {
      console.error(err);
    }
  };

  // Export Circuit JSON
  const exportCircuit = () => {
    const data = {
      name: circuitName,
      points: circuitPoints,
      segments: buildSegments()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${circuitName.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  // Import Circuit JSON
  const importCircuit = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.points) {
          setCircuitPoints(data.points);
          setCircuitName(data.name || 'Imported Track');
          setIsCircuitComplete(checkCircuitComplete(data.points));
        }
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  // Add Pit Stop
  const addPitStop = () => {
    if (pitStops.length >= totalLaps - 1) return;
    const nextLap = pitStops.length === 0 ? Math.floor(totalLaps / 2) : pitStops[pitStops.length - 1].lap + 1;
    setPitStops([...pitStops, { lap: Math.min(nextLap, totalLaps - 1), tire: 'hard' }]);
  };

  // Remove Pit Stop
  const removePitStop = (index) => {
    setPitStops(pitStops.filter((_, i) => i !== index));
  };

  // Clear Circuit
  const clearCircuit = () => {
    setCircuitPoints([]);
    setIsCircuitComplete(false);
    setSimulationResults(null);
    setRaceProgress(0);
    setCurrentTelemetry(null);
    setAiRecommendation(null);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-brand">
          <div className="header-logo">SF</div>
          <div>
            <div className="header-title">StarTrack F1</div>
            <div className="header-subtitle">Advanced Motorsport Analytics</div>
          </div>
        </div>
        
        <div className="header-nav">
          <button className={`nav-btn ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>
            🏁 Circuit
          </button>
          <button className={`nav-btn ${activeTab === 'strategy' ? 'active' : ''}`} onClick={() => setActiveTab('strategy')}>
            ⚙️ Strategy
          </button>
          <button className={`nav-btn ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
            📊 Telemetry
          </button>
          <button className={`nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
            🏆 Leaderboard
          </button>
        </div>

        <div className="header-actions">
          <button 
            className={`btn-icon ${audioEnabled ? 'active' : ''}`}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Disable Sound' : 'Enable Sound'}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          <div className="header-status">
            <span className="status-dot"></span>
            <span>System Online</span>
          </div>
        </div>
      </header>
      
      <main>
        <div className="sidebar">
          {/* Circuit Management */}
          <div className="panel">
            <h3>Circuit Management</h3>
            
            <div className="control-group">
              <label>Track Name</label>
              <input 
                type="text" 
                value={circuitName} 
                onChange={(e) => setCircuitName(e.target.value)}
                placeholder="Enter circuit name"
              />
            </div>
            
            {/* Track Templates */}
            {trackTemplates.length > 0 && (
              <div className="control-group">
                <label>Load Template</label>
                <select value={selectedTemplate} onChange={(e) => loadTemplate(e.target.value)}>
                  <option value="">Select template...</option>
                  {trackTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.length_km}km)</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="button-row">
              <button 
                onClick={() => setShowRacingLine(!showRacingLine)} 
                className={`btn-secondary ${showRacingLine ? 'active' : ''}`}
                title="Toggle Optimal Racing Line"
              >
                {showRacingLine ? '🚫 Hide Line' : '⚡ Show Line'}
              </button>
            </div>
            
            <div className="button-row">
              <button onClick={saveCircuit} className="btn-secondary">💾 Save</button>
              <button onClick={exportCircuit} className="btn-secondary">📤 Export</button>
            </div>
            
            <div className="control-group">
              <label style={{ cursor: 'pointer' }}>
                📥 Import JSON
                <input type="file" accept=".json" onChange={importCircuit} style={{ display: 'none' }} />
              </label>
            </div>
            
            {savedCircuits.length > 0 && (
              <div className="control-group">
                <label>Saved Tracks</label>
                <select onChange={(e) => loadCircuit(e.target.value)} defaultValue="">
                  <option value="" disabled>Load saved...</option>
                  {savedCircuits.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <button onClick={clearCircuit} className="btn-danger w-full">🗑 Clear</button>
          </div>

          {/* Race Configuration */}
          <div className="panel">
            <h3>Race Configuration</h3>
            
            <div className="control-group">
              <label>Total Laps</label>
              <input 
                type="number" 
                min="1" 
                max="50" 
                value={totalLaps} 
                onChange={(e) => setTotalLaps(parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="control-group">
              <label>Starting Tire</label>
              <select value={startingTire} onChange={(e) => setStartingTire(e.target.value)}>
                <option value="soft">🔴 Soft (C5)</option>
                <option value="medium">🟡 Medium (C3)</option>
                <option value="hard">⚪ Hard (C1)</option>
                <option value="intermediate">🟢 Intermediate</option>
                <option value="wet">🔵 Full Wet</option>
              </select>
            </div>
            
            <div className="control-group">
              <label>Weather</label>
              <select value={weather} onChange={(e) => setWeather(e.target.value)}>
                <option value="dry">☀️ Dry</option>
                <option value="hot">🌡️ Hot</option>
                <option value="rain">🌧️ Rain</option>
              </select>
            </div>
            
            <div className="control-group">
              <label>Fuel Load: {startingFuel}kg</label>
              <input 
                type="range" 
                min="50" 
                max="110" 
                value={startingFuel} 
                onChange={(e) => setStartingFuel(parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Pit Strategy */}
          <div className="panel">
            <h3>Pit Strategy</h3>
            
            {pitStops.map((stop, i) => (
              <div key={i} className="pit-stop-row">
                <span>Lap {stop.lap}</span>
                <select 
                  value={stop.tire} 
                  onChange={(e) => {
                    const newStops = [...pitStops];
                    newStops[i].tire = e.target.value;
                    setPitStops(newStops);
                  }}
                >
                  <option value="soft">Soft</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <button onClick={() => removePitStop(i)} className="btn-icon">✕</button>
              </div>
            ))}
            
            <button onClick={addPitStop} className="btn-secondary w-full">+ Add Pit Stop</button>
            
            <div className="divider" />
            
            <button onClick={getRecommendation} className="btn-secondary w-full" disabled={!isCircuitComplete}>
              🤖 AI Recommendation
            </button>
            
            {aiRecommendation && (
              <div className="ai-recommendation">
                <strong>{aiRecommendation.recommendation}</strong>
                <p>{aiRecommendation.explanation}</p>
                <button onClick={applyRecommendation} className="btn-primary w-full mt-sm">
                  Apply Strategy
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="panel">
            <button 
              onClick={runSimulation} 
              disabled={isSimulating || !isCircuitComplete}
              className="btn-primary w-full large"
            >
              {isSimulating ? `⏳ Racing... Lap ${currentLap}/${totalLaps}` : '🏁 Start Race'}
            </button>
            
            <button 
              onClick={runComparison} 
              className="btn-secondary w-full mt-sm"
              disabled={!isCircuitComplete}
            >
              ⚔️ Compare Strategies
            </button>
          </div>
        </div>
        
        <div className="canvas-area">
          {activeTab === 'editor' && (
            <>
              <CircuitEditor 
                points={circuitPoints} 
                setPoints={handlePointsChange}
                isComplete={isCircuitComplete}
                raceProgress={raceProgress}
                isSimulating={isSimulating}
                showRacingLine={showRacingLine}
                ghostProgress={ghostProgress}
              />
              
              <div className={`circuit-status ${isCircuitComplete ? 'complete' : ''}`}>
                <span className="circuit-status-icon"></span>
                <span>
                  {circuitPoints.length === 0 
                    ? 'Click to add points' 
                    : isCircuitComplete 
                      ? `Circuit Complete (${circuitPoints.length} points)` 
                      : `Drawing... (${circuitPoints.length} points)`
                  }
                </span>
              </div>
              
              {isSimulating && currentTelemetry && (
                <div className="telemetry-overlay">
                  <div className="telemetry-item">
                    <span className="telemetry-label">Speed</span>
                    <span className="telemetry-value speed">{currentTelemetry.speed} km/h</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">Lap</span>
                    <span className="telemetry-value">{currentLap}/{totalLaps}</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">G-Force</span>
                    <span className="telemetry-value">{currentTelemetry.g_lateral}G</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">Tire</span>
                    <span className="telemetry-value tire">{currentTelemetry.tire_life}%</span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">Fuel</span>
                    <span className="telemetry-value">{currentTelemetry.fuel}kg</span>
                  </div>
                </div>
              )}
            </>
          )}
          
          {activeTab === 'strategy' && (
            <div className="strategy-view">
              <h2>Race Strategy Overview</h2>
              
              <div className="strategy-timeline">
                {Array.from({ length: totalLaps }).map((_, i) => {
                  const isPit = pitStops.find(p => p.lap === i + 1);
                  return (
                    <div key={i} className={`lap-marker ${isPit ? 'pit' : ''}`}>
                      <span className="lap-num">{i + 1}</span>
                      {isPit && <span className="pit-badge">PIT</span>}
                    </div>
                  );
                })}
              </div>
              
              {comparisonResults && showComparison && (
                <div className="comparison-view">
                  <h3>Strategy Comparison</h3>
                  <div className="comparison-grid">
                    <div className={`comparison-card ${comparisonResults.winner === 'A' ? 'winner' : ''}`}>
                      <h4>{comparisonResults.strategy_a.name}</h4>
                      <div className="comp-time">{formatTime(comparisonResults.strategy_a.total_time)}</div>
                      {comparisonResults.winner === 'A' && <span className="winner-badge">FASTER</span>}
                    </div>
                    <div className="vs">VS</div>
                    <div className={`comparison-card ${comparisonResults.winner === 'B' ? 'winner' : ''}`}>
                      <h4>{comparisonResults.strategy_b.name}</h4>
                      <div className="comp-time">{formatTime(comparisonResults.strategy_b.total_time)}</div>
                      {comparisonResults.winner === 'B' && <span className="winner-badge">FASTER</span>}
                    </div>
                  </div>
                  <p className="diff-text">
                    Time Difference: <strong>{comparisonResults.time_difference.toFixed(3)}s</strong>
                  </p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'analysis' && (
            <div className="analysis-view">
              <div className="print-controls" style={{ textAlign: 'right', marginBottom: '1rem' }}>
                <button onClick={() => window.print()} className="btn-secondary">🖨️ Print Report / Save PDF</button>
              </div>
              <Dashboard data={simulationResults} formatTime={formatTime} />
            </div>
          )}
          
          {activeTab === 'leaderboard' && (
             <div className="leaderboard-view">
                <h2>🏆 Fastest Laps</h2>
                <div className="leaderboard-grid">
                   <div className="leaderboard-header">
                      <span>Rank</span>
                      <span>Circuit</span>
                      <span>Time</span>
                      <span>Laps</span>
                      <span>Date</span>
                   </div>
                   {leaderboard.length === 0 ? (
                      <div className="leaderboard-empty">No records yet. Start racing!</div>
                   ) : (
                      leaderboard.map((entry, i) => (
                         <div key={i} className={`leaderboard-row ${i===0?'gold':''} ${i===1?'silver':''} ${i===2?'bronze':''}`}>
                            <span className="rank">{i+1}</span>
                            <span>{entry.name}</span>
                            <span className="time">{formatTime(entry.time)}</span>
                            <span>{entry.laps}</span>
                            <span className="date">{new Date(entry.date).toLocaleDateString()}</span>
                         </div>
                      ))
                   )}
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
