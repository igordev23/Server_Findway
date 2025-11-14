from flask import Blueprint, request, jsonify
from database import db
from models.veiculo import Veiculo
from datetime import datetime
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")
veiculo_bp = Blueprint("veiculo_bp", __name__)

@veiculo_bp.route("/veiculos", methods=["GET"])
def listar_veiculos():
    veiculos = Veiculo.query.all()
    return jsonify([{
        "id": v.id,
        "placa": v.placa,
        "modelo": v.modelo,
        "marca": v.marca,
        "ano": v.ano,
        "status_ignicao": v.status_ignicao,
        "ativo": v.ativo,
        "cliente_id": v.cliente_id,
        "cliente_nome": v.cliente.nome if v.cliente else None  # opcional
    } for v in veiculos])


@veiculo_bp.route("/veiculos/<int:id>", methods=["GET"])
def obter_veiculo(id):
    v = Veiculo.query.get(id)
    if not v:
        return jsonify({"error": "Veículo não encontrado"}), 404
    return jsonify({
        "id": v.id,
        "placa": v.placa,
        "modelo": v.modelo,
        "marca": v.marca,
        "ano": v.ano,
        "status_ignicao": v.status_ignicao,
        "ativo": v.ativo
    })

@veiculo_bp.route("/veiculos", methods=["POST"])
def criar_veiculo():
    data = request.json
    try:
        v = Veiculo(
            cliente_id=data["cliente_id"],
            placa=data["placa"],
            modelo=data["modelo"],
            marca=data["marca"],
            ano=data["ano"],
            status_ignicao=False,
            ativo=True,
            criado_em=datetime.now(br_tz)
        )
        db.session.add(v)
        db.session.commit()
        return jsonify({"message": "Veículo criado", "id": v.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
