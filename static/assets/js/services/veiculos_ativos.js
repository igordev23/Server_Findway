const VeiculosAtivosApi = (() => {
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
    listVehicles: () => request("/veiculos"),
    listLocations: () => request("/localizacao"),
  };
})();

class VeiculosAtivosUI {
  constructor() {
    this.state = {
      vehicles: [],
      locations: [],
    };

    this.elements = {
      resumoOnline: document.getElementById("resumoOnline"),
      resumoOffline: document.getElementById("resumoOffline"),
      resumoAlerta: document.getElementById("resumoAlerta"),
      listaVeiculos: document.getElementById("listaVeiculosAtivos"),
      mapaContainer: document.getElementById("mapaVeiculos"),
    };
  }

  init() {
    this.loadAll();
    // Atualização periódica simples (30s) – pode ajustar depois se quiser
    setInterval(() => this.loadAll(false), 30000);
  }

  async loadAll(showLoader = true) {
    try {
      if (showLoader && this.elements.listaVeiculos) {
        this.elements.listaVeiculos.innerHTML =
          '<div class="p-3 text-muted text-center">Carregando veículos...</div>';
      }

      const [veiculos, localizacoes] = await Promise.all([
        VeiculosAtivosApi.listVehicles(),
        VeiculosAtivosApi.listLocations(),
      ]);

      this.state.vehicles = Array.isArray(veiculos) ? veiculos : [];
      this.state.locations = Array.isArray(localizacoes) ? localizacoes : [];

      this.renderResumo();
      this.renderLista();
      this.renderMapaPlaceholder();
    } catch (error) {
      if (this.elements.listaVeiculos) {
        this.elements.listaVeiculos.innerHTML = `
          <div class="p-3 text-danger text-center">
            Erro ao carregar veículos ativos: ${error.message}
          </div>`;
      }
    }
  }

  renderResumo() {
    const online = this.state.vehicles.filter((v) => v.status_ignicao === true)
      .length;
    const offline = this.state.vehicles.filter((v) => v.status_ignicao === false)
      .length;

    if (this.elements.resumoOnline) {
      this.elements.resumoOnline.textContent = online;
    }
    if (this.elements.resumoOffline) {
      this.elements.resumoOffline.textContent = offline;
    }
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

  renderLista() {
    if (!this.elements.listaVeiculos) return;

    if (!this.state.vehicles.length) {
      this.elements.listaVeiculos.innerHTML = `
        <div class="p-3 text-muted text-center">
          Nenhum veículo cadastrado.
        </div>`;
      return;
    }

    const html = this.state.vehicles
      .map((v) => {
        const clienteNome = v.cliente_nome || `Cliente #${v.cliente_id || "-"}`;
        const lastLoc = this.lastLocationForVehicle(v);
        const tempoTexto = lastLoc
          ? this.formatRelativeTime(lastLoc.timestamp)
          : "Sem dados recentes";

        let badgeClass = "text-bg-secondary";
        let badgeText = "Offline";
        if (v.status_ignicao === true) {
          badgeClass = "text-bg-success";
          badgeText = "Online";
        }

        return `
          <button type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
            <span>
              <strong>${clienteNome}</strong>
              <small class="d-block text-muted">
                ${v.modelo || ""} ${v.marca || ""} • ${v.placa} • ${tempoTexto}
              </small>
            </span>
            <span class="badge rounded-pill ${badgeClass}">${badgeText}</span>
          </button>
        `;
      })
      .join("");

    this.elements.listaVeiculos.innerHTML = html;
  }

  renderMapaPlaceholder() {
    if (!this.elements.mapaContainer) return;
    // Mantemos o placeholder estático por enquanto.
    // Quando quiser integrar com mapa real (Leaflet/Google Maps),
    // podemos reaproveitar as localizações aqui.
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
  const ui = new VeiculosAtivosUI();
  ui.init();
});


