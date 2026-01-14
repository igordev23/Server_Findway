from app import app
from database import db
from models.administrador import Administrador
from models.cliente import Cliente
from datetime import datetime, date
import os
import pytz
import firebase_admin
from firebase_admin import credentials, auth


def init_firebase_admin():
    if not firebase_admin._apps:
        cred_path = os.getenv("FIREBASE_CREDENTIALS")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")


def get_or_create_firebase_user(email, password, display_name):
    try:
        user = auth.get_user_by_email(email)
        return user
    except auth.UserNotFoundError:
        user = auth.create_user(email=email, password=password, display_name=display_name)
        return user


def criar_admin_e_clientes_inadimplentes():
    br_tz = pytz.timezone("America/Sao_Paulo")
    init_firebase_admin()
    demo_password = os.getenv("DEMO_USER_PASSWORD", "Senha123!")

    with app.app_context():
        admin_email = "admin.demo@findway.com"
        admin = Administrador.query.filter_by(email=admin_email).first()

        fb_admin_user = get_or_create_firebase_user(admin_email, demo_password, "Admin Demo")

        if not admin:
            admin = Administrador(
                nome="Admin Demo",
                email=admin_email,
                telefone="11999999999",
                tipo_usuario="administrador",
                firebase_uid=fb_admin_user.uid,
                criado_em=datetime.now(br_tz),
            )
            db.session.add(admin)
            db.session.commit()
        else:
            if not getattr(admin, "firebase_uid", None):
                admin.firebase_uid = fb_admin_user.uid
                db.session.commit()

        base_nome = "Cliente Inadimplente"
        hoje = date.today()

        for idx in range(1, 6):
            email = f"cliente{idx}.inadimplente@findway.com"
            cliente = Cliente.query.filter_by(email=email).first()
            display_name = f"{base_nome} {idx}"

            fb_cliente_user = get_or_create_firebase_user(email, demo_password, display_name)

            if cliente:
                if not getattr(cliente, "firebase_uid", None):
                    cliente.firebase_uid = fb_cliente_user.uid
                cliente.subscription_status = "inadimplente"
                db.session.commit()
                continue

            cliente = Cliente(
                nome=display_name,
                email=email,
                telefone=f"1190000{idx:04d}",
                tipo_usuario="cliente",
                firebase_uid=fb_cliente_user.uid,
                criado_em=datetime.now(br_tz),
                administrador_id=admin.id,
                rua="Rua Demo",
                cidade="São Paulo",
                estado="SP",
                cep="00000-000",
                numero=str(idx),
                stripe_customer_id=None,
                subscription_status="inadimplente",
                dia_pagamento=15,
                plano_nome="Plano Demo",
                plano_valor=49.90,
                data_ultimo_pagamento=None,
                data_proximo_vencimento=hoje.replace(day=1),
                data_inicio_cobranca=hoje.replace(day=1),
            )
            db.session.add(cliente)

        db.session.commit()


if __name__ == "__main__":
    criar_admin_e_clientes_inadimplentes()
