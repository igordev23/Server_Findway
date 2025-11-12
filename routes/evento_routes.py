from flask import Blueprint, request, jsonify
from database import db
from models.evento import Evento
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
        "timestamp": e.timestamp.isoformat()
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
