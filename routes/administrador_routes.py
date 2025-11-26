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
#   ATUALIZAR ADMINISTRADOR
# ==============================
@administrador_bp.route("/administradores/<int:id>", methods=["PUT"])
def atualizar_administrador(id):
    admin = Administrador.query.get(id)

    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404

    dados = request.json

    novo_nome = dados.get("nome")
    novo_email = dados.get("email")
    novo_telefone = dados.get("telefone")
    nova_senha = dados.get("senha")

    try:
        # 1️⃣ Atualizar no Firebase (se tiver UID)
        if admin.firebase_uid:
            update_data = {}

            if novo_email:
                update_data["email"] = novo_email

            if nova_senha:
                update_data["password"] = nova_senha

            if update_data:
                auth.update_user(admin.firebase_uid, **update_data)

        # 2️⃣ Atualizar no PostgreSQL
        if novo_nome:
            admin.nome = novo_nome

        if novo_email:
            admin.email = novo_email

        if novo_telefone:
            admin.telefone = novo_telefone

        admin.atualizado_em = datetime.now(br_tz)

        db.session.commit()

        return jsonify({"message": "Administrador atualizado com sucesso!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400




# ==============================
#   DELETAR ADMINISTRADOR
# ==============================
@administrador_bp.route("/administradores/<int:id>", methods=["DELETE"])
def deletar_administrador(id):
    admin = Administrador.query.get(id)

    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404

    try:
        # 1️⃣ Remover do Firebase Authentication (se tiver UID)
        if admin.firebase_uid:
            auth.delete_user(admin.firebase_uid)

        # 2️⃣ Remover do banco (Administrador + Usuario automaticamente)
        db.session.delete(admin)
        db.session.commit()

        return jsonify({"message": "Administrador removido com sucesso!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
