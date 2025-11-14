from flask import Blueprint, request, jsonify
from database import db
from models.cliente import Cliente
from datetime import datetime
import pytz
import firebase_admin
from firebase_admin import credentials, auth
import os

cliente_bp = Blueprint("cliente_bp", __name__)
br_tz = pytz.timezone("America/Sao_Paulo")

if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")

@cliente_bp.route("/clientes", methods=["GET"])
def listar_clientes():
    clientes = Cliente.query.all()
    return jsonify([
        {
            "id": c.id,
            "nome": c.nome,
            "email": c.email,
            "cidade": c.cidade,
            "estado": c.estado,
            "administrador_id": c.administrador_id
        } for c in clientes
    ])

@cliente_bp.route("/clientes/<int:id>", methods=["GET"])
def obter_cliente(id):
    cliente = Cliente.query.get(id)
    if not cliente:
        return jsonify({"error": "Cliente não encontrado"}), 404
    return jsonify({
        "id": cliente.id,
        "nome": cliente.nome,
        "email": cliente.email,
        "cidade": cliente.cidade,
        "estado": cliente.estado,
        "administrador_id": cliente.administrador_id
    })

@cliente_bp.route("/clientes", methods=["POST"])
def criar_cliente():
    data = request.json
    try:
        nome = data["nome"]
        email = data["email"]
        senha = data["senha"]
        telefone = data.get("telefone", "")
        administrador_id = data["administrador_id"]
        rua = data["rua"]
        cidade = data["cidade"]
        estado = data["estado"]
        cep = data["cep"]
        numero = data["numero"]

        # Cria usuário no Firebase
        firebase_user = auth.create_user(
            email=email,
            password=senha,
            display_name=nome,
            phone_number=None if telefone == "" else telefone
        )

        # Cria cliente localmente (herança)
        cliente = Cliente(
            nome=nome,
            email=email,
            telefone=telefone,
            tipo_usuario="cliente",
            firebase_uid=firebase_user.uid,
            criado_em=datetime.now(br_tz),
            administrador_id=administrador_id,
            rua=rua,
            cidade=cidade,
            estado=estado,
            cep=cep,
            numero=numero
        )

        db.session.add(cliente)
        db.session.commit()

        return jsonify({
            "message": "Cliente criado com sucesso.",
            "id": cliente.id,
            "firebase_uid": firebase_user.uid
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    
    

@cliente_bp.route("/clientes/<int:id>", methods=["DELETE"])
def deletar_cliente(id):
    cliente = Cliente.query.get(id)

    if not cliente:
        return jsonify({"error": "Cliente não encontrado"}), 404

    # 1️⃣ Remover do Firebase (se tiver UID)
    if cliente.firebase_uid:
        try:
            auth.delete_user(cliente.firebase_uid)
        except Exception as e:
            return jsonify({
                "error": f"Erro ao remover do Firebase: {str(e)}"
            }), 500

    # 2️⃣ Remover do banco (Cliente + Usuario por cascata)
    try:
        db.session.delete(cliente)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": f"Erro ao remover cliente no banco: {str(e)}"
        }), 500

    return jsonify({
        "message": "Cliente removido completamente (Banco + Firebase)"
    })
