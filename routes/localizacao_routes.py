from flask import Blueprint, jsonify, request
from models.localizacao import Localizacao
from models.veiculo import Veiculo
from database import db
from datetime import datetime, timedelta
import pytz

localizacao_bp = Blueprint("localizacao_bp", __name__)

# Fuso horário do Brasil
br_tz = pytz.timezone("America/Sao_Paulo")


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

@localizacao_bp.route("/localizacao/historico", methods=["GET"])
def historico_localizacao():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    dados = Localizacao.query.filter(Localizacao.timestamp >= cutoff).order_by(Localizacao.timestamp.desc()).all()
    return jsonify([d.to_dict() for d in dados])


# Localização mais recente por placa
@localizacao_bp.route("/localizacao/<placa>", methods=["GET"])
def localizacao_por_placa(placa):
    localizacao = Localizacao.query.filter_by(placa=placa).order_by(Localizacao.timestamp.desc()).first()
    if not localizacao:
        return jsonify({"error": "Nenhuma localização encontrada para esta placa"}), 404
    return jsonify(localizacao.to_dict())

# Histórico de 24h por placa
@localizacao_bp.route("/localizacao/<placa>/historico", methods=["GET"])
def historico_por_placa(placa):
    cutoff = datetime.utcnow() - timedelta(hours=24)
    dados = Localizacao.query.filter(
        Localizacao.placa == placa,
        Localizacao.timestamp >= cutoff
    ).order_by(Localizacao.timestamp.desc()).all()
    
    if not dados:
        return jsonify({"error": "Nenhuma localização encontrada para esta placa nas últimas 24h"}), 404
    return jsonify([d.to_dict() for d in dados])

@localizacao_bp.route("/localizacao/<int:id>", methods=["DELETE"])
def deletar_localizacao(id):
    loc = Localizacao.query.get(id)
    if not loc:
        return jsonify({"error": "Localização não encontrada"}), 404

    db.session.delete(loc)
    db.session.commit()
    return jsonify({"message": "Localização deletada"})


@localizacao_bp.route("/localizacao/ultimas-24h", methods=["DELETE"])
def deletar_localizacoes_24h():
    # Hora atual no fuso brasileiro
    agora_br = datetime.now(br_tz)

    # Limite: últimas 24h
    cutoff = agora_br - timedelta(hours=24)

    try:
        # Filtrar todas as localizações do período
        deletadas = Localizacao.query.filter(
            Localizacao.timestamp >= cutoff
        ).delete()

        db.session.commit()

        return jsonify({
            "message": "Localizações das últimas 24h removidas",
            "total_deletadas": deletadas
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@localizacao_bp.route("/localizacao/status/<placa>", methods=["GET"])
def info_completa(placa):
    # Buscar veículo
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    # Buscar última localização
    localizacao = Localizacao.query.filter_by(placa=placa)\
        .order_by(Localizacao.timestamp.desc()).first()

    if not localizacao:
        return jsonify({"error": "Nenhuma localização encontrada"}), 404

    return jsonify({
        "placa": veiculo.placa,
        "status_gps": "Online" if veiculo.ativo else "Offline",
        "velocidade": getattr(localizacao, "velocidade", 0),   # se quiser armazenar isso
        "latitude": localizacao.latitude,
        "longitude": localizacao.longitude,
        "timestamp": localizacao.timestamp.isoformat()
    })
