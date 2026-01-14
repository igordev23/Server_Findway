from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timedelta
from models.evento import Evento
from models.localizacao import Localizacao
from database import db
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles
    return c * r * 1000 # returns in meters

def process_vehicle_events(veiculo, new_lat, new_lng, new_timestamp):
    """
    Analyzes the new location against history to generate events:
    - MOVIMENTO
    - PARADA
    """
    try:
        # Get last location
        last_loc = Localizacao.query.filter_by(placa=veiculo.placa)\
            .order_by(Localizacao.timestamp.desc()).first()

        if not last_loc:
            # First location ever, no event comparison possible yet
            return

        # Ensure timestamps are comparable (offset-aware)
        if new_timestamp.tzinfo is None:
             new_timestamp = pytz.utc.localize(new_timestamp).astimezone(br_tz)
        
        last_ts = last_loc.timestamp
        if last_ts.tzinfo is None:
             last_ts = pytz.utc.localize(last_ts).astimezone(br_tz)

        # Calculate Distance and Time
        dist_meters = haversine(last_loc.latitude, last_loc.longitude, new_lat, new_lng)
        time_diff_seconds = (new_timestamp - last_ts).total_seconds()

        print(f"DEBUG: Dist={dist_meters}m, Time={time_diff_seconds}s")

        if time_diff_seconds <= 0:
            print("DEBUG: Time diff <= 0, returning")
            return # Duplicate or out of order packet

        # Speed (m/s) -> km/h
        speed_kmh = (dist_meters / time_diff_seconds) * 3.6
        print(f"DEBUG: Speed={speed_kmh} km/h")

        # Define Thresholds
        MOVEMENT_THRESHOLD_KMH = 5.0  # Speed to consider "moving"
        STOP_THRESHOLD_KMH = 2.0      # Speed to consider "stopped"
        
        # Determine Current State
        is_moving = speed_kmh > MOVEMENT_THRESHOLD_KMH
        is_stopped = speed_kmh < STOP_THRESHOLD_KMH

        # Get Last Event to avoid duplicates
        last_event = Evento.query.filter_by(veiculo_id=veiculo.id)\
            .order_by(Evento.timestamp.desc()).first()
        
        last_event_type = last_event.tipo if last_event else "UNKNOWN"

        # Generate "MOVIMENTO" Event
        if is_moving and last_event_type != "MOVIMENTO":
            # If we were previously stopped (or unknown), and now moving
            novo_evento = Evento(
                veiculo_id=veiculo.id,
                tipo="MOVIMENTO",
                descricao=f"Veículo entrou em movimento (Vel. aprox: {int(speed_kmh)} km/h)",
                timestamp=new_timestamp
            )
            db.session.add(novo_evento)
            # Update vehicle status (optional, but good for UI)
            veiculo.status_ignicao = True 

        # Generate "PARADA" Event
        elif is_stopped and last_event_type != "PARADA":
            # If we were moving, and now stopped
            # We only confirm stop if we really are slow
            if last_event_type == "MOVIMENTO" or last_event_type == "UNKNOWN":
                novo_evento = Evento(
                    veiculo_id=veiculo.id,
                    tipo="PARADA",
                    descricao=f"Veículo parou (Vel. aprox: {int(speed_kmh)} km/h)",
                    timestamp=new_timestamp
                )
                db.session.add(novo_evento)
                veiculo.status_ignicao = False

        # Note: Connection Loss is better handled by a periodic check or when querying status, 
        # because we can't detect "loss" when we *receive* a packet (we only detect "restoration").
        
        # We can detect "Connection Restored" here if gap is huge
        if time_diff_seconds > 600: # 10 minutes gap
            minutes_offline = int(time_diff_seconds/60)
            
            # Heurística: Se passou muito tempo sem sinal e a distância é curta (< 50m),
            # assumimos que o veículo ficou PARADO/DESLIGADO nesse período.
            if dist_meters < 50:
                if last_event_type != "PARADA":
                     stop_event = Evento(
                        veiculo_id=veiculo.id,
                        tipo="PARADA",
                        descricao=f"Veículo confirmado parado (retorno após {minutes_offline} min offline)",
                        timestamp=new_timestamp
                     )
                     db.session.add(stop_event)
                     veiculo.status_ignicao = False
            else:
                # Se deslocou muito enquanto estava offline
                novo_evento = Evento(
                    veiculo_id=veiculo.id,
                    tipo="ALERTA",
                    descricao=f"Conexão restaurada após {minutes_offline} min offline",
                    timestamp=new_timestamp
                )
                db.session.add(novo_evento)

    except Exception as e:
        print(f"Erro ao processar eventos: {e}")
