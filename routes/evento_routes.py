from flask import Blueprint, request, jsonify
from database import db
from models.evento import Evento
from models.veiculo import Veiculo
from models.cliente import Cliente
from datetime import datetime
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")
evento_bp = Blueprint("evento_bp", __name__)

@evento_bp.route("/eventos", methods=["GET"])
def listar_eventos():
    eventos = Evento.query.order_by(Evento.timestamp.desc()).all()
    return jsonify([{
        "id": e.id,
        "veiculo_id": e.veiculo_id,
        "tipo": e.tipo,
        "descricao": e.descricao,
        "timestamp": e.timestamp.isoformat(),
        "lido": getattr(e, "lido", False)
    } for e in eventos])

@evento_bp.route("/eventos/<int:evento_id>/ler", methods=["POST"])
def marcar_evento_lido(evento_id):
    evento = Evento.query.get(evento_id)
    if not evento:
        return jsonify({"error": "Evento não encontrado"}), 404
    
    try:
        evento.lido = True
        db.session.commit()
        return jsonify({"message": "Evento marcado como lido"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@evento_bp.route("/eventos/admin/<int:admin_id>", methods=["GET"])
def listar_eventos_admin(admin_id):
    eventos = db.session.query(Evento).join(
        Cliente, Evento.cliente_id == Cliente.id
    ).filter(
        Cliente.administrador_id == admin_id
    ).order_by(Evento.timestamp.desc()).all()
    
    return jsonify([{
        "id": e.id,
        "veiculo_id": e.veiculo_id,
        "tipo": e.tipo,
        "descricao": e.descricao,
        "timestamp": e.timestamp.isoformat(),
        "lido": getattr(e, "lido", False)
    } for e in eventos])

@evento_bp.route("/eventos", methods=["POST"])
def criar_evento():
    data = request.json
    try:
        veiculo_id = data.get("veiculo_id")
        cliente_id = None
        if veiculo_id:
            veiculo = Veiculo.query.get(veiculo_id)
            if veiculo:
                cliente_id = veiculo.cliente_id
        
        evento = Evento(
            veiculo_id=veiculo_id,
            cliente_id=cliente_id,
            tipo=data["tipo"],
            descricao=data["descricao"],
            timestamp=datetime.now(br_tz)
        )
        db.session.add(evento)
        db.session.commit()
        return jsonify({"message": "Evento registrado", "id": evento.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@evento_bp.route("/eventos/cliente/<int:cliente_id>/ler-todos", methods=["POST"])
def marcar_todos_eventos_lido_cliente(cliente_id):
    try:
        # Busca todos os eventos não lidos deste cliente
        eventos_nao_lidos = Evento.query.filter_by(
            cliente_id=cliente_id,
            lido=False
        ).all()
        
        if not eventos_nao_lidos:
             return jsonify({"message": "Nenhum evento pendente para marcar como lido"}), 200

        for evento in eventos_nao_lidos:
            evento.lido = True
        
        db.session.commit()
        return jsonify({"message": f"{len(eventos_nao_lidos)} eventos marcados como lidos"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@evento_bp.route("/eventos/cliente/<int:cliente_id>", methods=["GET"])
def listar_eventos_cliente(cliente_id):
    eventos = Evento.query.filter_by(cliente_id=cliente_id).order_by(Evento.timestamp.desc()).all()
    
    return jsonify([{
        "id": e.id,
        "veiculo_id": e.veiculo_id,
        "tipo": e.tipo,
        "descricao": e.descricao,
        "timestamp": e.timestamp.isoformat(),
        "lido": getattr(e, "lido", False)
    } for e in eventos])

@evento_bp.route("/eventos/cliente/<int:cliente_id>/limpar", methods=["DELETE"])
def limpar_eventos_cliente(cliente_id):
    try:
        Evento.query.filter_by(cliente_id=cliente_id).delete()
        db.session.commit()
        return jsonify({"message": "Notificações removidas para o cliente", "cliente_id": cliente_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
