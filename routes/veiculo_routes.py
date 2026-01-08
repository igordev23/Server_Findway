from flask import Blueprint, request, jsonify
from middlewares import check_subscription_status, _get_email_from_auth_header
from database import db
from models.veiculo import Veiculo
from models.cliente import Cliente
from models.administrador import Administrador
from models.localizacao import Localizacao 
from datetime import datetime
import pytz




br_tz = pytz.timezone("America/Sao_Paulo")
veiculo_bp = Blueprint("veiculo_bp", __name__)

@veiculo_bp.route("/veiculos", methods=["GET"])
@check_subscription_status
def listar_veiculos():
    agora = datetime.now(br_tz)

    email = _get_email_from_auth_header()
    if not email:
        return jsonify([])

    veiculos = []
    
    # 1. Verifica se é Administrador
    admin = Administrador.query.filter_by(email=email).first()
    if admin:
        # Retorna veículos dos clientes criados por este admin
        veiculos = Veiculo.query.join(Cliente).filter(Cliente.administrador_id == admin.id).all()
    else:
        # 2. Verifica se é Cliente
        cliente = Cliente.query.filter_by(email=email).first()
        if cliente:
            # Retorna apenas os veículos deste cliente
            veiculos = Veiculo.query.filter_by(cliente_id=cliente.id).all()
        else:
            # Se não identificou usuário, retorna lista vazia por segurança
            return jsonify([])

    resposta = []

    for v in veiculos:
        status_gps = "Offline"
        loc = Localizacao.query.filter_by(placa=v.placa).order_by(Localizacao.timestamp.desc()).first()
        if loc and loc.timestamp:
            ts = loc.timestamp
            ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
            delta_loc = agora - ts_br
            if delta_loc.total_seconds() <= 9:
                status_gps = "Online"
            else:
                if v.ultima_atualizacao:
                    delta = agora - v.ultima_atualizacao
                    status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
        else:
            if v.ultima_atualizacao:
                delta = agora - v.ultima_atualizacao
                status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"

        resposta.append({
            "id": v.id,
            "placa": v.placa,
            "modelo": v.modelo,
            "marca": v.marca,
            "ano": v.ano,
            "status_gps": status_gps,        # ✅ correto
            "ativo": v.ativo,
            "cliente_id": v.cliente_id,
            "cliente_nome": v.cliente.nome if v.cliente else None
        })

    return jsonify(resposta)

@veiculo_bp.route("/veiculos/admin/<int:admin_id>", methods=["GET"])
def listar_veiculos_por_admin(admin_id):
    agora = datetime.now(br_tz)

    veiculos = Veiculo.query.join(Cliente).filter(Cliente.administrador_id == admin_id).all()
    resposta = []

    for v in veiculos:
        status_gps = "Offline"
        loc = Localizacao.query.filter_by(placa=v.placa).order_by(Localizacao.timestamp.desc()).first()
        if loc and loc.timestamp:
            ts = loc.timestamp
            ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
            delta_loc = agora - ts_br
            if delta_loc.total_seconds() <= 9:
                status_gps = "Online"
            else:
                if v.ultima_atualizacao:
                    delta = agora - v.ultima_atualizacao
                    status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
        else:
            if v.ultima_atualizacao:
                delta = agora - v.ultima_atualizacao
                status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"

        resposta.append({
            "id": v.id,
            "placa": v.placa,
            "modelo": v.modelo,
            "marca": v.marca,
            "ano": v.ano,
            "status_gps": status_gps,
            "ativo": v.ativo,
            "cliente_id": v.cliente_id,
            "cliente_nome": v.cliente.nome if v.cliente else None
        })

    return jsonify(resposta)

@veiculo_bp.route("/veiculos/<int:id>", methods=["GET"])
@check_subscription_status
def obter_veiculo(id):
    v = Veiculo.query.get(id)
    if not v:
        return jsonify({"error": "Veículo não encontrado"}), 404

    # Verificação de segurança
    email = _get_email_from_auth_header()
    if email:
        admin = Administrador.query.filter_by(email=email).first()
        if admin:
            # Admin só vê veículos de SEUS clientes
            if v.cliente and v.cliente.administrador_id != admin.id:
                return jsonify({"error": "Acesso não autorizado a este veículo"}), 403
        else:
            cliente = Cliente.query.filter_by(email=email).first()
            if cliente:
                # Cliente só vê SEUS veículos
                if v.cliente_id != cliente.id:
                    return jsonify({"error": "Acesso não autorizado a este veículo"}), 403
            else:
                return jsonify({"error": "Usuário não identificado"}), 403

    agora = datetime.now(br_tz)
    status_gps = "Offline"
    loc = Localizacao.query.filter_by(placa=v.placa).order_by(Localizacao.timestamp.desc()).first()
    if loc and loc.timestamp:
        ts = loc.timestamp
        ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
        delta_loc = agora - ts_br
        if delta_loc.total_seconds() <= 9:
            status_gps = "Online"
        else:
            if v.ultima_atualizacao:
                delta = agora - v.ultima_atualizacao
                status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
    else:
        if v.ultima_atualizacao:
            delta = agora - v.ultima_atualizacao
            status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"

    return jsonify({
        "id": v.id,
        "placa": v.placa,
        "modelo": v.modelo,
        "marca": v.marca,
        "ano": v.ano,
        "status_gps": status_gps,   # ✅
        "ativo": v.ativo
    })

@veiculo_bp.route("/veiculos", methods=["POST"])
def criar_veiculo():
    data = request.json

    # Segurança
    email = _get_email_from_auth_header()
    if email:
        admin = Administrador.query.filter_by(email=email).first()
        if admin:
            # Verifica se o cliente_id pertence a este admin
            cliente_id = data.get("cliente_id")
            if cliente_id:
                cliente = Cliente.query.get(cliente_id)
                if not cliente or cliente.administrador_id != admin.id:
                    return jsonify({"error": "Cliente inválido ou não pertence a este administrador"}), 403
        else:
             return jsonify({"error": "Apenas administradores podem criar veículos"}), 403

    placa_existente = Veiculo.query.filter_by(placa=data["placa"]).first()
    if placa_existente:
        return jsonify({"error": "Já existe um veículo com essa placa"}), 400
    try:
        v = Veiculo(
            cliente_id=data["cliente_id"],
            placa=data["placa"],
            modelo=data["modelo"],
            marca=data["marca"],
            ano=data["ano"],
            status_ignicao=False,
            ativo=True,
            criado_em=datetime.now(br_tz)
        )
        db.session.add(v)
        db.session.commit()
        return jsonify({"message": "Veículo criado", "id": v.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@veiculo_bp.route("/veiculos/<int:id>", methods=["DELETE"])
def deletar_veiculo(id):
    veiculo = Veiculo.query.get(id)
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    # Segurança
    email = _get_email_from_auth_header()
    if email:
        admin = Administrador.query.filter_by(email=email).first()
        if admin:
            if veiculo.cliente and veiculo.cliente.administrador_id != admin.id:
                return jsonify({"error": "Acesso não autorizado"}), 403
        else:
            return jsonify({"error": "Apenas administradores podem remover veículos"}), 403

    try:
        db.session.delete(veiculo)
        db.session.commit()
        return jsonify({"message": f"Veículo {veiculo.placa} removido com sucesso!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Erro ao remover veículo: {str(e)}"}), 500

# Rota de atualização de veículo
@veiculo_bp.route("/veiculos/<int:id>", methods=["PUT"])
def atualizar_veiculo(id):
    veiculo = Veiculo.query.get(id)
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    # Segurança
    email = _get_email_from_auth_header()
    if email:
        admin = Administrador.query.filter_by(email=email).first()
        if admin:
            if veiculo.cliente and veiculo.cliente.administrador_id != admin.id:
                return jsonify({"error": "Acesso não autorizado"}), 403
        else:
            return jsonify({"error": "Apenas administradores podem atualizar veículos"}), 403

    data = request.json

    # Se houver mudança de placa, verifica duplicidade
    if "placa" in data and data["placa"] != veiculo.placa:
        placa_existente = Veiculo.query.filter_by(placa=data["placa"]).first()
        if placa_existente:
            return jsonify({"error": "Já existe um veículo com essa placa"}), 400
        veiculo.placa = data["placa"]

    # Atualiza outros campos
    for campo in ["modelo", "marca", "ano", "status_ignicao", "ativo", "cliente_id"]:
        if campo in data:
            setattr(veiculo, campo, data[campo])

    try:
        db.session.commit()
        return jsonify({"message": "Veículo atualizado com sucesso"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    
# Listar veículos de um cliente específico
@veiculo_bp.route("/veiculos/cliente/<int:cliente_id>", methods=["GET"])
@check_subscription_status
def listar_veiculos_cliente(cliente_id):
    agora = datetime.now(br_tz)
    veiculos = Veiculo.query.filter_by(cliente_id=cliente_id).all()
    if not veiculos:
        return jsonify({"message": "Nenhum veículo encontrado para este cliente"}), 404
    
    resposta = []
    for v in veiculos:
        status_gps = "Offline"
        loc = Localizacao.query.filter_by(placa=v.placa).order_by(Localizacao.timestamp.desc()).first()
        if loc and loc.timestamp:
            ts = loc.timestamp
            ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
            delta_loc = agora - ts_br
            if delta_loc.total_seconds() <= 9:
                status_gps = "Online"
            else:
                if v.ultima_atualizacao:
                    delta = agora - v.ultima_atualizacao
                    status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
        else:
            if v.ultima_atualizacao:
                delta = agora - v.ultima_atualizacao
                status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
            
        resposta.append({
            "id": v.id,
            "placa": v.placa,
            "modelo": v.modelo,
            "marca": v.marca,
            "ano": v.ano,
            "status_gps": status_gps,
            "status_ignicao": v.status_ignicao,
            "ativo": v.ativo,
            "cliente_id": v.cliente_id,
            "cliente_nome": v.cliente.nome if v.cliente else None
        })
    return jsonify(resposta)

@veiculo_bp.route("/veiculo/<placa>", methods=["DELETE"])
def deletar_veiculo_placa(placa):
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    Localizacao.query.filter_by(placa=placa).delete()
    db.session.delete(veiculo)
    db.session.commit()

    return jsonify({"message": "Veículo e localizações removidas"})
