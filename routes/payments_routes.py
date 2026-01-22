import os
import json
import stripe
from flask import Blueprint, request, jsonify, current_app
from database import db
from models.cliente import Cliente
from models.administrador import Administrador
from models.evento import Evento
from datetime import datetime
import pytz

br_tz = pytz.timezone("America/Sao_Paulo")
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


@payments_bp.route("/payments/prices", methods=["GET"])
def get_prices():
    try:
        prices = stripe.Price.list(active=True, expand=['data.product'], limit=100)
        
        result = []
        for p in prices.data:
            product = p.product
            if not isinstance(product, dict) or not product.get('active'):
                continue
                
            if p.currency.lower() != 'brl':
                continue
                
            amount_brl = (p.unit_amount or 0) / 100.0
            
            result.append({
                "price_id": p.id,
                "product_id": product.get("id"),
                "name": product.get("name"),
                "amount_brl": amount_brl,
                "currency": p.currency,
                "recurring": p.recurring
            })
            
        return jsonify(result)
    except Exception as e:
        print(f"Erro ao buscar preços: {e}")
        return jsonify({"error": str(e)}), 500


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
        elif cliente and cliente.stripe_customer_id:
            # Se o cliente já existe no banco e tem ID, FORÇA o uso desse ID
            params["customer"] = cliente.stripe_customer_id
            customer_id = cliente.stripe_customer_id # Atualiza variável local
            print(f"[DEBUG] Reutilizando stripe_customer_id do banco: {customer_id}")
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
                
                # IMPORTANTISSIMO: Atualiza params para usar o ID criado, evitando que o Stripe crie outro
                params["customer"] = customer_id
                if "customer_email" in params:
                    del params["customer_email"]

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


@payments_bp.route("/payments/my-latest-session", methods=["GET"])
def get_my_latest_session():
    print("[DEBUG] Rota /payments/my-latest-session chamada!")
    
    # Force DB refresh
    db.session.commit()
    
    email = _get_email_from_auth_header()
    if not email:
        print("[DEBUG] Falha na autenticação (sem email)")
        return jsonify({"error": "Autenticação necessária"}), 401
        
    print(f"[DEBUG] Buscando cliente para email: {email}")

    cliente = Cliente.query.filter_by(email=email).first()
    if not cliente:
         print(f"[DEBUG] Cliente não encontrado para email {email}")
         return jsonify({"error": "Cliente não encontrado"}), 404
         
    if not cliente.stripe_customer_id:
        print(f"[DEBUG] Cliente {email} sem stripe_customer_id")
        # Retorna 200 com status especial para evitar erros no console do frontend durante polling
        return jsonify({"payment_status": "no_customer_id"}), 200

    try:
        # Busca as últimas sessões do cliente
        print(f"[DEBUG] Buscando sessões para {cliente.stripe_customer_id}")
        sessions = stripe.checkout.Session.list(
            customer=cliente.stripe_customer_id,
            limit=1,
            expand=['data.subscription']
        )
        
        # --- AUTO-RECOVERY LOGIC START ---
        if not sessions.data:
            print(f"[DEBUG] Nenhuma sessão para {cliente.stripe_customer_id}. Verificando duplicatas por email...")
            try:
                # Busca clientes no Stripe pelo email (REDUZIDO LIMITE para evitar timeout)
                stripe_customers = stripe.Customer.list(email=cliente.email, limit=5)
                for sc in stripe_customers.data:
                    if sc.id == cliente.stripe_customer_id:
                        continue # Já verificado
                    
                    print(f"[DEBUG] Verificando cliente duplicado no Stripe: {sc.id}")
                    try:
                        other_sessions = stripe.checkout.Session.list(customer=sc.id, limit=1, expand=['data.subscription'])
                        if other_sessions.data:
                            print(f"[DEBUG] Encontrada sessão no cliente duplicado {sc.id}! Atualizando banco...")
                            # Atualiza o ID no banco para o que tem sessões
                            cliente.stripe_customer_id = sc.id
                            db.session.commit()
                            
                            # Usa esta sessão
                            sessions = other_sessions
                            break
                    except Exception as e_inner:
                        print(f"[DEBUG] Erro verificando duplicata {sc.id}: {e_inner}")
                        continue
            except Exception as e_recovery:
                print(f"[DEBUG] Erro na auto-recuperação: {e_recovery}")
        # --- AUTO-RECOVERY LOGIC END ---

        if not sessions.data:
            print("[DEBUG] Nenhuma sessão encontrada no Stripe (mesmo após verificação de duplicatas)")
            # Retorna 200 com status especial para evitar erros no console do frontend
            return jsonify({"payment_status": "no_session"}), 200
            
        session = sessions.data[0]
        
        # --- AUTO-UPDATE STATUS LOCAL ---
        # Se o pagamento foi confirmado no Stripe, libera o acesso imediatamente
        if session.payment_status == 'paid':
             # Verifica se precisa atualizar (se estava inativo ou se o último pagamento é antigo)
             needs_update = False
             if cliente.subscription_status != 'ativo':
                 needs_update = True
             elif cliente.data_proximo_vencimento and cliente.data_proximo_vencimento < date.today():
                 needs_update = True
                 
             if needs_update:
                 print(f"[DEBUG] Pagamento confirmado! Registrando pagamento para {cliente.email}...")
                 # Chama o método completo que atualiza status E datas
                 cliente.registrar_pagamento()

                
                 try:
                     from datetime import timedelta
                     limite_tempo = datetime.now(br_tz) - timedelta(minutes=5)
                     
                     duplicado = Evento.query.filter(
                         Evento.cliente_id == cliente.id,
                         Evento.tipo == "PAGAMENTO",
                         Evento.timestamp >= limite_tempo
                     ).first()
                     
                     if not duplicado:
                         amount = session.amount_total / 100.0 if session.amount_total else 0.0
                         notif = Evento(
                             cliente_id=cliente.id,
                             veiculo_id=None,
                             tipo="PAGAMENTO",
                             descricao=f"Pagamento de R$ {amount:.2f} efetuado com sucesso.",
                             lido=False,
                             timestamp=datetime.now(br_tz)
                         )
                         db.session.add(notif)
                         print(f"[DEBUG] Evento PAGAMENTO criado manualmente via polling para {cliente.email}")
                 except Exception as e_ev:
                     print(f"[DEBUG] Erro ao criar evento no polling: {e_ev}")
                 

                 db.session.commit()
      

        return jsonify({
            "id": session.id,
            "payment_status": session.payment_status,
            "status": session.status,
            "url": session.url
        })
    except Exception as e:
        print(f"Erro ao buscar sessões: {e}")
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/webhook", methods=["POST"])
def webhook_received():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        print(f"Webhook Error: Invalid payload")
        return "Invalid payload", 400
    except stripe.error.SignatureVerificationError as e:
        print(f"Webhook Error: Invalid signature")
        return "Invalid signature", 400

    event_type = event["type"]
    data_object = event["data"]["object"]
    
    print(f"Webhook recebido: {event_type}")

    # Handle events
    if event_type == "invoice.payment_succeeded":
        customer_id = data_object.get("customer")
        if customer_id:
            cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
            if cliente:
                amount = data_object.get('amount_paid', 0) / 100.0
                notif = Evento(
                    cliente_id=cliente.id,
                    veiculo_id=None,
                    tipo="PAGAMENTO",
                    descricao=f"Pagamento de R$ {amount:.2f} efetuado com sucesso.",
                    lido=False,
                    timestamp=datetime.now(br_tz)
                )
                db.session.add(notif)
                db.session.commit()
                print(f"Evento PAGAMENTO criado para {cliente.email}")

    elif event_type == "invoice.payment_failed":
        customer_id = data_object.get("customer")
        if customer_id:
            cliente = Cliente.query.filter_by(stripe_customer_id=customer_id).first()
            if cliente:
                notif = Evento(
                    cliente_id=cliente.id,
                    veiculo_id=None,
                    tipo="ATRASO",
                    descricao="Pagamento em atraso. Verifique seu método de pagamento.",
                    lido=False,
                    timestamp=datetime.now(br_tz)
                )
                db.session.add(notif)
                db.session.commit()
                print(f"Evento ATRASO criado para {cliente.email}")

    return jsonify({"status": "success"}), 200

