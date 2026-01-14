import numpy as np

class F1PhysicsEngine:
    """
    Physics engine for StarTrack F1.
    Calculates vehicle dynamics, lap times, tire wear, and ERS usage.
    """
    
    def __init__(self):
        # Base Vehicle Parameters
        self.mass = 798  # kg (Minimum weight)
        self.base_power = 740 * 0.7457  # kW (ICE - Internal Combustion implementation) ~740hp
        self.ers_power = 120  # kW (160hp MGU-K limit)
        self.drag_coeff = 1.0
        self.downforce_coeff = 3.5
        self.frontal_area = 1.6 # m2
        self.air_density = 1.225
        
        # State
        self.battery_mj = 4.0  # Max 4MJ/lap deploy
        self.max_battery_mj = 4.0
        self.fuel_kg = 100.0
        self.current_speed = 0.0 # m/s
        
        self.tire_grip = {
            "soft": 1.2,
            "medium": 1.1,
            "hard": 1.0
        }
        self.tire_wear_rate_per_km = {
            "soft": 0.05,  # 5% per km
            "medium": 0.03,
            "hard": 0.015
        }
        self.current_tire_life = 100.0

    def get_acceleration(self, speed_ms, deploying_ers=False):
        """
        Calculate longitudinal acceleration (m/s^2).
        F_net = F_tract - F_drag - F_roll
        """
        # Power limited acceleration
        power_kw = self.base_power
        if deploying_ers and self.battery_mj > 0.1:
            power_kw += self.ers_power
            
        # P = F * v  => F = P / v
        # Avoid division by zero
        v = max(speed_ms, 10.0) 
        f_tract = (power_kw * 1000) / v
        
        # Drag
        f_drag = 0.5 * self.air_density * self.drag_coeff * self.frontal_area * (speed_ms ** 2)
        
        # Rolling resistance (simplified)
        f_roll = self.mass * 9.81 * 0.015
        
        f_net = f_tract - f_drag - f_roll
        accel = f_net / self.mass
        return max(accel, 0) # Can't accelerate backwards simply

    def calculate_cornering_speed(self, radius, tire_compound, tire_life, grip_mod=1.0):
        """
        Max cornering speed constrained by lateral grip.
        mV^2/r = mu * (mg + Downforce)
        """
        base_mu = self.tire_grip.get(tire_compound, 1.0)
        # Tire life penalty
        wear_penalty = max(0.6, tire_life / 100.0) # Degradation factor
        mu = base_mu * wear_penalty * 1.6 * grip_mod # 1.6 lateral G mechanical base
        
        # Iterative solve for V because Downforce depends on V
        # V = sqrt( (mu * m * g) / (m/r - mu * 0.5 * rho * Cl * A) )
        m = self.mass
        g = 9.81
        rho = self.air_density
        Cl = self.downforce_coeff
        A = self.frontal_area
        
        numerator = mu * m * g
        denom_term = (m / radius) - (mu * 0.5 * rho * Cl * A)
        
        if denom_term <= 0:
            # Downforce allows theoretical infinite speed, cap at 340kph
            return 340 / 3.6
            
        v_squared = numerator / denom_term
        return np.sqrt(v_squared)

    def simulate_lap(self, circuit_segments, tire_compound="soft", weather="dry"):
        """
        Simulate a lap with given parameters.
        weather: "dry", "hot", "rain"
        """
        total_time = 0
        telemetry = []
        self.current_speed = 60.0 # Flying lap start speed (m/s)
        self.battery_mj = 4.0 # Fully charged start
        self.current_tire_life = 100.0
        
        # Weather modifiers
        grip_mod = 1.0
        if weather == "rain":
            grip_mod = 0.7
        elif weather == "hot":
            grip_mod = 0.95 
        
        for segment in circuit_segments:
            length = segment['length']
            radius = segment.get('radius', 0)
            
            # Physics Step
            if radius > 0:
                # Corner
                target_speed = self.calculate_cornering_speed(radius, tire_compound, self.current_tire_life, grip_mod)
                # If we are faster than target, we must BRAKE
                if self.current_speed > target_speed:
                    # Braking Zone - Harvest
                    ke_diff = 0.5 * self.mass * (self.current_speed**2 - target_speed**2)
                    if ke_diff > 0:
                        # MGU-K Harvest efficiency ~ 60%
                        recovered_j = ke_diff * 0.6
                        self.battery_mj = min(self.max_battery_mj, self.battery_mj + (recovered_j / 1e6))
                        
                    self.current_speed = target_speed
                
                # In corner, maintain speed (neutral throttle)
                dt = length / max(self.current_speed, 10.0)
                # Tire wear lateral
                self.current_tire_life -= (self.tire_wear_rate_per_km.get(tire_compound, 0.05) * (length/1000.0) * 1.5)
                
            else:
                # Straight - Accelerate!
                # Deploy ERS if battery good
                deploy = False
                if self.battery_mj > 0.2:
                    deploy = True
                
                # We iteratively integrate acceleration over the straight
                dt_step = 0.1 # 100ms steps
                current_pos = 0
                time_in_straight = 0
                
                while current_pos < length:
                    accel = self.get_acceleration(self.current_speed, deploy)
                    self.current_speed += accel * dt_step
                    
                    # Cap at ~350kph
                    if self.current_speed > 350/3.6:
                         self.current_speed = 350/3.6
                    
                    dist_step = self.current_speed * dt_step
                    current_pos += dist_step
                    time_in_straight += dt_step
                    
                    # Consume ERS
                    if deploy:
                        self.battery_mj -= (0.12 * dt_step) # 120kW * s = kJ => MJ
                        if self.battery_mj <= 0: 
                            self.battery_mj = 0
                            deploy = False
                            
                dt = time_in_straight
                # Tire wear longitudinal
                self.current_tire_life -= (self.tire_wear_rate_per_km.get(tire_compound, 0.05) * (length/1000.0))

            total_time += dt
            
            # Record Telemetry Point
            telemetry.append({
                "time": round(total_time, 3),
                "speed": round(self.current_speed * 3.6, 1),
                "battery": round(self.battery_mj, 2),
                "tire_life": round(self.current_tire_life, 1),
                "segment_type": "corner" if radius > 0 else "straight"
            })
            
        return round(total_time, 3), telemetry
