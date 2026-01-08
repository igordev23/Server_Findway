document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnPagarAgora");
  const feedback = document.getElementById("feedbackPagamento");
  const priceEl = document.getElementById("stripe-data");
  const defaultPriceId = priceEl ? priceEl.getAttribute("data-price-id") : "";
  const selectPlano = document.getElementById("selectPlano");
  const btnReload = document.getElementById("btnRecarregarPlanos");
  const adminArea = document.getElementById("adminArea");
  const inpNome = document.getElementById("novoPlanoNome");
  const inpValor = document.getElementById("novoPlanoValor");
  const btnCriar = document.getElementById("btnCriarPlano");
  const fbCriar = document.getElementById("feedbackCriarPlano");
  let plansCache = [];

  function setFeedback(msg, type = "muted") {
    if (!feedback) return;
    feedback.className = `mt-3 text-${type}`
    feedback.textContent = msg;
  }

  async function getAuthAndEmail() {
    try {
      const cfgEl = document.getElementById("firebase-config");
      if (!cfgEl || typeof firebase === "undefined") return { token: null, email: null };
      const cfg = JSON.parse(cfgEl.textContent);
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      const auth = firebase.auth();
      const user = auth.currentUser;
      if (!user) return { token: null, email: null };
      const token = await user.getIdToken();
      return { token, email: user.email || null };
    } catch (e) {
      return { token: null, email: null };
    }
  }

  async function resolveCustomerIdByEmail(email) {
    try {
      const res = await fetch("/clientes");
      const list = await res.json();
      const me = Array.isArray(list) ? list.find((c) => c.email === email) : null;
      return me ? me.stripe_customer_id : null;
    } catch (_) {
      return null;
    }
  }

  async function isAdmin(email) {
    try {
      const res = await fetch("/usuarios");
      const list = await res.json();
      const me = Array.isArray(list) ? list.find((u) => u.email === email) : null;
      return me && me.tipo_usuario === "administrador";
    } catch (_) {
      return false;
    }
  }

  async function loadPrices() {
    try {
      if (selectPlano) {
        selectPlano.innerHTML = `<option value="">Carregando planos...</option>`;
      }

      let token = null;
      try {
          const authData = await getAuthAndEmail();
          token = authData.token;
      } catch (e) {
          // Usuário não autenticado, segue sem token
      }

      const res = await fetch("/payments/prices", {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const items = await res.json();
      plansCache = Array.isArray(items) ? items : [];
      if (!Array.isArray(items) || !items.length) {
        if (selectPlano) {
          selectPlano.innerHTML = `<option value="">Nenhum plano disponível</option>`;
        }
        return;
      }
      if (selectPlano) {
        selectPlano.innerHTML = items
          .map(
            (p) =>
              `<option value="${p.price_id}">${p.name || p.product_id} — R$ ${Number(p.amount_brl).toFixed(2)}/mês</option>`
          )
          .join("");
      }
    } catch (e) {
      if (selectPlano) {
        selectPlano.innerHTML = `<option value="">Erro ao carregar planos</option>`;
      }
    }
  }

  // Polling para verificar se o pagamento foi confirmado
  async function pollForPaymentConfirmation() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment") !== "success") return;

    // Overlay de carregamento
    const overlay = document.createElement("div");
    overlay.id = "payment-confirmation-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;";
    overlay.innerHTML = `
      <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
      <h3 class="mb-2">Confirmando pagamento...</h3>
      <p class="text-muted mb-4">Aguarde enquanto validamos sua assinatura.</p>
      <button id="btnForceHome" class="btn btn-outline-primary" style="display:none">Ir para Home</button>
    `;
    document.body.appendChild(overlay);
    
    // Botão de escape caso demore muito
    const btnForce = overlay.querySelector("#btnForceHome");
    btnForce.onclick = () => window.location.href = "/home?payment=success";
    setTimeout(() => { btnForce.style.display = "inline-block"; }, 10000); // Aparece após 10s

    let attempts = 0;
    const maxAttempts = 60; // ~2 minutos (60 * 2s)
    const sessionId = urlParams.get("session_id");

    const interval = setInterval(async () => {
      attempts++;
      const debugEl = document.getElementById("polling-debug-info");
      if (!debugEl) {
           const d = document.createElement("small");
           d.id = "polling-debug-info";
           d.className = "text-muted mt-3";
           overlay.appendChild(d);
      }
      const updateDebug = (msg) => {
          const el = document.getElementById("polling-debug-info");
          if (el) el.textContent = `Tentativa ${attempts}/${maxAttempts}: ${msg}`;
      };
      
      // 1. Tenta verificar via session_id (mais confiável e rápido se webhook falhar)
      if (sessionId) {
          updateDebug("Verificando sessão Stripe...");
          try {
              const r = await fetch(`/payments/check-session/${sessionId}`);
              if (r.ok) {
                  const d = await r.json();
                  console.log("Check Session Status:", d);
                  updateDebug(`Status da sessão: ${d.status}`);
                  
                  if (d.status === "paid") {
                       clearInterval(interval);
                       overlay.innerHTML = `
                        <div class="mb-3 text-success" style="font-size: 3rem;"><i class="bi bi-check-circle-fill"></i></div>
                        <h3 class="mb-2">Pagamento Confirmado!</h3>
                        <p class="text-muted">Redirecionando...</p>
                      `;
                      setTimeout(() => {
                        window.location.href = "/home?payment=success";
                      }, 1500);
                      return;
                  }
              } else {
                  updateDebug(`Erro API: ${r.status}`);
              }
          } catch (e) {
              console.error("Erro ao verificar sessão:", e);
              updateDebug("Erro de conexão com API");
          }
      } else {
          // Tenta buscar a última sessão do usuário via API (recuperação automática)
          updateDebug("Buscando última sessão...");
          try {
             const { token } = await getAuthAndEmail();
             if (token) {
                 const r = await fetch("/payments/my-latest-session", {
                     headers: { "Authorization": `Bearer ${token}` }
                 });
                 if (r.ok) {
                     const d = await r.json();
                     updateDebug(`Última sessão: ${d.payment_status}`);
                     if (d.payment_status === "paid") {
                         clearInterval(interval);
                         overlay.innerHTML = `
                            <div class="mb-3 text-success" style="font-size: 3rem;"><i class="bi bi-check-circle-fill"></i></div>
                            <h3 class="mb-2">Pagamento Confirmado!</h3>
                            <p class="text-muted">Redirecionando...</p>
                         `;
                         setTimeout(() => { window.location.href = "/home?payment=success"; }, 1500);
                         return;
                     }
                 }
             }
          } catch(e) { console.error(e); }
      }

      // 2. Fallback: verifica status do cliente via API
      try {
        const { email } = await getAuthAndEmail();
        if (email) { 
             const res = await fetch("/clientes");
             if (res.ok) {
                 const list = await res.json();
                 if (Array.isArray(list)) {
                     const me = list.find((c) => c.email === email);
                     if (me) {
                         console.log("Status cliente:", me.subscription_status);
                         if (!sessionId) updateDebug(`Cliente encontrado. Status: ${me.subscription_status}`);
                         
                         if (me.subscription_status === "ativo") {
                             clearInterval(interval);
                             overlay.innerHTML = `
                                 <div class="mb-3 text-success" style="font-size: 3rem;"><i class="bi bi-check-circle-fill"></i></div>
                                 <h3 class="mb-2">Pagamento Confirmado!</h3>
                                 <p class="text-muted">Redirecionando...</p>
                             `;
                             setTimeout(() => {
                                 window.location.href = "/home?payment=success";
                             }, 1500);
                             return;
                         }
                     }
                 }
             }
        } else {
            if (!sessionId) updateDebug("Não autenticado.");
        }
      } catch (e) {
        console.error("Erro no polling (fallback):", e);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        overlay.innerHTML = `
           <div class="mb-3 text-warning" style="font-size: 3rem;"><i class="bi bi-exclamation-triangle-fill"></i></div>
           <h3 class="mb-2">Ainda não confirmamos</h3>
           <p class="text-muted mb-4">O pagamento pode levar alguns instantes para compensar.</p>
           <div class="d-flex gap-2 justify-content-center">
             <button onclick="window.location.reload()" class="btn btn-primary">Tentar novamente</button>
             <button onclick="window.location.href='/home'" class="btn btn-outline-secondary">Ir para Home (se liberado)</button>
           </div>
        `;
      }
    }, 2000);
  }

  pollForPaymentConfirmation();

  btnReload?.addEventListener("click", loadPrices);

  btn?.addEventListener("click", async () => {
    setFeedback("Preparando pagamento mensal...");
    btn.disabled = true;
    try {
      const { token, email } = await getAuthAndEmail();
      if (!email) {
        setFeedback("Faça login para continuar.", "danger");
        btn.disabled = false;
        return;
      }

      // Não exige mais stripe_customer_id, usa o email diretamente
      const customerId = await resolveCustomerIdByEmail(email);
      
      let priceId = (selectPlano && selectPlano.value) || defaultPriceId;
      if (!priceId) {
        priceId = prompt("Informe o priceId do plano mensal:");
      }
      if (!priceId) {
        setFeedback("PriceId não informado.", "warning");
        btn.disabled = false;
        return;
      }

      // Envia customerId se existir, ou apenas email se não tiver
      const res = await fetch("/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          customerId: customerId || null,
          customerEmail: email,
          priceId,
          one_time: true
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        setFeedback(data?.error || "Não foi possível iniciar o pagamento mensal.", "danger");
        btn.disabled = false;
        return;
      }

      setFeedback("Redirecionando para o pagamento...");
      window.location.replace(data.url);
    } catch (e) {
      setFeedback("Erro ao iniciar pagamento mensal.", "danger");
      btn.disabled = false;
    }
  });

  btnCriar?.addEventListener("click", async () => {
    if (!inpNome || !inpValor || !fbCriar) return;
    fbCriar.textContent = "Criando plano...";
    btnCriar.disabled = true;
    try {
      const { token, email } = await getAuthAndEmail();
      const admin = email ? await isAdmin(email) : false;
      if (!admin) {
        fbCriar.textContent = "Apenas administradores podem criar planos.";
        btnCriar.disabled = false;
        return;
      }
      const name = inpNome.value.trim();
      const amount_brl = parseFloat(inpValor.value);
      if (!name || !amount_brl || Number.isNaN(amount_brl)) {
        fbCriar.textContent = "Informe nome e valor válidos.";
        btnCriar.disabled = false;
        return;
      }
      const res = await fetch("/payments/create-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, amount_brl, currency: "brl", interval: "month" }),
      });
      const data = await res.json();
      if (!res.ok) {
        fbCriar.textContent = data?.error || "Erro ao criar plano.";
        btnCriar.disabled = false;
        return;
      }
      fbCriar.textContent = `Plano criado: ${data.name} — price ${data.price_id}`;
      await loadPrices();
    } catch (e) {
      fbCriar.textContent = "Erro ao criar plano.";
    } finally {
      btnCriar.disabled = false;
    }
  });

  (async () => {
    try {
      const { email } = await getAuthAndEmail();
      const admin = email ? await isAdmin(email) : false;
      if (admin && adminArea) adminArea.classList.remove("d-none");
    } catch (_) {}
    await loadPrices();
  })();
});

