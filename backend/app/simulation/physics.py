import numpy as np

class F1PhysicsEngine:
    """
    Physics engine for StarTrack F1.
    Calculates vehicle dynamics, lap times, and tire wear using
    simplified F1-style physics models.
    """
    
    def __init__(self):
        # Base Vehicle Parameters (Generic F1-style car)
        self.mass = 798  # kg
        self.power = 1000 * 0.7457  # kW (approx 1000hp)
        self.drag_coeff = 0.9
        self.downforce_coeff = 3.5
        self.tire_grip = {
            "soft": 1.0,
            "medium": 0.98,
            "hard": 0.96
        }
        self.tire_wear_rate = {
            "soft": 0.15,  # per lap
            "medium": 0.08,
            "hard": 0.04
        }

    def calculate_cornering_speed(self, radius, tire_compound="soft", tire_life=100):
        """
        Estimate max cornering speed for a given radius.
        Uses a friction circle model with downforce.
        v^2 = (mu * g * m + 0.5 * rho * Cl * A * v^2) * r / m
        Simplified: v = sqrt( (mu*g*r) / (1 - (0.5*rho*Cl*A*r)/m ) ) ... roughly
        """
        # Simplified grip factor based on compound and wear
        wear_factor = max(0.4, tire_life / 100.0)
        grip_mu = 1.8 * self.tire_grip.get(tire_compound, 0.98) * wear_factor
        
        # Aerodynamic assistance (approximated)
        # As speed increases, downforce increases grip.
        # We solve iteratively or use a lookup. For simplicity here:
        # A purely mechanical grip corner speed:
        # v_mech = sqrt(grip_mu * 9.81 * radius)
        # Aero multiplier:
        aero_factor = 1.0 + (radius / 100.0) * 0.5 # larger radius = faster = more aero
        
        speed_ms = np.sqrt(grip_mu * 9.81 * radius) * aero_factor
        return min(speed_ms, 350/3.6) # Cap at top speed

    def simulate_sector(self, length, curve_radius=0, tire_compound="soft"):
        """
        Simulate time to complete a sector (straight or corner).
        length: meters
        curve_radius: meters (0 for straight)
        """
        if curve_radius > 0:
            # Corner
            avg_speed = self.calculate_cornering_speed(curve_radius, tire_compound)
            time = length / avg_speed
            return time, avg_speed
        else:
            # Straight
            # Assume acceleration phase from 100kmh to 300kmh avg
            avg_speed = 280 / 3.6 
            time = length / avg_speed
            return time, avg_speed

    def simulate_lap(self, circuit_segments, tire_compound="soft"):
        total_time = 0
        telemetry = []
        
        for segment in circuit_segments:
            t, v = self.simulate_sector(segment['length'], segment.get('radius', 0), tire_compound)
            total_time += t
            telemetry.append({"time": total_time, "speed": v * 3.6}) # km/h
            
        return total_time, telemetry
