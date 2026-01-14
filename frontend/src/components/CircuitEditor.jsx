import { useRef, useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { GeometryEngine } from '../utils/GeometryEngine'
import ValidationPanel from './ValidationPanel'

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Generate smooth spline points or straight lines based on segment type
const getSplinePoints = (points, segments = 20, closed = false) => {
  if (points.length < 2) return points.map(p => ({...p, speed: 1.0}));
  
  const splinePoints = [];
  
  // Adjusted logic for closed loops to ensure smooth connection
  const loopPoints = closed ? [...points, points[0]] : points;
  
  for (let i = 0; i < loopPoints.length - 1; i++) {
    const p1 = loopPoints[i];
    const p2 = loopPoints[i + 1];
    
    // If marked as straight, draw linear interpolation
    if (p1.type === 'straight') {
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(5, Math.floor(dist / 10));
      
      for (let t = 0; t <= steps; t++) {
        const ratio = t / steps;
        const x = p1.x + (p2.x - p1.x) * ratio;
        const y = p1.y + (p2.y - p1.y) * ratio;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        // Don't duplicate points at segment boundaries unless necessary
        if (t > 0 || i === 0) {
            splinePoints.push({ x, y, dx, dy, angle: Math.atan2(dy, dx), speed: 1.0 });
        }
      }
    } else {
      // Catmull-Rom spline for curves
      // Robust previous/next point handling
      const p0 = i > 0 ? loopPoints[i - 1] : (closed ? loopPoints[loopPoints.length - 2] : p1);
      const p3 = i < loopPoints.length - 2 ? loopPoints[i + 2] : (closed ? loopPoints[1] : p2);

      for (let t = 0; t < segments; t++) {
        const st = t / segments;
        const tt = st * st;
        const ttt = tt * st;

        const q0 = -ttt + 2 * tt - st;
        const q1 = 3 * ttt - 5 * tt + 2;
        const q2 = -3 * ttt + 4 * tt + st;
        const q3 = ttt - st;

        const x = 0.5 * (p0.x * q0 + p1.x * q1 + p2.x * q2 + p3.x * q3);
        const y = 0.5 * (p0.y * q0 + p1.y * q1 + p2.y * q2 + p3.y * q3);
        
        const dq0 = -3*tt + 4*st - 1;
        const dq1 = 9*tt - 10*st;
        const dq2 = -9*tt + 8*st + 1;
        const dq3 = 3*tt - 1;
        
        const dx = 0.5 * (p0.x * dq0 + p1.x * dq1 + p2.x * dq2 + p3.x * dq3);
        const dy = 0.5 * (p0.y * dq0 + p1.y * dq1 + p2.y * dq2 + p3.y * dq3);
        
        splinePoints.push({ x, y, dx, dy, angle: Math.atan2(dy, dx) });
      }
    }
  }
  
  // Calculate speed colors
  for (let i = 0; i < splinePoints.length; i++) {
    const p = splinePoints[i];
    if (p.speed === 1.0) continue;
    
    let curvature = 0;
    if (i > 0 && i < splinePoints.length - 1) {
      const prev = splinePoints[i-1];
      const angle1 = Math.atan2(prev.dy, prev.dx);
      const angle2 = Math.atan2(p.dy, p.dx);
      let diff = Math.abs(angle1 - angle2);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      curvature = diff * 10;
    }
    p.speed = 1.0 - Math.min(curvature, 0.8);
  }

  return splinePoints;
}

const TrackOverlay = ({ points, setPoints, isComplete, raceProgress, isSimulating, showRacingLine, ghostProgress, activeTool, isRealMode }) => {
  const map = useMap();
  const canvasRef = useRef(null);
  const [draggingPoint, setDraggingPoint] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [carPosition, setCarPosition] = useState(null);
  const [ghostPosition, setGhostPosition] = useState(null);
  const smoothPointsRef = useRef([]);

  const TRACK_WIDTH = 28;

  useEffect(() => {
    if ((isSimulating || ghostProgress !== undefined) && smoothPointsRef.current.length > 0) {
      if (isSimulating) {
        const index = Math.floor((raceProgress / 100) * (smoothPointsRef.current.length - 1));
        const point = smoothPointsRef.current[Math.min(index, smoothPointsRef.current.length - 1)];
        if (point) setCarPosition(point);
      }
      if (ghostProgress !== undefined) {
        const index = Math.floor((ghostProgress / 100) * (smoothPointsRef.current.length - 1));
        const point = smoothPointsRef.current[Math.min(index, smoothPointsRef.current.length - 1)];
        if (point) setGhostPosition(point);
      }
    } else if (!isSimulating && ghostProgress === undefined) {
      setCarPosition(null);
      setGhostPosition(null);
    }
  }, [raceProgress, isSimulating, ghostProgress]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext('2d');
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    
    if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      ctx.scale(dpr, dpr);
    }
    
    ctx.clearRect(0, 0, size.x, size.y);

    const projectedPoints = points.map(p => {
       if (p.lat !== undefined && p.lng !== undefined) {
           const pt = map.latLngToContainerPoint(p);
           return { x: pt.x, y: pt.y, type: p.type };
       }
       return {x: p.x, y: p.y, type: p.type}; 
    });

    if (projectedPoints.length > 1) {
      const closed = isComplete;
      const smoothPoints = getSplinePoints(projectedPoints, 24, closed);
      smoothPointsRef.current = smoothPoints;

      if (smoothPoints.length > 1) {
        // Track Outline
        ctx.save();
        ctx.lineWidth = TRACK_WIDTH + 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#050507'; 
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) ctx.lineTo(p.x, p.y);
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Track Surface
        ctx.save();
        ctx.lineWidth = TRACK_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1a1a20';
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) ctx.lineTo(p.x, p.y);
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Racing Line
        if (showRacingLine) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 235, 59, 0.6)';
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 10]);
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffee58';
          ctx.beginPath();
          for (let i = 0; i < smoothPoints.length; i++) {
             const p = smoothPoints[i];
             const shift = (Math.sin(i * 0.1) * TRACK_WIDTH * 0.3); 
             if (i===0) ctx.moveTo(p.x + shift, p.y + shift);
             else ctx.lineTo(p.x + shift, p.y + shift);
          }
          if (closed) ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        // Speed Gradient Line
        for (let i = 1; i < smoothPoints.length; i++) {
          const p1 = smoothPoints[i-1];
          const p2 = smoothPoints[i];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          const speed = p2.speed || 1.0;
          const hue = Math.floor(speed * 180);
          ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.stroke();
        }

        // Center Dashed Line
        ctx.save();
        ctx.setLineDash([10, 20]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) ctx.lineTo(p.x, p.y);
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Start/Finish Line
    if (projectedPoints.length >= 3 && isComplete) {
       const start = projectedPoints[0];
       const second = projectedPoints[1];
       const angle = Math.atan2(second.y - start.y, second.x - start.x);
       const perp = angle + Math.PI / 2;
       const len = TRACK_WIDTH + 10;
       
       ctx.save();
       ctx.strokeStyle = '#ffffff';
       ctx.lineWidth = 4;
       ctx.shadowBlur = 10;
       ctx.shadowColor = '#ffffff';
       ctx.beginPath();
       ctx.moveTo(start.x + Math.cos(perp)*len/2, start.y + Math.sin(perp)*len/2);
       ctx.lineTo(start.x - Math.cos(perp)*len/2, start.y - Math.sin(perp)*len/2);
       ctx.stroke();
       ctx.restore();
    }

    // Control Points
    projectedPoints.forEach((p, i) => {
      if (isSimulating || ghostProgress !== undefined) return;
      
      const isHovered = hoveredPoint === i || draggingPoint === i;
      const isStart = i === 0;
      const isEnd = i === projectedPoints.length - 1;
      
      ctx.beginPath();
      // Color based on type (Blue = Straight, Yellow = Corner)
      const color = p.type === 'straight' ? '#2196f3' : '#d4a853';
      
      if (isHovered) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      } else if (isStart) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#43a047';
        ctx.fillStyle = '#43a047';
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      } else if (isEnd && !isComplete) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#e53935';
        ctx.fillStyle = '#e53935';
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.type === 'straight' ? 'rgba(33, 150, 243, 0.7)' : 'rgba(255, 255, 255, 0.5)';
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      }
      ctx.fill();
      
      // Center dot
      ctx.beginPath();
      ctx.fillStyle = '#030308';
      ctx.arc(p.x, p.y, isHovered ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Cars
    if (carPosition) {
       ctx.save();
       ctx.translate(carPosition.x, carPosition.y);
       ctx.rotate(carPosition.angle || 0);
       ctx.shadowBlur = 20;
       ctx.shadowColor = '#e53935';
       ctx.fillStyle = '#e53935';
       ctx.beginPath();
       ctx.moveTo(15, 0);
       ctx.lineTo(-10, -6);
       ctx.lineTo(-12, -4);
       ctx.lineTo(-12, 4);
       ctx.lineTo(-10, 6);
       ctx.closePath();
       ctx.fill();
       ctx.fillStyle = '#ffffff';
       ctx.fillRect(10, -8, 3, 16);
       ctx.fillRect(-14, -7, 2, 14);
       ctx.fillStyle = '#000000';
       ctx.beginPath();
       ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
       ctx.fill();
       ctx.restore();
    }
    
    if (ghostPosition) {
       ctx.save();
       ctx.translate(ghostPosition.x, ghostPosition.y);
       ctx.rotate(ghostPosition.angle || 0);
       ctx.globalAlpha = 0.5;
       ctx.shadowBlur = 15;
       ctx.shadowColor = '#00e5ff';
       ctx.fillStyle = '#00e5ff';
       ctx.beginPath();
       ctx.moveTo(15, 0);
       ctx.lineTo(-10, -6);
       ctx.lineTo(-12, -4);
       ctx.lineTo(-12, 4);
       ctx.lineTo(-10, 6);
       ctx.closePath();
       ctx.fill();
       ctx.restore();
    }

  }, [points, hoveredPoint, draggingPoint, isComplete, carPosition, ghostPosition, isSimulating, showRacingLine, ghostProgress, map]);

  useMapEvents({
    move: () => draw(),
    zoom: () => draw(),
    mousemove: (e) => {
       if (isSimulating || ghostProgress !== undefined) return;
       const containerPoint = map.latLngToContainerPoint(e.latlng);
       const projectedPoints = points.map(p => p.lat !== undefined ? map.latLngToContainerPoint(p) : {x:p.x, y:p.y});
       
       const hitIndex = projectedPoints.findIndex(p => Math.hypot(p.x - containerPoint.x, p.y - containerPoint.y) < 15);
       setHoveredPoint(hitIndex !== -1 ? hitIndex : null);

       if (draggingPoint !== null) {
           L.DomEvent.disableClickPropagation(canvasRef.current);
           const newPoints = [...points];
           newPoints[draggingPoint] = { ...newPoints[draggingPoint], lat: e.latlng.lat, lng: e.latlng.lng };
           setPoints(newPoints);
       }
    },
    mousedown: (e) => {
        if (isSimulating || ghostProgress !== undefined || isRealMode) return;
        
        const containerPoint = map.latLngToContainerPoint(e.latlng);
        const projectedPoints = points.map(p => p.lat !== undefined ? map.latLngToContainerPoint(p) : {x:p.x, y:p.y});
        const hitIndex = projectedPoints.findIndex(p => Math.hypot(p.x - containerPoint.x, p.y - containerPoint.y) < 15);
       
        if (activeTool === 'select') {
           if (hitIndex !== -1) {
               setDraggingPoint(hitIndex);
               map.dragging.disable();
           }
        } else {
             // Drawing Mode
             if (hitIndex === 0 && points.length >= 3) {
                 // Close the loop by snapping to start point
                 const startPoint = points[0];
                 const type = activeTool === 'straight' ? 'straight' : 'corner';
                 setPoints([...points, { ...startPoint, type }]);
             } else if (hitIndex === -1) {
                 // Add new point normally
                 const type = activeTool === 'straight' ? 'straight' : 'corner';
                 setPoints([...points, { lat: e.latlng.lat, lng: e.latlng.lng, type }]);
             }
        }
    },
    mouseup: () => {
        setDraggingPoint(null);
        map.dragging.enable();
    }
  });

  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas 
      ref={canvasRef}
      className="leaflet-overlay-pane pointer-events-none" 
      style={{ position: 'absolute', zIndex: 500, pointerEvents: 'none' }}
    />
  );
}

const CircuitEditor = (props) => {
  const monacoCenter = [43.7347, 7.4206];
  const [activeTool, setActiveTool] = useState('freehand');
  
  return (
    <div className="h-full w-full relative bg-gray-900 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-2xl">
      <MapContainer 
        center={monacoCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
        />
        <TrackOverlay {...props} activeTool={activeTool} />
      </MapContainer>
      
      {/* Drawing Toolbar */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
         <div className="glass-panel p-2 rounded-lg flex flex-col gap-2">
            <button 
               className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${activeTool === 'select' ? 'bg-[#d4a853] text-white' : 'hover:bg-white/10 text-white/70'}`}
               onClick={() => setActiveTool('select')}
               title="Select / Move Points"
            >
               👆
            </button>
            <button 
               className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${activeTool === 'freehand' ? 'bg-[#d4a853] text-white' : 'hover:bg-white/10 text-white/70'}`}
               onClick={() => setActiveTool('freehand')}
               title="Freehand Curve"
            >
               〰️
            </button>
            <button 
               className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${activeTool === 'straight' ? 'bg-[#2196f3] text-white' : 'hover:bg-white/10 text-white/70'}`}
               onClick={() => setActiveTool('straight')}
               title="Straight Line Segment"
            >
               📏
            </button>
         </div>
      </div>
      
      <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
          <div className="glass-panel px-4 py-2 rounded-lg text-xs text-white/50">
              REAL MODE ENABLED
          </div>
      </div>

      {/* Validation Panel */}
      <ValidationPanel 
        points={props.points} 
        isComplete={props.isComplete}
        circuitName="Custom Track"
      />
    </div>
  )
}

export default CircuitEditor
