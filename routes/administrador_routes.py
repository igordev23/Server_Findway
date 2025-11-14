from flask import Blueprint, request, jsonify
from database import db
from models.administrador import Administrador
from datetime import datetime
import pytz
import firebase_admin
from firebase_admin import credentials, auth
import os

administrador_bp = Blueprint("administrador_bp", __name__)
br_tz = pytz.timezone("America/Sao_Paulo")

# Inicializa Firebase (apenas uma vez)
if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")


# ==============================
#   LISTAR ADMINISTRADORES
# ==============================
@administrador_bp.route("/administradores", methods=["GET"])
def listar_administradores():
    administradores = Administrador.query.all()
    return jsonify([
        {
            "id": a.id,
            "nome": a.nome,
            "email": a.email,
            "telefone": a.telefone
        } for a in administradores
    ])


# ==============================
#   OBTER ADMIN POR ID
# ==============================
@administrador_bp.route("/administradores/<int:id>", methods=["GET"])
def obter_administrador(id):
    admin = Administrador.query.get(id)
    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404

    return jsonify({
        "id": admin.id,
        "nome": admin.nome,
        "email": admin.email,
        "telefone": admin.telefone
    })


# ==============================
#   DELETAR ADMINISTRADOR
# ==============================
@administrador_bp.route("/administradores/<int:id>", methods=["DELETE"])
def deletar_administrador(id):
    admin = Administrador.query.get(id)

    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404

    db.session.delete(admin)
    db.session.commit()

    return jsonify({"message": "Administrador removido"})
