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
      try {
        firebase.initializeApp(firebaseConfig);
      } catch (e) {
        console.warn("Firebase já inicializado ou erro na inicialização:", e);
      }
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
          // Não redireciona imediatamente. Deixa o fallback de 5s decidir.
          // Isso evita loop se o Firebase demorar para inicializar ou se houver "flicker" de estado.
          console.log("AuthStateChanged: !user. Aguardando confirmação...");
        }
      } else {
        user.getIdToken().then((token) => {
          document.cookie = `firebase_token=${token}; path=/; max-age=3600`;
          // Só redireciona APÓS definir o cookie para garantir que o backend receba o token
          if (isLoginPage) {
             // Limpa flag de redirecionamento antes de ir para home
             sessionStorage.removeItem('last_auth_redirect');
             window.location.replace("/home");
          }
        }).catch(() => {
             // Mesmo se falhar o token, tenta redirecionar se estiver no login, 
             // mas provavelmente falhará no backend. Melhor deixar o usuário tentar de novo ou mostrar erro.
        });
        
        auth.onIdTokenChanged(async (u) => {
          if (u) {
            try {
              const t = await u.getIdToken();
              document.cookie = `firebase_token=${t}; path=/; max-age=3600`;
            } catch (_) {}
          }
        });
        
        const email = user.email || "";
        if (email) {
          fetch(`/usuarios/verificar-role?email=${encodeURIComponent(email)}`)
            .then(r => r.ok ? r.json() : Promise.reject(r))
            .then(data => {
              const isAdmin = !!data.is_admin;
              const isSuperAdmin = !!data.is_super_admin;
              
              if (isAdmin && data.user_id) {
                window.ADMIN_ID = data.user_id;
                document.dispatchEvent(new CustomEvent('auth:admin-resolved', { detail: { adminId: data.user_id } }));
              }

              const adminMenu = document.getElementById("adminMenu");
              const clientMenu = document.getElementById("clientMenu");
              const superAdminLink = document.getElementById("superAdminLink");
              
              // Lógica de controle de acesso e menus
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
                
                // Bloqueia acesso a páginas de admin para não-admins
                if (window.location.pathname.startsWith("/admin")) {
                   window.location.replace("/home");
                }
              }
            })
            .catch(() => {
              // Removido redirecionamento para permitir acesso a todos
            });
        }
      }
    });

    /**
     * Fallback: verifica após 5 segundos se o estado foi definido
     * (para pegar acessos manuais por URL antes do Firebase carregar)
     */
    setTimeout(() => {
      // Verifica se o usuário NÃO está logado e NÃO está na página de login
      // Aumentado para 5s para evitar redirecionamentos em conexões lentas
      if (!isLoginPage && !auth.currentUser) {
        // Verifica se existe o cookie de token antes de redirecionar
        const hasTokenCookie = document.cookie.split('; ').find(row => row.startsWith('firebase_token='));
        
        if (hasTokenCookie) {
           console.log("Fallback: Token cookie encontrado. Aguardando sincronização do Firebase...");
           // Se o cookie existe, provavelmente o Firebase vai carregar ou já carregou.
           // Não redirecionamos para evitar loop se o Firebase estiver lento mas o cookie estiver lá.
           return;
        }

        // Verifica se já tentou redirecionar recentemente para evitar loop
        const lastRedirect = sessionStorage.getItem('last_auth_redirect');
        const now = Date.now();
        
        if (!lastRedirect || (now - parseInt(lastRedirect) > 10000)) {
           sessionStorage.setItem('last_auth_redirect', now.toString());
           window.location.replace("/login?logged_out=1");
        }
      }
    }, 5000);

    /**
     * Tratamento de logout via botão "Sair"
     */
    const logoutLink = document.getElementById("logoutLink");
    if (logoutLink) {
      logoutLink.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await auth.signOut();
          document.cookie = "firebase_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          window.location.replace("/login?logged_out=1");
        } catch (error) {
          console.error("Erro ao fazer logout:", error);
        }
      });
    }

  } catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
  }
});
