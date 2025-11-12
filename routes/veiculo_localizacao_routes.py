from flask import Blueprint, jsonify
from models.veiculo_localizacao import VeiculoLocalizacao

veiculo_localizacao_bp = Blueprint("veiculo_localizacao_bp", __name__)

@veiculo_localizacao_bp.route("/veiculo_localizacoes", methods=["GET"])
def listar_relacoes():
    relacoes = VeiculoLocalizacao.query.all()
    return jsonify([{
        "id": r.id,
        "veiculo_id": r.veiculo_id,
        "localizacao_id": r.localizacao_id
    } for r in relacoes])
