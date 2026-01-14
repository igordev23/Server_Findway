document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfigEl = document.getElementById("firebase-config");
  if (!firebaseConfigEl || typeof firebase === 'undefined') return;

  try {
    const firebaseConfig = JSON.parse(firebaseConfigEl.textContent);
    
    // Verifica se o Firebase já foi inicializado para evitar erro de duplicidade
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();

    // Força logout ao carregar a página de login para garantir limpeza de sessão
    if (auth.currentUser) {
       auth.signOut();
    }
    // Limpa cookies preventivamente
    document.cookie = "firebase_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";

    // Verifica se já está logado
    auth.onAuthStateChanged(async (user) => {
      // NÃO redireciona automaticamente se estiver na página de login
      // Isso permite que o usuário veja a tela de login e escolha "Sair" ou entrar com outra conta
      // O redirecionamento automático deve ocorrer apenas se o usuário tentar acessar uma página protegida
      
      // Se quiser manter logado, apenas atualiza o cookie, mas não força redirect
      if (user) {
        try {
          const token = await user.getIdToken();
          // Remove cookie antigo antes de setar novo
          document.cookie = "firebase_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
          document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
          // window.location.replace('/home');  <-- REMOVIDO REDIRECIONAMENTO FORÇADO
        } catch (e) {
          console.error("Erro ao obter token:", e);
        }
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
          // Define persistência LOCAL explicitamente antes de logar
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          const result = await auth.signInWithEmailAndPassword(email, senha);
          
          const token = await result.user.getIdToken();
          document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
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