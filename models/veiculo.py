from datetime import datetime
import pytz
from database import db

br_tz = pytz.timezone("America/Sao_Paulo")

class Veiculo(db.Model):
    __tablename__ = "Veiculo"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    cliente_id = db.Column(db.BigInteger, db.ForeignKey("Cliente.id"), nullable=False)
    placa = db.Column(db.String(10), nullable=False, unique=True)
    modelo = db.Column(db.String(50), nullable=False)
    marca = db.Column(db.String(50), nullable=False)
    ano = db.Column(db.SmallInteger, nullable=False)
    status_ignicao = db.Column(db.Boolean, nullable=False, default=False)
    ultima_atualizacao = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    criado_em = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))

    # Relacionamentos
    localizacoes = db.relationship("VeiculoLocalizacao", backref="veiculo", lazy=True)
    eventos = db.relationship("Evento", backref="veiculo", lazy=True)

    def __repr__(self):
        return f"<Veiculo {self.placa} ({self.modelo})>"
