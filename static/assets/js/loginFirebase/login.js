document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = JSON.parse(document.getElementById("firebase-config").textContent);
  firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();

  const emailInput = document.getElementById("email");
  const senhaInput = document.getElementById("senha");
  const btnLogin = document.getElementById("btnLogin");

  // Função para criar e exibir o popup de erro
  const showErrorPopup = (message) => {
    // Verifica se já existe um popup ativo e o remove
    const existingPopup = document.querySelector(".error-popup");
    if (existingPopup) {
      existingPopup.remove();
    }

    // Cria o elemento do popup
    const popup = document.createElement("div");
    popup.className = "error-popup";
    popup.textContent = message;

    // Adiciona o popup ao body
    document.body.appendChild(popup);

    // Remove o popup após 3 segundos
    setTimeout(() => {
      popup.remove();
    }, 3000);
  };

  btnLogin.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    try {
      await auth.signInWithEmailAndPassword(email, senha);
      window.location.href = "/home"; // redirecionamento pós-login
    } catch (error) {
      // Exibe o popup com uma mensagem amigável
      showErrorPopup("Email ou senha incorretos. Por favor, tente novamente.");
    }
  });
});

// Se já estiver logado, redireciona para /home imediatamente
document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfigEl = document.getElementById("firebase-config");
  if (firebaseConfigEl && typeof firebase !== 'undefined') {
    try {
      const cfg = JSON.parse(firebaseConfigEl.textContent);
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      const auth = firebase.auth();
      auth.onAuthStateChanged((user) => {
        if (user) {
          window.location.replace('/home');
        }
      });
    } catch (e) {
      console.error('Erro ao inicializar Firebase na tela de login:', e);
    }
  }
});
