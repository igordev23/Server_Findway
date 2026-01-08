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
        Veiculo, Evento.veiculo_id == Veiculo.id
    ).join(
        Cliente, Veiculo.cliente_id == Cliente.id
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
        evento = Evento(
            veiculo_id=data["veiculo_id"],
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
        # Busca todos os eventos não lidos dos veículos deste cliente
        eventos_nao_lidos = db.session.query(Evento).join(
            Veiculo, Evento.veiculo_id == Veiculo.id
        ).filter(
            Veiculo.cliente_id == cliente_id,
            Evento.lido == False
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
    eventos = db.session.query(Evento).join(
        Veiculo, Evento.veiculo_id == Veiculo.id
    ).filter(
        Veiculo.cliente_id == cliente_id
    ).order_by(Evento.timestamp.desc()).all()
    
    return jsonify([{
        "id": e.id,
        "veiculo_id": e.veiculo_id,
        "tipo": e.tipo,
        "descricao": e.descricao,
        "timestamp": e.timestamp.isoformat(),
        "lido": getattr(e, "lido", False)
    } for e in eventos])
