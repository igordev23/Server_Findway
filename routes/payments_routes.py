import os
import json
import stripe
from flask import Blueprint, request, jsonify, current_app
from database import db
from models.cliente import Cliente
from models.administrador import Administrador
from middlewares import require_admin, _get_email_from_auth_header

payments_bp = Blueprint("payments_bp", __name__)

stripe.api_key = os.getenv("STRIPE_API_KEY")

def _can_transfer_to_account(acct_id: str) -> bool:
    try:
        acct = stripe.Account.retrieve(acct_id)
        caps = acct.get("capabilities") or {}
        return (caps.get("transfers") == "active") or (caps.get("legacy_payments") == "active")
    except Exception:
        return False


@payments_bp.route("/payments/create-checkout-session", methods=["POST"])
def create_checkout_session():
    print("[DEBUG] create_checkout_session chamado")
    try:
        data = request.get_json(force=True)
        print(f"[DEBUG] Data recebida: {data}")
    except Exception as e:
        print(f"[DEBUG] Erro ao fazer parse JSON: {e}")
        return jsonify({"error": "JSON inválido"}), 400

    customer_id = (data or {}).get("customerId")
    price_id = (data or {}).get("priceId")
    customer_email = (data or {}).get("customerEmail")
    one_time = bool((data or {}).get("one_time"))

    print(f"[DEBUG] customerId: {customer_id}, price_id: {price_id}, customer_email: {customer_email}")

    if not price_id:
        print("[DEBUG] price_id não fornecido")
        return jsonify({"error": "Parâmetro ausente: priceId"}), 400

    if not stripe.api_key:
        print("[DEBUG] Stripe API key não configurada")
        return jsonify({"error": "Stripe API Key não configurada"}), 500

    # Busca o cliente pelo email para ter a associação com administrador
    cliente = None
    if customer_email:
        cliente = Cliente.query.filter_by(email=customer_email).first()
        print(f"[DEBUG] Cliente encontrado pelo email: {cliente is not None}")

    try:
        # Se for pagamento pontual (one_time), usamos Checkout "payment" e habilitamos pix
        if one_time:
            price = stripe.Price.retrieve(price_id, expand=["product"])
            unit_amount = price.get("unit_amount")
            currency = price.get("currency") or "brl"
            product = price.get("product")
            name = (product.get("name") if isinstance(product, dict) else "Mensalidade Findway")
            if not unit_amount:
                return jsonify({"error": "Price inválido (sem unit_amount)"}), 400
            enable_pix = (os.getenv("ENABLE_PIX") or "").strip().lower() in ("1", "true", "yes")
            payment_types = ["card", "boleto", "picpay"]
            if enable_pix:
                payment_types.append("pix")
            params = {
                "mode": "payment",
                "payment_method_types": payment_types,
                "line_items": [{
                    "price_data": {
                        "currency": currency,
                        "product_data": {"name": name},
                        "unit_amount": unit_amount,
                    },
                    "quantity": 1
                }],
                "success_url": os.getenv("STRIPE_SUCCESS_URL", "http://localhost:5000/home?payment=success&session_id={CHECKOUT_SESSION_ID}"),
                "cancel_url": os.getenv("STRIPE_CANCEL_URL", "http://localhost:5000/pagamento-pendente?payment=canceled"),
            }
        else:
            params = {
                "mode": "subscription",
                "line_items": [{"price": price_id, "quantity": 1}],
                "success_url": os.getenv("STRIPE_SUCCESS_URL", "http://localhost:5000/home?payment=success&session_id={CHECKOUT_SESSION_ID}"),
                "cancel_url": os.getenv("STRIPE_CANCEL_URL", "http://localhost:5000/pagamento-pendente?payment=canceled"),
            }
        
        # Se tiver customer_id, usa. Senão, cria com email
        if customer_id:
            params["customer"] = customer_id
            print(f"[DEBUG] Usando customer_id: {customer_id}")
        elif customer_email:
            params["customer_email"] = customer_email
            print(f"[DEBUG] Usando customer_email: {customer_email}")
        else:
            print("[DEBUG] Nem customerId nem customerEmail fornecidos")
            return jsonify({"error": "É necessário customerId ou customerEmail"}), 400

        # Se não tiver customer_id, cria um automaticamente com o email do cliente
        if not customer_id and customer_email:
            print(f"[DEBUG] Criando Stripe customer automaticamente para: {customer_email}")
            try:
                customer_data = {
                    "email": customer_email,
                    "metadata": {
                        'administrador_id': str(cliente.administrador_id) if cliente else None,
                        'created_by': 'payment_flow'
                    }
                }
                # Se encontrou o cliente no banco, adiciona o nome para ficar correto na fatura Stripe
                if cliente and cliente.nome:
                    customer_data["name"] = cliente.nome

                customer = stripe.Customer.create(**customer_data)
                customer_id = customer.id
                print(f"[DEBUG] Stripe customer criado: {customer_id}")
                
                # Atualiza o cliente no banco com o stripe_customer_id
                if cliente:
                    cliente.stripe_customer_id = customer_id
                    db.session.commit()
                    print(f"[DEBUG] Cliente atualizado com stripe_customer_id")
                
            except Exception as e:
                print(f"[DEBUG] Erro ao criar Stripe customer: {e}")
                # Continua sem customer_id se der erro
        
        # Transferência automática para o admin (Stripe Connect - destino)
        if customer_id and not one_time:  # Transfer em subscription flow
            # Se não tiver o cliente carregado, busca novamente
            if not cliente:
                cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
            
            if cliente and getattr(cliente, "administrador_id", None):
                admin = Administrador.query.get(cliente.administrador_id)
                dest = getattr(admin, "stripe_connected_account_id", None)
                if dest:
                    if _can_transfer_to_account(dest):
                        try:
                            subscription_data = {"transfer_data": {"destination": dest}}
                            fee_percent = os.getenv("STRIPE_APPLICATION_FEE_PERCENT")
                            if fee_percent:
                                try:
                                    subscription_data["application_fee_percent"] = float(fee_percent)
                                except Exception:
                                    pass
                            params["subscription_data"] = subscription_data
                            print(f"[DEBUG] Transferência configurada para {dest}")
                        except Exception as e:
                            print(f"[DEBUG] Erro ao configurar transferência: {e}")
                    else:
                        print(f"[DEBUG] Conta {dest} sem capacidades de transfer, usando conta principal")
            else:
                print(f"[DEBUG] Cliente não encontrado ou não tem admin associado")
        else:
            print(f"[DEBUG] Transferência automática desativada - pagamento vai para conta principal")

        print(f"[DEBUG] Criando sessão com params: {params}")
        try:
            session = stripe.checkout.Session.create(**params)
        except stripe.error.InvalidRequestError as e:
            msg = (str(e) or "").lower()
            if one_time:
                try:
                    pmts = list(params.get("payment_method_types") or [])
                    invalids = [t for t in pmts if (f"{t} is invalid" in msg) or (f"provided: {t} is invalid" in msg)]
                    if invalids:
                        params["payment_method_types"] = [p for p in pmts if p not in invalids]
                        if not params["payment_method_types"]:
                            params["payment_method_types"] = ["card", "boleto"]
                        print(f"[DEBUG] Removendo métodos inválidos {invalids}. Tentando novamente.")
                        session = stripe.checkout.Session.create(**params)
                    else:
                        # fallback genérico: mantém só métodos suportados amplamente
                        params["payment_method_types"] = ["card", "boleto"]
                        print("[DEBUG] Fallback genérico sem métodos não habilitados. Tentando novamente.")
                        session = stripe.checkout.Session.create(**params)
                except Exception as e2:
                    raise e2
            else:
                raise e
        print(f"[DEBUG] Sessão criada com sucesso: {session.url}")
        current_app.logger.info(f"Stripe Checkout Session criada para customer={customer_id}")
        return jsonify({"url": session.url}), 200
    except Exception as e:
        print(f"[DEBUG] Erro ao criar Checkout Session: {e}")
        current_app.logger.error(f"Erro ao criar Checkout Session: {e}")
        return jsonify({"error": f"Falha ao criar sessão de pagamento: {str(e)}"}), 500


@payments_bp.route("/webhooks/stripe", methods=["POST"])
def stripe_webhook():
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not endpoint_secret:
        return jsonify({"error": "Webhook secret não configurado"}), 500

    payload = request.data
    sig_header = request.headers.get("Stripe-Signature")

    try:
        event = stripe.webhooks.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=endpoint_secret,
        )
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Assinatura inválida"}), 400
    except Exception:
        return jsonify({"error": "Payload inválido"}), 400

    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {})

    try:
        if event_type == "invoice.payment_succeeded":
            customer_id = obj.get("customer")
            if customer_id:
                cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
                if cliente:
                    # Atualiza status e datas de vencimento para garantir desbloqueio
                    try:
                        cliente.registrar_pagamento()
                        cliente.subscription_status = "ativo"
                        db.session.commit()
                        current_app.logger.info(f"Pagamento de assinatura confirmado. Cliente {cliente.email} desbloqueado e datas atualizadas.")
                    except Exception as e:
                        db.session.rollback()
                        current_app.logger.error(f"Erro ao atualizar pagamento de assinatura: {e}")
        elif event_type == "invoice.payment_failed":
            customer_id = obj.get("customer")
            if customer_id:
                cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
                if cliente:
                    cliente.subscription_status = "inadimplente"
                    db.session.commit()
                    current_app.logger.warning(f"Pagamento falhou. Cliente {cliente.email} marcado como inadimplente.")
        elif event_type == "customer.subscription.deleted":
            customer_id = obj.get("customer")
            if customer_id:
                cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
                if cliente:
                    cliente.subscription_status = "cancelado"
                    db.session.commit()
                    current_app.logger.warning(f"Assinatura cancelada. Cliente {cliente.email} bloqueado.")
        elif event_type == "payment_intent.succeeded":
            metadata = obj.get("metadata") or {}
            customer_email = metadata.get("customer_email")
            if customer_email:
                cliente = Cliente.query.filter_by(email=customer_email).first()
                if cliente:
                    try:
                        cliente.registrar_pagamento()
                        cliente.subscription_status = "ativo"
                        db.session.commit()
                        current_app.logger.info(f"PIX confirmado. Cliente {cliente.email} desbloqueado.")
                    except Exception as e:
                        db.session.rollback()
                        current_app.logger.error(f"Erro ao registrar pagamento PIX: {e}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao atualizar status de assinatura: {e}")

    return jsonify({"received": True}), 200


@payments_bp.route("/payments/create-pix-payment", methods=["POST"])
def create_pix_payment():
    if not stripe.api_key:
        return jsonify({"error": "Stripe API Key não configurada"}), 500
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "JSON inválido"}), 400
    amount_brl = (data or {}).get("amount_brl")
    customer_email = (data or {}).get("customerEmail")
    description = (data or {}).get("description") or "Mensalidade Findway"
    if amount_brl is None or not customer_email:
        return jsonify({"error": "Parâmetros ausentes: amount_brl, customerEmail"}), 400
    try:
        amount = int(round(float(amount_brl) * 100))
    except Exception:
        return jsonify({"error": "amount_brl inválido"}), 400
    cliente = Cliente.query.filter_by(email=customer_email).first()
    metadata = {
        "customer_email": customer_email,
        "cliente_id": str(cliente.id) if cliente else "",
    }
    transfer_kwargs = {}
    if cliente and getattr(cliente, "administrador_id", None):
        admin = Administrador.query.get(cliente.administrador_id)
        dest = getattr(admin, "stripe_connected_account_id", None)
        if dest and _can_transfer_to_account(dest):
            transfer_kwargs["transfer_data"] = {"destination": dest}
            fee_percent = os.getenv("STRIPE_APPLICATION_FEE_PERCENT")
            try:
                if fee_percent:
                    pct = float(fee_percent)
                    fee_amount = int(round(amount * (pct / 100.0)))
                    transfer_kwargs["application_fee_amount"] = fee_amount
            except Exception:
                pass
    try:
        pi = stripe.PaymentIntent.create(
            amount=amount,
            currency="brl",
            payment_method_types=["pix"],
            description=description,
            metadata=metadata,
            **transfer_kwargs,
        )
        next_action = pi.get("next_action") or {}
        pix_info = next_action.get("pix_display_qr_code") or next_action.get("pix_qr_code") or {}
        image_url = pix_info.get("image_url_png") or pix_info.get("qr_code_url")
        code = pix_info.get("code") or pix_info.get("qr_code")
        return jsonify({
            "client_secret": pi.get("client_secret"),
            "payment_intent_id": pi.get("id"),
            "pix_qr_image_url": image_url,
            "pix_code": code,
        }), 200
    except Exception as e:
        current_app.logger.error(f"Erro ao criar PaymentIntent PIX: {e}")
        return jsonify({"error": "Falha ao criar pagamento PIX"}), 500

@payments_bp.route("/payments/create-plan", methods=["POST"])
@require_admin
def create_plan():
    if not stripe.api_key:
        return jsonify({"error": "Stripe API Key não configurada"}), 500

    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "JSON inválido"}), 400

    name = (data or {}).get("name")
    amount_brl = (data or {}).get("amount_brl")  # em reais
    currency = (data or {}).get("currency", "brl")
    interval = (data or {}).get("interval", "month")

    if not name or amount_brl is None:
        return jsonify({"error": "Parâmetros ausentes: name, amount_brl"}), 400

    try:
        unit_amount = int(round(float(amount_brl) * 100))
    except Exception:
        return jsonify({"error": "amount_brl inválido"}), 400

    try:
        product = stripe.Product.create(name=name)
        price = stripe.Price.create(
            product=product.get("id"),
            unit_amount=unit_amount,
            currency=currency,
            recurring={"interval": interval},
        )
        current_app.logger.info(f"Plano criado: product={product.get('id')} price={price.get('id')}")
        return jsonify({
            "product_id": product.get("id"),
            "price_id": price.get("id"),
            "name": product.get("name"),
            "amount_brl": amount_brl,
            "currency": currency,
            "interval": interval,
        }), 201
    except Exception as e:
        current_app.logger.error(f"Erro ao criar plano Stripe: {e}")
        return jsonify({"error": "Falha ao criar plano"}), 500


@payments_bp.route("/payments/prices", methods=["GET"])
def list_prices():
    if not stripe.api_key:
        return jsonify({"error": "Stripe API Key não configurada"}), 500
    try:
        prices = stripe.Price.list(active=True, expand=["data.product"], limit=50)
        items = []
        for p in prices.get("data", []):
            rec = p.get("recurring") or {}
            if rec.get("interval") != "month":
                continue
            product = p.get("product")
            items.append({
                "price_id": p.get("id"),
                "product_id": product.get("id") if isinstance(product, dict) else None,
                "name": product.get("name") if isinstance(product, dict) else None,
                "amount_brl": (p.get("unit_amount") or 0) / 100.0,
                "currency": p.get("currency"),
                "interval": rec.get("interval"),
                "active": p.get("active"),
            })
        return jsonify(items), 200
    except Exception as e:
        current_app.logger.error(f"Erro ao listar prices: {e}")
        return jsonify({"error": "Falha ao listar prices"}), 500


@payments_bp.route("/payments/check-session/<session_id>", methods=["GET"])
def check_session_status(session_id):
  
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        payment_status = session.get("payment_status")
        
        if payment_status == "paid":
            # Pagamento confirmado! Vamos liberar o cliente.
            customer_id = session.get("customer")
            customer_email = session.get("customer_email") or (session.get("customer_details") or {}).get("email")
            
            cliente = None
            if customer_id:
                cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
            
            if not cliente and customer_email:
                cliente = Cliente.query.filter_by(email=customer_email).first()
            
            if cliente:
                # Se for assinatura, o status correto viria do invoice, 
                # mas para garantir acesso imediato, forçamos 'ativo' se a sessão estiver paga.
                cliente.subscription_status = "ativo"
                cliente.registrar_pagamento() # Atualiza data de pagamento e vencimento
                db.session.commit()
                print(f"[CHECK-SESSION] Cliente {cliente.email} liberado manualmente após sucesso na sessão {session_id}")
                return jsonify({"status": "paid", "message": "Pagamento confirmado e acesso liberado."})
            else:
                return jsonify({"status": "paid", "message": "Pagamento confirmado, mas cliente não encontrado para vincular."})
        else:
            return jsonify({"status": payment_status, "message": "Pagamento ainda não confirmado."})

    except Exception as e:
        print(f"[CHECK-SESSION] Erro ao verificar sessão {session_id}: {e}")
        return jsonify({"error": str(e)}), 500



@payments_bp.route("/payments/my-latest-session", methods=["GET"])
def get_my_latest_session():
    if not stripe.api_key:
        return jsonify({"error": "Stripe API Key não configurada"}), 500
    
    email = _get_email_from_auth_header()
    if not email:
        return jsonify({"error": "Não autenticado"}), 401
        
    cliente = Cliente.query.filter_by(email=email).first()
    if not cliente or not cliente.stripe_customer_id:
        return jsonify({"error": "Cliente sem histórico no Stripe"}), 404
        
    try:
        sessions = stripe.checkout.Session.list(
            customer=cliente.stripe_customer_id,
            limit=1,
            expand=['data.payment_intent']
        )
        
        if not sessions or not sessions.data:
            return jsonify({"error": "Nenhuma sessão encontrada"}), 404
            
        latest = sessions.data[0]
        
        # Se achou uma sessão paga, aproveita para validar o cliente localmente
        if latest.payment_status == "paid":
             if getattr(cliente, "subscription_status", "") != "ativo":
                 cliente.registrar_pagamento()
                 cliente.subscription_status = "ativo"
                 db.session.commit()
                 current_app.logger.info(f"Pagamento confirmado via my-latest-session. Cliente {cliente.email} desbloqueado.")

        return jsonify({
            "id": latest.id,
            "status": latest.payment_status,
            "payment_status": latest.payment_status,
            "url": latest.url
        }), 200
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar última sessão: {e}")
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/connect/admin/onboarding-link", methods=["POST"])
@require_admin
def connect_admin_onboarding_link():
    if not stripe.api_key:
        return jsonify({"error": "Stripe API Key não configurada"}), 500

    email = _get_email_from_auth_header()
    admin = Administrador.query.filter_by(email=email).first() if email else None
    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404

    try:
        acct_id = getattr(admin, "stripe_connected_account_id", None)
        if not acct_id:
            acct = stripe.Account.create(type="express", country="BR", email=admin.email)
            acct_id = acct.get("id")
            admin.stripe_connected_account_id = acct_id
            db.session.commit()

        link = stripe.AccountLink.create(
            account=acct_id,
            refresh_url=os.getenv("STRIPE_CONNECT_REFRESH_URL", "http://localhost:5000/admin/dashboard"),
            return_url=os.getenv("STRIPE_CONNECT_RETURN_URL", "http://localhost:5000/admin/dashboard"),
            type="account_onboarding",
        )
        return jsonify({"onboarding_url": link.get("url"), "account_id": acct_id}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao preparar onboarding Connect: {e}")
        return jsonify({"error": "Falha ao preparar onboarding"}), 500


@payments_bp.route("/connect/admin/status", methods=["GET"])
@require_admin
def connect_admin_status():
    email = _get_email_from_auth_header()
    admin = Administrador.query.filter_by(email=email).first() if email else None
    if not admin:
        return jsonify({"error": "Administrador não encontrado"}), 404
    acct_id = getattr(admin, "stripe_connected_account_id", None)
    if not acct_id:
        return jsonify({"connected": False}), 200
    try:
        acct = stripe.Account.retrieve(acct_id)
        return jsonify({
            "connected": True,
            "account_id": acct_id,
            "details_submitted": acct.get("details_submitted", False),
            "charges_enabled": acct.get("charges_enabled", False),
            "payouts_enabled": acct.get("payouts_enabled", False),
        }), 200
    except Exception:
        return jsonify({"connected": False}), 200
