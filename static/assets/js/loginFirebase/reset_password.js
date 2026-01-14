document.addEventListener("DOMContentLoaded", () => {
    // Obtém a configuração do Firebase do elemento HTML
    const firebaseConfig = JSON.parse(document.getElementById("firebase-config").textContent);

    // Inicializa o Firebase, caso ainda não tenha sido inicializado
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const resetEmail = document.getElementById("resetEmail");
    const successMessage = document.getElementById("successMessage");
    const errorMessage = document.getElementById("errorMessage");

    resetPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = resetEmail.value.trim();

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            successMessage.textContent = "Um link de redefinição de senha foi enviado para o seu e-mail. Verifique também a sua caixa de spam.";
            successMessage.style.display = "block";
            errorMessage.style.display = "none";
        } catch (error) {
            errorMessage.textContent = "Erro ao enviar o e-mail: " + error.message;
            errorMessage.style.display = "block";
            successMessage.style.display = "none";
        }
    });
});
