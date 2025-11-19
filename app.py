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


<<<<<<< Updated upstream
@app.route("/login")
def login():
    firebase_config = {
=======
def get_firebase_config():
    """Retorna o dicionário de configuração do Firebase para injetar nos templates."""
    return {
>>>>>>> Stashed changes
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }
<<<<<<< Updated upstream
    return render_template("login.html", firebase_config=firebase_config)
=======


def render_with_firebase(template_name, **context):
    """
    Helper que garante que todos os templates recebam o firebase_config.
    O auth-check.js usa esse objeto para proteger as rotas no front-end.
    """
    context.setdefault("firebase_config", get_firebase_config())
    return render_template(template_name, **context)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        return render_with_firebase("login.html")
    return render_with_firebase("login.html")
>>>>>>> Stashed changes


@app.route("/")
def index():
    return redirect(url_for("login"))


@app.route("/home")
def home():
    return render_with_firebase(
        "index.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
    )


@app.route("/historico")
def historico():
    # Mantém a rota antiga apontando para a nova tela de histórico de rotas.
    return render_with_firebase(
        "cliente/historico_rotas.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
    )


# -------- Rotas da experiência do cliente --------

@app.route("/cliente/tempo-real")
def cliente_tempo_real():
    return render_with_firebase(
        "cliente/tempo_real.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
    )


@app.route("/cliente/historico-rotas")
def cliente_historico_rotas():
    return render_with_firebase(
        "cliente/historico_rotas.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
    )


@app.route("/cliente/ignicao")
def cliente_ignicao():
    return render_with_firebase("cliente/ignicao.html")


@app.route("/cliente/notificacoes")
def cliente_notificacoes():
    return render_with_firebase("cliente/notificacoes.html")


@app.route("/cliente/configuracoes-seguranca")
def cliente_configuracoes_seguranca():
    return render_with_firebase("cliente/configuracoes_seguranca.html")


# -------- Rotas da experiência administrativa --------

@app.route("/admin/dashboard")
def admin_dashboard():
    return render_with_firebase("admin/dashboard.html")


@app.route("/admin/veiculos")
def admin_veiculos():
    return render_with_firebase(
        "admin/veiculos_ativos.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
    )


@app.route("/admin/clientes")
def admin_clientes():
    return render_with_firebase("admin/gestao_clientes.html")


@app.route("/admin/relatorios")
def admin_relatorios():
    return render_with_firebase("admin/relatorios.html")


@app.route("/admin/monitoramento")
def admin_monitoramento():
    return render_with_firebase(
        "admin/monitoramento.html",
        google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"],
    )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
