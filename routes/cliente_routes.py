from flask import Blueprint, request, jsonify
from database import db
from models.cliente import Cliente

cliente_bp = Blueprint("cliente_bp", __name__)

@cliente_bp.route("/clientes", methods=["GET"])
def listar_clientes():
    clientes = Cliente.query.all()
    return jsonify([{
        "id": c.id,
        "cidade": c.cidade,
        "estado": c.estado,
        "rua": c.rua,
        "numero": c.numero,
        "cep": c.cep
    } for c in clientes])

@cliente_bp.route("/clientes/<int:id>", methods=["GET"])
def obter_cliente(id):
    cliente = Cliente.query.get(id)
    if not cliente:
        return jsonify({"error": "Cliente não encontrado"}), 404
    return jsonify({
        "id": cliente.id,
        "administrador_id": cliente.administrador_id,
        "cidade": cliente.cidade,
        "estado": cliente.estado
    })

@cliente_bp.route("/clientes", methods=["POST"])
def criar_cliente():
    data = request.json
    try:
        cliente = Cliente(
            administrador_id=data["administrador_id"],
            rua=data["rua"],
            cidade=data["cidade"],
            estado=data["estado"],
            cep=data["cep"],
            numero=data["numero"]
        )
        db.session.add(cliente)
        db.session.commit()
        return jsonify({"message": "Cliente criado", "id": cliente.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
