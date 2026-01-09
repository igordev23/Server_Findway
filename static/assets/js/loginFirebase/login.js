document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfigEl = document.getElementById("firebase-config");
  if (!firebaseConfigEl) return;

  try {
    const firebaseConfig = JSON.parse(firebaseConfigEl.textContent);
    
    // Verifica se o Firebase já foi inicializado para evitar erro de duplicidade
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();

    // Se já estiver logado, redireciona para /home
    auth.onAuthStateChanged((user) => {
      if (user) {
        window.location.replace('/home');
      }
    });

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

    if (btnLogin) {
      btnLogin.addEventListener("click", async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const senha = senhaInput.value.trim();

        try {
          await auth.signInWithEmailAndPassword(email, senha);
          // O redirecionamento será tratado pelo onAuthStateChanged, 
          // mas podemos forçar aqui também para garantir
          window.location.href = "/home";
        } catch (error) {
          console.error("Erro no login:", error);
          // Exibe o popup com uma mensagem amigável
          showErrorPopup("Email ou senha incorretos. Por favor, tente novamente.");
        }
      });
    }

  } catch (e) {
    console.error('Erro ao inicializar Firebase ou processar login:', e);
  }
});
