from flask import Blueprint, request, jsonify
from database import db
from models.usuario import Usuario
from datetime import datetime
import pytz
import firebase_admin
from firebase_admin import credentials, auth
import os

br_tz = pytz.timezone("America/Sao_Paulo")
usuario_bp = Blueprint("usuario_bp", __name__)

if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")

@usuario_bp.route("/usuarios", methods=["GET"])
def listar_usuarios():
    usuarios = Usuario.query.all()
    return jsonify([
        {
            "id": u.id,
            "nome": u.nome,
            "email": u.email,
            "telefone": u.telefone,
            "tipo_usuario": u.tipo_usuario
        } for u in usuarios
    ])

@usuario_bp.route("/usuarios", methods=["POST"])
def criar_usuario():
    data = request.json
    try:
        nome = data["nome"]
        email = data["email"]
        senha = data["senha"]  # o cliente deve enviar uma senha
        telefone = data.get("telefone", "")
        tipo_usuario = data["tipo_usuario"]

        # === 1. Cria no Firebase Authentication ===
        firebase_user = auth.create_user(
            email=email,
            password=senha,
            display_name=nome,
            phone_number=None if telefone == "" else telefone
        )

        # === 2. Cria localmente no PostgreSQL ===
        user = Usuario(
            nome=nome,
            email=email,
            telefone=telefone,
            tipo_usuario=tipo_usuario,
            firebase_uid=firebase_user.uid,
            criado_em=datetime.now(br_tz)
        )

        db.session.add(user)
        db.session.commit()

        return jsonify({
            "message": "Usuário criado com sucesso.",
            "id": user.id,
            "firebase_uid": firebase_user.uid
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
