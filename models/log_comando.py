from datetime import datetime
import pytz
from database import db

br_tz = pytz.timezone("America/Sao_Paulo")

class LogComando(db.Model):
    __tablename__ = "LogComando"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    veiculo_id = db.Column(db.BigInteger, db.ForeignKey("Veiculo.id"), nullable=False)
    comando = db.Column(db.String(50), nullable=False)  # "Corte", "Reativacao"
    origem = db.Column(db.String(50), nullable=False)   # "App Cliente", "Central"
    status = db.Column(db.String(50), nullable=False)   # "Pendente", "Confirmado", "Erro"
    timestamp = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))

    # Relacionamento
    veiculo = db.relationship("Veiculo", backref="logs_comando", lazy=True)

    def __repr__(self):
        return f"<LogComando {self.comando} - {self.status}>"