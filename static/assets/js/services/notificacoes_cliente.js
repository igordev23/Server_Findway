
document.addEventListener("DOMContentLoaded", () => {
  const listaContainer = document.getElementById("notificacoes-lista");

  // Helper to format date
  function formatTime(isoString) {
    if (!isoString) return "--:--";
    const date = new Date(isoString);
    return date.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
  }

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
    return date.toLocaleDateString("pt-BR");
  }

  let currentFilter = 'all';
  let allNotifications = []; // Store fetched notifications for filtering

  // Filter Button Logic
  const filterButtons = document.querySelectorAll('#notification-filters button');
  filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
          // Remove active class from all
          filterButtons.forEach(b => {
              b.classList.remove('active', 'btn-dark');
              b.classList.add('btn-outline-secondary'); // Default style
              
              // Restore specific colors for specific buttons if needed, 
              // but for simplicity let's just toggle active state visual
              if(b.dataset.filter === 'MOVIMENTO') b.classList.replace('btn-dark', 'btn-outline-danger');
              if(b.dataset.filter === 'ALERTA') b.classList.replace('btn-dark', 'btn-outline-warning');
          });

          // Add active to clicked
          btn.classList.add('active', 'btn-dark');
          btn.classList.remove('btn-outline-secondary', 'btn-outline-danger', 'btn-outline-warning', 'btn-outline-info');

          currentFilter = btn.dataset.filter;
          renderNotifications();
      });
  });

  // Helper to manage offline read status in LocalStorage
  function isOfflineRead(placa, timestamp) {
      const key = `offline_read_${placa}`;
      const saved = localStorage.getItem(key);
      return saved === timestamp;
  }

  function markOfflineRead(placa, timestamp) {
      const key = `offline_read_${placa}`;
      localStorage.setItem(key, timestamp);
  }

  function createNotificationCard(id, type, title, time, message, badgeColor, iconClass, isRead) {
    const bgClass = isRead ? 'bg-white' : 'bg-light';
    const dotHtml = isRead ? '' : `<span class="position-absolute top-0 start-0 translate-middle p-1 bg-primary border border-light rounded-circle" style="left: 10px !important; top: 15px !important;"></span>`;
    
    // Cursor pointer indicates clickable
    return `
      <div class="list-group-item d-flex align-items-start gap-3 ${bgClass} position-relative" 
           id="notif-${id}" 
           onclick="markAsRead('${id}')" 
           style="cursor: pointer; transition: background-color 0.2s;">
        ${dotHtml}
        <div class="rounded-circle p-2 bg-${badgeColor} bg-opacity-10 text-${badgeColor}">
            <i class="${iconClass} fs-5"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start">
            <h6 class="mb-1 fw-bold ${isRead ? 'text-secondary' : 'text-dark'}">${title}</h6>
            <div class="d-flex align-items-center">
                <small class="text-muted me-2">${time}</small>
            </div>
          </div>
          <p class="mb-0 text-muted small">
            ${message}
          </p>
        </div>
      </div>
    `;
  }

  // Global function for onclick
  window.markAsRead = async function(id) {
      if(!id) return;
      
      // Find notification object
      const notifIndex = allNotifications.findIndex(n => n.id == id);
      if (notifIndex === -1) return;
      
      const notif = allNotifications[notifIndex];
      if (notif.lido) return; // Already read

      // Optimistic UI update
      notif.lido = true;
      renderNotifications();

      if (String(id).startsWith('offline_')) {
          // Handle offline event (Local Storage)
          const placa = id.split('_')[1];
          if (notif.rawTimestamp) {
              markOfflineRead(placa, notif.rawTimestamp);
          }
      } else {
          // Handle server event
          try {
              const res = await fetch(`/eventos/${id}/ler`, { method: 'POST' });
              if(!res.ok) {
                  // Revert if failed
                  notif.lido = false;
                  renderNotifications();
                  console.error("Falha ao marcar como lido no servidor");
              }
          } catch(e) {
              notif.lido = false;
              renderNotifications();
              console.error("Erro ao marcar como lido", e);
          }
      }
  }

  // Mark All Listener
  const btnMarkAll = document.getElementById("btnMarkAllRead");
  if (btnMarkAll) {
      btnMarkAll.addEventListener("click", async () => {
          if (!currentUserId) return;

          // 1. Mark server events
          try {
              const res = await fetch(`/eventos/cliente/${currentUserId}/ler-todos`, { method: 'POST' });
              if (res.ok) {
                  // Update local state for server events
                  allNotifications.forEach(n => {
                      if (!String(n.id).startsWith('offline_')) {
                          n.lido = true;
                      }
                  });
              }
          } catch (e) {
              console.error("Erro ao marcar todos como lidos (server)", e);
          }

          // 2. Mark offline events (Local Storage)
          allNotifications.forEach(n => {
              if (String(n.id).startsWith('offline_') && !n.lido) {
                   n.lido = true;
                   const placa = n.id.split('_')[1];
                   if (n.rawTimestamp) {
                       markOfflineRead(placa, n.rawTimestamp);
                   }
              }
          });

          renderNotifications();
      });
  }


  function renderNotifications() {
      if (allNotifications.length === 0) {
        listaContainer.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-bell-slash fs-1 mb-3 d-block"></i>Nenhuma notificação encontrada.</div>';
        return;
      }

      let filtered = allNotifications;
      if (currentFilter !== 'all') {
          if (currentFilter === 'unread') {
              filtered = allNotifications.filter(n => !n.lido);
          } else {
              filtered = allNotifications.filter(n => n.tipo === currentFilter || (currentFilter === 'offline' && n.tipo === 'offline'));
          }
      }

      if (filtered.length === 0) {
          listaContainer.innerHTML = '<div class="p-4 text-center text-muted">Nenhum alerta neste filtro.</div>';
          return;
      }

      let html = "";
      for (const n of filtered) {
          html += createNotificationCard(
              n.id,
              n.tipo,
              n.title,
              n.timeAgo,
              n.message,
              n.color,
              n.icon,
              n.lido
          );
      }
      listaContainer.innerHTML = html;
  }

  async function loadNotifications(userEmail) {
    try {
      // 1. Get User ID
      const usuarios = await fetch("/usuarios").then(r => r.json());
      const usuario = usuarios.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());

      if (!usuario) {
        listaContainer.innerHTML = '<div class="p-3 text-center text-muted">Usuário não encontrado.</div>';
        return;
      }
      
      currentUserId = usuario.id; // Store globally for actions

      // 2. Get Vehicles
      let veiculos = [];
      try {
        veiculos = await fetch(`/veiculos/cliente/${usuario.id}`).then(r => r.json());
      } catch (e) {
        console.error("Erro ao buscar veículos", e);
      }

      if (!Array.isArray(veiculos) || veiculos.length === 0) {
        listaContainer.innerHTML = '<div class="p-3 text-center text-muted">Nenhum veículo encontrado para monitorar.</div>';
        return;
      }

      let tempNotifications = [];

      // 3. Check Status for each vehicle (Offline logic)
      for (const v of veiculos) {
        try {
          const statusData = await fetch(`/localizacao/status/${v.placa}`).then(r => r.json());
          
          if (statusData.status_gps === "Offline") {
            const timeStr = formatTime(statusData.timestamp);
            const timeAgoStr = timeAgo(statusData.timestamp);
            const rawTs = statusData.timestamp; // keep raw for localstorage check
            
            tempNotifications.push({
                id: `offline_${v.placa}`, // Unique ID per vehicle
                tipo: 'offline',
                title: "Perda de conexão",
                timeAgo: timeAgoStr,
                message: `O rastreador ficou offline por mais de 10 segundos. Última posição registrada às ${timeStr}.`,
                color: "warning",
                icon: "bi bi-wifi-off",
                lido: isOfflineRead(v.placa, rawTs),
                timestamp: new Date(statusData.timestamp),
                rawTimestamp: rawTs
            });
          }
        } catch (err) {
          console.error(`Erro ao verificar status da placa ${v.placa}`, err);
        }
      }

      // 4. Fetch Backend Events
      try {
        const eventos = await fetch(`/eventos/cliente/${usuario.id}`).then(r => r.json());
        if (Array.isArray(eventos)) {
           for (const e of eventos) {
             const timeAgoStr = timeAgo(e.timestamp);
             let icon = "bi-info-circle";
             let color = "primary";
             let title = e.tipo || "Evento";
             
             if (e.tipo === "ALERTA") { 
               icon = "bi-exclamation-triangle"; 
               color = "warning"; 
             } else if (e.tipo === "MOVIMENTO") {
               icon = "bi-exclamation-octagon";
               color = "danger";
               title = "Movimento detectado";
             } else if (e.tipo === "PARADA") {
               icon = "bi-stop-circle";
               color = "secondary";
               title = "Veículo parado";
             }
             
             tempNotifications.push({
                 id: e.id,
                 tipo: e.tipo,
                 title: title,
                 timeAgo: timeAgoStr,
                 message: e.descricao,
                 color: color,
                 icon: icon,
                 lido: e.lido,
                 timestamp: new Date(e.timestamp)
             });
           }
        }
      } catch (e) {
        console.log("Sem eventos históricos ou erro API");
      }
      
      // Sort by timestamp desc (already mostly sorted but good to ensure mixed types are sorted)
      // Note: offline events rely on last location timestamp, events on event timestamp
      // Assuming 'timestamp' property is Date object
      // tempNotifications.sort((a, b) => b.timestamp - a.timestamp); // Optional

      allNotifications = tempNotifications;
      renderNotifications();

    } catch (error) {
      console.error("Erro geral", error);
      listaContainer.innerHTML = '<div class="p-3 text-center text-danger">Erro ao carregar notificações.</div>';
    }
  }

  // Auth Observer
  if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.email) {
        loadNotifications(user.email);
      } else {
        listaContainer.innerHTML = '<div class="p-3 text-center text-muted">Faça login para ver as notificações.</div>';
      }
    });
  } else {
    // Fallback/Dev mode
    console.warn("Firebase not loaded");
  }
});
