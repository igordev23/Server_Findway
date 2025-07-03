from flask import Blueprint, request, jsonify

mensagens_bp = Blueprint('mensagens_bp', __name__)
mensagens = []

@mensagens_bp.route("/mensagem", methods=["GET"])
def receber_mensagem():
    mensagem = request.args.get("msg")
    if mensagem:
        mensagens.append(mensagem)
        print(f"Mensagem recebida: {mensagem}")
    return "Mensagem recebida"

@mensagens_bp.route("/mensagens", methods=["GET"])
def listar_mensagens():
    return jsonify(mensagens)

@mensagens_bp.route("/reset", methods=["POST"])
def resetar_mensagens():
    global mensagens
    mensagens = []
    print("Mensagens resetadas.")
    return "Mensagens resetadas"
