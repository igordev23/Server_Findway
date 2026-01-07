from app import app
from database import db
from models.usuario import Usuario
from models.cliente import Cliente
from models.administrador import Administrador
from datetime import date, timedelta
from werkzeug.security import generate_password_hash

def criar_cliente_vencido():
    with app.app_context():
        # 1. Buscar um administrador para vincular (obrigatório)
        admin = Administrador.query.first()
        if not admin:
            print("❌ Erro: Nenhum administrador encontrado no banco. Crie um admin primeiro.")
            return

        # 2. Verificar se o usuário já existe e remover se necessário
        email = "vencido@teste.com"
        usuario_existente = Usuario.query.filter_by(email=email).first()
        if usuario_existente:
            db.session.delete(usuario_existente)
            db.session.commit()
            print(f"🗑️ Usuário antigo {email} removido.")

        # 3. Criar Cliente Vencido
        vencimento_passado = date.today() - timedelta(days=5) # Venceu há 5 dias

        # Instancia vazia e preenche depois para evitar erro de construtor
        cliente = Cliente()
        
        # Campos de Usuario
        cliente.nome = "Cliente Teste Vencido"
        cliente.email = email
        cliente.senha = "123456"
        cliente.role = "cliente"
        cliente.telefone = "11999999999"
        
        # Campos de Cliente
        cliente.administrador_id = admin.id
        cliente.rua = "Rua Teste"
        cliente.cidade = "São Paulo"
        cliente.estado = "SP"
        cliente.cep = "01001-000"
        cliente.numero = "123"
        
        # Status de Pagamento
        cliente.subscription_status = "inadimplente"
        cliente.data_proximo_vencimento = vencimento_passado
        cliente.dia_pagamento = vencimento_passado.day
        cliente.plano_valor = 50.00
        cliente.plano_nome = "Plano Básico"

        db.session.add(cliente)
        db.session.commit()

        print(f"\n✅ Cliente criado com sucesso!")
        print(f"📧 Email: {email}")
        print(f"🔑 Senha: 123456")
        print(f"📅 Vencimento: {vencimento_passado} (Vencido)")
        print(f"💳 Status: inadimplente")

if __name__ == "__main__":
    criar_cliente_vencido()
