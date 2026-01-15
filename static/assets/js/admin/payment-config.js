document.addEventListener("DOMContentLoaded", () => {
  // Elementos da página
  const stripeStatus = document.getElementById("stripe-connect-status");
  const btnConnect = document.getElementById("btnConnectStripe");
  const btnDisconnect = document.getElementById("btnDisconnectStripe");
  const btnSave = document.getElementById("btnSaveConfig");
  const btnTest = document.getElementById("btnTestPayment");
  const feedback = document.getElementById("feedback-config");

  // Função para mostrar feedback
  function setFeedback(message, type = "info") {
    if (!feedback) return;
    feedback.className = `mt-3 alert alert-${type}`;
    feedback.innerHTML = message;
    
    // Auto-hide após 5 segundos para mensagens de sucesso
    if (type === "success") {
      setTimeout(() => {
        feedback.className = "mt-3";
        feedback.innerHTML = "";
      }, 5000);
    }
  }

  // Função para obter auth do Firebase
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

  // Verificar status do Stripe Connect
  async function checkStripeStatus() {
    try {
      const { token } = await getAuthAndEmail();
      const res = await fetch("/admin/stripe-connect/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const data = await res.json();
        updateStripeStatus(data.connected, data.accountId);
      } else {
        updateStripeStatus(false, null);
      }
    } catch (e) {
      updateStripeStatus(false, null);
    }
  }

  // Atualizar UI do status do Stripe
  function updateStripeStatus(connected, accountId) {
    if (!stripeStatus) return;
    
    if (connected) {
      stripeStatus.className = "alert alert-success";
      stripeStatus.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
          <span>
            <i class="bi bi-check-circle-fill me-2"></i>
            Conta Stripe conectada com sucesso!
          </span>
          <small class="text-muted">ID: ${accountId}</small>
        </div>
      `;
      btnConnect?.classList.add("d-none");
      btnDisconnect?.classList.remove("d-none");
    } else {
      stripeStatus.className = "alert alert-warning";
      stripeStatus.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Conta Stripe não conectada. Conecte sua conta para receber pagamentos diretamente.
      `;
      btnConnect?.classList.remove("d-none");
      btnDisconnect?.classList.add("d-none");
    }
  }

  // Conectar Stripe
  btnConnect?.addEventListener("click", async () => {
    try {
      setFeedback("Iniciando conexão com Stripe...", "info");
      btnConnect.disabled = true;
      
      const { token } = await getAuthAndEmail();
      const res = await fetch("/admin/stripe-connect/create-link", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        throw new Error("Erro ao criar link de conexão");
      }
      
      const data = await res.json();
      if (data.url) {
        setFeedback("Redirecionando para o Stripe...", "info");
        window.location.href = data.url;
      } else {
        throw new Error("Link não recebido");
      }
    } catch (e) {
      setFeedback(`Erro ao conectar Stripe: ${e.message}`, "danger");
      btnConnect.disabled = false;
    }
  });

  // Desconectar Stripe
  btnDisconnect?.addEventListener("click", async () => {
    const confirmResult = await Swal.fire({
      title: "Desconectar conta Stripe",
      text: "Tem certeza que deseja desconectar sua conta Stripe? Você não receberá mais pagamentos diretos.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, desconectar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmResult.isConfirmed) {
      return;
    }
    try {
      setFeedback("Desconectando conta Stripe...", "warning");
      btnDisconnect.disabled = true;
      
      const { token } = await getAuthAndEmail();
      const res = await fetch("/admin/stripe-connect/disconnect", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        setFeedback("Conta Stripe desconectada com sucesso!", "success");
        updateStripeStatus(false, null);
      } else {
        throw new Error("Erro ao desconectar");
      }
    } catch (e) {
      setFeedback(`Erro ao desconectar Stripe: ${e.message}`, "danger");
    } finally {
      btnDisconnect.disabled = false;
    }
  });

  // Salvar configurações
  btnSave?.addEventListener("click", async () => {
    try {
      setFeedback("Salvando configurações...", "info");
      btnSave.disabled = true;
      
      // Coletar configurações
      const config = {
        payment_methods: {
          card: document.getElementById("payment-card")?.checked || false,
          pix: document.getElementById("payment-pix")?.checked || false,
          boleto: document.getElementById("payment-boleto")?.checked || false
        },
        billing_day: parseInt(document.getElementById("billing-day")?.value || "15"),
        billing_time: document.getElementById("billing-time")?.value || "18:00",
        application_fee: parseFloat(document.getElementById("application-fee")?.value || "5.0"),
        late_fee: parseFloat(document.getElementById("late-fee")?.value || "2.0")
      };
      
      const { token } = await getAuthAndEmail();
      const res = await fetch("/admin/payment-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        setFeedback("Configurações salvas com sucesso!", "success");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar configurações");
      }
    } catch (e) {
      setFeedback(`Erro ao salvar configurações: ${e.message}`, "danger");
    } finally {
      btnSave.disabled = false;
    }
  });

  // Testar pagamento
  btnTest?.addEventListener("click", async () => {
    try {
      setFeedback("Criando sessão de teste...", "info");
      btnTest.disabled = true;
      
      const { token } = await getAuthAndEmail();
      const res = await fetch("/payments/test-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          test_mode: true,
          amount: 1000, // R$ 10,00 em centavos
          currency: "brl"
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setFeedback("Redirecionando para página de teste...", "info");
          window.open(data.url, "_blank");
        } else {
          throw new Error("URL não recebida");
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar teste");
      }
    } catch (e) {
      setFeedback(`Erro ao criar teste: ${e.message}`, "danger");
    } finally {
      btnTest.disabled = false;
    }
  });

  // Carregar configurações existentes
  async function loadConfig() {
    try {
      const { token } = await getAuthAndEmail();
      const res = await fetch("/admin/payment-config", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const config = await res.json();
        
        // Preencher formulário
        if (config.payment_methods) {
          document.getElementById("payment-card").checked = config.payment_methods.card || false;
          document.getElementById("payment-pix").checked = config.payment_methods.pix || false;
          document.getElementById("payment-boleto").checked = config.payment_methods.boleto || false;
        }
        
        if (config.billing_day) {
          document.getElementById("billing-day").value = config.billing_day;
        }
        
        if (config.billing_time) {
          document.getElementById("billing-time").value = config.billing_time;
        }
        
        if (config.application_fee !== undefined) {
          document.getElementById("application-fee").value = config.application_fee;
        }
        
        if (config.late_fee !== undefined) {
          document.getElementById("late-fee").value = config.late_fee;
        }
      }
    } catch (e) {
      console.error("Erro ao carregar configurações:", e);
    }
  }

  // Inicializar
  checkStripeStatus();
  loadConfig();
});
