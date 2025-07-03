from flask import Blueprint, request, jsonify
from models.mensagem import Mensagem  # importar o modelo criado
from database import db
from datetime import datetime

mensagens_bp = Blueprint('mensagens_bp', __name__)

@mensagens_bp.route("/mensagem", methods=["GET"])
def receber_mensagem():
    texto = request.args.get("msg")
    if texto:
        nova_mensagem = Mensagem(texto=texto, timestamp=datetime.utcnow())
        db.session.add(nova_mensagem)
        db.session.commit()
        print(f"Mensagem salva no banco: {texto}")
        return jsonify(nova_mensagem.to_dict())
    return jsonify({"error": "Nenhuma mensagem recebida"}), 400

@mensagens_bp.route("/mensagens", methods=["GET"])
def listar_mensagens():
    todas = Mensagem.query.order_by(Mensagem.timestamp.desc()).all()
    return jsonify([m.to_dict() for m in todas])

@mensagens_bp.route("/reset", methods=["POST"])
def resetar_mensagens():
    num = Mensagem.query.delete()
    db.session.commit()
    print(f"{num} mensagens deletadas.")
    return jsonify({"message": f"{num} mensagens resetadas"})
