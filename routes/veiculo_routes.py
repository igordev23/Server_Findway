from flask import Blueprint, request, jsonify
from database import db
from models.veiculo import Veiculo
from models.cliente import Cliente
from models.localizacao import Localizacao 
from models.log_comando import LogComando
from datetime import datetime
import pytz
import models.evento as evento

br_tz = pytz.timezone("America/Sao_Paulo")
veiculo_bp = Blueprint("veiculo_bp", __name__)

@veiculo_bp.route("/veiculos", methods=["GET"])
def listar_veiculos():
    agora = datetime.now(br_tz)

    veiculos = Veiculo.query.all()
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
def obter_veiculo(id):
    v = Veiculo.query.get(id)
    if not v:
        return jsonify({"error": "Veículo não encontrado"}), 404

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
            "cliente_id": v.cliente_id
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

# ==========================================
#  CONTROLE DE IGNIÇÃO
# ==========================================

@veiculo_bp.route("/veiculos/<placa>/comando", methods=["POST"])
def enviar_comando_por_placa(placa):
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    data = request.json
    comando = data.get("comando")  # "cortar" ou "reativar"
    pin = str(data.get("pin", "")).strip()
    cliente_id = data.get("cliente_id")

    if not comando or comando not in ["cortar", "reativar"]:
        return jsonify({"error": "Comando inválido"}), 400

    if not cliente_id:
        return jsonify({"error": "ID do cliente não fornecido"}), 400

    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({"error": "Cliente não encontrado"}), 404

    # Verifica PIN
    if not cliente.pin:
         return jsonify({"error": "PIN de segurança não configurado. Configure no seu perfil."}), 403

    if cliente.pin != pin:
        return jsonify({"error": "PIN incorreto"}), 403

    # Executa comando (Atualiza estado e Log)
    # True = Ligada (Ativada/Verde), False = Cortada (Desativada/Vermelho)
    novo_status = False if comando == "cortar" else True
    veiculo.status_ignicao = novo_status
    veiculo.ultima_atualizacao = datetime.now(br_tz)

    log = LogComando(
        veiculo_id=veiculo.id,
        comando="Corte de ignição" if comando == "cortar" else "Reativação da ignição",
        origem="App Cliente",
        status="Confirmado", 
        timestamp=datetime.now(br_tz)
    )

    # Notificação de Evento
    tipo_evento = "IGNICAO_CORTADA" if comando == "cortar" else "IGNICAO_REATIVADA"
    desc_evento = "Ignição cortada remotamente pelo usuário" if comando == "cortar" else "Ignição reativada remotamente pelo usuário"
    
    novo_evento = evento.Evento(
        veiculo_id=veiculo.id,
        tipo=tipo_evento,
        descricao=desc_evento,
        timestamp=datetime.now(br_tz)
    )

    try:
        db.session.add(log)
        db.session.add(novo_evento)
        db.session.commit()
        return jsonify({
            "message": f"Comando de {comando} enviado com sucesso!",
            "novo_status": novo_status
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Erro ao processar comando: {str(e)}"}), 500


@veiculo_bp.route("/veiculos/comando/ignicao", methods=["GET"])
def obter_comando_ignicao():
    placa = request.args.get("placa")
    if not placa:
        return jsonify({"error": "Placa não informada"}), 400

    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    return jsonify({
        "placa": placa,
        "state": "on" if veiculo.status_ignicao else "off"
    }), 200



@veiculo_bp.route("/veiculos/<int:id>/status_ignicao", methods=["GET"])
def status_ignicao(id):
    veiculo = Veiculo.query.get(id)
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    logs = LogComando.query.filter_by(veiculo_id=id).order_by(LogComando.timestamp.desc()).limit(10).all()
    
    logs_data = []
    for log in logs:
        logs_data.append({
            "data_hora": log.timestamp.strftime("%d/%m/%Y %H:%M"),
            "acao": log.comando,
            "origem": log.origem,
            "status": log.status
        })

    status_text = "Ligada" if veiculo.status_ignicao else "Cortada"
    
    return jsonify({
        "status_atual": status_text,
        "logs": logs_data
    })
