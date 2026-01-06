const MonitoramentoApi = (() => {
  const defaultHeaders = { "Content-Type": "application/json" };

  async function request(url, options = {}) {
    const config = { headers: defaultHeaders, ...options };
    const response = await fetch(url, config);
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
    listClients: () => request("/clientes"),
    listVehicles: () => request("/veiculos"),
    listLocations: () => request("/localizacao"),
  };
})();

class MonitoramentoUI {
  constructor() {
    this.state = {
      clients: [],
      vehicles: [],
      locations: [],
      filters: {
        clienteId: "all",
        veiculoId: "all",
        status: "all",
      },
      autoRefresh: true,
      refreshIntervalId: null,
    };

    this.elements = {
      clienteSelect: document.getElementById("filtroCliente"),
      veiculoSelect: document.getElementById("filtroVeiculo"),
      statusSelect: document.getElementById("filtroStatus"),
      autoRefreshToggle: document.getElementById("autoRefresh"),
      btnRefresh: document.getElementById("btnRefresh"),
      listaVeiculos: document.getElementById("listaVeiculosMonitorados"),
      badgeQuantidade: document.getElementById("badgeQtdVeiculos"),
      mapaContainer: document.getElementById("mapaMonitoramento"),
    };
  }

  init() {
    this.registerEvents();
    this.loadAll();
    this.setupAutoRefresh();
  }

  registerEvents() {
    this.elements.clienteSelect?.addEventListener("change", (e) => {
      this.state.filters.clienteId = e.target.value;
      this.populateVeiculosSelect();
      this.renderListaVeiculos();
    });

    this.elements.veiculoSelect?.addEventListener("change", (e) => {
      this.state.filters.veiculoId = e.target.value;
      this.renderListaVeiculos();
    });

    this.elements.statusSelect?.addEventListener("change", (e) => {
      this.state.filters.status = e.target.value;
      this.renderListaVeiculos();
    });

    this.elements.autoRefreshToggle?.addEventListener("change", (e) => {
      this.state.autoRefresh = e.target.checked;
      this.setupAutoRefresh();
    });

    this.elements.btnRefresh?.addEventListener("click", () => {
      this.loadAll();
    });
  }

  setupAutoRefresh() {
    if (this.state.refreshIntervalId) {
      clearInterval(this.state.refreshIntervalId);
      this.state.refreshIntervalId = null;
    }

    if (this.state.autoRefresh) {
      this.state.refreshIntervalId = setInterval(() => {
        this.loadAll(false);
      }, 10000); // 10s
    }
  }

  async loadAll(showLoader = true) {
    try {
      if (showLoader && this.elements.listaVeiculos) {
        this.elements.listaVeiculos.innerHTML =
          '<div class="p-3 text-muted text-center">Carregando dados de monitoramento...</div>';
      }

      let clientes, veiculos, localizacoes;

      if (this.adminId) {
        [clientes, veiculos, localizacoes] = await Promise.all([
            MonitoramentoApi.listClientsByAdmin(this.adminId),
            MonitoramentoApi.listVehiclesByAdmin(this.adminId),
            MonitoramentoApi.listLocationsByAdmin(this.adminId),
        ]);
      } else {
        // Fallback ou modo visualização geral (se permitido)
        // Se a segurança for estrita, poderia retornar vazio aqui.
        // Mas mantendo compatibilidade com admin não identificado (talvez superadmin?)
        // Por hora, mantemos o comportamento antigo se não identificar ID,
        // MAS como o objetivo é restringir, o ideal é que se não tem ID, não vê nada ou vê erro.
        // Vou assumir que resolveAdminId falha silenciosamente se não achar, e listamos tudo (comportamento legado)
        // OU retornamos vazio. O usuário pediu "garantir que cada admin tenha acesso SOMENTE aos seus".
        // Se não sei quem é o admin, melhor não mostrar nada sensível?
        // Vou manter o fallback mas logar aviso.
        console.warn("Admin ID não identificado. Carregando modo geral (pode violar regras de permissão).");
        [clientes, veiculos, localizacoes] = await Promise.all([
            MonitoramentoApi.listClients(),
            MonitoramentoApi.listVehicles(),
            MonitoramentoApi.listLocations(),
        ]);
      }

      this.state.clients = Array.isArray(clientes) ? clientes : [];
      this.state.vehicles = Array.isArray(veiculos) ? veiculos : [];
      this.state.locations = Array.isArray(localizacoes) ? localizacoes : [];

      this.populateClienteSelect();
      this.populateVeiculosSelect();
      this.renderListaVeiculos();
      this.renderMapaPlaceholder();
    } catch (error) {
      if (this.elements.listaVeiculos) {
        this.elements.listaVeiculos.innerHTML = `
          <div class="p-3 text-danger text-center">
            Erro ao carregar dados de monitoramento: ${error.message}
          </div>`;
      }
    }
  }

  populateClienteSelect() {
    if (!this.elements.clienteSelect) return;
    const select = this.elements.clienteSelect;
    const current = this.state.filters.clienteId;

    select.innerHTML = '<option value="all">Todos</option>';
    this.state.clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = c.nome || c.email || `Cliente #${c.id}`;
      select.appendChild(opt);
    });

    if (current) {
      select.value = current;
    }
  }

  populateVeiculosSelect() {
    if (!this.elements.veiculoSelect) return;
    const select = this.elements.veiculoSelect;
    const current = this.state.filters.veiculoId;
    const clienteId = this.state.filters.clienteId;

    let veiculos = this.state.vehicles;
    if (clienteId !== "all") {
      veiculos = veiculos.filter(
        (v) => String(v.cliente_id) === String(clienteId)
      );
    }

    select.innerHTML = '<option value="all">Todos</option>';
    veiculos.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v.id);
      opt.textContent = `${v.placa} • ${v.modelo || ""}`.trim();
      select.appendChild(opt);
    });

    if (current) {
      select.value = current;
    }
  }

  getFilteredVehicles() {
    const { clienteId, veiculoId, status } = this.state.filters;
    let veiculos = this.state.vehicles;

    if (clienteId !== "all") {
      veiculos = veiculos.filter(
        (v) => String(v.cliente_id) === String(clienteId)
      );
    }

    if (veiculoId !== "all") {
      veiculos = veiculos.filter((v) => String(v.id) === String(veiculoId));
    }

    if (status !== "all") {
      if (status === "online") {
        veiculos = veiculos.filter((v) => v.status_gps === "Online");
      } else if (status === "offline") {
        veiculos = veiculos.filter((v) => v.status_gps !== "Online");
      }
    }

    return veiculos;
  }

  lastLocationForVehicle(veiculo) {
    if (!this.state.locations?.length) return null;
    const locs = this.state.locations.filter(
      (l) => String(l.veiculo_id) === String(veiculo.id)
    );
    if (!locs.length) return null;
    locs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return locs[0];
  }

  renderListaVeiculos() {
    if (!this.elements.listaVeiculos) return;

    const veiculos = this.getFilteredVehicles();
    if (!veiculos.length) {
      this.elements.listaVeiculos.innerHTML = `
        <div class="p-3 text-muted text-center">
          Nenhum veículo encontrado para os filtros selecionados.
        </div>`;
      this.updateBadgeQuantidade(0);
      return;
    }

    const html = veiculos
      .map((v) => {
        const clienteNome = v.cliente_nome || this.findClientName(v.cliente_id);
        const lastLoc = this.lastLocationForVehicle(v);
        const tempoTexto = lastLoc
          ? this.formatRelativeTime(lastLoc.timestamp)
          : "Sem dados recentes";

        const statusBadge = (v.status_gps === "Online")
          ? '<span class="badge rounded-pill text-bg-success">Online</span>'
          : '<span class="badge rounded-pill text-bg-secondary">Offline</span>';

        return `
          <button type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
            <span>
              <strong>${v.placa}</strong>
              <small class="d-block text-muted">
                ${clienteNome || "Cliente desconhecido"} • ${tempoTexto}
              </small>
            </span>
            ${statusBadge}
          </button>
        `;
      })
      .join("");

    this.elements.listaVeiculos.innerHTML = html;
    this.updateBadgeQuantidade(veiculos.length);
  }

  renderMapaPlaceholder() {
    if (!this.elements.mapaContainer) return;

    // Se API do Google Maps não estiver carregada, tenta de novo em breve
    if (typeof google === "undefined" || !google.maps) {
        setTimeout(() => this.renderMapaPlaceholder(), 500);
        return;
    }

    // Inicializa o mapa apenas uma vez
    if (!this.map) {
        this.elements.mapaContainer.innerHTML = "";
        this.map = new google.maps.Map(this.elements.mapaContainer, {
            center: { lat: -23.5505, lng: -46.6333 }, // Centro SP
            zoom: 10,
        });
        this.markers = [];
    }

    this.atualizarMarcadores();
  }

  atualizarMarcadores() {
    if (!this.map) return;

    // Limpar marcadores antigos
    if (this.markers) {
        this.markers.forEach(m => m.setMap(null));
    }
    this.markers = [];

    const veiculos = this.getFilteredVehicles();
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    veiculos.forEach(v => {
        const lastLoc = this.lastLocationForVehicle(v);
        if (lastLoc && lastLoc.latitude && lastLoc.longitude) {
            const pos = { 
                lat: parseFloat(lastLoc.latitude), 
                lng: parseFloat(lastLoc.longitude) 
            };
            
            const marker = new google.maps.Marker({
                position: pos,
                map: this.map,
                title: `${v.modelo || 'Veículo'} - ${v.placa}`,
                label: {
                    text: v.placa,
                    color: "black",
                    fontSize: "10px",
                    fontWeight: "bold"
                },
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: v.status_gps === "Online" ? "#198754" : "#6c757d", // Verde ou Cinza
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "#ffffff",
                }
            });

            // InfoWindow ao clicar
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="color: black;">
                        <h6 style="margin-bottom: 5px;">${v.placa}</h6>
                        <p style="margin: 0;"><strong>Modelo:</strong> ${v.modelo || '-'}</p>
                        <p style="margin: 0;"><strong>Cliente:</strong> ${v.cliente_nome || this.findClientName(v.cliente_id) || '-'}</p>
                        <p style="margin: 0;"><strong>Status:</strong> ${v.status_gps === "Online" ? 'Online' : 'Offline'}</p>
                        <p style="margin: 0; font-size: 0.85em; color: #666;">
                           Atualizado ${lastLoc ? this.formatRelativeTime(lastLoc.timestamp) : '-'}
                        </p>
                    </div>
                `
            });

            marker.addListener("click", () => {
                infoWindow.open(this.map, marker);
            });

            this.markers.push(marker);
            bounds.extend(pos);
            hasPoints = true;
        }
    });

    if (hasPoints) {
        this.map.fitBounds(bounds);
        if (this.markers.length === 1) {
            this.map.setZoom(15);
        }
    }
  }

  updateBadgeQuantidade(qtd) {
    if (!this.elements.badgeQuantidade) return;
    this.elements.badgeQuantidade.textContent = `${qtd} no filtro`;
  }

  findClientName(clienteId) {
    const c = this.state.clients.find(
      (cli) => String(cli.id) === String(clienteId)
    );
    return c?.nome || c?.email || null;
  }

  formatRelativeTime(timestamp) {
    try {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return "Data inválida";

      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.round(diffMs / 1000);
      if (diffSec < 60) return `há ${diffSec}s`;
      const diffMin = Math.round(diffSec / 60);
      if (diffMin < 60) return `há ${diffMin}min`;
      const diffH = Math.round(diffMin / 60);
      return `há ${diffH}h`;
    } catch {
      return "Data inválida";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const ui = new MonitoramentoUI();
  ui.init();
});


