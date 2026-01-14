import numpy as np

class F1PhysicsEngine:
    """
    Advanced Physics Engine for StarTrack F1.
    Simulates vehicle dynamics, lap times, tire wear, ERS, fuel, and pit stops.
    """
    
    # Track Templates with Realistic Segments
    # dir: 1 = Right, -1 = Left (for corners)
    TRACK_TEMPLATES = {
        "monaco": {
            "name": "Monaco GP",
            "length_km": 3.337,
            "segments": [
                {"id": "main_straight", "type": "straight", "length": 250, "radius": 0},
                {"id": "sainte_devote", "type": "corner", "length": 50, "radius": 30, "dir": 1},
                {"id": "beau_rivage", "type": "straight", "length": 350, "radius": 0},
                {"id": "massenet", "type": "corner", "length": 120, "radius": 80, "dir": -1},
                {"id": "casino", "type": "corner", "length": 80, "radius": 60, "dir": 1},
                {"id": "mirabeau_haute", "type": "corner", "length": 40, "radius": 20, "dir": 1},
                {"id": "hairpin", "type": "corner", "length": 50, "radius": 15, "dir": -1}, # Grand Hotel
                {"id": "mirabeau_bas", "type": "corner", "length": 60, "radius": 25, "dir": 1},
                {"id": "portier", "type": "corner", "length": 50, "radius": 30, "dir": 1},
                {"id": "tunnel", "type": "straight", "length": 450, "radius": 0},
                {"id": "nouvelle_chicane_1", "type": "corner", "length": 20, "radius": 20, "dir": -1},
                {"id": "nouvelle_chicane_2", "type": "corner", "length": 20, "radius": 20, "dir": 1},
                {"id": "tabac", "type": "corner", "length": 80, "radius": 70, "dir": -1},
                {"id": "pool_1", "type": "corner", "length": 60, "radius": 90, "dir": -1},
                {"id": "pool_2", "type": "corner", "length": 60, "radius": 90, "dir": 1},
                {"id": "rascasse", "type": "corner", "length": 40, "radius": 18, "dir": 1},
                {"id": "antony_noghes", "type": "corner", "length": 40, "radius": 25, "dir": 1},
                {"id": "finish_straight", "type": "straight", "length": 150, "radius": 0}
            ]
        },
        "silverstone": {
            "name": "Silverstone GP",
            "length_km": 5.891,
            "segments": [
                {"id": "hamilton_straight", "type": "straight", "length": 400, "radius": 0},
                {"id": "abbey", "type": "corner", "length": 100, "radius": 180, "dir": 1},
                {"id": "farm", "type": "corner", "length": 80, "radius": 150, "dir": -1},
                {"id": "village", "type": "corner", "length": 60, "radius": 40, "dir": 1},
                {"id": "the_loop", "type": "corner", "length": 70, "radius": 35, "dir": -1},
                {"id": "aintree", "type": "corner", "length": 90, "radius": 100, "dir": -1},
                {"id": "wellington_straight", "type": "straight", "length": 700, "radius": 0},
                {"id": "brooklands", "type": "corner", "length": 100, "radius": 60, "dir": -1},
                {"id": "luffield", "type": "corner", "length": 150, "radius": 50, "dir": 1},
                {"id": "woodcote", "type": "corner", "length": 100, "radius": 120, "dir": 1},
                {"id": "national_straight", "type": "straight", "length": 300, "radius": 0},
                {"id": "copse", "type": "corner", "length": 120, "radius": 150, "dir": 1},
                {"id": "maggots", "type": "corner", "length": 80, "radius": 140, "dir": -1},
                {"id": "becketts", "type": "corner", "length": 80, "radius": 110, "dir": 1},
                {"id": "chapel", "type": "corner", "length": 70, "radius": 130, "dir": -1},
                {"id": "hangar_straight", "type": "straight", "length": 750, "radius": 0},
                {"id": "stowe", "type": "corner", "length": 110, "radius": 90, "dir": 1},
                {"id": "vale", "type": "straight", "length": 150, "radius": 0},
                {"id": "club", "type": "corner", "length": 120, "radius": 60, "dir": 1}
            ]
        },
        "spa": {
            "name": "Spa-Francorchamps",
            "length_km": 7.004,
            "segments": [
                {"id": "la_source", "type": "corner", "length": 60, "radius": 25, "dir": 1},
                {"id": "eau_rouge_appr", "type": "straight", "length": 400, "radius": 0},
                {"id": "eau_rouge", "type": "corner", "length": 100, "radius": 150, "dir": -1},
                {"id": "raidillon", "type": "corner", "length": 100, "radius": 140, "dir": 1},
                {"id": "kemmel_straight", "type": "straight", "length": 1200, "radius": 0},
                {"id": "les_combes_1", "type": "corner", "length": 60, "radius": 50, "dir": 1},
                {"id": "les_combes_2", "type": "corner", "length": 60, "radius": 50, "dir": -1},
                {"id": "bruxelles", "type": "corner", "length": 150, "radius": 60, "dir": 1},
                {"id": "no_name", "type": "corner", "length": 80, "radius": 70, "dir": -1},
                {"id": "pouhon", "type": "corner", "length": 250, "radius": 140, "dir": -1},
                {"id": "campus_st", "type": "straight", "length": 200, "radius": 0},
                {"id": "fagnes", "type": "corner", "length": 100, "radius": 80, "dir": 1},
                {"id": "campus", "type": "corner", "length": 80, "radius": 75, "dir": 1},
                {"id": "stavelot", "type": "corner", "length": 120, "radius": 100, "dir": 1},
                {"id": "blanchimont_1", "type": "straight", "length": 500, "radius": 0},
                {"id": "blanchimont_2", "type": "corner", "length": 200, "radius": 300, "dir": -1},
                {"id": "bus_stop_1", "type": "corner", "length": 40, "radius": 30, "dir": 1},
                {"id": "bus_stop_2", "type": "corner", "length": 40, "radius": 30, "dir": -1},
                {"id": "start_finish", "type": "straight", "length": 300, "radius": 0}
            ]
        },
        "bahrain": {
            "name": "Bahrain GP",
            "length_km": 5.412,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "australia": {
            "name": "Australian GP",
            "length_km": 5.278,
            "segments": [{"id": "main", "type": "straight", "length": 300, "radius": 0}]
        },
        "japan": {
            "name": "Japanese GP (Suzuka)",
            "length_km": 5.807,
            "segments": [{"id": "main", "type": "straight", "length": 400, "radius": 0}]
        },
        "china": {
            "name": "Chinese GP",
            "length_km": 5.451,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "miami": {
            "name": "Miami GP",
            "length_km": 5.412,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "imola": {
            "name": "Emilia Romagna GP (Imola)",
            "length_km": 4.909,
        },
        "saudi_arabia": {
            "name": "Saudi Arabian GP (Jeddah)",
            "length_km": 6.174,
            "segments": [{"id": "main", "type": "straight", "length": 400, "radius": 0}]
        },
        "azerbaijan": {
            "name": "Azerbaijan GP (Baku)",
            "length_km": 6.003,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "spain": {
            "name": "Spanish GP (Barcelona)",
            "length_km": 4.675,
            "segments": [{"id": "main", "type": "straight", "length": 300, "radius": 0}]
        },
        "canada": {
            "name": "Canadian GP (Montreal)",
            "length_km": 4.361,
            "segments": [{"id": "main", "type": "straight", "length": 275, "radius": 0}]
        },
        "austria": {
            "name": "Austrian GP (Red Bull Ring)",
            "length_km": 4.318,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "hungary": {
            "name": "Hungarian GP (Hungaroring)",
            "length_km": 4.381,
            "segments": [{"id": "main", "type": "straight", "length": 250, "radius": 0}]
        },
        "netherlands": {
            "name": "Dutch GP (Zandvoort)",
            "length_km": 4.259,
            "segments": [{"id": "main", "type": "straight", "length": 280, "radius": 0}]
        },
        "italy": {
            "name": "Italian GP (Monza)",
            "length_km": 5.793,
            "segments": [{"id": "main", "type": "straight", "length": 400, "radius": 0}]
        },
        "singapore": {
            "name": "Singapore GP (Marina Bay)",
            "length_km": 4.940,
            "segments": [{"id": "main", "type": "straight", "length": 300, "radius": 0}]
        },
        "usa": {
            "name": "United States GP (COTA)",
            "length_km": 5.513,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "mexico": {
            "name": "Mexico City GP",
            "length_km": 4.304,
            "segments": [{"id": "main", "type": "straight", "length": 300, "radius": 0}]
        },
        "brazil": {
            "name": "Brazilian GP (Interlagos)",
            "length_km": 4.309,
            "segments": [{"id": "main", "type": "straight", "length": 280, "radius": 0}]
        },
        "las_vegas": {
            "name": "Las Vegas GP",
            "length_km": 6.120,
            "segments": [{"id": "main", "type": "straight", "length": 400, "radius": 0}]
        },
        "qatar": {
            "name": "Qatar GP (Losail)",
            "length_km": 5.380,
            "segments": [{"id": "main", "type": "straight", "length": 350, "radius": 0}]
        },
        "abu_dhabi": {
            "name": "Abu Dhabi GP (Yas Marina)",
            "length_km": 5.281,
            "segments": [{"id": "main", "type": "straight", "length": 325, "radius": 0}]
        }
    }

    # Static coordinates for accurate visualization with Lat/Lon
    TRACK_COORDINATES = {
        "monaco": [
           {"lat": 43.7347, "lng": 7.4206}, # Start/Finish
           {"lat": 43.7355, "lng": 7.4210}, 
           {"lat": 43.7375, "lng": 7.4215}, # Ste Devote
           {"lat": 43.7385, "lng": 7.4230}, # Beau Rivage
           {"lat": 43.7395, "lng": 7.4275}, # Massenet/Casino
           {"lat": 43.7400, "lng": 7.4290}, # Mirabeau
           {"lat": 43.7405, "lng": 7.4300}, # Hairpin
           {"lat": 43.7400, "lng": 7.4305},
           {"lat": 43.7390, "lng": 7.4310}, # Portier
           {"lat": 43.7370, "lng": 7.4330}, # Tunnel
           {"lat": 43.7350, "lng": 7.4290}, # Chicane
           {"lat": 43.7345, "lng": 7.4270}, # Tabac
           {"lat": 43.7335, "lng": 7.4250}, # Pool
           {"lat": 43.7340, "lng": 7.4220}, # Rascasse
           {"lat": 43.7347, "lng": 7.4206}  # Finish
        ],
        "bahrain": [
           {"lat": 26.0325, "lng": 50.5106}, # Start/Finish
           {"lat": 26.0315, "lng": 50.5120}, # Turn 1
           {"lat": 26.0305, "lng": 50.5130}, # Turn 2
           {"lat": 26.0295, "lng": 50.5140}, # Turn 3
           {"lat": 26.0285, "lng": 50.5145}, # Turn 4
           {"lat": 26.0270, "lng": 50.5140}, # Turns 5-6
           {"lat": 26.0260, "lng": 50.5135},
           {"lat": 26.0250, "lng": 50.5140}, # Turn 8
           {"lat": 26.0240, "lng": 50.5150}, # Turn 9-10
           {"lat": 26.0245, "lng": 50.5165}, # Turn 11
           {"lat": 26.0260, "lng": 50.5175}, # Turn 13
           {"lat": 26.0280, "lng": 50.5165}, # Turn 14
           {"lat": 26.0305, "lng": 50.5140}, # Turn 15
           {"lat": 26.0325, "lng": 50.5106}  # Finish
        ],
        "australia": [
           {"lat": -37.8497, "lng": 144.9680}, # Start/Finish
           {"lat": -37.8505, "lng": 144.9685}, # Turn 1
           {"lat": -37.8510, "lng": 144.9690}, # Turn 2
           {"lat": -37.8515, "lng": 144.9695}, # Turn 3
           {"lat": -37.8520, "lng": 144.9710}, # Turn 4-5-6
           {"lat": -37.8525, "lng": 144.9720},
           {"lat": -37.8530, "lng": 144.9715}, # Turn 9-10
           {"lat": -37.8525, "lng": 144.9705}, # Turn 11-12
           {"lat": -37.8515, "lng": 144.9690}, # Turn 13
           {"lat": -37.8505, "lng": 144.9675}, # Turn 14-15
           {"lat": -37.8497, "lng": 144.9680}  # Finish
        ],
        "japan": [
           {"lat": 34.8431, "lng": 136.5407}, # Start/Finish (Suzuka)
           {"lat": 34.8425, "lng": 136.5415}, # Turn 1
           {"lat": 34.8420, "lng": 136.5425}, # Turn 2 (S-Curves)
           {"lat": 34.8415, "lng": 136.5435},
           {"lat": 34.8410, "lng": 136.5445}, # Dunlop Curve
           {"lat": 34.8405, "lng": 136.5455}, # Degner
           {"lat": 34.8400, "lng": 136.5465}, # Hairpin
           {"lat": 34.8405, "lng": 136.5475}, # Spoon Curve
           {"lat": 34.8415, "lng": 136.5470},
           {"lat": 34.8425, "lng": 136.5460}, # 130R
           {"lat": 34.8430, "lng": 136.5440}, # Casio Triangle
           {"lat": 34.8431, "lng": 136.5407}  # Finish
        ],
        "china": [
           {"lat": 31.3389, "lng": 121.2200}, # Start/Finish (Shanghai)
           {"lat": 31.3395, "lng": 121.2210}, # Turn 1
           {"lat": 31.3400, "lng": 121.2220}, # Turn 2-3
           {"lat": 31.3405, "lng": 121.2230},
           {"lat": 31.3410, "lng": 121.2240}, # Turns 6-7
           {"lat": 31.3405, "lng": 121.2250}, # Turn 8
           {"lat": 31.3395, "lng": 121.2255}, # Turn 11
           {"lat": 31.3385, "lng": 121.2245}, # Turn 13
           {"lat": 31.3380, "lng": 121.2230}, # Turn 14
           {"lat": 31.3385, "lng": 121.2215}, # Turn 16
           {"lat": 31.3389, "lng": 121.2200}  # Finish
        ],
        "miami": [
           {"lat": 25.9581, "lng": -80.2389}, # Start/Finish
           {"lat": 25.9585, "lng": -80.2395}, # Turn 1
           {"lat": 25.9590, "lng": -80.2400}, # Turns 2-3
           {"lat": 25.9595, "lng": -80.2405},
           {"lat": 25.9600, "lng": -80.2395}, # Turn 11 (DRS 1)
           {"lat": 25.9595, "lng": -80.2385}, # Turn 13-14
           {"lat": 25.9590, "lng": -80.2380}, # Turn 16
           {"lat": 25.9585, "lng": -80.2385}, # Turn 17
           {"lat": 25.9581, "lng": -80.2389}  # Finish
        ],
        "imola": [
           {"lat": 44.3439, "lng": 11.7167}, # Start/Finish
           {"lat": 44.3445, "lng": 11.7175}, # Tamburello
           {"lat": 44.3450, "lng": 11.7185}, # Villeneuve
           {"lat": 44.3455, "lng": 11.7195}, # Tosa
           {"lat": 44.3460, "lng": 11.7205}, # Piratella
           {"lat": 44.3465, "lng": 11.7215}, # Acque Minerali
           {"lat": 44.3460, "lng": 11.7225}, # Variante Alta
           {"lat": 44.3450, "lng": 11.7220}, # Rivazza
           {"lat": 44.3445, "lng": 11.7200},
           {"lat": 44.3439, "lng": 11.7167}  # Finish
        ],
        "spa": [
           {"lat": 50.4372, "lng": 5.9714}, # Start/Finish
           {"lat": 50.4365, "lng": 5.9725}, # La Source
           {"lat": 50.4355, "lng": 5.9745}, # Eau Rouge
           {"lat": 50.4350, "lng": 5.9765}, # Raidillon
           {"lat": 50.4345, "lng": 5.9800}, # Kemmel Straight
           {"lat": 50.4340, "lng": 5.9830}, # Les Combes
           {"lat": 50.4335, "lng": 5.9850}, # Malmedy
           {"lat": 50.4325, "lng": 5.9860}, # Pouhon
           {"lat": 50.4315, "lng": 5.9855}, # Fagnes
           {"lat": 50.4310, "lng": 5.9840}, # Stavelot
           {"lat": 50.4320, "lng": 5.9815}, # Blanchimont
           {"lat": 50.4335, "lng": 5.9785}, # Bus Stop
           {"lat": 50.4350, "lng": 5.9750},
           {"lat": 50.4372, "lng": 5.9714}  # Finish
        ],
        "silverstone": [
           {"lat": 52.0786, "lng": -1.0169}, # Start/Finish
           {"lat": 52.0780, "lng": -1.0180}, # Abbey
           {"lat": 52.0775, "lng": -1.0190}, # Farm
           {"lat": 52.0770, "lng": -1.0195}, # Village
           {"lat": 52.0765, "lng": -1.0200}, # The Loop
           {"lat": 52.0760, "lng": -1.0205}, # Aintree
           {"lat": 52.0755, "lng": -1.0210}, # Brooklands
           {"lat": 52.0753, "lng": -1.0215}, # Luffield
           {"lat": 52.0755, "lng": -1.0205}, # Woodcote
           {"lat": 52.0760, "lng": -1.0195}, # Copse
           {"lat": 52.0770, "lng": -1.0185}, # Maggots-Becketts-Chapel
           {"lat": 52.0780, "lng": -1.0175},
           {"lat": 52.0785, "lng": -1.0170}, # Stowe
           {"lat": 52.0786, "lng": -1.0169}  # Finish
        ],
        "saudi_arabia": [
           {"lat": 21.6319, "lng": 39.1044}, # Start/Finish (Jeddah)
           {"lat": 21.6325, "lng": 39.1050}, # Turn 1
           {"lat": 21.6330, "lng": 39.1055}, # Turn 2-3
           {"lat": 21.6340, "lng": 39.1065}, # Turn 4
           {"lat": 21.6350, "lng": 39.1075}, # Turn 10
           {"lat": 21.6355, "lng": 39.1085}, # Turn 13
           {"lat": 21.6350, "lng": 39.1095}, # Turn 22
           {"lat": 21.6340, "lng": 39.1085}, # Turn 24
           {"lat": 21.6330, "lng": 39.1070}, # Turn 26
           {"lat": 21.6319, "lng": 39.1044}  # Finish
        ],
        "azerbaijan": [
           {"lat": 40.3725, "lng": 49.8533}, # Start/Finish (Baku)
           {"lat": 40.3730, "lng": 49.8540}, # Turn 1
           {"lat": 40.3735, "lng": 49.8545}, # Turn 2
           {"lat": 40.3740, "lng": 49.8550}, # Turn 3
           {"lat": 40.3750, "lng": 49.8560}, # Turn 7
           {"lat": 40.3755, "lng": 49.8570}, # Turn 12
           {"lat": 40.3750, "lng": 49.8580}, # Turn 15
           {"lat": 40.3740, "lng": 49.8575}, # Turn 16 (Castle)
           {"lat": 40.3730, "lng": 49.8560}, # Turn 18
           {"lat": 40.3725, "lng": 49.8545}, # Turn 20
           {"lat": 40.3725, "lng": 49.8533}  # Finish
        ],
        "spain": [
           {"lat": 41.5700, "lng": 2.2611}, # Start/Finish (Barcelona)
           {"lat": 41.5705, "lng": 2.2620}, # Turn 1 (Elf)
           {"lat": 41.5710, "lng": 2.2630}, # Turn 3 (Renault)
           {"lat": 41.5715, "lng": 2.2640}, # Turn 5
           {"lat": 41.5720, "lng": 2.2650}, # Turn 7
           {"lat": 41.5725, "lng": 2.2655}, # Turn 9 (Campsa)
           {"lat": 41.5720, "lng": 2.2645}, # Turn 10 (La Caixa)
           {"lat": 41.5710, "lng": 2.2635}, # Turn 12
           {"lat": 41.5705, "lng": 2.2625}, # Turn 14
           {"lat": 41.5700, "lng": 2.2611}  # Finish
        ],
        "canada": [
           {"lat": 45.5050, "lng": -73.5267}, # Start/Finish (Montreal)
           {"lat": 45.5055, "lng": -73.5275}, # Turn 1 (Senna)
           {"lat": 45.5060, "lng": -73.5285}, # Turn 2
           {"lat": 45.5065, "lng": -73.5295}, # Turn 3-4
           {"lat": 45.5070, "lng": -73.5305}, # Turn 6
           {"lat": 45.5075, "lng": -73.5310}, # Turn 8 (Hairpin)
           {"lat": 45.5070, "lng": -73.5300}, # Turn 10
           {"lat": 45.5060, "lng": -73.5285}, # Turn 13 (Wall of Champions)
           {"lat": 45.5055, "lng": -73.5275}, # Turn 14
           {"lat": 45.5050, "lng": -73.5267}  # Finish
        ],
        "austria": [
           {"lat": 47.2197, "lng": 14.7647}, # Start/Finish (Red Bull Ring)
           {"lat": 47.2200, "lng": 14.7655}, # Turn 1
           {"lat": 47.2205, "lng": 14.7665}, # Turn 2
           {"lat": 47.2210, "lng": 14.7670}, # Turn 3
           {"lat": 47.2215, "lng": 14.7665}, # Turn 4
           {"lat": 47.2210, "lng": 14.7655}, # Turn 6
           {"lat": 47.2205, "lng": 14.7650}, # Turn 8
           {"lat": 47.2200, "lng": 14.7645}, # Turn 9
           {"lat": 47.2197, "lng": 14.7647}  # Finish
        ],
        "hungary": [
           {"lat": 47.5789, "lng": 19.2486}, # Start/Finish (Hungaroring)
           {"lat": 47.5795, "lng": 19.2495}, # Turn 1
           {"lat": 47.5800, "lng": 19.2505}, # Turn 2
           {"lat": 47.5805, "lng": 19.2515}, # Turn 4
           {"lat": 47.5810, "lng": 19.2520}, # Turn 6
           {"lat": 47.5815, "lng": 19.2515}, # Turn 8
           {"lat": 47.5810, "lng": 19.2505}, # Turn 11
           {"lat": 47.5800, "lng": 19.2495}, # Turn 13
           {"lat": 47.5795, "lng": 19.2490}, # Turn 14
           {"lat": 47.5789, "lng": 19.2486}  # Finish
        ],
        "netherlands": [
           {"lat": 52.3888, "lng": 4.5409}, # Start/Finish (Zandvoort)
           {"lat": 52.3893, "lng": 4.5415}, # Turn 1 (Tarzan)
           {"lat": 52.3898, "lng": 4.5425}, # Turn 3 (Hugenholtz)
           {"lat": 52.3905, "lng": 4.5435}, # Turn 7
           {"lat": 52.3910, "lng": 4.5445}, # Turn 9
           {"lat": 52.3905, "lng": 4.5455}, # Turn 11 (Banked)
           {"lat": 52.3900, "lng": 4.5445}, # Turn 13
           {"lat": 52.3893, "lng": 4.5425}, # Turn 14
           {"lat": 52.3888, "lng": 4.5409}  # Finish
        ],
        "italy": [
           {"lat": 45.6206, "lng": 9.2811}, # Start/Finish (Monza)
           {"lat": 45.6210, "lng": 9.2820}, # Turn 1 (Rettifilo)
           {"lat": 45.6215, "lng": 9.2830}, # Turn 3
           {"lat": 45.6220, "lng": 9.2840}, # Lesmo 1
           {"lat": 45.6225, "lng": 9.2850}, # Lesmo 2
           {"lat": 45.6230, "lng": 9.2860}, # Ascari
           {"lat": 45.6235, "lng": 9.2855}, # Parabolica
           {"lat": 45.6225, "lng": 9.2835},
           {"lat": 45.6215, "lng": 9.2820},
           {"lat": 45.6206, "lng": 9.2811}  # Finish
        ],
        "singapore": [
           {"lat": 1.2914, "lng": 103.8644}, # Start/Finish (Marina Bay)
           {"lat": 1.2920, "lng": 103.8650}, # Turn 1
           {"lat": 1.2925, "lng": 103.8655}, # Turn 3
           {"lat": 1.2930, "lng": 103.8665}, # Turn 5
           {"lat": 1.2935, "lng": 103.8675}, # Turn 7
           {"lat": 1.2940, "lng": 103.8680}, # Turn 10
           {"lat": 1.2935, "lng": 103.8670}, # Turn 13
           {"lat": 1.2925, "lng": 103.8660}, # Turn 16
           {"lat": 1.2920, "lng": 103.8650}, # Turn 19
           {"lat": 1.2914, "lng": 103.8644}  # Finish
        ],
        "usa": [
           {"lat": 30.1328, "lng": -97.6411}, # Start/Finish (COTA)
           {"lat": 30.1335, "lng": -97.6420}, # Turn 1
           {"lat": 30.1345, "lng": -97.6430}, # Turn 3-6 (Esses)
           {"lat": 30.1355, "lng": -97.6440},
           {"lat": 30.1360, "lng": -97.6450}, # Turn 11 (Hairpin)
           {"lat": 30.1355, "lng": -97.6455}, # Turn 12
           {"lat": 30.1345, "lng": -97.6445}, # Turn 15
           {"lat": 30.1335, "lng": -97.6430}, # Turn 18
           {"lat": 30.1328, "lng": -97.6420}, # Turn 20
           {"lat": 30.1328, "lng": -97.6411}  # Finish
        ],
        "mexico": [
           {"lat": 19.4042, "lng": -99.0907}, # Start/Finish (Mexico City)
           {"lat": 19.4048, "lng": -99.0915}, # Turn 1
           {"lat": 19.4055, "lng": -99.0925}, # Turn 3
           {"lat": 19.4060, "lng": -99.0935}, # Turn 4 (Esses)
           {"lat": 19.4065, "lng": -99.0945}, # Turn 8
           {"lat": 19.4070, "lng": -99.0950}, # Turn 11
           {"lat": 19.4065, "lng": -99.0940}, # Turn 12 (Peraltada)
           {"lat": 19.4055, "lng": -99.0925}, # Turn 15
           {"lat": 19.4048, "lng": -99.0915}, # Turn 17
           {"lat": 19.4042, "lng": -99.0907}  # Finish
        ],
        "brazil": [
           {"lat": -23.7036, "lng": -46.6997}, # Start/Finish (Interlagos)
           {"lat": -23.7040, "lng": -46.7005}, # Turn 1 (Senna S)
           {"lat": -23.7045, "lng": -46.7015}, # Turn 2
           {"lat": -23.7050, "lng": -46.7020}, # Turn 4 (Descida do Lago)
           {"lat": -23.7055, "lng": -46.7025}, # Turn 6
           {"lat": -23.7060, "lng": -46.7020}, # Turn 8 (Laranjinha)
           {"lat": -23.7055, "lng": -46.7010}, # Turn 10
           {"lat": -23.7045, "lng": -46.7000}, # Turn 12 (Juncao)
           {"lat": -23.7040, "lng": -46.6995}, # Turn 14
           {"lat": -23.7036, "lng": -46.6997}  # Finish
        ],
        "las_vegas": [
           {"lat": 36.1162, "lng": -115.1745}, # Start/Finish (Las Vegas Strip)
           {"lat": 36.1168, "lng": -115.1750}, # Turn 1
           {"lat": 36.1175, "lng": -115.1760}, # Turn 3
           {"lat": 36.1180, "lng": -115.1770}, # Turn 5
           {"lat": 36.1185, "lng": -115.1780}, # Turn 7
           {"lat": 36.1190, "lng": -115.1785}, # Turn 9
           {"lat": 36.1185, "lng": -115.1775}, # Turn 12
           {"lat": 36.1175, "lng": -115.1765}, # Turn 14
           {"lat": 36.1168, "lng": -115.1755}, # Turn 16
           {"lat": 36.1162, "lng": -115.1745}  # Finish
        ],
        "qatar": [
           {"lat": 25.4900, "lng": 51.4542}, # Start/Finish (Losail)
           {"lat": 25.4905, "lng": 51.4550}, # Turn 1
           {"lat": 25.4910, "lng": 51.4560}, # Turn 2
           {"lat": 25.4915, "lng": 51.4570}, # Turn 4
           {"lat": 25.4920, "lng": 51.4580}, # Turn 6
           {"lat": 25.4925, "lng": 51.4585}, # Turn 10
           {"lat": 25.4920, "lng": 51.4575}, # Turn 12
           {"lat": 25.4910, "lng": 51.4560}, # Turn 14
           {"lat": 25.4905, "lng": 51.4550}, # Turn 15
           {"lat": 25.4900, "lng": 51.4542}  # Finish
        ],
        "abu_dhabi": [
           {"lat": 24.4672, "lng": 54.6031}, # Start/Finish (Yas Marina)
           {"lat": 24.4678, "lng": 54.6040}, # Turn 1
           {"lat": 24.4685, "lng": 54.6050}, # Turn 3
           {"lat": 24.4690, "lng": 54.6060}, # Turn 5-6
           {"lat": 24.4695, "lng": 54.6070}, # Turn 8
           {"lat": 24.4700, "lng": 54.6075}, # Turn 11
           {"lat": 24.4695, "lng": 54.6065}, # Turn 13
           {"lat": 24.4685, "lng": 54.6050}, # Turn 17
           {"lat": 24.4678, "lng": 54.6040}, # Turn 19
           {"lat": 24.4672, "lng": 54.6031}  # Finish
        ]
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
        """
        apexes = []
        for idx, segment in enumerate(circuit_segments):
            if segment.get("radius", 0) > 0:
                radius = segment["radius"]
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
        """
        Generate 2D coordinates for track visualization.
        Now uses manually curated high-quality static data for templates.
        """
        if track_id in cls.TRACK_COORDINATES:
            return cls.TRACK_COORDINATES[track_id]
            
        # Fallback to procedural generation for custom tracks (if any)
        if track_id not in cls.TRACK_TEMPLATES:
            return []
            
        segments = cls.TRACK_TEMPLATES[track_id]["segments"]
        points = []
        
        # Start at origin
        x, y = 100, 300
        angle = 0  # 0 is East
        points.append({"x": x, "y": y})
        
        scale = 0.5 
        
        for segment in segments:
            length = segment["length"] * scale
            radius = segment["radius"] * scale
            
            if radius == 0:
                x += length * np.cos(angle)
                y += length * np.sin(angle)
                points.append({"x": x, "y": y})
            else:
                arc_length = length
                turn_angle = arc_length / radius 
                turn_direction = segment.get("dir", 1) 
                
                steps = 10
                step_angle = (turn_angle * turn_direction) / steps
                step_len = arc_length / steps
                
                for _ in range(steps):
                    angle += step_angle
                    x += step_len * np.cos(angle)
                    y += step_len * np.sin(angle)
                    points.append({"x": x, "y": y})
                    
        return points

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
