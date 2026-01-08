import os
import stripe
from functools import wraps
from flask import request, jsonify, redirect, url_for
from models.cliente import Cliente
from models.usuario import Usuario
from models.administrador import Administrador
from database import db
import firebase_admin
from firebase_admin import credentials, auth


def _init_firebase_admin():
    if not firebase_admin._apps:
        cred_path = os.getenv("FIREBASE_CREDENTIALS")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            raise RuntimeError("Credenciais Firebase não encontradas. Configure FIREBASE_CREDENTIALS no .env")


def _get_email_from_auth_header():
    try:
        _init_firebase_admin()
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            decoded = auth.verify_id_token(token)
            return decoded.get("email")
    except Exception:
        return None
    return None


def check_subscription_status(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        email = _get_email_from_auth_header()
        if not email:
            return jsonify({"error": "Autenticação necessária"}), 401

        user = Usuario.query.filter_by(email=email).first()
        if user and getattr(user, "tipo_usuario", None) == "administrador":
            return f(*args, **kwargs)

        cliente = Cliente.query.filter_by(email=email).first()
        if not cliente:
            return jsonify({"error": "Cliente não encontrado"}), 404

        status = getattr(cliente, "subscription_status", "ativo")
        if status in ("inadimplente", "cancelado"):
            return jsonify({"error": "Pagamento pendente. Regularize sua assinatura para continuar."}), 403

        return f(*args, **kwargs)
    return wrapper


def check_payment_status(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Tenta obter o email do usuário logado via Firebase
        try:
            _init_firebase_admin()
            # Pega o token do cookie primeiro (para rotas de página)
            token = request.cookies.get("firebase_token")
            email = None
            
            if token:
                decoded = auth.verify_id_token(token)
                email = decoded.get("email")
            
            if not email:
                # Fallback: tenta do header Authorization (para APIs)
                auth_header = request.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header.split(" ", 1)[1]
                    decoded = auth.verify_id_token(token)
                    email = decoded.get("email")
            
            if not email:
                # Se não conseguir o email, permite acesso (fallback)
                return f(*args, **kwargs)
            
            # Verifica se é administrador
            user = Usuario.query.filter_by(email=email).first()
            if user and getattr(user, "tipo_usuario", None) == "administrador":
                return f(*args, **kwargs)
            
            # Verifica status do cliente
            cliente = Cliente.query.filter_by(email=email).first()
            if cliente:
                # Verifica se há retorno de pagamento (sucesso) na URL para liberar imediatamente
                session_id = request.args.get("session_id")
                payment_status_param = request.args.get("payment")
                
                if payment_status_param == "success" and session_id:
                    try:
                        stripe.api_key = os.getenv("STRIPE_API_KEY")
                        print(f"[DEBUG] Verificando sessão {session_id} no middleware...")
                        session = stripe.checkout.Session.retrieve(session_id)
                        
                        # Verifica se a sessão pertence ao usuário logado para evitar fraudes
                        sess_customer = session.get("customer")
                        sess_email = session.get("customer_email") or (session.get("customer_details") or {}).get("email")
                        
                        is_owner = False
                        if sess_customer and sess_customer == cliente.stripe_customer_id:
                            is_owner = True
                        elif sess_email and sess_email == cliente.email:
                            is_owner = True
                            
                        if is_owner and session.get("payment_status") == "paid":
                            print(f"[DEBUG] Pagamento confirmado na sessão {session_id}. Liberando cliente {email}.")
                            cliente.subscription_status = "ativo"
                            cliente.registrar_pagamento()
                            db.session.commit()
                            # Redireciona para a mesma URL sem query params para efetivar o acesso limpo
                            return redirect(request.path)
                        elif not is_owner:
                            print(f"[DEBUG] Sessão {session_id} não pertence ao usuário {email}. Ignorando.")
                            
                    except Exception as e:
                        print(f"[DEBUG] Erro ao validar sessão no middleware: {e}")

                # Usa o novo método de verificação de pagamento
                status_pagamento_em_dia = cliente.verificar_status_pagamento()
                status_atual = (getattr(cliente, "subscription_status", "ativo") or "ativo").strip().lower()
                
                # Se não está em dia, mas o status ainda consta como ativo, atualiza para inadimplente
                if not status_pagamento_em_dia and status_atual == "ativo":
                    print(f"[DEBUG] Atualizando status de {email} para inadimplente no banco.")
                    cliente.subscription_status = "inadimplente"
                    db.session.commit()
                    status_atual = "inadimplente"
                
                print(f"[DEBUG] Cliente {email} - Status atual: {status_atual}, Pagamento em dia: {status_pagamento_em_dia}")
                
                # Se não está em dia com o pagamento, redireciona
                if (not status_pagamento_em_dia) or (status_atual in ("inadimplente", "cancelado", "bloqueado")):
                    print(f"[DEBUG] Redirecionando {email} para pagamento pendente (vencido)")
                    if request.args.get("payment") == "success":
                        # Preserva session_id se existir, para verificação no frontend
                        session_id = request.args.get("session_id")
                        if session_id:
                            return redirect(url_for("pagamento_pendente", payment="success", session_id=session_id))
                        return redirect(url_for("pagamento_pendente", payment="success"))
                    return redirect(url_for("pagamento_pendente"))
                else:
                    print(f"[DEBUG] Cliente {email} com pagamento em dia, permitindo acesso")
            else:
                print(f"[DEBUG] Cliente não encontrado para email: {email}")
            
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"[DEBUG] Erro no middleware check_payment_status: {e}")
            return f(*args, **kwargs)
    
    return wrapper


def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        email = _get_email_from_auth_header()
        if not email:
            return jsonify({"error": "Autenticação necessária"}), 401
        admin = Administrador.query.filter_by(email=email).first()
        if not admin:
            return jsonify({"error": "Acesso restrito a administradores"}), 403
        return f(*args, **kwargs)
    return wrapper



