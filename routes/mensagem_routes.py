from flask import Blueprint, request, jsonify
from models.localizacao import Localizacao  
from database import db
from datetime import datetime
import re
import pytz  # precisa estar instalado no seu projeto

mensagens_bp = Blueprint('mensagens_bp', __name__)

@mensagens_bp.route("/mensagem", methods=["GET"])
def receber_mensagem():
    mensagem = request.args.get("msg")
    if not mensagem:
        return jsonify({"error": "Mensagem não enviada"}), 400
    
    print(f"Mensagem recebida: {mensagem}")

    # Regex para extrair latitude e longitude
    padrao = r"latitude=([-+]?\d*\.\d+|\d+), longitude=([-+]?\d*\.\d+|\d+)"
    match = re.search(padrao, mensagem)
    if not match:
        return jsonify({"error": "Não conseguiu extrair lat/lng da mensagem"}), 400

    lat = float(match.group(1))
    lng = float(match.group(2))

    # Usar timezone de Brasília
    fuso_brasilia = pytz.timezone("America/Sao_Paulo")
    timestamp_brasilia = datetime.now(fuso_brasilia)

    # Criar entrada GPS
    gps_entry = Localizacao(latitude=lat, longitude=lng, timestamp=timestamp_brasilia)
    db.session.add(gps_entry)
    db.session.commit()

    return jsonify({
        "status": "ok",
        "latitude": lat,
        "longitude": lng,
        "timestamp": gps_entry.timestamp.isoformat()
    }), 201
