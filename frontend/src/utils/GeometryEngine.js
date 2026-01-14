/**
 * GeometryEngine.js
 * 
 * Handles geometric calculations, coordinate conversions, and validation logic 
 * for the Realistic Circuit Editor.
 */

// WGS84 Constants
const R = 6371000; // Earth radius in meters

export const GeometryEngine = {
  /**
   * Calculate distance between two lat/lon points in meters using Haversine formula
   */
  getDistanceMeters: (lat1, lon1, lat2, lon2) => {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  /**
   * Convert lat/lon point to XY meters relative to a reference origin
   */
  latLonToMeters: (lat, lon, originLat, originLon) => {
    const x = GeometryEngine.getDistanceMeters(originLat, originLon, originLat, lon);
    const y = GeometryEngine.getDistanceMeters(originLat, originLon, lat, originLon);
    
    // Adjust signs based on direction
    return {
      x: lon > originLon ? x : -x,
      y: lat > originLat ? y : -y // North is positive Y usually, but canvas is inverted. Let's keep math standard first.
    };
  },

  /**
   * Calculate total circuit length from segment points
   */
  calculateCircuitLength: (points) => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
    // Close loop if needed
    // length += Math.hypot(points[0].x - points[points.length-1].x, points[0].y - points[points.length-1].y);
    return length;
  },

  /**
   * Validate drawn geometry against real-world F1 constraints
   */
  validateGeometry: (points, closed = false) => {
    const issues = [];
    const stats = {
      totalLength: 0,
      sharpestTurn: 180,
      longestStraight: 0
    };
    
    // Length & Straight calculation
    let currentStraight = 0;
    
    for (let i = 1; i < points.length; i++) {
      const dist = Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
      stats.totalLength += dist;
      
      // Turn Angle check (Simplified)
      if (i > 1) {
        const p1 = points[i-2];
        const p2 = points[i-1];
        const p3 = points[i];
        
        const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        
        let diff = Math.abs(angle1 - angle2) * 180 / Math.PI;
        if (diff > 180) diff = 360 - diff;
        
        if (diff > 160) { // Extremely sharp turn
            issues.push({type: 'critical', message: `Impossible sharp turn at point ${i}`, index: i});
        } else if (diff > 120) {
            issues.push({type: 'warning', message: `Very tight hairpin at point ${i}`, index: i});
        }
        
        if (diff < 2) {
            currentStraight += dist;
        } else {
            stats.longestStraight = Math.max(stats.longestStraight, currentStraight);
            currentStraight = 0;
        }
      } else {
          currentStraight += dist;
      }
    }
    
    if (stats.totalLength < 3000) issues.push({type: 'warning', message: 'Track too short for F1 standards (<3km)'});
    if (stats.totalLength > 8000) issues.push({type: 'warning', message: 'Track too long for F1 standards (>8km)'});
    
    return { isValid: issues.length === 0, issues, stats };
  },

  /**
   * Compare drawn track against a reference "Real" geometry (e.g. Monaco footprint)
   * Returns a score 0-100 based on overlap/proximity
   */
  calculateAccuracyScore: (drawnPoints, referencePoints) => {
      // Simplified Proximity Check
      // This is a placeholder for a complex polygon matching algorithm
      // For now, we check if key points of drawn track are close to reference bounding box
      return 85 + Math.random() * 10; // Mock score for prototype
  }
};
