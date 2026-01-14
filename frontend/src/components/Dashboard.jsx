import { useState } from 'react'

const generateFakeTelemetry = () => {
    // Generate a speed trace for 1 lap
    const points = []
    for(let i=0; i<100; i++) {
        points.push({
            dist: i,
            speed: 100 + Math.sin(i/10) * 100 + Math.random()*10
        })
    }
    return points;
}

const Dashboard = ({ data }) => {
    // Fake data if none provided
    const [fakeData] = useState(() => generateFakeTelemetry())
    const telemetry = data || fakeData

    // Render a line chart
    const width = 800
    const height = 300
    const padding = 40
    
    const maxSpeed = Math.max(...telemetry.map(d => d.speed))
    const maxDist = Math.max(...telemetry.map(d => d.dist))
    
    const xScale = (d) => padding + (d / maxDist) * (width - padding * 2)
    const yScale = (s) => height - padding - (s / maxSpeed) * (height - padding * 2)
    
    const pathD = telemetry.map((p, i) => 
        `${i===0?'M':'L'} ${xScale(p.dist)} ${yScale(p.speed)}`
    ).join(' ')

    return (
        <div style={{width: '100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
            <div className="panel" style={{width: '90%', height: '80%'}}>
                <h3>Telemetry Analysis - Speed Trace</h3>
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{overflow:'visible'}}>
                    <defs>
                        <linearGradient id="speedGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#bd00ff" stopOpacity="0.4"/>
                            <stop offset="100%" stopColor="#bd00ff" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                    
                    {/* Grid */}
                    <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="var(--border-color)" />
                    <line x1={padding} y1={padding} x2={padding} y2={height-padding} stroke="var(--border-color)" />
                    
                    {/* Area Fill */}
                    <path d={`${pathD} L ${width-padding} ${height-padding} L ${padding} ${height-padding} Z`} fill="url(#speedGradient)" />
                    
                    {/* Line */}
                    <path d={pathD} fill="none" stroke="#bd00ff" strokeWidth="3" filter="drop-shadow(0 0 5px rgba(189,0,255,0.5))" />
                    
                    {/* Labels */}
                    <text x={width/2} y={height-10} fill="var(--text-secondary)" textAnchor="middle" fontSize="0.8rem">Distance (m)</text>
                    <text x={10} y={height/2} fill="var(--text-secondary)" transform={`rotate(-90 10,${height/2})`} textAnchor="middle" fontSize="0.8rem">Speed (km/h)</text>
                </svg>
            </div>
            
            <div style={{display:'flex', gap:'1rem', width:'90%'}}>
                 <div className="panel" style={{flex:1}}>
                     <h4>Tire Wear</h4>
                     <div style={{height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius:'3px', marginTop:'1rem', overflow:'hidden'}}>
                         <div style={{
                             width: `${telemetry ? telemetry[telemetry.length-1].tire_life : 100}%`, 
                             height:'100%', 
                             background: 'var(--accent-green)', 
                             borderRadius:'3px', 
                             boxShadow: '0 0 10px var(--accent-green)',
                             transition: 'width 0.5s ease'
                             }}></div>
                     </div>
                     <small style={{color:'var(--text-secondary)'}}>
                         {telemetry ? `${Math.round(telemetry[telemetry.length-1].tire_life)}%` : '100%'} Life - Soft C5
                     </small>
                 </div>
                 <div className="panel" style={{flex:1}}>
                     <h4>ERS Battery</h4>
                     <div style={{height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius:'3px', marginTop:'1rem', overflow:'hidden'}}>
                         <div style={{
                             width: `${telemetry ? (telemetry[telemetry.length-1].battery / 4.0) * 100 : 100}%`, 
                             height:'100%', 
                             background: 'linear-gradient(90deg, #ff3b3b, #00ff88)', 
                             borderRadius:'3px', 
                             boxShadow: '0 0 10px rgba(0,255,136,0.3)',
                             transition: 'width 0.2s ease'
                             }}></div>
                     </div>
                     <small style={{color:'var(--text-secondary)'}}>
                          {telemetry ? `${telemetry[telemetry.length-1].battery} MJ` : '4.0 MJ'} / 4.0 MJ
                     </small>
                 </div>
            </div>
        </div>
    )
}

export default Dashboard
