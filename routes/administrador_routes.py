from flask import Blueprint, request, jsonify
from database import db
from models.administrador import Administrador

administrador_bp = Blueprint("administrador_bp", __name__)

@administrador_bp.route("/administradores", methods=["GET"])
def listar_administradores():
    administradores = Administrador.query.all()
    return jsonify([{"id": a.id} for a in administradores])

@administrador_bp.route("/administradores/<int:id>", methods=["GET"])
def obter_administrador(id):
    admin = Administrador.query.get(id)
    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404
    return jsonify({"id": admin.id})

@administrador_bp.route("/administradores", methods=["POST"])
def criar_administrador():
    admin = Administrador()
    db.session.add(admin)
    db.session.commit()
    return jsonify({"message": "Administrador criado", "id": admin.id}), 201

@administrador_bp.route("/administradores/<int:id>", methods=["DELETE"])
def deletar_administrador(id):
    admin = Administrador.query.get(id)
    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404
    db.session.delete(admin)
    db.session.commit()
    return jsonify({"message": "Administrador removido"})
