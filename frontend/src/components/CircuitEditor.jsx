import { useRef, useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { GeometryEngine } from '../utils/GeometryEngine'

// Fix for default marker icons in Leaflet with webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Generate smooth spline points with Catmull-Rom interpolation
const getSplinePoints = (points, segments = 20, closed = false) => {
  if (points.length < 2) return points.map(p => ({...p, speed: 1.0}));
  
  const splinePoints = [];
  const pts = [...points];
  
  if (closed) {
    pts.unshift(points[points.length - 1]);
    pts.unshift(points[points.length - 2]);
    pts.push(points[0]);
    pts.push(points[1]);
  } else {
    pts.unshift(points[0]);
    pts.push(points[points.length - 1]);
  }

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];

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
      
      // Calculate tangent for rotation
      const dq0 = -3*tt + 4*st - 1;
      const dq1 = 9*tt - 10*st;
      const dq2 = -9*tt + 8*st + 1;
      const dq3 = 3*tt - 1;
      
      const dx = 0.5 * (p0.x * dq0 + p1.x * dq1 + p2.x * dq2 + p3.x * dq3);
      const dy = 0.5 * (p0.y * dq0 + p1.y * dq1 + p2.y * dq2 + p3.y * dq3);
      
      splinePoints.push({ x, y, dx, dy, angle: Math.atan2(dy, dx) });
    }
  }
  
  // Calculate speed colors based on curvature
  for (let i = 0; i < splinePoints.length; i++) {
    const p = splinePoints[i];
    let curvature = 0;
    if (i > 0 && i < splinePoints.length - 1) {
      const prev = splinePoints[i-1];
      const angle1 = Math.atan2(prev.dy, prev.dx);
      const angle2 = Math.atan2(p.dy, p.dx);
      let diff = Math.abs(angle1 - angle2);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      curvature = diff * 10;
    }
    let speed = 1.0 - Math.min(curvature, 0.8);
    p.speed = speed;
  }

  if (!closed) {
    const last = points[points.length-1];
    splinePoints.push({...last, speed: splinePoints[splinePoints.length-1]?.speed || 0, angle: 0});
  }
  return splinePoints;
}

// TrackOverlay Component handles the Canvas drawing synced with Leaflet Map
const TrackOverlay = ({ points, setPoints, isComplete, raceProgress, isSimulating, showRacingLine, ghostProgress }) => {
  const map = useMap();
  const canvasRef = useRef(null);
  const [draggingPoint, setDraggingPoint] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [carPosition, setCarPosition] = useState(null);
  const [ghostPosition, setGhostPosition] = useState(null);
  const smoothPointsRef = useRef([]);

  const TRACK_WIDTH = 28;

  // Sync Car Positions
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

  // Main Draw Function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    
    // Get map dimensions
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    
    // Resize canvas to match map
    if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, size.x, size.y);

    // Coordinate Conversion: Lat/Lon -> Container Points (Pixels)
    const projectedPoints = points.map(p => {
       if (p.lat !== undefined && p.lng !== undefined) {
           return map.latLngToContainerPoint(p);
       }
       // Fallback for non-geo points (should be avoided in Real Mode)
       return {x: p.x, y: p.y}; 
    });

    if (projectedPoints.length > 1) {
      const closed = isComplete;
      const smoothPoints = getSplinePoints(projectedPoints, 24, closed);
      smoothPointsRef.current = smoothPoints;

      if (smoothPoints.length > 1) {
        // Draw track outer edge
        ctx.save();
        ctx.lineWidth = TRACK_WIDTH + 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#050507'; 
        ctx.shadowBlur = 0;
        
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) ctx.lineTo(p.x, p.y);
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Draw track surface
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

        // Speed Line
        for (let i = 1; i < smoothPoints.length; i++) {
          const p1 = smoothPoints[i-1];
          const p2 = smoothPoints[i];
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          const speed = p2.speed || 1.0;
          const hue = Math.floor(speed * 180);
          const color = `hsl(${hue}, 100%, 50%)`;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.stroke();
        }

        // Center dashed line
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

    // Draw Start/Finish
    if (projectedPoints.length >= 3 && isComplete) {
       const startPoint = projectedPoints[0];
       const secondPoint = projectedPoints[1];
       const angle = Math.atan2(secondPoint.y - startPoint.y, secondPoint.x - startPoint.x);
       const perpAngle = angle + Math.PI / 2;
       
       const lineLength = TRACK_WIDTH + 10;
       const x1 = startPoint.x + Math.cos(perpAngle) * lineLength / 2;
       const y1 = startPoint.y + Math.sin(perpAngle) * lineLength / 2;
       const x2 = startPoint.x - Math.cos(perpAngle) * lineLength / 2;
       const y2 = startPoint.y - Math.sin(perpAngle) * lineLength / 2;
       
       ctx.save();
       ctx.strokeStyle = '#ffffff';
       ctx.lineWidth = 4;
       ctx.shadowBlur = 10;
       ctx.shadowColor = '#ffffff';
       ctx.beginPath();
       ctx.moveTo(x1, y1);
       ctx.lineTo(x2, y2);
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
      if (isHovered) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#d4a853';
        ctx.fillStyle = '#d4a853';
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      }
      ctx.fill();
      
      ctx.beginPath();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#030308';
      ctx.arc(p.x, p.y, isHovered ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Cars
    if (carPosition) {
       ctx.save();
       ctx.translate(carPosition.x, carPosition.y);
       ctx.rotate(carPosition.angle || 0);
       
       // Car Shape
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

    // Close Hint
    if (projectedPoints.length >= 3 && !isComplete && !isSimulating) {
      const first = projectedPoints[0];
      const last = projectedPoints[projectedPoints.length - 1];
      const dist = Math.hypot(first.x - last.x, first.y - last.y);
      
      if (dist < 80) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(67, 160, 71, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(first.x, first.y);
        ctx.stroke();
        ctx.restore();
      }
    }

  }, [points, hoveredPoint, draggingPoint, isComplete, carPosition, ghostPosition, isSimulating, showRacingLine, ghostProgress, map]);

  // Hook into Map Events
  useMapEvents({
    move: () => {
      draw();
    },
    zoom: () => {
      draw();
    },
    mousemove: (e) => {
       if (isSimulating || ghostProgress !== undefined) return;
       
       const containerPoint = map.latLngToContainerPoint(e.latlng);
       const projectedPoints = points.map(p => {
         if (p.lat !== undefined) return map.latLngToContainerPoint(p);
         return {x: p.x, y: p.y};
       });
       
       const hitIndex = projectedPoints.findIndex(p => Math.hypot(p.x - containerPoint.x, p.y - containerPoint.y) < 15);
       setHoveredPoint(hitIndex !== -1 ? hitIndex : null);

       if (draggingPoint !== null) {
           L.DomEvent.disableClickPropagation(canvasRef.current);
           const newPoints = [...points];
           newPoints[draggingPoint] = e.latlng;
           setPoints(newPoints);
       }
    },
    mousedown: (e) => {
        if (isSimulating || ghostProgress !== undefined) return;
        
        const containerPoint = map.latLngToContainerPoint(e.latlng);
        const projectedPoints = points.map(p => {
           if (p.lat !== undefined) return map.latLngToContainerPoint(p);
           return {x: p.x, y: p.y};
        });
        
        const hitIndex = projectedPoints.findIndex(p => Math.hypot(p.x - containerPoint.x, p.y - containerPoint.y) < 15);

        if (hitIndex !== -1) {
            setDraggingPoint(hitIndex);
            map.dragging.disable();
        } else {
             setPoints([...points, e.latlng]);
        }
    },
    mouseup: () => {
        setDraggingPoint(null);
        map.dragging.enable();
    }
  });

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas 
      ref={canvasRef}
      className="leaflet-overlay-pane pointer-events-none" 
      style={{ 
        position: 'absolute', 
        zIndex: 500, 
        pointerEvents: 'none', 
      }}
    />
  );
}

const CircuitEditor = (props) => {
  const monacoCenter = [43.7347, 7.4206];
  
  return (
    <div className="h-full w-full relative bg-gray-900 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-2xl">
      <MapContainer 
        center={monacoCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
        />
        <TrackOverlay {...props} />
      </MapContainer>
      
      <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
          <div className="glass-panel px-4 py-2 rounded-lg text-xs text-white/50">
              REAL MODE ENABLED
          </div>
      </div>
    </div>
  )
}

export default CircuitEditor
