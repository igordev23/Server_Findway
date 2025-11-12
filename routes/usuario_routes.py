from flask import Blueprint, request, jsonify
from database import db
from models.usuario import Usuario
from datetime import datetime
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")
usuario_bp = Blueprint("usuario_bp", __name__)

@usuario_bp.route("/usuarios", methods=["GET"])
def listar_usuarios():
    usuarios = Usuario.query.all()
    return jsonify([{
        "id": u.id,
        "nome": u.nome,
        "email": u.email,
        "telefone": u.telefone,
        "tipo_usuario": u.tipo_usuario
    } for u in usuarios])

@usuario_bp.route("/usuarios", methods=["POST"])
def criar_usuario():
    data = request.json
    try:
        user = Usuario(
            nome=data["nome"],
            email=data["email"],
            telefone=data["telefone"],
            tipo_usuario=data["tipo_usuario"],
            firebase_uid=data["firebase_uid"],
            criado_em=datetime.now(br_tz)
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "Usuário criado", "id": user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
