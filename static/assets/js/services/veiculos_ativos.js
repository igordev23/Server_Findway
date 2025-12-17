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
      
      // Atualiza o texto de última atualização
      const updateText = document.getElementById("lastUpdateText");
      if (updateText) {
          const now = new Date();
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          updateText.textContent = `Última atualização: ${hours}:${minutes}`;
      }

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
          <button type="button" data-id="${v.id}"
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

    // Adiciona evento de clique para focar no veículo
    const botoes = this.elements.listaVeiculos.querySelectorAll('button[data-id]');
    botoes.forEach(btn => {
        btn.addEventListener('click', () => {
            this.focarVeiculo(btn.getAttribute('data-id'));
        });
    });
  }

  focarVeiculo(id) {
    if (!this.map || !this.markers) return;
    
    // Encontra o marcador correspondente ao ID do veículo
    const marker = this.markers.find(m => String(m.veiculoId) === String(id));
    
    if (marker) {
        this.map.panTo(marker.getPosition());
        this.map.setZoom(17); // Zoom ampliado conforme solicitado
        
        // Simula um clique no marcador para abrir o InfoWindow
        google.maps.event.trigger(marker, 'click');
        
        // Scroll suave até o mapa (útil em mobile)
        this.elements.mapaContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Feedback visual caso não tenha localização
        alert("Localização deste veículo não disponível no mapa.");
    }
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

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    this.state.vehicles.forEach(v => {
        const lastLoc = this.lastLocationForVehicle(v);
        if (lastLoc && lastLoc.latitude && lastLoc.longitude) {
            const pos = { 
                lat: parseFloat(lastLoc.latitude), 
                lng: parseFloat(lastLoc.longitude) 
            };
            
            // Ícone diferente se online/offline
            // Usando ícones padrão do Google mas com cores diferentes seria ideal,
            // aqui vamos usar o padrão vermelho, mas você pode customizar.
            // Exemplo simples: label com placa
            
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
                    fillColor: v.status_ignicao ? "#198754" : "#6c757d", // Verde ou Cinza
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "#ffffff",
                }
            });
            
            // Armazena ID do veículo no marcador para referência futura
            marker.veiculoId = v.id;

            // InfoWindow ao clicar
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="color: black;">
                        <h6 style="margin-bottom: 5px;">${v.placa}</h6>
                        <p style="margin: 0;"><strong>Modelo:</strong> ${v.modelo || '-'}</p>
                        <p style="margin: 0;"><strong>Cliente:</strong> ${v.cliente_nome || '-'}</p>
                        <p style="margin: 0;"><strong>Status:</strong> ${v.status_ignicao ? 'Online' : 'Offline'}</p>
                        <p style="margin: 0; font-size: 0.85em; color: #666;">
                           Atualizado ${this.formatRelativeTime(lastLoc.timestamp)}
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

    if (hasPoints && !this.initialFitDone) {
        this.map.fitBounds(bounds);
        // Evita zoom excessivo se tiver apenas 1 veículo
        if (this.markers.length === 1) {
            this.map.setZoom(15);
        }
        this.initialFitDone = true;
    }
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


