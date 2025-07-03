from flask import Blueprint, request, jsonify
from models.models import GPSData  # seu modelo GPS
from database import db
from datetime import datetime
import re

mensagens_bp = Blueprint('mensagens_bp', __name__)

@mensagens_bp.route("/mensagem", methods=["GET"])
def receber_mensagem():
    mensagem = request.args.get("msg")
    if not mensagem:
        return jsonify({"error": "Mensagem não enviada"}), 400
    
    print(f"Mensagem recebida: {mensagem}")

    # Regex para pegar latitude e longitude da mensagem tipo:
    # "Localização GPS: latitude=-4.289924, longitude=-41.793201"
    padrao = r"latitude=([-+]?\d*\.\d+|\d+), longitude=([-+]?\d*\.\d+|\d+)"
    match = re.search(padrao, mensagem)
    if not match:
        return jsonify({"error": "Não conseguiu extrair lat/lng da mensagem"}), 400

    lat = float(match.group(1))
    lng = float(match.group(2))

    # Criar entrada GPS no banco
    gps_entry = GPSData(latitude=lat, longitude=lng, timestamp=datetime.utcnow())
    db.session.add(gps_entry)
    db.session.commit()

    return jsonify({
        "status": "ok",
        "latitude": lat,
        "longitude": lng,
        "timestamp": gps_entry.timestamp.isoformat()
    }), 201
