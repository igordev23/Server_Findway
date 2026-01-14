document.addEventListener("DOMContentLoaded", () => {
  const csConnected = document.getElementById("csConnected");
  const csAccountId = document.getElementById("csAccountId");
  const csCharges = document.getElementById("csCharges");
  const csPayouts = document.getElementById("csPayouts");
  const btnConnect = document.getElementById("btnConnectStripe");
  const btnDisconnect = document.getElementById("btnDisconnectStripe");
  const connectFb = document.getElementById("connectFeedback");
  
  // Feedback elements
  function setConnectFeedback(msg, type = "info") {
    if (connectFb) {
      connectFb.textContent = msg || "";
      connectFb.className = `text-${type} small mt-2`;
    }
  }

  async function getIdToken() {
    try {
      const cfgEl = document.getElementById("firebase-config");
      if (!cfgEl || typeof firebase === "undefined") return null;
      const cfg = JSON.parse(cfgEl.textContent);
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      const auth = firebase.auth();
      const user = auth.currentUser;
      if (user) return await user.getIdToken();
      const resolvedUser = await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((u) => {
          unsub();
          resolve(u || null);
        });
      });
      return resolvedUser ? await resolvedUser.getIdToken() : null;
    } catch (e) {
      return null;
    }
  }

  async function loadConnectStatus() {
    try {
      const token = await getIdToken();
      // ROTA CORRIGIDA
      const res = await fetch("/admin/stripe-connect/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      
      csConnected.textContent = data.connected ? "Sim" : "Não";
      csAccountId.textContent = data.accountId || "-";
      csCharges.textContent = data.charges_enabled ? "Sim" : "Não";
      csPayouts.textContent = data.payouts_enabled ? "Sim" : "Não";

      // Lógica inteligente do botão
      if (btnConnect) {
        if (data.connected && data.charges_enabled && data.payouts_enabled) {
           // Tudo certo
           btnConnect.textContent = "Configurações do Stripe";
           btnConnect.classList.remove("btn-primary", "btn-warning");
           btnConnect.classList.add("btn-secondary");
           setConnectFeedback("Conta ativa e pronta para processar pagamentos.", "success");
           if (btnDisconnect) btnDisconnect.classList.remove("d-none");
        } else if (data.connected && (!data.charges_enabled || !data.payouts_enabled)) {
           // Conta existe mas falta terminar cadastro ou verificação
           btnConnect.textContent = "Completar Cadastro / Verificar Pendências";
           btnConnect.classList.remove("btn-primary", "btn-secondary");
           btnConnect.classList.add("btn-warning");
           
           // Diagnóstico detalhado
           let msg = "Conta conectada, mas inativa. ";
           if (data.requirements && data.requirements.currently_due && data.requirements.currently_due.length > 0) {
               const mapErro = {
                   "individual.verification.proof_of_liveness": "Necessário enviar selfie/verificação facial",
                   "individual.verification.document": "Necessário enviar documento de identidade",
                   "business.verification.document": "Necessário enviar documento da empresa",
                   "external_account": "Necessário adicionar conta bancária para recebimento"
               };
               const pendencias = data.requirements.currently_due.map(p => mapErro[p] || p);
               msg += "Pendências: " + pendencias.join(", ");
           } else if (data.requirements && data.requirements.disabled_reason) {
               msg += "Motivo: " + data.requirements.disabled_reason;
           } else {
               msg += "Aguardando verificação do Stripe.";
           }
           setConnectFeedback(msg, "warning");
           if (btnDisconnect) btnDisconnect.classList.remove("d-none");
        } else {
           // Não conectado
           btnConnect.textContent = "Conectar com Stripe";
           btnConnect.classList.remove("btn-warning", "btn-secondary");
           btnConnect.classList.add("btn-primary");
           if (btnDisconnect) btnDisconnect.classList.add("d-none");
        }
      }

      if (data.message) {
        setConnectFeedback(data.message, "warning");
      }

    } catch (_) {
      csConnected.textContent = "-";
      csAccountId.textContent = "-";
      csCharges.textContent = "-";
      csPayouts.textContent = "-";
    }
  }

  async function connectStripe() {
    setConnectFeedback("Preparando conexão...", "info");
    if (btnConnect) btnConnect.disabled = true;
    try {
      const token = await getIdToken();
      // ROTA CORRIGIDA
      const res = await fetch("/admin/stripe-connect/create-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setConnectFeedback(data?.error || "Erro ao iniciar conexão.", "danger");
        if (btnConnect) btnConnect.disabled = false;
        return;
      }
      // Redireciona para o Stripe
      window.location.href = data.url;
    } catch (_) {
      setConnectFeedback("Erro ao iniciar conexão.", "danger");
      if (btnConnect) btnConnect.disabled = false;
    }
  }

  async function disconnectStripe() {
      if (!confirm("Tem certeza? Isso removerá a conexão atual e você precisará reconectar.")) return;
      
      setConnectFeedback("Desconectando...", "info");
      if (btnDisconnect) btnDisconnect.disabled = true;

      try {
          const token = await getIdToken();
          const res = await fetch("/admin/stripe-connect/disconnect", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
          });
          
          if (res.ok) {
              setConnectFeedback("Desconectado com sucesso.", "success");
              setTimeout(loadConnectStatus, 1000); // Recarrega status
          } else {
              setConnectFeedback("Erro ao desconectar.", "danger");
          }
      } catch (e) {
          setConnectFeedback("Erro ao desconectar.", "danger");
      } finally {
          if (btnDisconnect) btnDisconnect.disabled = false;
      }
  }

  // Inicialização
  loadConnectStatus();
  if (btnConnect) {
    btnConnect.addEventListener("click", connectStripe);
  }
  if (btnDisconnect) {
    btnDisconnect.addEventListener("click", disconnectStripe);
  }

  // --- Lógica de Planos ---
  const btnReloadPrices = document.getElementById("btnReloadPrices");
  const pricesTableBody = document.getElementById("pricesTableBody");
  const btnCreatePlan = document.getElementById("btnCreatePlan");
  const inpPlanName = document.getElementById("planName");
  const inpPlanValue = document.getElementById("planValue");
  const createPlanFeedback = document.getElementById("createPlanFeedback");

  function setPlanFeedback(msg, type = "muted") {
    if (createPlanFeedback) {
      createPlanFeedback.textContent = msg;
      createPlanFeedback.className = `mt-2 text-${type}`;
    }
  }

  async function loadPrices() {
    if (!pricesTableBody) return;
    pricesTableBody.innerHTML = '<tr><td colspan="4" class="text-muted">Carregando...</td></tr>';
    try {
        const token = await getIdToken();
        const res = await fetch("/payments/prices", {
             headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Erro ao listar");
        
        pricesTableBody.innerHTML = "";
        if (!data.length) {
            pricesTableBody.innerHTML = '<tr><td colspan="4" class="text-muted">Nenhum plano encontrado</td></tr>';
            return;
        }

        data.forEach(p => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${p.name || "-"}</td>
                <td><small>${p.price_id}</small></td>
                <td>R$ ${parseFloat(p.amount_brl).toFixed(2)}</td>
                <td>${p.active ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>'}</td>
            `;
            pricesTableBody.appendChild(tr);
        });

    } catch (e) {
        pricesTableBody.innerHTML = '<tr><td colspan="4" class="text-danger">Erro ao carregar planos</td></tr>';
    }
  }

  async function createPlan() {
      if (!inpPlanName || !inpPlanValue) return;
      const name = inpPlanName.value.trim();
      const val = parseFloat(inpPlanValue.value);

      if (!name || isNaN(val) || val <= 0) {
          setPlanFeedback("Preencha nome e valor válidos", "danger");
          return;
      }

      setPlanFeedback("Criando...", "info");
      if (btnCreatePlan) btnCreatePlan.disabled = true;

      try {
          const token = await getIdToken();
          const res = await fetch("/payments/create-plan", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                  name: name,
                  amount_brl: val,
                  interval: "month"
              })
          });
          const data = await res.json();

          if (!res.ok) {
              throw new Error(data.error || "Falha ao criar");
          }

          setPlanFeedback("Plano criado com sucesso!", "success");
          inpPlanName.value = "";
          inpPlanValue.value = "";
          loadPrices(); // Recarrega a lista

      } catch (e) {
          setPlanFeedback(e.message, "danger");
      } finally {
          if (btnCreatePlan) btnCreatePlan.disabled = false;
      }
  }

  if (btnReloadPrices) btnReloadPrices.addEventListener("click", loadPrices);
  if (btnCreatePlan) btnCreatePlan.addEventListener("click", createPlan);

  // Carrega ao iniciar
  loadPrices();
});
