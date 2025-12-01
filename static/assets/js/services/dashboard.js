const DashboardApi = (() => {
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
    listLocationsHistorico: () => request("/localizacao/historico"),
  };
})();

class DashboardUI {
  constructor() {
    this.state = {
      vehicles: [],
      locationsHistorico: [],
    };

    this.elements = {
      veiculosOnline: document.getElementById("dashVeiculosOnline"),
      comandosEnviados: document.getElementById("dashComandosEnviados"),
      tempoMedio: document.getElementById("dashTempoMedio"),
    };
  }

  init() {
    this.loadAll();
    // Atualiza a cada 60s para manter números razoavelmente frescos
    setInterval(() => this.loadAll(false), 60000);
  }

  async loadAll(showLoader = true) {
    try {
      if (showLoader && this.elements.veiculosOnline) {
        this.elements.veiculosOnline.textContent = "...";
      }

      const [veiculos, historico] = await Promise.all([
        DashboardApi.listVehicles(),
        DashboardApi.listLocationsHistorico(),
      ]);

      this.state.vehicles = Array.isArray(veiculos) ? veiculos : [];
      this.state.locationsHistorico = Array.isArray(historico) ? historico : [];

      this.renderCards();
    } catch (error) {
      if (this.elements.veiculosOnline) {
        this.elements.veiculosOnline.textContent = "-";
      }
      if (this.elements.comandosEnviados) {
        this.elements.comandosEnviados.textContent = "-";
      }
      if (this.elements.tempoMedio) {
        this.elements.tempoMedio.textContent = "-";
      }
    }
  }

  renderCards() {
    const online = this.state.vehicles.filter(
      (v) => v.status_ignicao === true
    ).length;

    if (this.elements.veiculosOnline) {
      this.elements.veiculosOnline.textContent = online;
    }

    const totalEventos = this.state.locationsHistorico.length;
    if (this.elements.comandosEnviados) {
      this.elements.comandosEnviados.textContent = totalEventos;
    }

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


