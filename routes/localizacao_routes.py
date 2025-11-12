from flask import Blueprint, request, jsonify
from models.localizacao import Localizacao
from database import db
from datetime import datetime, timedelta, timezone

# Nome do blueprint corrigido
localizacao_bp = Blueprint('localizacao_bp', __name__)

@localizacao_bp.route("/localizacao", methods=["GET"])
def get_latest_localizacao():
    latest = Localizacao.query.order_by(Localizacao.timestamp.desc()).first()
    if latest:
        return jsonify(latest.to_dict())
    else:
        return jsonify({"message": "Nenhum dado de localização disponível"})


@localizacao_bp.route("/localizacao", methods=["POST"])
def add_localizacao():
    data = request.json
    try:
        nome = data.get("nome")
        lat = float(data.get("latitude"))
        lon = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Latitude e Longitude inválidos"}), 400

    nova_localizacao = Localizacao(nome=nome, latitude=lat, longitude=lon)
    db.session.add(nova_localizacao)
    db.session.commit()

    # Remove registros com mais de 24 horas
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    Localizacao.query.filter(Localizacao.timestamp < cutoff).delete()
    db.session.commit()

    print(f"[LOG] Localização salva: {nova_localizacao.latitude}, {nova_localizacao.longitude}, {nova_localizacao.timestamp}")

    return jsonify(nova_localizacao.to_dict()), 201

@localizacao_bp.route("/localizacao/historico", methods=["GET"])
def historico_localizacao():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    dados = Localizacao.query.filter(Localizacao.timestamp >= cutoff).order_by(Localizacao.timestamp.desc()).all()
    return jsonify([d.to_dict() for d in dados])
