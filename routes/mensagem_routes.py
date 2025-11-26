from flask import Blueprint, request, jsonify
from models.localizacao import Localizacao
from models.veiculo import Veiculo
from database import db
from datetime import datetime
import re
import pytz  # timezone

mensagens_bp = Blueprint('mensagens_bp', __name__)

@mensagens_bp.route("/mensagem", methods=["GET"])
def receber_mensagem():
    mensagem = request.args.get("msg")
    if not mensagem:
        return jsonify({"error": "Mensagem não enviada"}), 400

    print(f"Mensagem recebida: {mensagem}")

    # Regex para extrair placa, latitude e longitude
    padrao = r"placa=([A-Z0-9]+), latitude=([-+]?\d*\.\d+|\d+), longitude=([-+]?\d*\.\d+|\d+)"
    match = re.search(padrao, mensagem)
    if not match:
        return jsonify({"error": "Não conseguiu extrair placa/lat/lng da mensagem"}), 400

    placa = match.group(1)
    lat = float(match.group(2))
    lng = float(match.group(3))

    # Verifica se o veículo existe
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": f"Veículo não encontrado para a placa {placa}"}), 404

    # Usar timezone de Brasília
    fuso_brasilia = pytz.timezone("America/Sao_Paulo")
    timestamp_brasilia = datetime.now(fuso_brasilia)

    # Criar entrada GPS
    gps_entry = Localizacao(
        placa=placa,
        latitude=lat,
        longitude=lng,
        timestamp=timestamp_brasilia
    )

    try:
        db.session.add(gps_entry)
        db.session.commit()
        return jsonify({
            "status": "ok",
            "placa": placa,
            "latitude": lat,
            "longitude": lng,
            "timestamp": gps_entry.timestamp.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
