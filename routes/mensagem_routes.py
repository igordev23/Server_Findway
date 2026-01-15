from flask import Blueprint, request, jsonify
from models.localizacao import Localizacao
from models.veiculo import Veiculo
from database import db
from datetime import datetime
import re
import pytz  # timezone
from utils.event_helper import process_vehicle_events

mensagens_bp = Blueprint('mensagens_bp', __name__)

from flask import Blueprint, request, jsonify
from models.localizacao import Localizacao
from models.veiculo import Veiculo
from database import db
from datetime import datetime
import re
import pytz
from utils.event_helper import process_vehicle_events

mensagens_bp = Blueprint('mensagens_bp', __name__)

@mensagens_bp.route("/mensagem", methods=["GET"])
def receber_mensagem():
    mensagem = request.args.get("msg")
    if not mensagem:
        return jsonify({"error": "Mensagem não enviada"}), 400

    print(f"Mensagem recebida: {mensagem}")

    # ======================================
    # 🛰️ GPS
    # ======================================
    padrao = (
        r"placa=([A-Z0-9]+),\s*"
        r"latitude=([-+]?\d*\.\d+|\d+),\s*"
        r"longitude=([-+]?\d*\.\d+|\d+)"
    )

    match = re.search(padrao, mensagem)
    if not match:
        return jsonify({"error": "Formato inválido"}), 400

    placa = match.group(1)
    lat = float(match.group(2))
    lng = float(match.group(3))

    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": f"Veículo {placa} não encontrado"}), 404

    fuso = pytz.timezone("America/Sao_Paulo")
    timestamp = datetime.now(fuso)

    # =====================================================
    # 🔒 TRAVA ABSOLUTA DO STATUS DA IGNIÇÃO
    # =====================================================
    status_ignicao_original = veiculo.status_ignicao

    # Atualiza somente último contato
    veiculo.ultima_atualizacao = timestamp

    # Salva GPS
    gps_entry = Localizacao(
        placa=placa,
        latitude=lat,
        longitude=lng,
        timestamp=timestamp
    )

    # Pode gerar eventos, mas NÃO pode alterar ignição
    process_vehicle_events(veiculo, lat, lng, timestamp)

    # 🔒 RESTAURA O VALOR ORIGINAL (proteção final)
    veiculo.status_ignicao = status_ignicao_original

    try:
        db.session.add(gps_entry)
        db.session.commit()

        return jsonify({
            "type": "gps",
            "placa": placa,
            "latitude": lat,
            "longitude": lng,
            "status_ignicao": status_ignicao_original
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
