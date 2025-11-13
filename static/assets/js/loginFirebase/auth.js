document.addEventListener("DOMContentLoaded", () => {
      const firebaseConfigEl = document.getElementById("firebase-config");
      let auth = null;

      if (firebaseConfigEl && typeof firebase !== 'undefined') {
        try {
          const firebaseConfig = JSON.parse(firebaseConfigEl.textContent);
          if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
          auth = firebase.auth();
        } catch (e) {
          console.error("Erro ao inicializar Firebase:", e);
        }
      }

      let hasRedirected = false;

      if (auth) {
        const isLoginPage = window.location.pathname === "/login" || window.location.pathname === "/";
        // Protege páginas (todas que carregam firebase_config) exceto a página de login
        if (!isLoginPage) {
          auth.onAuthStateChanged((user) => {
            if (!user && !hasRedirected) {
              hasRedirected = true;
              window.location.replace("/login?logged_out=1");
            }
          });

          // Fallback: se após 1.5s o currentUser continuar null, redireciona (evita acesso manual via URL)
          setTimeout(() => {
            try {
              if (!auth.currentUser && !hasRedirected) {
                hasRedirected = true;
                window.location.replace("/login?logged_out=1");
              }
            } catch (e) {
              console.error("Erro ao verificar auth.currentUser:", e);
            }
          }, 1500);
        } else {
          // Na página de login, redireciona para /home se já houver usuário autenticado
          auth.onAuthStateChanged((user) => {
            if (user) {
              window.location.replace("/home");
            }
          });
        }
      }

      // 🔴 Captura o link "Sair" do dropdown
      const logoutLink = document.getElementById("logoutLink");
      if (logoutLink) {
        logoutLink.addEventListener("click", async (event) => {
          event.preventDefault(); // evita recarregar a página
          try {
            if (auth) {
              await auth.signOut();
            }
            localStorage.removeItem("token");
            window.location.replace("/login?logged_out=1");
          } catch (error) {
            console.error("Erro ao sair:", error);
          }
        });
      }
    });