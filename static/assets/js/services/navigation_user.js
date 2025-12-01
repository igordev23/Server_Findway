document.addEventListener("DOMContentLoaded", () => {
  const nameSpan = document.querySelector("#navbarUserName");

  if (!nameSpan) return;

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
    console.error("Erro ao inicializar Firebase na navbar:", error);
  }

  if (!auth) return;

  auth.onAuthStateChanged((user) => {
    if (!user) {
      nameSpan.textContent = "Visitante";
      return;
    }

    const baseNome = user.displayName || user.email || "Usuário";
    nameSpan.textContent = baseNome;

    // Opcional: guardar UID/email para outras páginas
    try {
      localStorage.setItem(
        "fw_current_user",
        JSON.stringify({ uid: user.uid, email: user.email || null })
      );
    } catch (_) {
      // ignore storage errors
    }
  });
});


