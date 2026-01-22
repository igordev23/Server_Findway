
from app import app, db
from models.evento import Evento
from models.veiculo import Veiculo
from sqlalchemy import text

def migrate_schema():
    with app.app_context():
        print("Iniciando migração de schema para Notificações...")
        
        # 1. Adicionar coluna cliente_id na tabela Evento
        try:
            print("Adicionando coluna 'cliente_id' em 'Evento'...")
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES "Cliente"(id)'))
                conn.commit()
        except Exception as e:
            print(f"Erro ao adicionar coluna (pode já existir): {e}")

        # 2. Popular cliente_id para eventos existentes
        print("Populando cliente_id para eventos existentes...")
        eventos = Evento.query.all()
        count = 0
        for ev in eventos:
            if ev.veiculo_id and not ev.cliente_id:
                veiculo = Veiculo.query.get(ev.veiculo_id)
                if veiculo:
                    ev.cliente_id = veiculo.cliente_id
                    count += 1
        
        db.session.commit()
        print(f"Atualizados {count} eventos com cliente_id.")

        # 3. Alterar veiculo_id para ser nullable
        try:
            print("Alterando 'veiculo_id' para NULLABLE...")
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE "Evento" ALTER COLUMN veiculo_id DROP NOT NULL'))
                conn.commit()
        except Exception as e:
            print(f"Erro ao alterar coluna veiculo_id: {e}")

        print("Migração concluída com sucesso!")

if __name__ == "__main__":
    migrate_schema()
