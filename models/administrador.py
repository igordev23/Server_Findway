from database import db
from models.usuario import Usuario

class Administrador(Usuario):
    __tablename__ = "Administrador"

    id = db.Column(db.BigInteger, db.ForeignKey("Usuario.id"), primary_key=True)

    stripe_connected_account_id = db.Column(db.String(255), unique=True, nullable=True)


    __mapper_args__ = {
        "polymorphic_identity": "administrador",
    }
