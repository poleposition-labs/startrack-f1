import { GeometryEngine } from '../utils/GeometryEngine'

const ValidationPanel = ({ points, isComplete, circuitName }) => {
  if (points.length < 3) return null;

  // Calculate validation metrics
  let totalLength = 0;
  let validation = { isValid: true, issues: [], stats: {} };
  
  if (points.length >= 2 && points[0].lat !== undefined) {
    // Calculate using GeometryEngine for Lat/Lon points
    const origin = points[0];
    const meterPoints = points.map(p => 
      GeometryEngine.latLonToMeters(p.lat, p.lng, origin.lat, origin.lng)
    );
    
    totalLength = GeometryEngine.calculateCircuitLength(meterPoints);
    validation = GeometryEngine.validateGeometry(meterPoints, isComplete);
  } else {
    // Fallback for pixel coordinates
    for (let i = 1; i < points.length; i++) {
      totalLength += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
  }

  const lengthKm = (totalLength / 1000).toFixed(3);
  const realLength = circuitName === 'Monaco GP' ? 3.337 : null;
  const accuracyScore = realLength ? Math.max(0, 100 - Math.abs(parseFloat(lengthKm) - realLength) / realLength * 100).toFixed(1) : null;

  return (
    <div className="absolute bottom-4 right-4 z-[1000] pointer-events-auto">
      <div className="glass-panel p-4 rounded-lg w-64">
        <h3 className="text-white font-semibold mb-3 text-sm">Track Validation</h3>
        
        <div className="space-y-2 text-xs">
          {/* Length */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">Length:</span>
            <span className="text-white font-mono">{lengthKm} km</span>
          </div>
          
          {/* Real Length Comparison */}
          {realLength && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-white/60">Real Length:</span>
                <span className="text-white/80 font-mono">{realLength} km</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-white/60">Accuracy:</span>
                <span className={`font-mono ${parseFloat(accuracyScore) > 80 ? 'text-green-400' : parseFloat(accuracyScore) > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {accuracyScore}%
                </span>
              </div>
            </>
          )}
          
          {/* Point Count */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">Control Points:</span>
            <span className="text-white">{points.length}</span>
          </div>
          
          {/* Status */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">Status:</span>
            <span className={isComplete ? 'text-green-400' : 'text-yellow-400'}>
              {isComplete ? '✓ Closed' : '○ Open'}
            </span>
          </div>
        </div>

        {/* Issues */}
        {validation.issues && validation.issues.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <h4 className="text-white/80 font-semibold mb-2 text-xs">Issues:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {validation.issues.map((issue, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${issue.type === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                  {issue.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationPanel;
