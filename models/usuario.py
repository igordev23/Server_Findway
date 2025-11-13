from database import db
from datetime import datetime
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")

class Usuario(db.Model):
    __tablename__ = "Usuario"
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    telefone = db.Column(db.String(20), nullable=False)
    criado_em = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))
    tipo_usuario = db.Column(db.String(20), nullable=False)
    firebase_uid = db.Column(db.String(128), unique=True, nullable=True)

    __mapper_args__ = {
        "polymorphic_identity": "usuario",
        "polymorphic_on": tipo_usuario
    }

    def __repr__(self):
        return f"<Usuario {self.id} - {self.nome}>"
