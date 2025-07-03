from flask import Blueprint, request, jsonify
from models.models import GPSData
from database import db
from datetime import datetime, timedelta, timezone

gps_bp = Blueprint('gps_bp', __name__)

@gps_bp.route("/gps", methods=["GET"])
def get_latest_gps():
    latest = GPSData.query.order_by(GPSData.timestamp.desc()).first()
    if latest:
        return jsonify(latest.to_dict())
    else:
        # NÃO retornar 404, só mensagem normal com 200 OK
        return jsonify({"message": "Nenhum dado GPS disponível"})

@gps_bp.route("/gps", methods=["POST"])
def add_gps():
    data = request.json
    try:
        nome = data.get("nome")  # pega o nome opcionalmente
        lat = float(data.get("latitude"))
        lon = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Latitude e Longitude inválidos"}), 400

    gps_entry = GPSData(nome=nome, latitude=lat, longitude=lon)
    db.session.add(gps_entry)
    db.session.commit()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    GPSData.query.filter(GPSData.timestamp < cutoff).delete()
    db.session.commit()
    print(f"[LOG] GPS salvo: {gps_entry.latitude}, {gps_entry.longitude}, {gps_entry.timestamp}")


    return jsonify(gps_entry.to_dict()), 201

@gps_bp.route("/gps/historico", methods=["GET"])
def historico_gps():
    from datetime import datetime, timedelta

    # Define o tempo de corte (últimas 24h)
    cutoff = datetime.utcnow() - timedelta(hours=24)
    dados = GPSData.query.filter(GPSData.timestamp >= cutoff).order_by(GPSData.timestamp.desc()).all()

    return jsonify([d.to_dict() for d in dados])
