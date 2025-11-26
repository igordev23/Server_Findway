from flask import Blueprint, jsonify, request
from models.localizacao import Localizacao
from models.veiculo import Veiculo
from database import db

localizacao_bp = Blueprint("localizacao_bp", __name__)

# Listar todas as localizações com dados do veículo
@localizacao_bp.route("/localizacao", methods=["GET"])
def listar_localizacoes():
    localizacoes = db.session.query(Localizacao, Veiculo).join(
        Veiculo, Localizacao.placa == Veiculo.placa
    ).all()

    return jsonify([{
        "id": loc.Localizacao.id,
        "placa": loc.Localizacao.placa,
        "veiculo_id": loc.Veiculo.id,
        "modelo": loc.Veiculo.modelo,
        "marca": loc.Veiculo.marca,
        "latitude": loc.Localizacao.latitude,
        "longitude": loc.Localizacao.longitude,
        "timestamp": loc.Localizacao.timestamp.isoformat()
    } for loc in localizacoes])

# Criar uma nova localização para um veículo existente
@localizacao_bp.route("/localizacao", methods=["POST"])
def criar_localizacao():
    data = request.json
    placa = data.get("placa")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    timestamp = data.get("timestamp")

    # Verifica se o veículo existe
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado para a placa fornecida"}), 404

    localizacao = Localizacao(
        placa=placa,
        latitude=latitude,
        longitude=longitude,
        timestamp=timestamp
    )

    try:
        db.session.add(localizacao)
        db.session.commit()
        return jsonify({
            "message": "Localização criada com sucesso",
            "id": localizacao.id,
            "placa": localizacao.placa
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
