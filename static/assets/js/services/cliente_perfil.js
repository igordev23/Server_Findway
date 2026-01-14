document.addEventListener("DOMContentLoaded", () => {
  const nomeEl = document.getElementById("perfilNome");
  const emailEl = document.getElementById("perfilEmail");
  const telEl = document.getElementById("perfilTelefone");
  const tipoEl = document.getElementById("perfilTipo");
  const ruaEl = document.getElementById("perfilRua");
  const numeroEl = document.getElementById("perfilNumero");
  const cidadeEl = document.getElementById("perfilCidade");
  const estadoEl = document.getElementById("perfilEstado");
  const cepEl = document.getElementById("perfilCep");
  const feedbackEl = document.getElementById("perfil-feedback");

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
    console.error("Erro ao inicializar Firebase em Meu Perfil:", error);
  }

  async function fetchJson(url) {
    const res = await fetch(url);
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

  async function carregarPerfil(usuarioEmail) {
    try {
      const [usuarios, clientes] = await Promise.all([
        fetchJson("/usuarios"),
        fetchJson("/clientes"),
      ]);

      const usuario = (usuarios || []).find(
        (u) => u.email && u.email.toLowerCase() === usuarioEmail.toLowerCase()
      );

      if (!usuario) {
        showFeedback("Não foi possível localizar seus dados no sistema.", "warning");
        if (nomeEl) nomeEl.textContent = "Usuário";
        if (emailEl) emailEl.textContent = usuarioEmail;
        return;
      }

      if (nomeEl) nomeEl.textContent = usuario.nome || "Usuário";
      if (emailEl) emailEl.textContent = usuario.email || usuarioEmail;
      if (telEl) telEl.textContent = usuario.telefone || "-";
      if (tipoEl) tipoEl.textContent = usuario.tipo_usuario || "-";

      const cliente = (clientes || []).find((c) => c.id === usuario.id);
      if (cliente) {
        if (ruaEl) ruaEl.textContent = cliente.rua || "-";
        if (numeroEl) numeroEl.textContent = cliente.numero || "-";
        if (cidadeEl) cidadeEl.textContent = cliente.cidade || "-";
        if (estadoEl) estadoEl.textContent = cliente.estado || "-";
        if (cepEl) cepEl.textContent = cliente.cep || "-";
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      showFeedback(error.message || "Erro ao carregar dados do perfil.", "danger");
    }
  }

  if (!auth) {
    showFeedback("Serviço de autenticação indisponível. Tente novamente mais tarde.", "danger");
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (!user || !user.email) {
      showFeedback("Sessão expirada. Faça login novamente.", "danger");
      if (nomeEl) nomeEl.textContent = "Visitante";
      if (emailEl) emailEl.textContent = "-";
      return;
    }
    carregarPerfil(user.email);
  });
});


