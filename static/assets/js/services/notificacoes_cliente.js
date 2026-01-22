
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
  function mapTipoToGrupo(tipo) {
    const t = String(tipo || '').toUpperCase();
    if (t === 'MOVIMENTO') return 'MOVIMENTO';
    if (t === 'PARADA') return 'PARADA';
    if (t === 'ALERTA') return 'ALERTA';
    if (t === 'PAGAMENTO' || t === 'ATRASO') return 'FINANCEIRO';
    if (t === 'CADASTRO') return 'CADASTRO';
    if (t === 'VEICULO_LIGADO' || t === 'LIGADO' || t === 'VEICULO_DESLIGADO' || t === 'DESLIGADO') return 'IGNICAO';
    if (t === 'CONEXAO' || t === 'CONEXAO_PERDIDA' || t === 'OFFLINE') return 'CONEXAO';
    return 'outros';
  }

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

  function createNotificationCard(id, type, title, time, message, badgeColor, iconClass, isRead) {
    const bgClass = isRead ? 'bg-white' : 'bg-light';
    const dotHtml = isRead ? '' : `<span class="position-absolute top-0 start-0 translate-middle p-1 bg-primary border border-light rounded-circle" style="left: 10px !important; top: 15px !important;"></span>`;
    const readBtnHtml = isRead ? '' : `<button class="btn btn-link btn-sm text-decoration-none p-0 ms-2" onclick="markAsRead('${id}')" title="Marcar como lida"><i class="bi bi-check-circle"></i></button>`;
    
    // For offline events (no ID in DB yet for this view logic), we handle differently or just show as unread always/never
    // But user wants db events mainly. For offline logic which is client-computed, we can't persist "read" easily without a real event.
    // For now, let's assume offline logic is just visual and transient.

    return `
      <div class="list-group-item d-flex align-items-start gap-3 ${bgClass} position-relative" id="notif-${id}" onclick="handleNotificationClick('${id}')">
        ${dotHtml}
        <div class="rounded-circle p-2 bg-${badgeColor} bg-opacity-10 text-${badgeColor}">
            <i class="${iconClass} fs-5"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start">
            <h6 class="mb-1 fw-bold ${isRead ? 'text-secondary' : 'text-dark'}">${title}</h6>
            <div class="d-flex align-items-center">
                <small class="text-muted me-2">${time}</small>
                ${id && id !== 'offline' ? readBtnHtml : ''}
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
      try {
          const res = await fetch(`/eventos/${id}/ler`, { method: 'POST' });
          if(res.ok) {
              // Update local state
              const notif = allNotifications.find(n => n.id == id);
              if(notif) notif.lido = true;
              renderNotifications(); // Re-render to update UI
          }
      } catch(e) {
          console.error("Erro ao marcar como lido", e);
      }
  }

  window.handleNotificationClick = async function(id) {
      if (!id) return;
      await window.markAsRead(id);
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
              filtered = allNotifications.filter(n => mapTipoToGrupo(n.tipo) === currentFilter);
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

      if (!Array.isArray(veiculos)) {
        veiculos = [];
      }

      let tempNotifications = [];

      // 3. Check Status for each vehicle (Offline logic)
      if (veiculos.length > 0) {
          for (const v of veiculos) {
            try {
              const statusData = await fetch(`/localizacao/status/${v.placa}`).then(r => r.json());
              
              if (statusData.status_gps === "Offline") {
                // Persisted backend events will handle connection loss notifications
              }
            } catch (err) {
              console.error(`Erro ao verificar status da placa ${v.placa}`, err);
            }
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
             const tipoNorm = String(e.tipo || "").toUpperCase();
             
             if (tipoNorm === "ALERTA") { 
               icon = "bi-exclamation-triangle"; 
               color = "warning"; 
             } else if (tipoNorm === "MOVIMENTO") {
               icon = "bi-exclamation-octagon";
               color = "danger";
               title = "Movimento detectado";
             } else if (tipoNorm === "PARADA") {
               icon = "bi-stop-circle";
               color = "secondary";
               title = "Veículo parado";
             } else if (tipoNorm === "PAGAMENTO") {
               icon = "bi-check-circle-fill";
               color = "success";
               title = "Pagamento Efetuado";
             } else if (tipoNorm === "ATRASO") {
               icon = "bi-clock-history";
               color = "danger";
               title = "Pagamento em Atraso";
             } else if (tipoNorm === "CADASTRO") {
               icon = "bi-car-front-fill";
               color = "info";
               title = "Novo Veículo";
             } else if (tipoNorm === "VEICULO_LIGADO" || tipoNorm === "LIGADO") {
               icon = "bi-key-fill";
               color = "success";
               title = "Veículo Ligado";
             } else if (tipoNorm === "VEICULO_DESLIGADO" || tipoNorm === "DESLIGADO") {
               icon = "bi-key";
               color = "secondary";
               title = "Veículo Desligado";
             } else if (tipoNorm === "CONEXAO" || tipoNorm === "CONEXAO_PERDIDA") {
               icon = "bi-wifi-off";
               color = "warning";
               title = "Perda de conexão";
             }
             
             tempNotifications.push({
                 id: e.id,
                 tipo: e.tipo,
                 grupo: mapTipoToGrupo(e.tipo),
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
      
      tempNotifications.sort((a, b) => b.timestamp - a.timestamp);

      allNotifications = tempNotifications;
      // Hide ALERTA filter if no items of this group
      const alertaBtn = document.querySelector('#notification-filters button[data-filter="ALERTA"]');
      if (alertaBtn) {
          const hasAlerta = allNotifications.some(n => mapTipoToGrupo(n.tipo) === 'ALERTA');
          alertaBtn.classList.toggle('d-none', !hasAlerta);
      }
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
        const btnAll = document.getElementById("btnMarkAllRead");
        if (btnAll) {
            btnAll.addEventListener("click", async () => {
                try {
                    if (currentUserId) {
                        await fetch(`/eventos/cliente/${currentUserId}/ler-todos`, { method: 'POST' });
                        allNotifications = allNotifications.map(n => ({ ...n, lido: true }));
                        renderNotifications();
                    }
                } catch (e) {
                    console.error("Erro ao marcar todas como lidas", e);
                }
            });
        }
      } else {
        listaContainer.innerHTML = '<div class="p-3 text-center text-muted">Faça login para ver as notificações.</div>';
      }
    });
  } else {
    // Fallback/Dev mode
    console.warn("Firebase not loaded");
  }
});
