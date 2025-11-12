from database import db

class Administrador(db.Model):
    __tablename__ = "Administrador"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)

    # Relacionamento com Cliente
    clientes = db.relationship("Cliente", backref="administrador", lazy=True)

    def __repr__(self):
        return f"<Administrador {self.id}>"
