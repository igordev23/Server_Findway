document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("clienteVeiculosTabelaBody");
  const resumoHeader = document.getElementById("veiculosResumoHeader");
  const feedbackEl = document.getElementById("veiculos-feedback");

  function showFeedback(message, variant = "info") {
    if (!feedbackEl || !message) return;
    feedbackEl.innerHTML = `
      <div class="alert alert-${variant} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  let auth = null;
  try {
    const cfgEl = document.getElementById("firebase-config");
    if (cfgEl && typeof firebase !== "undefined") {
      const cfg = JSON.parse(cfgEl.textContent);
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
      }
      auth = firebase.auth();
    }
  } catch (error) {
    console.error("Erro ao inicializar Firebase em Meus Veículos:", error);
  }

  async function fetchJson(url) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}_t=${Date.now()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const msg = data?.error || `Erro ao chamar ${url}`;
       if (res.status === 403) {
        window.location.replace("/pagamento-pendente");
        return {};
      }
      throw new Error(msg);
    }
    return res.json();
  }

  async function carregarVeiculos(usuarioEmail) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            Carregando veículos...
          </td>
        </tr>`;
    }

    try {
      const usuarios = await fetchJson("/usuarios");
      const usuario = (usuarios || []).find(
        (u) => u.email && u.email.toLowerCase() === usuarioEmail.toLowerCase()
      );

      if (!usuario) {
        showFeedback("Não foi possível localizar seu usuário no sistema.", "warning");
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="5" class="text-center text-muted py-4">
                Nenhum veículo encontrado.
              </td>
            </tr>`;
        }
        if (resumoHeader) resumoHeader.textContent = "0 veículos";
        return;
      }

      if (usuario.tipo_usuario !== "cliente") {
        showFeedback("Esta tela está disponível apenas para clientes.", "warning");
      }

      let veiculos = [];
      try {
        veiculos = await fetchJson(`/veiculos/cliente/${usuario.id}`);
      } catch (error) {
        // Se a rota dedicada não existir/retornar 404, faz fallback usando /veiculos
        const todos = await fetchJson("/veiculos");
        veiculos = (todos || []).filter(
          (v) => String(v.cliente_id) === String(usuario.id)
        );
      }

      if (!veiculos.length) {
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="5" class="text-center text-muted py-4">
                Nenhum veículo vinculado à sua conta.
              </td>
            </tr>`;
        }
        if (resumoHeader) resumoHeader.textContent = "0 veículos";
        return;
      }

      if (tbody) {
        tbody.innerHTML = veiculos
          .map((v) => {
            const statusBadge = (v.status_gps === "Online")
              ? '<span class="badge text-bg-success">Online</span>'
              : '<span class="badge text-bg-secondary">Offline</span>';
            return `
              <tr>
                <td>${v.placa || "-"}</td>
                <td>${v.modelo || "-"}</td>
                <td>${v.marca || "-"}</td>
                <td>${v.ano || "-"}</td>
                <td>${statusBadge}</td>
              </tr>`;
          })
          .join("");
      }

      if (resumoHeader) resumoHeader.textContent = `${veiculos.length} veículo(s)`;
    } catch (error) {
      console.error("Erro ao carregar veículos do cliente:", error);
      showFeedback(error.message || "Erro ao carregar veículos.", "danger");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted py-4">
              Não foi possível carregar os veículos.
            </td>
          </tr>`;
      }
      if (resumoHeader) resumoHeader.textContent = "Erro ao carregar";
    }
  }

  if (!auth) {
    showFeedback("Serviço de autenticação indisponível. Tente novamente mais tarde.", "danger");
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (!user || !user.email) {
      showFeedback("Sessão expirada. Faça login novamente.", "danger");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted py-4">
              Nenhum veículo disponível sem autenticação.
            </td>
          </tr>`;
      }
      if (resumoHeader) resumoHeader.textContent = "Não autenticado";
      return;
    }
    carregarVeiculos(user.email);
  });
});


