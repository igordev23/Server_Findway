document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfigEl = document.getElementById("firebase-config");
  if (!firebaseConfigEl || typeof firebase === 'undefined') return;

  try {
    const firebaseConfig = JSON.parse(firebaseConfigEl.textContent);
    
    // Inicializa Firebase se ainda não foi inicializado
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");
    const btnLogin = document.getElementById("btnLogin");
    const erroMsg = document.getElementById("erro");

    // Verifica se já está logado
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Armazena o token em um cookie para o backend poder ler
        try {
          const token = await user.getIdToken();
          document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
          window.location.replace('/home');
        } catch (e) {
          console.error("Erro ao obter token:", e);
        }
      }
    });

    if (btnLogin) {
      btnLogin.addEventListener("click", async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const senha = senhaInput.value.trim();

        try {
          // Define persistência LOCAL explicitamente antes de logar
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          const result = await auth.signInWithEmailAndPassword(email, senha);
          
          // O redirecionamento será tratado pelo onAuthStateChanged acima, 
          // mas para garantir UX rápida, podemos fazer aqui também se o listener demorar.
          // Mas é mais seguro deixar o listener lidar ou redirecionar manualmente aqui também.
          
          const token = await result.user.getIdToken();
          document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
          window.location.href = "/home"; 
        } catch (error) {
          if (erroMsg) erroMsg.textContent = "Erro ao fazer login: " + error.message;
          console.error("Erro login:", error);
        }
      });
    }

  } catch (e) {
    console.error('Erro ao inicializar Firebase na tela de login:', e);
  }
});