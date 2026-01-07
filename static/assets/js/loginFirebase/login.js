document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = JSON.parse(document.getElementById("firebase-config").textContent);
  firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();

  const emailInput = document.getElementById("email");
  const senhaInput = document.getElementById("senha");
  const btnLogin = document.getElementById("btnLogin");
  const erroMsg = document.getElementById("erro");

  btnLogin.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    try {
      const result = await auth.signInWithEmailAndPassword(email, senha);
      
      // Armazena o token em um cookie para o backend poder ler
      const token = await result.user.getIdToken();
      document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
      
      window.location.href = "/home"; // redirecionamento pós-login
    } catch (error) {
      erroMsg.textContent = "Erro ao fazer login: " + error.message;
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
        auth.onAuthStateChanged(async (user) => {
          if (user) {
            // Armazena o token em um cookie para o backend poder ler
            const token = await user.getIdToken();
            document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
            
            window.location.replace('/home');
          }
        });
      } catch (e) {
        console.error('Erro ao inicializar Firebase na tela de login:', e);
      }
    }
  });