const DashboardApi = (() => {
  const defaultHeaders = { "Content-Type": "application/json" };

  async function request(url, options = {}) {
    const separator = url.includes("?") ? "&" : "?";
    const urlWithCache = `${url}${separator}_t=${Date.now()}`;
    const config = { headers: defaultHeaders, ...options };
    const response = await fetch(urlWithCache, config);
    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
    if (!response.ok) {
      const error = new Error(data?.error || `Erro ao chamar ${url}`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  return {
    listVehicles: () => request("/veiculos"),
    listVehiclesByAdmin: (id) => request(`/veiculos/admin/${id}`),
    listLocationsHistorico: () => request("/localizacao/historico"),
    listLocationsHistoricoByAdmin: (id) => request(`/localizacao/historico/admin/${id}`),
    listEvents: () => request("/eventos"),
    listEventsByAdmin: (id) => request(`/eventos/admin/${id}`),
  };
})();

class DashboardUI {
  constructor() {
    this.state = {
      vehicles: [],
      locationsHistorico: [],
      events: [],
    };

    this.elements = {
      veiculosOnline: document.getElementById("dashVeiculosOnline"),
      comandosEnviados: document.getElementById("dashComandosEnviados"),
      tempoMedio: document.getElementById("dashTempoMedio"),
      listaComandos: document.getElementById("dashListaComandos"),
      graficoContainer: document.getElementById("dashGraficoContainer"),
      eventosStats: document.getElementById("dashEventosStats"),
    };
    
    this.chartInstance = null;
  }

  async init() {
    await this.resolveAdminId();
    this.loadAll();
    // Atualiza a cada 30s
    setInterval(() => this.loadAll(false), 30000);
  }

  async resolveAdminId() {
    if (window.ADMIN_ID) {
      this.adminId = Number(window.ADMIN_ID);
      return;
    }
    try {
      const userJson = localStorage.getItem("fw_current_user");
      if (userJson) {
        const user = JSON.parse(userJson);
        if (user.email) {
          const res = await fetch(
            `/usuarios/verificar-role?email=${encodeURIComponent(user.email)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.is_admin && data.user_id) {
              this.adminId = Number(data.user_id);
            }
          }
        }
      }
    } catch (_) {}
  }

  async loadAll(showLoader = true) {
    try {
      if (showLoader && this.elements.veiculosOnline) {
        this.elements.veiculosOnline.textContent = "...";
      }

      let veiculosPromise, historicoPromise, eventosPromise;

      if (this.adminId) {
        veiculosPromise = DashboardApi.listVehiclesByAdmin(this.adminId);
        historicoPromise = DashboardApi.listLocationsHistoricoByAdmin(this.adminId);
        eventosPromise = DashboardApi.listEventsByAdmin(this.adminId);
      } else {
        veiculosPromise = DashboardApi.listVehicles();
        historicoPromise = DashboardApi.listLocationsHistorico();
        eventosPromise = DashboardApi.listEvents();
      }

      const [veiculos, historico, eventos] = await Promise.all([
        veiculosPromise,
        historicoPromise,
        eventosPromise
      ]);

      this.state.vehicles = Array.isArray(veiculos) ? veiculos : [];
      this.state.locationsHistorico = Array.isArray(historico) ? historico : [];
      this.state.events = Array.isArray(eventos) ? eventos : [];

      this.renderCards();
      this.renderChart();
      this.renderEventsList();
      this.renderEventStats();
    } catch (error) {
      console.error("Erro no dashboard:", error);
      if (this.elements.veiculosOnline) this.elements.veiculosOnline.textContent = "-";
      if (this.elements.comandosEnviados) this.elements.comandosEnviados.textContent = "-";
      if (this.elements.tempoMedio) this.elements.tempoMedio.textContent = "-";
    }
  }

  renderCards() {
    // Card 1: Veículos Online
    const online = this.state.vehicles.filter(
      (v) => v.status_gps === "Online"
    ).length;

    if (this.elements.veiculosOnline) {
      this.elements.veiculosOnline.textContent = online;
    }

    // Card 2: Total de Comandos (Eventos)
    const totalEventos = this.state.events.length;
    if (this.elements.comandosEnviados) {
      this.elements.comandosEnviados.textContent = totalEventos;
    }

    // Card 3: Tempo Médio
    const tempoMedioHoras = this.calcularTempoMedioRastreamento();
    if (this.elements.tempoMedio) {
      if (tempoMedioHoras == null) {
        this.elements.tempoMedio.textContent = "0h/dia";
      } else {
        const arredondado = Math.round(tempoMedioHoras);
        this.elements.tempoMedio.textContent = `${arredondado}h/dia`;
      }
    }
  }
  
  renderEventsList() {
      if (!this.elements.listaComandos) return;
      
      const ultimos = this.state.events.slice(0, 5); // Pegar os 5 mais recentes
      
      if (ultimos.length === 0) {
          this.elements.listaComandos.innerHTML = '<li class="list-group-item text-center text-muted">Nenhum comando registrado.</li>';
          return;
      }
      
      this.elements.listaComandos.innerHTML = ultimos.map(evt => {
          let badgeClass = "text-bg-secondary";
          if (evt.tipo === "bloqueio") badgeClass = "text-bg-danger";
          if (evt.tipo === "desbloqueio") badgeClass = "text-bg-success";
          
          // Formatar data
          const data = new Date(evt.timestamp);
          const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          return `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <span class="d-block fw-bold">${evt.tipo || 'Evento'}</span>
                <small class="text-muted">${evt.descricao || ''} - ${dataFormatada}</small>
              </div>
              <span class="badge ${badgeClass}">${evt.veiculo_id ? 'V#' + evt.veiculo_id : '-'}</span>
            </li>
          `;
      }).join('');
  }

  renderEventStats() {
    if (!this.elements.eventosStats) return;

    if (this.state.events.length === 0) {
      this.elements.eventosStats.innerHTML = '<li class="list-group-item text-center text-muted">Nenhum comando enviado.</li>';
      return;
    }

    const counts = {};
    this.state.events.forEach(evt => {
      const tipo = evt.tipo || 'Outros';
      counts[tipo] = (counts[tipo] || 0) + 1;
    });

    // Mapeamento de labels e cores
    const config = {
      'bloqueio': { label: 'Corte de ignição', class: 'text-bg-danger' },
      'desbloqueio': { label: 'Reativação', class: 'text-bg-success' },
      'teste': { label: 'Teste de conexão', class: 'text-bg-secondary' }
    };

    const html = Object.entries(counts).map(([tipo, count]) => {
      const conf = config[tipo] || { label: tipo, class: 'text-bg-secondary' };
      return `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${conf.label}
          <span class="badge ${conf.class}">${count}</span>
        </li>
      `;
    }).join('');

    this.elements.eventosStats.innerHTML = html;
  }

  renderChart() {
      if (!this.elements.graficoContainer || typeof Chart === 'undefined') return;
      
      const online = this.state.vehicles.filter(v => v.status_gps === "Online").length;
      const offline = this.state.vehicles.filter(v => v.status_gps !== "Online").length;
      
      const ctx = this.elements.graficoContainer.getContext('2d');
      
      if (this.chartInstance) {
          this.chartInstance.data.datasets[0].data = [online, offline];
          this.chartInstance.update();
      } else {
          this.chartInstance = new Chart(ctx, {
              type: 'doughnut',
              data: {
                  labels: ['Online', 'Offline'],
                  datasets: [{
                      data: [online, offline],
                      backgroundColor: ['#198754', '#6c757d'],
                      borderWidth: 0
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                      legend: {
                          position: 'bottom'
                      }
                  }
              }
          });
      }
  }

  calcularTempoMedioRastreamento() {
    if (!this.state.locationsHistorico.length) return null;

    const porVeiculo = new Map();

    this.state.locationsHistorico.forEach((loc) => {
      const vid = loc.veiculo_id || loc.veiculoId || loc.id_veiculo;
      if (!vid) return;
      const t = new Date(loc.timestamp);
      if (Number.isNaN(t.getTime())) return;

      const atual = porVeiculo.get(vid) || {
        min: t,
        max: t,
      };
      if (t < atual.min) atual.min = t;
      if (t > atual.max) atual.max = t;
      porVeiculo.set(vid, atual);
    });

    if (!porVeiculo.size) return null;

    let somaHoras = 0;
    let cont = 0;
    porVeiculo.forEach(({ min, max }) => {
      const diffMs = max.getTime() - min.getTime();
      if (diffMs <= 0) return;
      const horas = diffMs / (1000 * 60 * 60);
      const capped = Math.min(horas, 24);
      somaHoras += capped;
      cont += 1;
    });

    if (!cont) return null;
    return somaHoras / cont;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const ui = new DashboardUI();
  ui.init();
});


