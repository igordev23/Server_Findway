document.addEventListener("DOMContentLoaded", () => {
  const configElement = document.getElementById("firebase-config");
  const firebaseConfig = JSON.parse(configElement.textContent);
  firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();

  const btnLogin = document.getElementById("btnLogin");
  const erro = document.getElementById("erro");

  btnLogin.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    try {
      await auth.signInWithEmailAndPassword(email, senha);
      window.location.href = "/home";
    } catch (error) {
      console.error("Erro ao fazer login:", error.message);
      erro.textContent = "E-mail ou senha inválidos.";
    }
  });
});
