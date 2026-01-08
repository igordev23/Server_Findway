document.addEventListener("DOMContentLoaded", () => {
  const badge = document.getElementById("navbarNotificationBadge");
  const listContainer = document.getElementById("navbarNotificationsList");
  let currentUserId = null;

  // Helper: Format Time Ago
  function timeAgo(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `há ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours} h`;
    
    const isCurrentYear = date.getFullYear() === now.getFullYear();
    const options = { day: '2-digit', month: '2-digit' };
    if (!isCurrentYear) options.year = 'numeric';
    
    return date.toLocaleDateString("pt-BR", options);
  }

  // Helper: Check offline read status
  function isOfflineRead(placa, timestamp) {
      const key = `offline_read_${placa}`;
      const saved = localStorage.getItem(key);
      return saved === timestamp;
  }

  function markOfflineRead(placa, timestamp) {
      const key = `offline_read_${placa}`;
      localStorage.setItem(key, timestamp);
  }

  // Helper: Mark as read action
  window.markNavbarNotificationRead = async function(id, element) {
      // Optimistic update
      if (element) {
          element.classList.remove("bg-light");
          const dot = element.querySelector(".badge-dot");
          if (dot) dot.remove();
      }

      // Update Badge
      if (badge) {
          let count = parseInt(badge.innerText) || 0;
          if (count > 0) {
              count--;
              badge.innerText = count;
              if (count === 0) badge.classList.add("d-none");
          }
      }

      if (String(id).startsWith('offline_')) {
           const parts = id.split('_');
           // id format: offline_PLACA_TIMESTAMP
           // actually let's pass the raw timestamp if possible or store it in element dataset
           if (element && element.dataset.rawTimestamp) {
               markOfflineRead(parts[1], element.dataset.rawTimestamp);
           }
      } else {
          try {
              await fetch(`/eventos/${id}/ler`, { method: 'POST' });
          } catch(e) {
              console.error("Erro ao marcar como lido", e);
          }
      }
      
      // Redirect if needed or just stay
      // element.click() might have triggered navigation if it was an <a> tag
  }

  async function fetchNotifications() {
      if (!currentUserId) return;

      try {
          // 1. Fetch Vehicles (for offline check)
          let veiculos = [];
          try {
            veiculos = await fetch(`/veiculos/cliente/${currentUserId}`).then(r => r.json());
          } catch (e) {}

          let allNotifs = [];

          // 2. Check Offline Status
          if (Array.isArray(veiculos)) {
              for (const v of veiculos) {
                  try {
                      const statusData = await fetch(`/localizacao/status/${v.placa}`).then(r => r.json());
                      if (statusData.status_gps === "Offline") {
                          const rawTs = statusData.timestamp;
                          if (!isOfflineRead(v.placa, rawTs)) {
                              const dt = new Date(statusData.timestamp);
                              if (!isNaN(dt.getTime())) {
                                  allNotifs.push({
                                      id: `offline_${v.placa}`,
                                      tipo: 'offline',
                                      descricao: `Veículo ${v.placa} perdeu conexão.`,
                                      timestamp: dt,
                                      lido: false,
                                      rawTimestamp: rawTs
                                  });
                              }
                          }
                      }
                  } catch (e) {}
              }
          }

          // 3. Fetch Server Events
          try {
              const eventos = await fetch(`/eventos/cliente/${currentUserId}`).then(r => r.json());
              if (Array.isArray(eventos)) {
                  // Take the most recent 10 events (read or unread)
                  // The backend sorts by timestamp desc, so first items are newest
                  const recentEvents = eventos.slice(0, 10);
                  
                  recentEvents.forEach(e => {
                      const dt = new Date(e.timestamp);
                      if (!isNaN(dt.getTime())) {
                          allNotifs.push({
                              id: e.id,
                              tipo: e.tipo,
                              descricao: e.descricao,
                              timestamp: dt,
                              lido: e.lido // Use actual status
                          });
                      }
                  });
              }
          } catch (e) {}

          // Sort by date desc
          allNotifs.sort((a, b) => {
              const tA = a.timestamp.getTime();
              const tB = b.timestamp.getTime();
              return tB - tA;
          });

          renderNavbarNotifications(allNotifs);

      } catch (error) {
          console.error("Erro ao carregar notificações navbar", error);
          if (listContainer) listContainer.innerHTML = '<li class="text-center py-2 text-danger small">Erro ao carregar</li>';
      }
  }

  function renderNavbarNotifications(notifs) {
      if (!listContainer) return;
      
      const unreadCount = notifs.filter(n => !n.lido).length;
      
      // Update Badge
      if (badge) {
          badge.innerText = unreadCount;
          if (unreadCount > 0) badge.classList.remove("d-none");
          else badge.classList.add("d-none");
      }

      if (notifs.length === 0) {
          listContainer.innerHTML = `
            <li class="text-center py-5 text-muted">
                <i class="bi bi-bell mb-2 d-block" style="font-size: 2rem;"></i>
                <small>Você não tem nenhuma nova notificação</small>
            </li>
          `;
          return;
      }

      // Show max 5 in navbar
      const sliced = notifs.slice(0, 5);
      
      listContainer.innerHTML = sliced.map(n => {
          let icon = "bi-info-circle";
          let color = "text-primary";
          
          if (n.tipo === "offline") { icon = "bi-wifi-off"; color = "text-warning"; }
          else if (n.tipo === "ALERTA") { icon = "bi-exclamation-triangle"; color = "text-warning"; }
          else if (n.tipo === "MOVIMENTO") { icon = "bi-exclamation-octagon"; color = "text-danger"; }
          else if (n.tipo === "PARADA") { icon = "bi-stop-circle"; color = "text-secondary"; }

          // Pass raw timestamp for offline handling
          const dataAttr = n.rawTimestamp ? `data-raw-timestamp="${n.rawTimestamp}"` : "";
          
          const isUnread = !n.lido;
          const bgClass = isUnread ? "bg-light" : "bg-white";
          const dotHtml = isUnread ? `<span class="position-absolute top-0 start-0 translate-middle p-1 bg-danger border border-light rounded-circle badge-dot" style="left: 10px !important; top: 10px !important;"></span>` : "";
          const textWeight = isUnread ? "fw-bold" : "fw-normal";

          return `
            <li>
                <a href="#" 
                   class="dropdown-item py-2 border-bottom position-relative d-flex align-items-start gap-2 ${bgClass}"
                   onclick="markNavbarNotificationRead('${n.id}', this); return false;"
                   ${dataAttr}>
                   
                   <div class="mt-1 ${color}"><i class="${icon}"></i></div>
                   <div class="w-100">
                       <div class="d-flex justify-content-between">
                           <strong class="small text-dark ${textWeight}">${n.tipo === 'offline' ? 'Conexão' : n.tipo}</strong>
                           <small class="text-muted" style="font-size: 0.7rem;">${timeAgo(n.timestamp)}</small>
                       </div>
                       <div class="text-secondary small text-truncate" style="max-width: 200px;">
                           ${n.descricao}
                       </div>
                   </div>
                   ${dotHtml}
                </a>
            </li>
          `;
      }).join('');
  }

  // Auth Observer (Reuse Firebase logic or fetch user)
  if (typeof firebase !== 'undefined') {
    // Ensure initialized
    try {
        const cfgEl = document.getElementById("firebase-config");
        if (cfgEl && !firebase.apps.length) {
             const cfg = JSON.parse(cfgEl.textContent);
             firebase.initializeApp(cfg);
        }
    } catch(e) { console.error("Erro init firebase navbar", e); }

    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.email) {
        // We need the internal ID, similar to notificacoes_cliente.js
        fetch("/usuarios").then(r => r.json()).then(users => {
             const found = users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
             if (found) {
                 currentUserId = found.id;
                 fetchNotifications();
                 // Poll every 5s (Real-time feel)
                 setInterval(fetchNotifications, 5000);
             } else {
                 // User logged in firebase but not found in DB
                 if (listContainer) listContainer.innerHTML = '<li class="text-center py-2 text-danger small">Usuário não vinculado</li>';
             }
        }).catch(() => {
             if (listContainer) listContainer.innerHTML = '<li class="text-center py-2 text-danger small">Erro de conexão</li>';
        });
      } else {
          // Not logged in
          if (listContainer) listContainer.innerHTML = '<li class="text-center py-2 text-muted small">Faça login</li>';
      }
    });
  } else {
      console.warn("Firebase não carregado na navbar");
      if (listContainer) listContainer.innerHTML = '<li class="text-center py-2 text-danger small">Sistema indisponível</li>';
  }
});
