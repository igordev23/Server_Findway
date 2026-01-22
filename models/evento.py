from datetime import datetime
import pytz
from database import db

br_tz = pytz.timezone("America/Sao_Paulo")

class Evento(db.Model):
    __tablename__ = "Evento"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    veiculo_id = db.Column(db.BigInteger, db.ForeignKey("Veiculo.id"), nullable=True)
    cliente_id = db.Column(db.BigInteger, db.ForeignKey("Cliente.id"), nullable=True)
    tipo = db.Column(db.String(50), nullable=False)
    descricao = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))
    lido = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f"<Evento {self.tipo} - Veiculo {self.veiculo_id}>"
