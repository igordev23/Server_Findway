const RelatoriosApi = (() => {
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
    listClientsByAdmin: (adminId) => request(`/clientes/admin/${adminId}`),
    listVehicles: () => request("/veiculos"),
    listVehiclesByAdmin: (adminId) => request(`/veiculos/admin/${adminId}`),
    listLocationsHistorico: () => request("/localizacao/historico"),
    listLocationsHistoricoByAdmin: (adminId) => request(`/localizacao/historico/admin/${adminId}`),
    listEventos: () => request("/eventos"),
    listEventosByAdmin: (adminId) => request(`/eventos/admin/${adminId}`),
  };
})();

class RelatoriosUI {
  constructor() {
    this.adminId = null;
    this.state = {
      clients: [],
      vehicles: [],
      locations: [],
      eventos: [],
      filtros: {
        periodo: "diario",
        dataInicial: null,
        dataFinal: null,
        veiculoId: "all",
      },
    };

    this.elements = {
      periodoSelect: document.getElementById("relPeriodo"),
      dataInicial: document.getElementById("relDataInicial"),
      dataFinal: document.getElementById("relDataFinal"),
      clienteVeiculoSelect: document.getElementById("relClienteVeiculo"),
      btnGerar: document.getElementById("btnGerarRelatorio"),
      percursosValor: document.getElementById("relPercursosValor"),
      cortesValor: document.getElementById("relCortesValor"),
      alertasValor: document.getElementById("relAlertasValor"),
      conectividadeValor: document.getElementById("relConectividadeValor"),
      tabelaBody: document.getElementById("relTabelaBody"),
    };
  }

  init() {
    this.registrarEventos();
    this.carregarDadosIniciais();
  }

  registrarEventos() {
    this.elements.periodoSelect?.addEventListener("change", (e) => {
      this.state.filtros.periodo = e.target.value;
      this.ajustarDatasPorPeriodo();
    });

    this.elements.dataInicial?.addEventListener("change", (e) => {
      this.state.filtros.dataInicial = e.target.value
        ? new Date(e.target.value)
        : null;
    });

    this.elements.dataFinal?.addEventListener("change", (e) => {
      this.state.filtros.dataFinal = e.target.value
        ? new Date(e.target.value)
        : null;
    });

    this.elements.clienteVeiculoSelect?.addEventListener("change", (e) => {
      this.state.filtros.veiculoId = e.target.value;
    });

    this.elements.btnGerar?.addEventListener("click", async () => {
      await this.gerarRelatorio();
    });
  }

  async carregarDadosIniciais() {
    try {
      const [clientes, veiculos] = await Promise.all([
        RelatoriosApi.listClients(),
        RelatoriosApi.listVehicles(),
      ]);

      this.state.clients = Array.isArray(clientes) ? clientes : [];
      this.state.vehicles = Array.isArray(veiculos) ? veiculos : [];

      this.preencherSelectClienteVeiculo();
      this.ajustarDatasPorPeriodo();
    } catch (error) {
      console.error("Erro ao carregar clientes/veículos para relatórios:", error);
    }
  }

  preencherSelectClienteVeiculo() {
    const select = this.elements.clienteVeiculoSelect;
    if (!select) return;

    select.innerHTML = '<option value="all">Todos</option>';

    this.state.vehicles.forEach((v) => {
      const clienteNome = v.cliente_nome || `Cliente #${v.cliente_id || "-"}`;
      const label = `${clienteNome} - ${v.modelo || ""} ${v.marca || ""} (${v.placa})`.trim();
      const opt = document.createElement("option");
      opt.value = String(v.id);
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

  ajustarDatasPorPeriodo() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fim = new Date(hoje);
    const inicio = new Date(hoje);

    switch (this.state.filtros.periodo) {
      case "diario":
        // hoje
        break;
      case "semanal":
        inicio.setDate(inicio.getDate() - 7);
        break;
      case "mensal":
        inicio.setDate(inicio.getDate() - 30);
        break;
      case "personalizado":
        // não mexe nas datas; usuário controla
        return;
      default:
        break;
    }

    this.state.filtros.dataInicial = inicio;
    this.state.filtros.dataFinal = fim;

    if (this.elements.dataInicial) {
      this.elements.dataInicial.value = this.toInputDate(inicio);
    }
    if (this.elements.dataFinal) {
      this.elements.dataFinal.value = this.toInputDate(fim);
    }
  }

  toInputDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async gerarRelatorio() {
    try {
      let locationsPromise, eventosPromise;

      if (this.adminId) {
        locationsPromise = RelatoriosApi.listLocationsHistoricoByAdmin(this.adminId);
        eventosPromise = RelatoriosApi.listEventosByAdmin(this.adminId);
      } else {
        locationsPromise = RelatoriosApi.listLocationsHistorico();
        eventosPromise = RelatoriosApi.listEventos();
      }

      const [locations, eventos] = await Promise.all([
        locationsPromise,
        eventosPromise,
      ]);

      this.state.locations = Array.isArray(locations) ? locations : [];
      this.state.eventos = Array.isArray(eventos) ? eventos : [];

      const { dataInicial, dataFinal, veiculoId } = this.state.filtros;

      const locFiltradas = this.state.locations.filter((loc) =>
        this.filtrarPorDataELimite(loc.timestamp, dataInicial, dataFinal)
      );

      const eventosFiltrados = this.state.eventos.filter((ev) =>
        this.filtrarPorDataELimite(ev.timestamp, dataInicial, dataFinal)
      );

      const locFiltradasVeic = veiculoId === "all"
        ? locFiltradas
        : locFiltradas.filter(
            (loc) => String(loc.veiculo_id) === String(veiculoId)
          );

      const eventosFiltradosVeic = veiculoId === "all"
        ? eventosFiltrados
        : eventosFiltrados.filter(
            (ev) => String(ev.veiculo_id) === String(veiculoId)
          );

      this.renderResumo(locFiltradasVeic, eventosFiltradosVeic);
      this.renderTabela(locFiltradasVeic, eventosFiltradosVeic);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
    }
  }

  filtrarPorDataELimite(timestamp, inicio, fim) {
    try {
      const d = new Date(timestamp);
      if (Number.isNaN(d.getTime())) return false;
      if (inicio && d < inicio) return false;
      if (fim) {
        const fimInclusivo = new Date(fim);
        fimInclusivo.setHours(23, 59, 59, 999);
        if (d > fimInclusivo) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  renderResumo(locais, eventos) {
    if (this.elements.percursosValor) {
      const placasUnicas = new Set(locais.map((l) => l.placa || l.placa_veiculo));
      this.elements.percursosValor.textContent = placasUnicas.size;
    }

    if (this.elements.cortesValor || this.elements.alertasValor) {
      let cortes = 0;
      let alertas = 0;

      eventos.forEach((ev) => {
        const tipo = (ev.tipo || "").toLowerCase();
        if (tipo.includes("corte")) {
          cortes += 1;
        } else if (tipo.includes("alerta")) {
          alertas += 1;
        }
      });

      if (this.elements.cortesValor) {
        this.elements.cortesValor.textContent = cortes;
      }
      if (this.elements.alertasValor) {
        this.elements.alertasValor.textContent = alertas;
      }
    }

    if (this.elements.conectividadeValor) {
      const totalVeiculos = this.state.vehicles.length || 1;
      const veiculosComLocalizacao = new Set(
        locais.map((l) => l.veiculo_id || l.veiculoId).filter(Boolean)
      ).size;
      const percentual = Math.min(
        100,
        Math.round((veiculosComLocalizacao / totalVeiculos) * 100)
      );
      this.elements.conectividadeValor.textContent = `${percentual}%`;
    }
  }

  renderTabela(locais, eventos) {
    const tbody = this.elements.tabelaBody;
    if (!tbody) return;

    const linhas = [];

    locais
      .slice(0, 10)
      .forEach((loc) => {
        const data = this.formatarData(loc.timestamp);
        linhas.push({
          data,
          tipo: "Percurso",
          descricao: `Placa ${loc.placa || "-"} • posição registrada`,
          status: "Concluído",
          statusVariant: "success",
        });
      });

    eventos.slice(0, 10).forEach((ev) => {
      const data = this.formatarData(ev.timestamp);
      const tipoBase = (ev.tipo || "").toLowerCase();
      let tipoLabel = "Evento";
      let status = "Registrado";
      let variant = "secondary";

      if (tipoBase.includes("corte")) {
        tipoLabel = "Corte";
        variant = "warning";
      } else if (tipoBase.includes("alerta")) {
        tipoLabel = "Alerta";
        variant = "danger";
      }

      linhas.push({
        data,
        tipo: tipoLabel,
        descricao: ev.descricao || "",
        status,
        statusVariant: variant,
      });
    });

    if (!linhas.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">
            Nenhum dado encontrado para os filtros selecionados.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = linhas
      .map(
        (linha) => `
      <tr>
        <td>${linha.data}</td>
        <td>${linha.tipo}</td>
        <td>${linha.descricao}</td>
        <td><span class="badge text-bg-${linha.statusVariant}">${linha.status}</span></td>
      </tr>`
      )
      .join("");
  }

  formatarData(ts) {
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "-";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const ui = new RelatoriosUI();
  ui.init();
});


