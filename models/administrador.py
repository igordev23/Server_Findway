from database import db
from .usuario import Usuario

class Administrador(Usuario):
    __tablename__ = "Administrador"

    id = db.Column(db.BigInteger, db.ForeignKey("Usuario.id"), primary_key=True)

    clientes = db.relationship("Cliente", backref="administrador", lazy=True)

    __mapper_args__ = {
        "polymorphic_identity": "administrador",
    }

    def __repr__(self):
        return f"<Administrador {self.nome}>"
