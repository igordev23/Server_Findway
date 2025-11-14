from flask import Blueprint, jsonify
from models.veiculo_localizacao import VeiculoLocalizacao
from database import db
from flask import request

veiculo_localizacao_bp = Blueprint("veiculo_localizacao_bp", __name__)

@veiculo_localizacao_bp.route("/veiculo_localizacoes", methods=["GET"])
def listar_relacoes():
    relacoes = VeiculoLocalizacao.query.all()
    return jsonify([{
        "id": r.id,
        "veiculo_id": r.veiculo_id,
        "localizacao_id": r.localizacao_id
    } for r in relacoes])

@veiculo_localizacao_bp.route("/veiculo_localizacoes", methods=["POST"])
def criar_relacao():
    data = request.json
    try:
        veiculo_id = data["veiculo_id"]
        localizacao_id = data["localizacao_id"]

        relacao = VeiculoLocalizacao(
            veiculo_id=veiculo_id,
            localizacao_id=localizacao_id
        )

        db.session.add(relacao)
        db.session.commit()

        return jsonify({
            "message": "Relação criada com sucesso",
            "id": relacao.id,
            "veiculo_id": relacao.veiculo_id,
            "localizacao_id": relacao.localizacao_id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
