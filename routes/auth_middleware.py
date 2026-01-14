from functools import wraps
from flask import request, jsonify
import firebase_admin
from firebase_admin import auth
import os

def check_firebase_token():
    """
    Verifica o token Bearer do Firebase no header Authorization.
    Retorna o decoded_token se válido, ou lança exceção/retorna None.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Erro ao verificar token: {e}")
        return None

def require_super_admin(f):
    """
    Decorator que protege rotas exigindo que o usuário seja o Super Admin.
    O email do Super Admin deve estar na variável de ambiente SUPER_ADMIN_EMAIL.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        decoded_token = check_firebase_token()
        if not decoded_token:
            return jsonify({"error": "Acesso não autorizado. Token ausente ou inválido."}), 401

        email = decoded_token.get("email")
        super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")

        if not super_admin_email:
            # Se não estiver configurado, bloqueia por segurança
            return jsonify({"error": "Configuração de segurança incompleta no servidor."}), 500

        if not email or email.lower() != super_admin_email.lower():
            return jsonify({"error": "Acesso negado. Requer privilégios de Administrador Geral."}), 403

        return f(*args, **kwargs)
    return decorated_function