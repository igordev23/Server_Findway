from database import db
from sqlalchemy.sql import func

class Usuario(db.Model):
    __tablename__ = "Usuario"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    telefone = db.Column(db.String(20), nullable=False)
    criado_em = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
    tipo_usuario = db.Column(db.String(20), nullable=False)  # 'administrador' ou 'cliente'
    firebase_uid = db.Column(db.String(128), unique=True, nullable=False)

    # Configura a herança
    __mapper_args__ = {
        "polymorphic_on": tipo_usuario,
        "polymorphic_identity": "usuario"
    }

    def __repr__(self):
        return f"<Usuario {self.nome} ({self.tipo_usuario})>"
