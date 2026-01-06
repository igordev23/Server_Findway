from flask import Blueprint, request, jsonify
from database import db
from models.cliente import Cliente
from models.veiculo import Veiculo
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
            "telefone": c.telefone,
            "cidade": c.cidade,
            "estado": c.estado,
            "administrador_id": c.administrador_id
        } for c in clientes
    ])

@cliente_bp.route("/clientes/admin/<int:admin_id>", methods=["GET"])
def listar_clientes_por_admin(admin_id):
    clientes = Cliente.query.filter_by(administrador_id=admin_id).all()
    return jsonify([
        {
            "id": c.id,
            "nome": c.nome,
            "email": c.email,
            "telefone": c.telefone,
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
        "telefone": cliente.telefone,
        "rua": cliente.rua,
        "numero": cliente.numero,
        "cidade": cliente.cidade,
        "estado": cliente.estado,
        "cep": cliente.cep,
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
            phone_number=telefone if telefone else None
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

    firebase_error = None
    if cliente.firebase_uid:
        try:
            auth.delete_user(cliente.firebase_uid)
        except Exception as e:
            firebase_error = str(e)

    try:
        # 1️⃣ Remove primeiro todos os veículos vinculados a este cliente
        veiculos = Veiculo.query.filter_by(cliente_id=id).all()
        for v in veiculos:
            db.session.delete(v)

        # 2️⃣ Depois remove o próprio cliente
        db.session.delete(cliente)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": f"Erro ao remover cliente no banco: {str(e)}"
        }), 500

    if firebase_error:
        return jsonify({
            "message": "Cliente removido do banco, mas houve erro ao removê-lo do Firebase.",
            "firebase_error": firebase_error
        }), 200

    return jsonify({
        "message": "Cliente removido completamente (Banco + Firebase)"
    })


# ==============================
#   ATUALIZAR CLIENTE
# ==============================
@cliente_bp.route("/clientes/<int:id>", methods=["PUT"])
def atualizar_cliente(id):
    cliente = Cliente.query.get(id)

    if not cliente:
        return jsonify({"error": "Cliente não encontrado"}), 404

    dados = request.json or {}

    novo_nome = dados.get("nome")
    novo_email = dados.get("email")
    novo_telefone = dados.get("telefone")
    nova_senha = dados.get("senha")

    nova_rua = dados.get("rua")
    nova_cidade = dados.get("cidade")
    novo_estado = dados.get("estado")
    novo_numero = dados.get("numero")
    novo_cep = dados.get("cep")

    try:
        # 1️⃣ Atualizar no Firebase (se tiver UID)
        if cliente.firebase_uid:
            update_data = {}

            if novo_email:
                update_data["email"] = novo_email

            if nova_senha:
                update_data["password"] = nova_senha

            if novo_nome:
                update_data["display_name"] = novo_nome

            # Firebase só aceita telefone no formato E.164
            if novo_telefone:
                update_data["phone_number"] = novo_telefone

            if update_data:
                auth.update_user(cliente.firebase_uid, **update_data)

        # 2️⃣ Atualizações no banco local (PostgreSQL)
        if novo_nome:
            cliente.nome = novo_nome

        if novo_email:
            cliente.email = novo_email

        if novo_telefone:
            cliente.telefone = novo_telefone

        if nova_rua:
            cliente.rua = nova_rua

        if nova_cidade:
            cliente.cidade = nova_cidade

        if novo_estado:
            cliente.estado = novo_estado

        if novo_numero:
            cliente.numero = novo_numero

        if novo_cep:
            cliente.cep = novo_cep

        cliente.atualizado_em = datetime.now(br_tz)

        db.session.commit()

        return jsonify({"message": "Cliente atualizado com sucesso!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@cliente_bp.route("/clientes/<int:id>/veiculos", methods=["GET"])
def listar_veiculos_por_cliente(id):
    cliente = Cliente.query.get(id)
    if not cliente:
        return jsonify({"error": "Cliente não encontrado"}), 404

    veiculos = Veiculo.query.filter_by(cliente_id=id).all()
    return jsonify([
        {
            "id": v.id,
            "cliente_id": v.cliente_id,
            "placa": v.placa,
            "modelo": v.modelo,
            "marca": v.marca,
            "ano": v.ano,
            "status_ignicao": v.status_ignicao,
            "ativo": v.ativo,
            "ultima_atualizacao": v.ultima_atualizacao,
        }
        for v in veiculos
    ])
