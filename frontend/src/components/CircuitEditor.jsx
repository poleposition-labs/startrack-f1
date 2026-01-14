import { useRef, useEffect, useState } from 'react'

const isLoopClosed = (pts) => {
    if(pts.length < 3) return false;
    const first = pts[0];
    const last = pts[pts.length-1];
    const dist = Math.hypot(first.x - last.x, first.y - last.y);
    return dist < 20; // Snap distance
}

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

    // Curvature calculation helper
    // We'll assign a 'speed factor' (0.0 to 1.0) based on local curvature
    // 1.0 = Straight (Fast), 0.0 = Tight Turn (Slow)
    
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
            
            // Derivative (Tangent vector)
            // dx/dt = 0.5 * (p0.x*dq0 + ...)
            const dq0 = -3*tt + 4*st - 1;
            const dq1 = 9*tt - 10*st;
            const dq2 = -9*tt + 8*st + 1;
            const dq3 = 3*tt - 1;
            
            const dx = 0.5 * (p0.x * dq0 + p1.x * dq1 + p2.x * dq2 + p3.x * dq3);
            const dy = 0.5 * (p0.y * dq0 + p1.y * dq1 + p2.y * dq2 + p3.y * dq3);
            
            // Second Derivative (Acceleration vector) - for Curvature k = |x'y'' - y'x''| / (x'^2 + y'^2)^(3/2)
            // Simple approximation for visualization: 1 / radius
            // Actually, let's just use the segment angle change for simplified speed map
            
            splinePoints.push({ x, y, dx, dy });
        }
    }
    
    // Post-process to calculate curvature/speed colors
    for(let i=0; i<splinePoints.length; i++) {
        const p = splinePoints[i];
        // Calculate curvature based on change in tangent angle
        let curvature = 0;
        if (i > 0 && i < splinePoints.length - 1) {
             const prev = splinePoints[i-1];
             const angle1 = Math.atan2(prev.dy, prev.dx);
             const angle2 = Math.atan2(p.dy, p.dx);
             let diff = Math.abs(angle1 - angle2);
             if(diff > Math.PI) diff = 2*Math.PI - diff; // Wrap
             curvature = diff * 10; // Scale up
        }
        
        // Speed: Inverse of curvature. 
        // 0 curvature = Max Speed (1.0). High curvature = Min Speed (0.2)
        let speed = 1.0 - Math.min(curvature, 0.8);
        p.speed = speed;
    }

    if (!closed) {
        const last = points[points.length-1];
        splinePoints.push({...last, speed: splinePoints[splinePoints.length-1]?.speed || 0});
    }
    return splinePoints;
}

const CircuitEditor = ({ points, setPoints }) => {
    const canvasRef = useRef(null)
    const [draggingPoint, setDraggingPoint] = useState(null)
    const [hoveredPoint, setHoveredPoint] = useState(null)

    // Config
    const SNAP_GRID = 20;

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const rect = canvas.parentElement.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Draw Grid Dots
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        for(let x=0; x<canvas.width; x+=SNAP_GRID) {
            for(let y=0; y<canvas.height; y+=SNAP_GRID) {
                ctx.fillRect(x-1, y-1, 2, 2);
            }
        }

        // Draw Spline Track
        if (points.length > 1) {
            const closed = isLoopClosed(points);
            const smoothPoints = getSplinePoints(points, 20, closed);

            // Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f0ff';
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = 6;

            // Draw segments with dynamic color
            // Standard stroke() takes one color. To create gradient line efficiently without 
            // thousands of stroke calls, we can use a GradientStroke or multiple segments.
            // For 2000 points, rendering individual lines is okay for "Neon" look.
            
            for(let i=1; i<smoothPoints.length; i++) {
                const p1 = smoothPoints[i-1];
                const p2 = smoothPoints[i];
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                
                // Color interpolation: Red (0) to Cyan (120 hue?) or straight Red/Blue
                // Speed 1.0 (Fast) -> Cyan (#00f0ff)
                // Speed 0.2 (Slow) -> Red (#ff3b3b)
                const speed = p2.speed || 1.0;
                
                // Simple mix
                // Low speed -> Red, High speed -> Cyan
                // We can use HSL. Cyan is ~180, Purple ~280, Red ~360/0
                // Let's go Red (0) -> Purple (280) -> Cyan (180)?
                // Let's do Red (Slow) -> Yellow -> Green -> Cyan (Fast)
                // Red=0, Green=120, Cyan=180.
                const hue = Math.floor(speed * 180); 
                const color = `hsl(${hue}, 100%, 50%)`;
                
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                ctx.stroke();
            }
            
            // Draw Inner White Core (Simplified - just one white line on top? 
            // Or skip to keep the colors vibrant. Let's keep a thin white line with low opacity)
             ctx.globalCompositeOperation = 'source-over';
             ctx.shadowBlur = 0;
             ctx.strokeStyle = 'rgba(255,255,255,0.8)';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);
             for(let p of smoothPoints) ctx.lineTo(p.x, p.y);
             if (closed) ctx.closePath();
             ctx.stroke();
        }

        // Draw Control Points
        points.forEach((p, i) => {
            ctx.beginPath()
            const isHovered = hoveredPoint === i || draggingPoint === i;
            
            if (isHovered) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#bd00ff';
                ctx.fillStyle = '#bd00ff';
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2) // Larger touch target
            } else {
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
            }
            ctx.fill()
            
            if (i === 0) {
                 ctx.fillStyle = '#00ff88'; 
                 ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            }
        })
        
    }, [points, hoveredPoint, draggingPoint])

    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect()
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        }
    }

    const handleMouseDown = (e) => {
        const {x, y} = getMousePos(e)
        // Check if clicking existing point
        const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < 15);
        
        if (hitIndex !== -1) {
            setDraggingPoint(hitIndex);
        } else {
            // Add new point (Snap to grid)
            const snapX = Math.round(x / SNAP_GRID) * SNAP_GRID;
            const snapY = Math.round(y / SNAP_GRID) * SNAP_GRID;
            setPoints([...points, {x: snapX, y: snapY}]);
        }
    }
    
    const handleMouseMove = (e) => {
        const {x, y} = getMousePos(e)
        const snapX = Math.round(x / SNAP_GRID) * SNAP_GRID;
        const snapY = Math.round(y / SNAP_GRID) * SNAP_GRID;

        if (draggingPoint !== null) {
            // Move existing point
            const newPoints = [...points];
            newPoints[draggingPoint] = {x: snapX, y: snapY};
            setPoints(newPoints);
            // setHoveredPoint(draggingPoint); // Keep it looked 'active'
            return;
        }

        // Hover Check
        const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < 15);
        setHoveredPoint(hitIndex !== -1 ? hitIndex : null);
    }
    
    const handleMouseUp = () => {
        setDraggingPoint(null);
        // Closure check logic similar to before
        if (points.length > 2 && isLoopClosed(points)) {
             // Maybe auto-weld?
             // For now, visual closure is handled in render.
        }
    }

    return (
        <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {setDraggingPoint(null); setHoveredPoint(null)}}
            style={{ width: '100%', height: '100%', cursor: draggingPoint !== null ? 'grabbing' : 'crosshair', display: 'block' }}
        />
    )
}

export default CircuitEditor
