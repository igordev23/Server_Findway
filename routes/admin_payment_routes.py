from flask import Blueprint, request, jsonify, redirect, url_for
from models.administrador import Administrador
from database import db
from middlewares import _get_email_from_auth_header
from config import Config
import stripe
import os

admin_bp = Blueprint("admin_bp", __name__)

stripe.api_key = os.getenv("STRIPE_API_KEY")

def _get_logged_admin():
    email = _get_email_from_auth_header()
    if not email:
        return None
    return Administrador.query.filter_by(email=email).first()

@admin_bp.route("/admin/stripe-connect/status", methods=["GET"])
def stripe_connect_status():
    """Verificar status da conexão Stripe Connect do administrador"""
    try:
        admin = _get_logged_admin()
        if not admin:
             return jsonify({"error": "Administrador não identificado"}), 401
        
        if getattr(admin, "stripe_connected_account_id", None):
            account_id = admin.stripe_connected_account_id
            
            # Tenta buscar os dados reais no Stripe para confirmar se a conta existe e é válida
            try:
                account = stripe.Account.retrieve(account_id)
                
                return jsonify({
                    "connected": True,
                    "accountId": account.id,
                    "charges_enabled": account.charges_enabled,
                    "payouts_enabled": account.payouts_enabled,
                    "details_submitted": account.details_submitted,
                    "requirements": account.requirements
                })
            except stripe.error.PermissionError:
                # O ID existe mas não pertence a esta chave de API (provavelmente ID antigo de teste)
                # Vamos limpar do banco para permitir criar uma nova
                admin.stripe_connected_account_id = None
                db.session.commit()
                return jsonify({
                    "connected": False,
                    "accountId": None,
                    "message": "Conta antiga inválida removida. Tente conectar novamente."
                })
            except stripe.error.InvalidRequestError:
                # O ID não existe no Stripe
                admin.stripe_connected_account_id = None
                db.session.commit()
                return jsonify({
                    "connected": False,
                    "accountId": None,
                    "message": "Conta não encontrada. Tente conectar novamente."
                })
        else:
            return jsonify({
                "connected": False,
                "accountId": None
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/admin/stripe-connect/create-link", methods=["POST"])
def stripe_connect_create_link():
    """Criar link para conexão Stripe Connect"""
    try:
        admin = _get_logged_admin()
        if not admin:
            return jsonify({"error": "Administrador não encontrado ou não autenticado"}), 404
        
        # Verificar se admin já tem uma conta Stripe Connect
        account_id = getattr(admin, "stripe_connected_account_id", None)
        
        if not account_id:
            # Se não tiver, cria uma conta Express nova
            account = stripe.Account.create(
                type="express",
                country="BR",
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )
            account_id = account.id
            
            # Salvar no banco
            admin.stripe_connected_account_id = account_id
            db.session.commit()

        # Criar link de conexão Stripe Connect (onboarding ou update)
        refresh_url = Config.STRIPE_CONNECT_REFRESH_URL
        return_url = Config.STRIPE_CONNECT_RETURN_URL
        
        account_link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
        
        return jsonify({"url": account_link.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/admin/stripe-connect/disconnect", methods=["POST"])
def stripe_connect_disconnect():
    """Desconectar conta Stripe Connect"""
    try:
        admin = _get_logged_admin()
        if not admin:
            return jsonify({"error": "Administrador não encontrado"}), 404
        
        # Limpar o ID da conta conectada
        admin.stripe_connected_account_id = None
        db.session.commit()
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/admin/payment-config", methods=["GET"])
def get_payment_config():
    """Obter configurações de pagamento do administrador"""
    try:
        admin = _get_logged_admin()
        if not admin:
            return jsonify({"error": "Administrador não encontrado"}), 404
        
        # Configurações padrão (em um sistema real, estariam no banco)
        config = {
            "payment_methods": {
                "card": True,
                "pix": True,
                "boleto": False
            },
            "billing_day": getattr(admin, "billing_day", 15),
            "billing_time": getattr(admin, "billing_time", "18:00"),
            "application_fee": getattr(admin, "application_fee", 5.0),
            "late_fee": getattr(admin, "late_fee", 2.0)
        }
        
        return jsonify(config)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/admin/payment-config", methods=["POST"])
def save_payment_config():
    """Salvar configurações de pagamento do administrador"""
    try:
        data = request.get_json(force=True)
        
        admin = _get_logged_admin()
        if not admin:
            return jsonify({"error": "Administrador não encontrado"}), 404
        
        # Salvar configurações (em um sistema real, estariam no banco)
        admin.billing_day = data.get("billing_day", 15)
        admin.billing_time = data.get("billing_time", "18:00")
        admin.application_fee = data.get("application_fee", 5.0)
        admin.late_fee = data.get("late_fee", 2.0)
        
        # Adicionar campos para formas de pagamento se não existirem
        if not hasattr(admin, 'payment_methods'):
            # Em um sistema real, isso seria um campo JSON no banco
            pass
        
        db.session.commit()
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/admin/payment-config")
def payment_config_page():
    """Página de configurações de pagamento"""
    return render_with_firebase("admin/payment_config.html")
