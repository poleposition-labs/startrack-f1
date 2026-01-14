import { useMemo } from 'react'

const Dashboard = ({ data, formatTime }) => {
  // Handle both single lap and multi-lap formats
  const telemetry = useMemo(() => {
    if (!data) return null;
    
    // If data is an array of lap results
    if (Array.isArray(data) && data.length > 0) {
      if (data[0].telemetry) {
        // Multi-lap format - combine all telemetry
        return data.flatMap(lap => lap.telemetry);
      }
      return data;
    }
    return null;
  }, [data]);

  // Calculate stats from all laps
  const stats = useMemo(() => {
    if (!data || !Array.isArray(data)) return null;
    
    const allTelemetry = data.flatMap(lap => lap.telemetry || []);
    if (!allTelemetry.length) return null;
    
    const speeds = allTelemetry.map(t => t.speed);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    
    const lastPoint = allTelemetry[allTelemetry.length - 1];
    const bestLap = data.reduce((best, lap) => 
      !best || (lap.pure_lap_time || lap.lap_time) < (best.pure_lap_time || best.lap_time) ? lap : best
    , null);
    
    // G-force stats
    const gForces = allTelemetry.map(t => t.g_lateral || 0);
    const maxG = Math.max(...gForces);
    
    return {
      maxSpeed,
      avgSpeed,
      finalBattery: lastPoint?.battery || 0,
      finalTire: lastPoint?.tire_life || 0,
      finalFuel: lastPoint?.fuel || 0,
      totalLaps: data.length,
      totalTime: data[data.length - 1]?.cumulative_time || 0,
      bestLapTime: bestLap?.pure_lap_time || bestLap?.lap_time || 0,
      bestLapNumber: bestLap?.lap_number || 1,
      maxG,
      pitStops: data.filter(lap => lap.pit_stop).length
    };
  }, [data]);

  // Lap times for chart
  const lapTimes = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map(lap => ({
      lap: lap.lap_number,
      time: lap.pure_lap_time || lap.lap_time,
      tire: lap.tire_compound,
      pit: lap.pit_stop
    }));
  }, [data]);

  if (!data || !stats) {
    return (
      <div className="dashboard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.5 }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</p>
          <p>Run a simulation to see telemetry data</p>
        </div>
      </div>
    );
  }

  // SVG dimensions
  const width = 800;
  const height = 250;
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Speed chart scales
  const maxSpeedChart = Math.max(...(telemetry?.map(d => d.speed) || [350]), 350);
  const maxDist = telemetry ? Math.max(...telemetry.map(d => d.dist || 0)) : 100;
  
  const xScale = (dist) => padding.left + (dist / maxDist) * chartWidth;
  const yScale = (s) => padding.top + chartHeight - (s / maxSpeedChart) * chartHeight;

  const speedPath = telemetry?.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(p.dist || i * 50)} ${yScale(p.speed)}`
  ).join(' ') || '';

  // Lap time chart
  const lapChartWidth = 600;
  const lapChartHeight = 200;
  const maxLapTime = Math.max(...lapTimes.map(l => l.time), 0);
  const minLapTime = Math.min(...lapTimes.map(l => l.time), maxLapTime);
  const lapYScale = (t) => 30 + ((t - minLapTime) / (maxLapTime - minLapTime + 0.1)) * (lapChartHeight - 60);
  const lapXScale = (i) => 50 + (i / (lapTimes.length - 1 || 1)) * (lapChartWidth - 100);

  // Tire color mapping
  const tireColors = {
    soft: '#e53935',
    medium: '#ffd600',
    hard: '#ffffff',
    intermediate: '#4caf50',
    wet: '#2196f3'
  };

  return (
    <div className="dashboard-container">
      {/* Top Metrics */}
      <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="metric-card">
          <span className="metric-label">Total Time</span>
          <span className="metric-value" style={{ color: 'var(--accent-primary)', fontSize: '1.5rem' }}>
            {formatTime ? formatTime(stats.totalTime) : stats.totalTime.toFixed(3)}
          </span>
        </div>
        
        <div className="metric-card">
          <span className="metric-label">Best Lap</span>
          <span className="metric-value" style={{ color: 'var(--racing-green)', fontSize: '1.5rem' }}>
            {formatTime ? formatTime(stats.bestLapTime) : stats.bestLapTime.toFixed(3)}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lap {stats.bestLapNumber}</span>
        </div>
        
        <div className="metric-card">
          <span className="metric-label">Max Speed</span>
          <span className="metric-value" style={{ color: 'var(--racing-cyan)', fontSize: '1.5rem' }}>
            {stats.maxSpeed.toFixed(0)}
            <span style={{ fontSize: '0.8rem', marginLeft: '4px', opacity: 0.7 }}>km/h</span>
          </span>
        </div>
        
        <div className="metric-card">
          <span className="metric-label">Max G-Force</span>
          <span className="metric-value" style={{ color: '#ff9800', fontSize: '1.5rem' }}>
            {stats.maxG.toFixed(1)}G
          </span>
        </div>
        
        <div className="metric-card">
          <span className="metric-label">Pit Stops</span>
          <span className="metric-value" style={{ color: 'var(--racing-red)', fontSize: '1.5rem' }}>
            {stats.pitStops}
          </span>
        </div>
      </div>

      {/* Speed Trace */}
      <div className="chart-panel">
        <h3>Speed Trace</h3>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="speedGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Grid */}
          {[0, 100, 200, 300].map(v => (
            <g key={v}>
              <line x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)} stroke="rgba(255,255,255,0.05)" />
              <text x={padding.left - 10} y={yScale(v) + 4} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="end">{v}</text>
            </g>
          ))}
          
          {/* Axes */}
          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="rgba(255,255,255,0.15)" />
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="rgba(255,255,255,0.15)" />
          
          {/* Area */}
          {speedPath && (
            <path d={`${speedPath} L ${width - padding.right} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`} fill="url(#speedGrad)" />
          )}
          
          {/* Line */}
          {speedPath && (
            <path d={speedPath} fill="none" stroke="#00f0ff" strokeWidth="2" />
          )}
          
          <text x={width / 2} y={height - 8} fill="rgba(255,255,255,0.5)" fontSize="11" textAnchor="middle">Distance (m)</text>
          <text x={15} y={height / 2} fill="rgba(255,255,255,0.5)" fontSize="11" textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`}>Speed (km/h)</text>
        </svg>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        {/* Lap Times Chart */}
        <div className="chart-panel">
          <h3>Lap Times</h3>
          <svg width="100%" height="200" viewBox={`0 0 ${lapChartWidth} ${lapChartHeight}`}>
            {/* Bars */}
            {lapTimes.map((lap, i) => (
              <g key={i}>
                <rect
                  x={lapXScale(i) - 15}
                  y={lapChartHeight - lapYScale(lap.time)}
                  width={30}
                  height={lapYScale(lap.time) - 30}
                  fill={tireColors[lap.tire] || '#888'}
                  opacity={0.7}
                  rx={4}
                />
                {lap.pit && (
                  <text x={lapXScale(i)} y={lapChartHeight - lapYScale(lap.time) - 5} fill="#e53935" fontSize="10" textAnchor="middle">PIT</text>
                )}
                <text x={lapXScale(i)} y={lapChartHeight - 10} fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="middle">L{lap.lap}</text>
              </g>
            ))}
          </svg>
        </div>

        {/* Final Stats */}
        <div className="chart-panel">
          <h3>End of Race</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Tire Life Gauge */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tire Life</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: stats.finalTire > 50 ? 'var(--racing-green)' : 'var(--racing-red)' }}>{stats.finalTire.toFixed(0)}%</span>
              </div>
              <div className="metric-bar">
                <div className={`metric-bar-fill ${stats.finalTire > 50 ? 'gold' : 'red'}`} style={{ width: `${stats.finalTire}%` }} />
              </div>
            </div>
            
            {/* Fuel */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fuel Remaining</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{stats.finalFuel.toFixed(1)} kg</span>
              </div>
              <div className="metric-bar">
                <div className="metric-bar-fill green" style={{ width: `${(stats.finalFuel / 100) * 100}%` }} />
              </div>
            </div>
            
            {/* Battery */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ERS Battery</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{stats.finalBattery.toFixed(2)} MJ</span>
              </div>
              <div className="metric-bar">
                <div className={`metric-bar-fill ${stats.finalBattery > 2 ? 'green' : 'red'}`} style={{ width: `${(stats.finalBattery / 4) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sector Times */}
      {data && data[0]?.sector_times && (
        <div className="chart-panel">
          <h3>Sector Analysis (Best Lap)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {['Sector 1', 'Sector 2', 'Sector 3'].map((name, i) => {
              const bestLap = data.reduce((best, lap) => 
                !best || (lap.pure_lap_time || lap.lap_time) < (best.pure_lap_time || best.lap_time) ? lap : best
              , null);
              const time = bestLap?.sector_times?.[i] || 0;
              
              return (
                <div key={i} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{name}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                    {time.toFixed(3)}s
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
