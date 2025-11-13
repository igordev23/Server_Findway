from flask import Blueprint, request, jsonify, render_template, flash, redirect
from database import db
from models.administrador import Administrador
from datetime import datetime
import pytz
import firebase_admin
from models.cliente import Cliente
from models.veiculo import Veiculo
from firebase_admin import credentials, auth
import os

administrador_bp = Blueprint("administrador_bp", __name__)
br_tz = pytz.timezone("America/Sao_Paulo")

if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")

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

@administrador_bp.route("/administradores", methods=["POST"])
def criar_administrador():
    data = request.json
    try:
        nome = data["nome"]
        email = data["email"]
        senha = data["senha"]
        telefone = data.get("telefone", "")

        # Cria usuário no Firebase
        firebase_user = auth.create_user(
            email=email,
            password=senha,
            display_name=nome,
            phone_number=None if telefone == "" else telefone
        )

        # Cria o administrador (herda de Usuario)
        admin = Administrador(
            nome=nome,
            email=email,
            telefone=telefone,
            tipo_usuario="administrador",
            firebase_uid=firebase_user.uid,
            criado_em=datetime.now(br_tz)
        )

        db.session.add(admin)
        db.session.commit()

        return jsonify({
            "message": "Administrador criado com sucesso.",
            "id": admin.id,
            "firebase_uid": firebase_user.uid
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@administrador_bp.route("/administradores/<int:id>", methods=["DELETE"])
def deletar_administrador(id):
    admin = Administrador.query.get(id)
    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404
    db.session.delete(admin)
    db.session.commit()
    return jsonify({"message": "Administrador removido"})


@administrador_bp.route("/admin/cadastrar-cliente", methods=["GET", "POST"])
def cadastrar_cliente():
    if request.method == "POST":
        data = request.form
        novo_cliente = Cliente(
            nome=data["nome"],
            email=data["email"],
            senha=data["senha"],
            telefone=data.get("telefone"),
            rua=data["rua"],
            numero=data["numero"],
            cidade=data["cidade"],
            estado=data["estado"],
            cep=data["cep"],
            administrador_id=1  # Exemplo fixo — depois use o usuário logado
        )
        db.session.add(novo_cliente)
        db.session.commit()
        flash("Cliente cadastrado com sucesso!", "success")
        return redirect("/admin/cadastrar-cliente")

    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }
    return render_template("admin/cadastrar_cliente.html", firebase_config=firebase_config)

@administrador_bp.route("/admin/cadastrar-veiculo", methods=["GET", "POST"])
def cadastrar_veiculo():
    if request.method == "POST":
        data = request.form
        novo_veiculo = Veiculo(
            cliente_id=data["cliente_id"],
            placa=data["placa"],
            modelo=data["modelo"],
            marca=data["marca"],
            ano=int(data["ano"]),
            ativo=data["ativo"].lower() == "true"
        )
        db.session.add(novo_veiculo)
        db.session.commit()
        flash("Veículo cadastrado com sucesso!", "success")
        return redirect("/admin/cadastrar-veiculo")

    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }
    return render_template("admin/cadastrar_veiculo.html", firebase_config=firebase_config)

