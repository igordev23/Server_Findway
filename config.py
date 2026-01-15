import os
from dotenv import load_dotenv

# Carrega o arquivo .env antes de ler as variáveis
load_dotenv()

class Config:
    use_local = os.getenv("USE_LOCAL_DB", "False").lower() == "true"

    if use_local:
        SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_LOCAL")
        print("⚙️  Usando banco LOCAL:", SQLALCHEMY_DATABASE_URI)
    else:
        SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
        print("⚙️  Usando banco REMOTO (Render):", SQLALCHEMY_DATABASE_URI)

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
    STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
    STRIPE_DEFAULT_PRICE_ID = os.getenv("STRIPE_DEFAULT_PRICE_ID")
    STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "http://localhost:5000/home?payment=success")
    STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "http://localhost:5000/pagamento-pendente?payment=canceled")
    STRIPE_CONNECT_RETURN_URL = os.getenv("STRIPE_CONNECT_RETURN_URL", "http://localhost:5000/admin/financeiro")
    STRIPE_CONNECT_REFRESH_URL = os.getenv("STRIPE_CONNECT_REFRESH_URL", "http://localhost:5000/admin/financeiro")
    STRIPE_APPLICATION_FEE_PERCENT = os.getenv("STRIPE_APPLICATION_FEE_PERCENT")

    ASSETS_ROOT = '/static/assets'

    # Configuração do Flask-Mail
    MAIL_SERVER = os.getenv("MAIL_SERVER")
    MAIL_PORT = int(os.getenv("MAIL_PORT"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS").lower() == "true"
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER") or os.getenv("MAIL_USERNAME")
