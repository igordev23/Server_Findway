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
        if (!isLoginPage) {
          window.location.replace("/login?logged_out=1");
        }
      } else {
        if (isLoginPage) {
          window.location.replace("/home");
        }
        const email = user.email || "";
        const accessingAdmin = currentPath.startsWith("/admin");
        if (email) {
          fetch(`/usuarios/verificar-role?email=${encodeURIComponent(email)}`)
            .then(r => r.ok ? r.json() : Promise.reject(r))
            .then(data => {
              const isAdmin = !!data.is_admin;
              const isSuperAdmin = !!data.is_super_admin;
              
              const adminMenu = document.getElementById("adminMenu");
              const clientMenu = document.getElementById("clientMenu");
              const superAdminLink = document.getElementById("superAdminLink");
              
              // Lógica antiga de adminSection removida em favor dos novos IDs
              if (isAdmin) {
                if (adminMenu) adminMenu.classList.remove("d-none");
                if (clientMenu) clientMenu.classList.add("d-none");
                
                // Exibe link de gestão de empresas se for super admin
                if (isSuperAdmin && superAdminLink) {
                    superAdminLink.classList.remove("d-none");
                }
              } else {
                if (adminMenu) adminMenu.classList.add("d-none");
                if (clientMenu) clientMenu.classList.remove("d-none");
              }

              if (accessingAdmin && !isAdmin) {
                window.location.replace("/home");
              }
            })
            .catch(() => {
              if (accessingAdmin) {
                window.location.replace("/home");
              }
            });
        } else if (accessingAdmin) {
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
