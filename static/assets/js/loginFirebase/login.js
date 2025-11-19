document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = JSON.parse(document.getElementById("firebase-config").textContent);
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

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
      await auth.signInWithEmailAndPassword(email, senha);
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