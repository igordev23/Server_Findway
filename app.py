import os
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

mensagens = []
gps_data = {"latitude": 0.0, "longitude": 0.0}  # armazena a última coordenada válida recebida

@app.route("/mensagem", methods=["GET"])
def receber_mensagem():
    mensagem = request.args.get("msg")
    if mensagem:
        mensagens.append(mensagem)
        print(f"Mensagem recebida: {mensagem}")

        # Se for mensagem GPS, extrai latitude/longitude
        if "latitude=" in mensagem and "longitude=" in mensagem:
            try:
                partes = mensagem.replace("Localização GPS:", "").strip().split(",")
                lat = float(partes[0].split("=")[1])
                lon = float(partes[1].split("=")[1])
                gps_data["latitude"] = lat
                gps_data["longitude"] = lon
                print(f"GPS Atualizado: {gps_data}")
            except Exception as e:
                print("Erro ao extrair coordenadas:", e)
    return "Mensagem recebida"

@app.route("/mensagens", methods=["GET"])
def listar_mensagens():
    return jsonify(mensagens)

@app.route("/reset", methods=["POST"])
def resetar_mensagens():
    global mensagens
    mensagens = []
    print("Mensagens resetadas.")
    return "Mensagens resetadas"

@app.route("/gps", methods=["GET"])
def get_gps():
    return jsonify(gps_data)

@app.route("/", methods=["GET"])
def pagina_inicial():
    return render_template("index.html")

@app.route("/")
def index():
    google_maps_api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    return render_template("index.html", google_maps_api_key=google_maps_api_key)

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
