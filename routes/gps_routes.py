from flask import Blueprint, request, jsonify
from models.models import GPSData
from database import db
from datetime import datetime, timedelta

gps_bp = Blueprint('gps_bp', __name__)

@gps_bp.route("/gps", methods=["GET"])
def get_latest_gps():
    # Retorna a última localização armazenada
    latest = GPSData.query.order_by(GPSData.timestamp.desc()).first()
    if latest:
        return jsonify(latest.to_dict())
    else:
        return jsonify({"message": "Nenhum dado GPS disponível"}), 404

@gps_bp.route("/gps", methods=["POST"])
def add_gps():
    data = request.json
    try:
        lat = float(data.get("latitude"))
        lon = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Latitude e Longitude inválidos"}), 400

    gps_entry = GPSData(latitude=lat, longitude=lon)
    db.session.add(gps_entry)
    db.session.commit()

    # Apagar dados com mais de 24h
    cutoff = datetime.utcnow() - timedelta(hours=24)
    GPSData.query.filter(GPSData.timestamp < cutoff).delete()
    db.session.commit()

    return jsonify(gps_entry.to_dict()), 201
