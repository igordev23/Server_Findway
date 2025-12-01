document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formAlterarSenha");
  const senhaAtualInput = document.getElementById("senhaAtual");
  const novaSenhaInput = document.getElementById("novaSenha");
  const confirmarSenhaInput = document.getElementById("confirmarSenha");
  const btnAtualizar = document.getElementById("btnAtualizarSenha");
  const feedbackArea = document.getElementById("senha-feedback");

  if (!form || !senhaAtualInput || !novaSenhaInput || !confirmarSenhaInput || !btnAtualizar) {
    return;
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
    console.error("Erro ao inicializar Firebase nas configurações de segurança:", error);
  }

  function showFeedback(message, variant = "info") {
    if (!feedbackArea) return;
    feedbackArea.innerHTML = `
      <div class="alert alert-${variant} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!auth) {
      showFeedback("Serviço de autenticação indisponível. Tente novamente mais tarde.", "danger");
      return;
    }

    const senhaAtual = senhaAtualInput.value.trim();
    const novaSenha = novaSenhaInput.value.trim();
    const confirmarSenha = confirmarSenhaInput.value.trim();

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      showFeedback("Preencha todos os campos de senha.", "warning");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      showFeedback("A confirmação da nova senha não confere.", "warning");
      return;
    }

    if (novaSenha.length < 6) {
      showFeedback("A nova senha deve ter pelo menos 6 caracteres.", "warning");
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      showFeedback("Sessão expirada. Faça login novamente para alterar a senha.", "danger");
      return;
    }

    btnAtualizar.disabled = true;
    const originalText = btnAtualizar.textContent;
    btnAtualizar.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Atualizando...';

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, senhaAtual);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(novaSenha);

      showFeedback("Senha atualizada com sucesso!", "success");
      form.reset();
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      let msg = "Não foi possível atualizar a senha.";
      if (error.code === "auth/wrong-password") {
        msg = "Senha atual incorreta.";
      } else if (error.code === "auth/weak-password") {
        msg = "A nova senha é muito fraca. Use mais caracteres, números e símbolos.";
      } else if (error.code === "auth/requires-recent-login") {
        msg =
          "Por segurança, faça login novamente e tente alterar a senha em seguida.";
      } else if (error.message) {
        msg = error.message;
      }
      showFeedback(msg, "danger");
    } finally {
      btnAtualizar.disabled = false;
      btnAtualizar.textContent = originalText;
    }
  });
});


