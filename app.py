import os
from flask import Flask, render_template, redirect, url_for
from config import Config
from database import db
from dotenv import load_dotenv

# Importa todos os blueprints
from routes.localizacao_routes import localizacao_bp
from routes.mensagem_routes import mensagens_bp
from routes.administrador_routes import administrador_bp
from routes.cliente_routes import cliente_bp
from routes.veiculo_routes import veiculo_bp
from routes.evento_routes import evento_bp
from routes.usuario_routes import usuario_bp
from routes.veiculo_localizacao_routes import veiculo_localizacao_bp

load_dotenv()

# Inicialização do app
app = Flask(__name__)
app.config.from_object(Config)

# Inicializa o banco
db.init_app(app)

app.register_blueprint(localizacao_bp)
app.register_blueprint(mensagens_bp)
app.register_blueprint(administrador_bp)
app.register_blueprint(cliente_bp)
app.register_blueprint(veiculo_bp)
app.register_blueprint(evento_bp)
app.register_blueprint(usuario_bp)
app.register_blueprint(veiculo_localizacao_bp)


@app.route("/login")
def login():
    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }
    return render_template("login.html", firebase_config=firebase_config)


@app.route("/")
def index():
    return redirect(url_for("login"))


@app.route("/home")
def home():
    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }
    return render_template(
        "index.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
        firebase_config=firebase_config
    )


@app.route("/historico")
def historico():
    return render_template(
        "historico.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"]
    )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
