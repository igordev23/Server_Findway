from database import db
from .usuario import Usuario

class Cliente(Usuario):
    __tablename__ = "Cliente"

    id = db.Column(db.BigInteger, db.ForeignKey("Usuario.id"), primary_key=True)
    administrador_id = db.Column(db.BigInteger, db.ForeignKey("Administrador.id"), nullable=False)
    rua = db.Column(db.String(255), nullable=False)
    cidade = db.Column(db.String(255), nullable=False)
    estado = db.Column(db.String(255), nullable=False)
    cep = db.Column(db.String(255), nullable=False)
    numero = db.Column(db.String(255), nullable=False)

    __mapper_args__ = {
        "polymorphic_identity": "cliente",
    }

    def __repr__(self):
        return f"<Cliente {self.nome} - {self.cidade}/{self.estado}>"
