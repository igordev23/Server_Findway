import os
from flask import Flask, render_template
from config import Config
from database import db
from routes.gps_routes import gps_bp
from routes.mensagem_routes import mensagens_bp

app = Flask(__name__)

# Configuração base (Config pode conter variáveis padrão)
app.config.from_object(Config)

# Sobrescreve a URL do banco caso esteja definida em variável de ambiente (Render)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    'postgresql://findwaybd_user:9HYkQCDNHR5FlwRKC4woOGNZZhambjdT@dpg-d3g0h61r0fns73dlfhig-a.oregon-postgres.render.com/findwaybd?sslmode=require'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa o banco
db.init_app(app)

# Registra as rotas
app.register_blueprint(gps_bp)
app.register_blueprint(mensagens_bp)

# Exibe as rotas no console para debug
with app.app_context():
    for rule in app.url_map.iter_rules():
        print(rule)

# Rotas principais
@app.route("/")
def index():
    return render_template("index.html", google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"])

@app.route("/historico")
def historico():
    return render_template("historico.html", google_maps_api_key=app.config["GOOGLE_MAPS_API_KEY"])

# Ponto de entrada
if __name__ == "__main__":
    with app.app_context():
        print("Criando tabelas no banco, se ainda não existirem...")
        db.create_all()  # Cria automaticamente a tabela 'locais'
        print("Tabelas criadas com sucesso!")
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
