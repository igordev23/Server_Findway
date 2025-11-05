import os
from flask import Flask, render_template, redirect, url_for
from config import Config
from database import db
from routes.gps_routes import gps_bp
from routes.mensagem_routes import mensagens_bp
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Inicializa o banco
db.init_app(app)

# Registra blueprints
app.register_blueprint(gps_bp)
app.register_blueprint(mensagens_bp)

# Página de login
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

# Redireciona para login por padrão
@app.route("/")
def index():
    return redirect(url_for("login"))

# Página principal pós-login
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
    return render_template("index.html", google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"], firebase_config=firebase_config)

@app.route("/historico")
def historico():
    return render_template("historico.html", google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"])

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
