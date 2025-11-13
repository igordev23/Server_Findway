from database import db
from models.usuario import Usuario

class Administrador(Usuario):
    __tablename__ = "Administrador"
    id = db.Column(db.BigInteger, db.ForeignKey("Usuario.id"), primary_key=True)

    clientes = db.relationship(
        "Cliente",
        backref="administrador",
        lazy=True,
        foreign_keys="Cliente.administrador_id"  # 👈 evita ambiguidade
    )

    __mapper_args__ = {
        "polymorphic_identity": "administrador",
    }

    def __repr__(self):
        return f"<Administrador {self.id}>"
