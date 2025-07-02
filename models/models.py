from datetime import datetime
from database import db

class GPSData(db.Model):
    __tablename__ = 'locais'  # nome da tabela

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True) 

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
