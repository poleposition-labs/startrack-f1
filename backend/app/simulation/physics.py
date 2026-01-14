import numpy as np

class F1PhysicsEngine:
    """
    Advanced Physics Engine for StarTrack F1.
    Simulates vehicle dynamics, lap times, tire wear, ERS, fuel, and pit stops.
    """
    
    # Track Templates
    TRACK_TEMPLATES = {
        "monaco": {
            "name": "Monaco GP",
            "length_km": 3.337,
            "segments": [
                {"id": "s1", "type": "straight", "length": 500, "radius": 0},
                {"id": "s2", "type": "corner", "length": 80, "radius": 40},
                {"id": "s3", "type": "straight", "length": 300, "radius": 0},
                {"id": "s4", "type": "corner", "length": 120, "radius": 25},
                {"id": "s5", "type": "straight", "length": 200, "radius": 0},
                {"id": "s6", "type": "corner", "length": 100, "radius": 60},
                {"id": "s7", "type": "straight", "length": 400, "radius": 0},
                {"id": "s8", "type": "corner", "length": 90, "radius": 35},
                {"id": "s9", "type": "straight", "length": 350, "radius": 0},
                {"id": "s10", "type": "corner", "length": 110, "radius": 50},
            ]
        },
        "silverstone": {
            "name": "Silverstone GP",
            "length_km": 5.891,
            "segments": [
                {"id": "s1", "type": "straight", "length": 800, "radius": 0},
                {"id": "s2", "type": "corner", "length": 200, "radius": 120},
                {"id": "s3", "type": "straight", "length": 600, "radius": 0},
                {"id": "s4", "type": "corner", "length": 150, "radius": 80},
                {"id": "s5", "type": "straight", "length": 500, "radius": 0},
                {"id": "s6", "type": "corner", "length": 180, "radius": 100},
                {"id": "s7", "type": "straight", "length": 700, "radius": 0},
                {"id": "s8", "type": "corner", "length": 160, "radius": 90},
            ]
        },
        "spa": {
            "name": "Spa-Francorchamps",
            "length_km": 7.004,
            "segments": [
                {"id": "s1", "type": "straight", "length": 1000, "radius": 0},
                {"id": "s2", "type": "corner", "length": 300, "radius": 150},
                {"id": "s3", "type": "straight", "length": 800, "radius": 0},
                {"id": "s4", "type": "corner", "length": 400, "radius": 200},
                {"id": "s5", "type": "straight", "length": 1200, "radius": 0},
                {"id": "s6", "type": "corner", "length": 250, "radius": 100},
            ]
        }
    }
    
    # Tire Compounds
    TIRE_DATA = {
        "soft": {"grip": 1.25, "wear_rate": 0.06, "optimal_temp": 100, "cliff_life": 30},
        "medium": {"grip": 1.15, "wear_rate": 0.035, "optimal_temp": 95, "cliff_life": 20},
        "hard": {"grip": 1.0, "wear_rate": 0.018, "optimal_temp": 90, "cliff_life": 15},
        "intermediate": {"grip": 0.9, "wear_rate": 0.025, "optimal_temp": 70, "cliff_life": 25},
        "wet": {"grip": 0.75, "wear_rate": 0.02, "optimal_temp": 60, "cliff_life": 30},
    }
    
    def __init__(self):
        # Base Vehicle Parameters
        self.mass = 798  # kg (Minimum weight)
        self.base_power = 740 * 0.7457  # kW (ICE)
        self.ers_power = 120  # kW (MGU-K limit)
        self.drag_coeff = 1.0
        self.downforce_coeff = 3.5
        self.frontal_area = 1.6
        self.air_density = 1.225
        
        # Fuel
        self.fuel_consumption_per_km = 2.0  # kg per km
        
        # Pit Stop
        self.pit_stop_time = 2.5  # seconds for tire change
        self.pit_lane_time = 18.0  # seconds pit lane transit
        
    def reset_state(self, fuel_kg=100.0, tire_compound="soft"):
        """Reset car state for new run."""
        self.battery_mj = 4.0
        self.max_battery_mj = 4.0
        self.fuel_kg = fuel_kg
        self.current_speed = 0.0
        self.tire_life = 100.0
        self.tire_compound = tire_compound
        self.tire_temp = 80.0  # Starting temp
        self.brake_temp = 300.0
        
    def get_tire_data(self, compound):
        return self.TIRE_DATA.get(compound, self.TIRE_DATA["medium"])

    def get_acceleration(self, speed_ms, deploying_ers=False):
        """Calculate longitudinal acceleration."""
        power_kw = self.base_power
        if deploying_ers and self.battery_mj > 0.1:
            power_kw += self.ers_power
            
        v = max(speed_ms, 10.0)
        f_tract = (power_kw * 1000) / v
        f_drag = 0.5 * self.air_density * self.drag_coeff * self.frontal_area * (speed_ms ** 2)
        f_roll = (self.mass + self.fuel_kg) * 9.81 * 0.015
        
        f_net = f_tract - f_drag - f_roll
        accel = f_net / (self.mass + self.fuel_kg)
        return max(accel, 0)

    def calculate_cornering_speed(self, radius, grip_mod=1.0):
        """Max cornering speed constrained by lateral grip."""
        tire_data = self.get_tire_data(self.tire_compound)
        base_mu = tire_data["grip"]
        
        # Tire life penalty
        wear_penalty = max(0.6, self.tire_life / 100.0)
        # Tire temperature effect
        temp_optimal = tire_data["optimal_temp"]
        temp_diff = abs(self.tire_temp - temp_optimal)
        temp_penalty = max(0.85, 1.0 - (temp_diff / 100.0) * 0.15)
        
        mu = base_mu * wear_penalty * temp_penalty * 1.6 * grip_mod
        
        m = self.mass + self.fuel_kg
        g = 9.81
        rho = self.air_density
        Cl = self.downforce_coeff
        A = self.frontal_area
        
        numerator = mu * m * g
        denom_term = (m / radius) - (mu * 0.5 * rho * Cl * A)
        
        if denom_term <= 0:
            return 340 / 3.6
            
        v_squared = numerator / denom_term
        return np.sqrt(v_squared)
    
    def calculate_g_force(self, speed_ms, radius=0, accel=0):
        """Calculate lateral and longitudinal G-forces."""
        g = 9.81
        lateral_g = (speed_ms ** 2) / (radius * g) if radius > 0 else 0
        longitudinal_g = accel / g
        return {"lateral": round(lateral_g, 2), "longitudinal": round(longitudinal_g, 2)}

    def simulate_lap(self, circuit_segments, tire_compound="soft", weather="dry", lap_number=1):
        """Simulate a single lap with given parameters."""
        total_time = 0
        telemetry = []
        
        # Weather modifiers
        grip_mod = {"dry": 1.0, "hot": 0.95, "rain": 0.7}.get(weather, 1.0)
        
        tire_data = self.get_tire_data(tire_compound)
        self.tire_compound = tire_compound
        
        sector_times = [0, 0, 0]
        current_sector = 0
        segment_count = len(circuit_segments)
        
        for idx, segment in enumerate(circuit_segments):
            length = segment.get('length', 100)
            radius = segment.get('radius', 0)
            
            # Determine sector (split into 3)
            current_sector = min(2, int((idx / segment_count) * 3))
            segment_time = 0
            
            if radius > 0:
                # Corner
                target_speed = self.calculate_cornering_speed(radius, grip_mod)
                
                if self.current_speed > target_speed:
                    # Braking
                    ke_diff = 0.5 * (self.mass + self.fuel_kg) * (self.current_speed**2 - target_speed**2)
                    if ke_diff > 0:
                        recovered_j = ke_diff * 0.6
                        self.battery_mj = min(self.max_battery_mj, self.battery_mj + (recovered_j / 1e6))
                        # Brake temperature increases
                        self.brake_temp = min(900, self.brake_temp + (ke_diff / 50000))
                        
                    self.current_speed = target_speed
                
                dt = length / max(self.current_speed, 10.0)
                segment_time = dt
                
                # Tire wear in corners (higher)
                wear = tire_data["wear_rate"] * (length / 1000.0) * 1.5
                self.tire_life = max(0, self.tire_life - wear)
                
                # Tire temp increases in corners
                self.tire_temp = min(120, self.tire_temp + (dt * 2))
                
                # Calculate G-force
                g_force = self.calculate_g_force(self.current_speed, radius)
                
            else:
                # Straight
                deploy = self.battery_mj > 0.2
                dt_step = 0.1
                current_pos = 0
                time_in_straight = 0
                
                while current_pos < length:
                    accel = self.get_acceleration(self.current_speed, deploy)
                    self.current_speed += accel * dt_step
                    
                    if self.current_speed > 350 / 3.6:
                        self.current_speed = 350 / 3.6
                    
                    current_pos += self.current_speed * dt_step
                    time_in_straight += dt_step
                    
                    if deploy:
                        self.battery_mj = max(0, self.battery_mj - (0.12 * dt_step))
                        if self.battery_mj <= 0:
                            deploy = False
                            
                segment_time = time_in_straight
                dt = time_in_straight
                
                # Tire wear on straights (lower)
                wear = tire_data["wear_rate"] * (length / 1000.0)
                self.tire_life = max(0, self.tire_life - wear)
                
                # Brake temp cools on straights
                self.brake_temp = max(300, self.brake_temp - (dt * 5))
                
                # Tire temp decreases slightly on straights
                self.tire_temp = max(70, self.tire_temp - (dt * 0.5))
                
                g_force = self.calculate_g_force(self.current_speed, 0, accel if 'accel' in dir() else 0)
            
            # Fuel consumption
            self.fuel_kg = max(0, self.fuel_kg - (self.fuel_consumption_per_km * (length / 1000.0)))
            
            total_time += segment_time
            sector_times[current_sector] += segment_time
            
            # Record telemetry
            telemetry.append({
                "time": round(total_time, 3),
                "dist": sum([s.get('length', 0) for s in circuit_segments[:idx+1]]),
                "speed": round(self.current_speed * 3.6, 1),
                "battery": round(self.battery_mj, 2),
                "tire_life": round(self.tire_life, 1),
                "tire_temp": round(self.tire_temp, 1),
                "brake_temp": round(self.brake_temp, 1),
                "fuel": round(self.fuel_kg, 2),
                "g_lateral": g_force["lateral"],
                "g_longitudinal": g_force["longitudinal"],
                "segment_type": "corner" if radius > 0 else "straight",
                "sector": current_sector + 1
            })
        
        return {
            "lap_time": round(total_time, 3),
            "sector_times": [round(s, 3) for s in sector_times],
            "telemetry": telemetry,
            "final_tire_life": round(self.tire_life, 1),
            "final_fuel": round(self.fuel_kg, 2),
            "final_battery": round(self.battery_mj, 2)
        }
    
    def simulate_race(self, circuit_segments, strategy, weather="dry"):
        """
        Simulate a full race with pit strategy.
        
        strategy = {
            "total_laps": 5,
            "pit_stops": [
                {"lap": 2, "tire": "hard"},
                {"lap": 4, "tire": "medium"}
            ],
            "starting_tire": "soft",
            "starting_fuel": 100
        }
        """
        total_laps = strategy.get("total_laps", 1)
        pit_stops = {p["lap"]: p["tire"] for p in strategy.get("pit_stops", [])}
        
        self.reset_state(
            fuel_kg=strategy.get("starting_fuel", 100),
            tire_compound=strategy.get("starting_tire", "soft")
        )
        self.current_speed = 60.0  # Rolling start
        
        race_results = []
        cumulative_time = 0
        
        for lap in range(1, total_laps + 1):
            # Check for pit stop
            pit_time = 0
            if lap in pit_stops:
                pit_time = self.pit_stop_time + self.pit_lane_time
                self.tire_life = 100.0
                self.tire_compound = pit_stops[lap]
                self.tire_temp = 80.0
            
            # Simulate lap
            lap_result = self.simulate_lap(
                circuit_segments,
                tire_compound=self.tire_compound,
                weather=weather,
                lap_number=lap
            )
            
            total_lap_time = lap_result["lap_time"] + pit_time
            cumulative_time += total_lap_time
            
            race_results.append({
                "lap_number": lap,
                "lap_time": total_lap_time,
                "pure_lap_time": lap_result["lap_time"],
                "pit_stop": pit_time > 0,
                "pit_time": pit_time,
                "cumulative_time": round(cumulative_time, 3),
                "tire_compound": self.tire_compound,
                "tire_life": lap_result["final_tire_life"],
                "fuel": lap_result["final_fuel"],
                "sector_times": lap_result["sector_times"],
                "telemetry": lap_result["telemetry"]
            })
        
        return race_results
    
    def calculate_optimal_line(self, circuit_segments):
        """
        Calculate apex points for optimal racing line.
        Returns list of apex suggestions.
        """
        apexes = []
        for idx, segment in enumerate(circuit_segments):
            if segment.get("radius", 0) > 0:
                radius = segment["radius"]
                # Apex point is at the tightest part of the corner
                apex_speed = self.calculate_cornering_speed(radius, 1.0)
                
                apexes.append({
                    "segment_id": segment.get("id", f"seg-{idx}"),
                    "segment_index": idx,
                    "recommended_speed": round(apex_speed * 3.6, 1),
                    "radius": radius,
                    "tip": "Late apex" if radius < 50 else "Standard apex"
                })
        
        return apexes
    
    def recommend_strategy(self, circuit_segments, total_laps, weather="dry"):
        """
        AI-based strategy recommendation.
        """
        # Simple heuristic-based recommendation
        avg_segment_length = np.mean([s.get("length", 100) for s in circuit_segments])
        corner_count = sum(1 for s in circuit_segments if s.get("radius", 0) > 0)
        
        if total_laps <= 3:
            return {
                "recommendation": "Single stint",
                "starting_tire": "soft",
                "pit_stops": [],
                "explanation": "Short race - maximize grip with softs, no pit required."
            }
        elif total_laps <= 10:
            return {
                "recommendation": "One-stop strategy",
                "starting_tire": "soft" if weather == "dry" else "intermediate",
                "pit_stops": [{"lap": total_laps // 2, "tire": "hard"}],
                "explanation": f"Start on softs for early pace, pit on lap {total_laps // 2} for hards."
            }
        else:
            return {
                "recommendation": "Two-stop strategy",
                "starting_tire": "soft",
                "pit_stops": [
                    {"lap": total_laps // 3, "tire": "hard"},
                    {"lap": (2 * total_laps) // 3, "tire": "medium"}
                ],
                "explanation": f"Aggressive three-stint strategy for optimal pace."
            }
    
    @classmethod
    def generate_track_layout(cls, track_id):
        """Generate 2D coordinates for track visualization."""
        if track_id not in cls.TRACK_TEMPLATES:
            return []
            
        segments = cls.TRACK_TEMPLATES[track_id]["segments"]
        points = []
        
        # Start at origin
        x, y = 100, 300
        angle = 0  # 0 is East
        points.append({"x": x, "y": y})
        
        scale = 0.5 # Scale down for visualization
        
        for segment in segments:
            length = segment["length"] * scale
            radius = segment["radius"] * scale
            
            if radius == 0:
                # Straight
                x += length * np.cos(angle)
                y += length * np.sin(angle)
                points.append({"x": x, "y": y})
            else:
                # Corner
                # Simplified approximation: arc made of small straight segments
                arc_length = length
                turn_angle = arc_length / radius # radians
                
                # Determine direction (alternate left/right for interest or hardcoded)
                # For templates, we'll use a pseudo-random but deterministic direction based on ID
                # or just alternate for simple closed loops
                turn_direction = 1 if int(segment["id"][1:]) % 2 == 0 else -1
                
                if track_id == "monaco":
                    # Hardcoded directions for Monaco-ish shape
                    idx = int(segment["id"][1:]) 
                    turn_direction = 1 if idx in [2, 6, 10] else -1
                
                steps = 10
                step_angle = (turn_angle * turn_direction) / steps
                step_len = arc_length / steps
                
                for _ in range(steps):
                    angle += step_angle
                    x += step_len * np.cos(angle)
                    y += step_len * np.sin(angle)
                    points.append({"x": x, "y": y})
                    
        # Normalize coordinates to fit in 800x600 canvas
        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        width = max_x - min_x
        height = max_y - min_y
        
        scale_x = 700 / width if width > 0 else 1
        scale_y = 500 / height if height > 0 else 1
        final_scale = min(scale_x, scale_y) * 0.8
        
        offset_x = 400 - (min_x + width/2) * final_scale
        offset_y = 300 - (min_y + height/2) * final_scale
        
        return [{"x": p["x"] * final_scale + offset_x, "y": p["y"] * final_scale + offset_y} for p in points]

    @classmethod
    def get_track_templates(cls):
        """Return available track templates."""
        templates = {}
        for k, v in cls.TRACK_TEMPLATES.items():
            templates[k] = {
                "name": v["name"],
                "length_km": v["length_km"],
                "preview_points": cls.generate_track_layout(k)
            }
        return templates
    
    @classmethod
    def get_track_segments(cls, track_id):
        """Return segments for a specific track template."""
        if track_id in cls.TRACK_TEMPLATES:
            return cls.TRACK_TEMPLATES[track_id]["segments"]
        return []
