from sqlalchemy import create_engine, text, inspect
from config import Config
from dotenv import load_dotenv

load_dotenv()

def upgrade_database():
    print(f"⚙️  Conectando ao banco de dados: {Config.SQLALCHEMY_DATABASE_URI}")
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # 1. Atualizações na tabela Cliente
        print("\nVerificando tabela 'Cliente'...")
        columns_cliente = [col['name'] for col in inspector.get_columns('Cliente')]
        
        updates_cliente = [
            ("pin", "VARCHAR(6)"),
            ("stripe_customer_id", "VARCHAR(255)"),
            ("subscription_status", "VARCHAR(50) DEFAULT 'ativo'"),
            ("dia_pagamento", "INTEGER"),
            ("plano_id", "VARCHAR(255)"),
            ("plano_nome", "VARCHAR(100)"),
            ("plano_valor", "FLOAT"),
            ("data_ultimo_pagamento", "TIMESTAMP"),
            ("data_proximo_vencimento", "TIMESTAMP"),
            ("data_inicio_cobranca", "TIMESTAMP")
        ]
        
        for col_name, col_type in updates_cliente:
            if col_name not in columns_cliente:
                print(f"⚠️  Adicionando coluna '{col_name}' na tabela 'Cliente'...")
                try:
                    conn.execute(text(f'ALTER TABLE "Cliente" ADD COLUMN {col_name} {col_type}'))
                    conn.commit()
                    print(f"✅ Coluna '{col_name}' adicionada com sucesso!")
                except Exception as e:
                    print(f"❌ Erro ao adicionar coluna '{col_name}': {e}")
                    # conn.rollback() não é sempre necessário aqui se o driver fizer autocommit ou falhar transação
            else:
                print(f"✅ Coluna '{col_name}' já existe.")

        # 2. Atualizações na tabela Evento
        print("\nVerificando tabela 'Evento'...")
        columns_evento = [col['name'] for col in inspector.get_columns('Evento')]
        
        if 'lido' not in columns_evento:
            print("⚠️  Adicionando coluna 'lido' na tabela 'Evento'...")
            try:
                conn.execute(text('ALTER TABLE "Evento" ADD COLUMN lido BOOLEAN DEFAULT FALSE'))
                conn.commit()
                print("✅ Coluna 'lido' adicionada com sucesso!")
            except Exception as e:
                print(f"❌ Erro ao adicionar coluna 'lido': {e}")
        else:
            print("✅ Coluna 'lido' já existe.")

if __name__ == "__main__":
    upgrade_database()
