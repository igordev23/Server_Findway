from database import db

class Cliente(db.Model):
    __tablename__ = "Cliente"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    administrador_id = db.Column(db.BigInteger, db.ForeignKey("Administrador.id"), nullable=False)
    rua = db.Column(db.String(255), nullable=False)
    cidade = db.Column(db.String(255), nullable=False)
    estado = db.Column(db.String(255), nullable=False)
    cep = db.Column(db.String(255), nullable=False)
    numero = db.Column(db.String(255), nullable=False)

    # Relacionamento com veículos
    veiculos = db.relationship("Veiculo", backref="cliente", lazy=True)

    def __repr__(self):
        return f"<Cliente {self.id} - {self.cidade}/{self.estado}>"
