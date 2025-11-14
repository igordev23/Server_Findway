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
