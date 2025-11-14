from database import db

class VeiculoLocalizacao(db.Model):
    __tablename__ = "Veiculo_Localizacao"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    veiculo_id = db.Column(db.BigInteger, db.ForeignKey("Veiculo.id"), nullable=False)
    localizacao_id = db.Column(db.BigInteger, db.ForeignKey("Localizacao.id"), nullable=False)

    localizacao = db.relationship("Localizacao", backref="veiculo_associado", lazy=True)

    def __repr__(self):
        return f"<VeiculoLocalizacao Veiculo={self.veiculo_id} Localizacao={self.localizacao_id}>"
