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
from routes.auth_middleware import require_super_admin

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

        # Se for criar administrador, verificar se quem solicita é o Super Admin
        if tipo_usuario == "administrador":
            # Verificação manual do decorator para permitir lógica condicional dentro da função
            # ou extrair lógica. Como o decorator envolve a função toda, aqui vamos fazer uma verificação inline
            # ou separar em outra rota. Mas para manter a rota unificada, vamos checar o token aqui.
            
            from routes.auth_middleware import check_firebase_token
            decoded_token = check_firebase_token()
            super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")
            
            if not decoded_token or not super_admin_email or decoded_token.get("email", "").lower() != super_admin_email.lower():
                return jsonify({"error": "Apenas o Administrador Geral pode criar novos administradores."}), 403

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


# ==============================
# VERIFICAR PAPEL DO USUÁRIO
# ==============================
@usuario_bp.route("/usuarios/verificar-role", methods=["GET"])
def verificar_role():
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Parâmetro 'email' é obrigatório"}), 400

    row = db.session.execute(
        db.select(
            Usuario.id,
            Usuario.email,
            Usuario.tipo_usuario,
        ).where(db.func.lower(Usuario.email) == email)
    ).first()

    if not row:
        return jsonify({"found": False, "role": None, "is_admin": False}), 404

    tipo = (row[2] or "").lower()
    if tipo == "admin":
        tipo = "administrador"
    
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "").lower()
    is_super_admin = (row[1].lower() == super_admin_email) if super_admin_email else False

    return jsonify({
        "found": True,
        "role": tipo,
        "is_admin": tipo == "administrador",
        "is_super_admin": is_super_admin,
        "user_id": row[0],
        "email": row[1]
    })
