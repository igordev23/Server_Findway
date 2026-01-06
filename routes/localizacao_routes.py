from flask import Blueprint, jsonify, request
from models.localizacao import Localizacao
from models.veiculo import Veiculo
from models.cliente import Cliente
from database import db
from datetime import datetime, timedelta
import pytz

localizacao_bp = Blueprint("localizacao_bp", __name__)

# Fuso horário do Brasil
br_tz = pytz.timezone("America/Sao_Paulo")


# Listar todas as localizações com dados do veículo
@localizacao_bp.route("/localizacao", methods=["GET"])
def listar_localizacoes():
    localizacoes = db.session.query(Localizacao, Veiculo).join(
        Veiculo, Localizacao.placa == Veiculo.placa
    ).all()

    agora = datetime.now(br_tz)
    resultado = []
    for loc in localizacoes:
        ts = loc.Localizacao.timestamp
        ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
        delta = agora - ts_br
        status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
        resultado.append({
            "id": loc.Localizacao.id,
            "placa": loc.Localizacao.placa,
            "veiculo_id": loc.Veiculo.id,
            "modelo": loc.Veiculo.modelo,
            "marca": loc.Veiculo.marca,
            "latitude": loc.Localizacao.latitude,
            "longitude": loc.Localizacao.longitude,
            "timestamp": ts_br.isoformat(),
            "status_gps": status_gps
        })

    return jsonify(resultado)

# Listar localizações filtradas por cliente
@localizacao_bp.route("/localizacao/cliente/<int:cliente_id>", methods=["GET"])
def listar_localizacoes_cliente(cliente_id):
    localizacoes = db.session.query(Localizacao, Veiculo).join(
        Veiculo, Localizacao.placa == Veiculo.placa
    ).filter(Veiculo.cliente_id == cliente_id).all()

    agora = datetime.now(br_tz)
    resultado = []
    for loc in localizacoes:
        ts = loc.Localizacao.timestamp
        ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
        delta = agora - ts_br
        status_gps = "Online" if delta.total_seconds() <= 9 else "Offline"
        resultado.append({
            "id": loc.Localizacao.id,
            "placa": loc.Localizacao.placa,
            "veiculo_id": loc.Veiculo.id,
            "modelo": loc.Veiculo.modelo,
            "marca": loc.Veiculo.marca,
            "latitude": loc.Localizacao.latitude,
            "longitude": loc.Localizacao.longitude,
            "timestamp": ts_br.isoformat(),
            "status_gps": status_gps
        })

    return jsonify(resultado)

# Criar uma nova localização para um veículo existente
@localizacao_bp.route("/localizacao", methods=["POST"])
def criar_localizacao():
    data = request.json
    placa = data.get("placa")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    timestamp = data.get("timestamp")

    # Verifica se o veículo existe
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado para a placa fornecida"}), 404

    # Atualiza timestamp do veículo para ficar online
    veiculo.ultima_atualizacao = datetime.now(br_tz)
    
    # Força a marcação do objeto como modificado na sessão
    db.session.add(veiculo)

    localizacao = Localizacao(
        placa=placa,
        latitude=latitude,
        longitude=longitude,
        timestamp=timestamp
    )

    try:
        db.session.add(localizacao)
        db.session.commit()
        return jsonify({
            "message": "Localização criada com sucesso",
            "id": localizacao.id,
            "placa": localizacao.placa
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@localizacao_bp.route("/localizacao/historico", methods=["GET"])
def historico_localizacao():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    dados = db.session.query(Localizacao, Veiculo).join(
        Veiculo, Localizacao.placa == Veiculo.placa
    ).filter(Localizacao.timestamp >= cutoff).order_by(Localizacao.timestamp.desc()).all()
    
    resultado = []
    for loc, veiculo in dados:
        d = loc.to_dict()
        d['veiculo_id'] = veiculo.id
        resultado.append(d)
        
    return jsonify(resultado)

@localizacao_bp.route("/localizacao/historico/admin/<int:admin_id>", methods=["GET"])
def historico_localizacao_admin(admin_id):
    cutoff = datetime.utcnow() - timedelta(hours=24)
    dados = db.session.query(Localizacao, Veiculo).join(
        Veiculo, Localizacao.placa == Veiculo.placa
    ).join(
        Cliente, Veiculo.cliente_id == Cliente.id
    ).filter(
        Cliente.administrador_id == admin_id,
        Localizacao.timestamp >= cutoff
    ).order_by(Localizacao.timestamp.desc()).all()
    
    resultado = []
    for loc, veiculo in dados:
        d = loc.to_dict()
        d['veiculo_id'] = veiculo.id
        resultado.append(d)
    
    return jsonify(resultado)


# Localização mais recente por placa
@localizacao_bp.route("/localizacao/<placa>", methods=["GET"])
def localizacao_por_placa(placa):
    localizacao = Localizacao.query.filter_by(placa=placa).order_by(Localizacao.timestamp.desc()).first()
    if not localizacao:
        return jsonify({"error": "Nenhuma localização encontrada para esta placa"}), 404
    return jsonify(localizacao.to_dict())

# Histórico de 24h por placa ou filtro personalizado
@localizacao_bp.route("/localizacao/<placa>/historico", methods=["GET"])
def historico_por_placa(placa):
    # Parâmetros opcionais para filtro
    data_filtro = request.args.get("data")       # YYYY-MM-DD
    hora_inicio = request.args.get("inicio")     # HH:MM
    hora_fim = request.args.get("fim")           # HH:MM

    query = Localizacao.query.filter(Localizacao.placa == placa)

    if data_filtro:
        try:
            # Monta horário inicio/fim baseando-se na data
            # Assumindo horário de Brasília para o input
            h_ini = hora_inicio if hora_inicio else "00:00"
            h_fim = hora_fim if hora_fim else "23:59"

            dt_inicio_str = f"{data_filtro} {h_ini}:00"
            dt_fim_str = f"{data_filtro} {h_fim}:59"

            # Converte string para datetime (naive)
            dt_inicio_naive = datetime.strptime(dt_inicio_str, "%Y-%m-%d %H:%M:%S")
            dt_fim_naive = datetime.strptime(dt_fim_str, "%Y-%m-%d %H:%M:%S")

            # Localiza como BR
            dt_inicio_br = br_tz.localize(dt_inicio_naive)
            dt_fim_br = br_tz.localize(dt_fim_naive)

            # Converte para UTC (já que o banco parece usar UTC/utcnow)
            dt_inicio_utc = dt_inicio_br.astimezone(pytz.utc).replace(tzinfo=None)
            dt_fim_utc = dt_fim_br.astimezone(pytz.utc).replace(tzinfo=None)

            query = query.filter(
                Localizacao.timestamp >= dt_inicio_utc,
                Localizacao.timestamp <= dt_fim_utc
            )
        except ValueError:
            return jsonify({"error": "Formato de data/hora inválido"}), 400
    else:
        # Padrão: últimas 24h
        cutoff = datetime.utcnow() - timedelta(hours=24)
        query = query.filter(Localizacao.timestamp >= cutoff)

    dados = query.order_by(Localizacao.timestamp.desc()).all()
    
    # Se não encontrar nada
    if not dados:
        # Se foi filtro específico, retorna lista vazia para não quebrar front
        if data_filtro:
            return jsonify([])
        # Se foi padrão 24h, mantém comportamento antigo de 404 (opcional, mas mantendo compatibilidade)
        return jsonify({"error": "Nenhuma localização encontrada para esta placa nas últimas 24h"}), 404

    return jsonify([d.to_dict() for d in dados])

@localizacao_bp.route("/localizacao/<int:id>", methods=["DELETE"])
def deletar_localizacao(id):
    loc = Localizacao.query.get(id)
    if not loc:
        return jsonify({"error": "Localização não encontrada"}), 404

    db.session.delete(loc)
    db.session.commit()
    return jsonify({"message": "Localização deletada"})


@localizacao_bp.route("/localizacao/ultimas-24h", methods=["DELETE"])
def deletar_localizacoes_24h():
    # Hora atual no fuso brasileiro
    agora_br = datetime.now(br_tz)

    # Limite: últimas 24h
    cutoff = agora_br - timedelta(hours=24)

    try:
        # Filtrar todas as localizações do período
        deletadas = Localizacao.query.filter(
            Localizacao.timestamp >= cutoff
        ).delete()

        db.session.commit()

        return jsonify({
            "message": "Localizações das últimas 24h removidas",
            "total_deletadas": deletadas
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@localizacao_bp.route("/localizacao/status/<placa>", methods=["GET"])
def info_completa(placa):
    veiculo = Veiculo.query.filter_by(placa=placa).first()
    if not veiculo:
        return jsonify({"error": "Veículo não encontrado"}), 404

    localizacao = Localizacao.query.filter_by(placa=placa)\
        .order_by(Localizacao.timestamp.desc()).first()

    if not localizacao:
        return jsonify({"error": "Nenhuma localização encontrada"}), 404

    agora = datetime.now(br_tz)

    ts = localizacao.timestamp
    ts_br = ts.astimezone(br_tz) if ts.tzinfo else pytz.utc.localize(ts).astimezone(br_tz)
    delta_loc = agora - ts_br
    if delta_loc.total_seconds() <= 9:
        status = "Online"
    else:
        if veiculo.ultima_atualizacao:
            delta = agora - veiculo.ultima_atualizacao
            status = "Online" if delta.total_seconds() <= 9 else "Offline"
        else:
            status = "Offline"

    return jsonify({
        "placa": veiculo.placa,
        "status_gps": status,
        "latitude": localizacao.latitude,
        "longitude": localizacao.longitude,
        "timestamp": ts_br.isoformat(),
        "ultima_atualizacao": veiculo.ultima_atualizacao.isoformat() if veiculo.ultima_atualizacao else None
    })
