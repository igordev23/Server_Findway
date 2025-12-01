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

      const [clientes, veiculos, localizacoes] = await Promise.all([
        MonitoramentoApi.listClients(),
        MonitoramentoApi.listVehicles(),
        MonitoramentoApi.listLocations(),
      ]);

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
        veiculos = veiculos.filter((v) => v.status_ignicao === true);
      } else if (status === "offline") {
        veiculos = veiculos.filter((v) => v.status_ignicao === false);
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

        const statusBadge = v.status_ignicao
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
    // Aqui você pode integrar com Leaflet / Google Maps depois.
    // Por enquanto não vamos desenhar marcadores para manter simples,
    // apenas garantimos que o texto de placeholder faça sentido.
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


