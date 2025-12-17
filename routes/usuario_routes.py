from flask import Blueprint, request, jsonify
from database import db
from models.usuario import Usuario
from models.cliente import Cliente
from models.administrador import Administrador
from datetime import datetime
import pytz
import firebase_admin
from firebase_admin import credentials, auth
import os

br_tz = pytz.timezone("America/Sao_Paulo")
usuario_bp = Blueprint("usuario_bp", __name__)

# Inicializa Firebase uma única vez
if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")


# ==============================
# LISTAR TODOS OS USUÁRIOS
# ==============================
@usuario_bp.route("/usuarios", methods=["GET"])
def listar_usuarios():
    # Usa SELECT Core para evitar resolução polimórfica automática,
    # que falha se houver valores desconhecidos no discriminador.
    rows = db.session.execute(
        db.select(
            Usuario.id,
            Usuario.nome,
            Usuario.email,
            Usuario.telefone,
            Usuario.tipo_usuario,
        )
    ).all()

    # Normaliza valores de tipo_usuario para manter consistência com o mapeamento ORM
    def normalize_tipo(tipo):
        if not tipo:
            return tipo
        tipo_l = str(tipo).lower()
        if tipo_l == "admin":
            return "administrador"
        return tipo_l

    return jsonify([
        {
            "id": r[0],
            "nome": r[1],
            "email": r[2],
            "telefone": r[3],
            "tipo_usuario": normalize_tipo(r[4]),
        }
        for r in rows
    ])


# ==============================
# CRIAR USUÁRIO (CLIENTE ou ADM)
# ==============================
@usuario_bp.route("/usuarios", methods=["POST"])
def criar_usuario():
    data = request.json

    try:
        nome = data["nome"]
        email = data["email"]
        senha = data["senha"]
        telefone = data.get("telefone", "")
        tipo_usuario = data["tipo_usuario"]  # cliente ou administrador

        # 1️⃣ Criar no Firebase Authentication
        firebase_user = auth.create_user(
            email=email,
            password=senha,
            display_name=nome,
            phone_number=None if telefone == "" else telefone
        )

        # ======================================================
        # 2️⃣ Criar DIRETO o registro na classe FILHA (JOINED)
        # ======================================================

        # ----------- CLIENTE -----------
        # ----------- CLIENTE -----------
        if tipo_usuario == "cliente":

            user = Cliente(
                nome=nome,
                email=email,
                telefone=telefone,
                tipo_usuario="cliente",
                firebase_uid=firebase_user.uid,
                criado_em=datetime.now(br_tz),

                # Quem criou o cliente (um Administrador)
                administrador_id=data["administrador_id"],


                rua=data["rua"],
                cidade=data["cidade"],
                estado=data["estado"],
                cep=data["cep"],
                numero=data["numero"]
            )


        # ----------- ADMINISTRADOR -----------
        elif tipo_usuario == "administrador":

            user = Administrador(
                nome=nome,
                email=email,
                telefone=telefone,
                tipo_usuario="administrador",
                firebase_uid=firebase_user.uid,
                criado_em=datetime.now(br_tz)
            )

        else:
            return jsonify({"error": "tipo_usuario inválido"}), 400

        # 3️⃣ Salvar usuário completo
        db.session.add(user)
        db.session.commit()

        return jsonify({
            "message": "Usuário criado com sucesso!",
            "id": user.id,
            "firebase_uid": firebase_user.uid,
            "tipo_usuario": tipo_usuario
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
