from datetime import datetime
import pytz
from database import db

br_tz = pytz.timezone("America/Sao_Paulo")

class Usuario(db.Model):
    __tablename__ = "Usuario"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    telefone = db.Column(db.String(20), nullable=False)
    criado_em = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))
    tipo_usuario = db.Column(db.String(20), nullable=False)
    firebase_uid = db.Column(db.String(128), nullable=False, unique=True)

    def __repr__(self):
        return f"<Usuario {self.nome} ({self.tipo_usuario})>"
