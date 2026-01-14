import { useRef, useEffect, useState, useCallback } from 'react'

// Check if circuit loop is closed
const isLoopClosed = (pts) => {
  if (pts.length < 3) return false;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dist = Math.hypot(first.x - last.x, first.y - last.y);
  return dist < 30;
}

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

const CircuitEditor = ({ points, setPoints, isComplete, raceProgress, isSimulating, showRacingLine, ghostProgress }) => {
  const canvasRef = useRef(null)
  const [draggingPoint, setDraggingPoint] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [carPosition, setCarPosition] = useState(null)
  const [ghostPosition, setGhostPosition] = useState(null)
  const smoothPointsRef = useRef([])

  const SNAP_GRID = 24;
  const TRACK_WIDTH = 28;

  // Update car positions during simulation
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

  // Drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')
    const rect = canvas.parentElement.getBoundingClientRect()
    
    // Handle HiDPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, rect.width, rect.height)
    
    // Draw subtle grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let x = 0; x < rect.width; x += SNAP_GRID) {
      for (let y = 0; y < rect.height; y += SNAP_GRID) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Track
    if (points.length > 1) {
      const closed = isComplete;
      const smoothPoints = getSplinePoints(points, 24, closed);
      smoothPointsRef.current = smoothPoints;

      if (smoothPoints.length > 1) {
        // Draw track outer edge (asphalt)
        ctx.save();
        ctx.lineWidth = TRACK_WIDTH + 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1a1a24';
        ctx.shadowBlur = 0;
        
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) {
          ctx.lineTo(p.x, p.y);
        }
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Draw track surface (dark gray)
        ctx.save();
        ctx.lineWidth = TRACK_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#2a2a38';
        
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) {
          ctx.lineTo(p.x, p.y);
        }
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Draw racing line with speed colors
        if (showRacingLine) {
          // Draw Optimal Line (Apexes) visual helper
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 235, 59, 0.6)'; // Yellow line
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 10]);
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffee58';
          
          ctx.beginPath();
          // Simplified optimal line: shift points inwards at corners based on turn direction
          // This is a visual approximation for the user
          for (let i = 0; i < smoothPoints.length; i++) {
             const p = smoothPoints[i];
             // Simple shift for visual effect (improve later with real physics data if needed)
             const shift = (Math.sin(i * 0.1) * TRACK_WIDTH * 0.3); 
             if (i===0) ctx.moveTo(p.x + shift, p.y + shift);
             else ctx.lineTo(p.x + shift, p.y + shift);
          }
          if (closed) ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        // Standard speed line (always visible)
        for (let i = 1; i < smoothPoints.length; i++) {
          const p1 = smoothPoints[i-1];
          const p2 = smoothPoints[i];
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          const speed = p2.speed || 1.0;
          // Red (slow) -> Yellow -> Green -> Cyan (fast)
          const hue = Math.floor(speed * 180);
          const color = `hsl(${hue}, 100%, 50%)`;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.stroke();
        }

        // Draw white center line (dashed)
        ctx.save();
        ctx.setLineDash([10, 20]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        
        ctx.beginPath();
        ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
        for (let p of smoothPoints) {
          ctx.lineTo(p.x, p.y);
        }
        if (closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw Start/Finish line if circuit is complete
    if (points.length >= 3 && isComplete) {
      const startPoint = points[0];
      const secondPoint = points[1];
      const angle = Math.atan2(secondPoint.y - startPoint.y, secondPoint.x - startPoint.x);
      const perpAngle = angle + Math.PI / 2;
      
      const lineLength = TRACK_WIDTH + 10;
      const x1 = startPoint.x + Math.cos(perpAngle) * lineLength / 2;
      const y1 = startPoint.y + Math.sin(perpAngle) * lineLength / 2;
      const x2 = startPoint.x - Math.cos(perpAngle) * lineLength / 2;
      const y2 = startPoint.y - Math.sin(perpAngle) * lineLength / 2;
      
      // Checkered pattern effect
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

    // Draw Control Points
    points.forEach((p, i) => {
      const isHovered = hoveredPoint === i || draggingPoint === i;
      const isStart = i === 0;
      const isEnd = i === points.length - 1;
      
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
      
      // Inner dot
      ctx.beginPath();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#030308';
      ctx.arc(p.x, p.y, isHovered ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Race Car during simulation
    if (carPosition && isSimulating) {
      ctx.save();
      ctx.translate(carPosition.x, carPosition.y);
      ctx.rotate(carPosition.angle || 0);
      
      // Car body
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#e53935';
      ctx.fillStyle = '#e53935';
      
      // Simple F1 car shape
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -6);
      ctx.lineTo(-12, -4);
      ctx.lineTo(-12, 4);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();
      
      // Front wing
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(10, -8, 3, 16);
      
      // Rear wing
      ctx.fillRect(-14, -7, 2, 14);
      
      // Cockpit
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }

    // Draw hint to close circuit
    if (points.length >= 3 && !isComplete) {
      const first = points[0];
      const last = points[points.length - 1];
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
    
  }, [points, hoveredPoint, draggingPoint, isComplete, carPosition, ghostPosition, isSimulating, showRacingLine]);

  useEffect(() => {
    draw();
    
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleMouseDown = (e) => {
    if (isSimulating) return;
    
    const {x, y} = getMousePos(e)
    const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < 15);
    
    if (hitIndex !== -1) {
      setDraggingPoint(hitIndex);
    } else {
      const snapX = Math.round(x / SNAP_GRID) * SNAP_GRID;
      const snapY = Math.round(y / SNAP_GRID) * SNAP_GRID;
      setPoints([...points, {x: snapX, y: snapY}]);
    }
  }
  
  const handleMouseMove = (e) => {
    const {x, y} = getMousePos(e)
    const snapX = Math.round(x / SNAP_GRID) * SNAP_GRID;
    const snapY = Math.round(y / SNAP_GRID) * SNAP_GRID;

    if (draggingPoint !== null && !isSimulating) {
      const newPoints = [...points];
      newPoints[draggingPoint] = {x: snapX, y: snapY};
      setPoints(newPoints);
      return;
    }

    const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < 15);
    setHoveredPoint(hitIndex !== -1 ? hitIndex : null);
  }
  
  const handleMouseUp = () => {
    setDraggingPoint(null);
  }

  return (
    <canvas 
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDraggingPoint(null); setHoveredPoint(null); }}
      style={{ 
        width: '100%', 
        height: '100%', 
        cursor: isSimulating ? 'default' : (draggingPoint !== null ? 'grabbing' : 'crosshair'), 
        display: 'block' 
      }}
    />
  )
}

export default CircuitEditor
