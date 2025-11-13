/**
 * Verificação centralizada de autenticação Firebase
 * Redireciona usuários não autenticados para a página de login
 * Executa em todas as páginas que carregam este script
 */

document.addEventListener("DOMContentLoaded", () => {
  // Verifica se existe a configuração do Firebase na página
  const firebaseConfigEl = document.getElementById("firebase-config");
  
  if (!firebaseConfigEl || typeof firebase === 'undefined') {
    // Se não houver Firebase configurado, permite acesso (ex: páginas de erro)
    return;
  }

  try {
    const firebaseConfig = JSON.parse(firebaseConfigEl.textContent);
    
    // Inicializa Firebase se ainda não foi inicializado
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath === "/login" || currentPath === "/";

    /**
     * Monitora mudanças de estado de autenticação
     */
    auth.onAuthStateChanged((user) => {
      if (!user) {
        // Usuário não autenticado
        if (!isLoginPage) {
          // Redireciona para login se não estiver na página de login
          window.location.replace("/login?logged_out=1");
        }
      } else {
        // Usuário autenticado
        if (isLoginPage) {
          // Redireciona para home se estiver na página de login
          window.location.replace("/home");
        }
      }
    });

    /**
     * Fallback: verifica após 2 segundos se o estado foi definido
     * (para pegar acessos manuais por URL antes do Firebase carregar)
     */
    setTimeout(() => {
      if (!isLoginPage && !auth.currentUser) {
        window.location.replace("/login?logged_out=1");
      }
    }, 2000);

    /**
     * Tratamento de logout via botão "Sair"
     */
    const logoutLink = document.getElementById("logoutLink");
    if (logoutLink) {
      logoutLink.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await auth.signOut();
          localStorage.removeItem("token");
          window.location.replace("/login?logged_out=1");
        } catch (error) {
          console.error("Erro ao fazer logout:", error);
        }
      });
    }

  } catch (error) {
    console.error("Erro ao inicializar verificação de autenticação:", error);
  }
});
