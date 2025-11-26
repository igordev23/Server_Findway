from datetime import datetime
from database import db
from sqlalchemy.sql import func
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")

class Localizacao(db.Model):
    __tablename__ = "Localizacao"

    id = db.Column(db.BigInteger, primary_key=True, unique=True)
    placa = db.Column(db.String(10), db.ForeignKey("Veiculo.placa"), nullable=False)
    latitude = db.Column(db.Numeric(10, 7), nullable=False)
    longitude = db.Column(db.Numeric(10, 7), nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(br_tz))

    def to_dict(self):
        ts = self.timestamp.astimezone(br_tz) if self.timestamp.tzinfo else pytz.utc.localize(self.timestamp).astimezone(br_tz)
        return {
            "id": self.id,
            "placa": self.placa,
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "timestamp": ts.isoformat()
        }

    def __repr__(self):
        return f"<Localizacao {self.placa} ({self.latitude}, {self.longitude})>"
