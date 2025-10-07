import os
from flask import Flask, render_template
from config import Config
from database import db
from routes.gps_routes import gps_bp  
from routes.mensagem_routes import mensagens_bp

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)
app.register_blueprint(gps_bp)
app.register_blueprint(mensagens_bp)

with app.app_context():
    for rule in app.url_map.iter_rules():
        print(rule)




@app.route("/")
def index():
    return render_template("index.html", google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"])

@app.route("/historico")
def historico():
    return render_template("historico.html", google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"])


if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # cria as tabelas no banco
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
