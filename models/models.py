from datetime import datetime
from database import db

from sqlalchemy.sql import func
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")

class GPSData(db.Model):
    __tablename__ = 'locais'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    # Use func.now() para pegar o horário direto do banco
    timestamp = db.Column(
        db.DateTime(timezone=True), 
        default=lambda: datetime.now(br_tz), 
        index=True
    )

    def to_dict(self):
        # Força conversão para Brasil ao retornar
        if self.timestamp.tzinfo is None:
            # Adiciona timezone se estiver "naive"
            timestamp = pytz.utc.localize(self.timestamp).astimezone(br_tz)
        else:
            timestamp = self.timestamp.astimezone(br_tz)

        return {
            "id": self.id,
            "nome": self.nome,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": timestamp.isoformat()
        }
