let map;
let routePath;
let markers = [];
let lastLocations = [];

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicializar Mapa
    initMap();

    // 2. Aguardar Auth e Carregar Veículos
    const auth = await waitForAuth();
    if (auth && auth.currentUser) {
        const user = auth.currentUser;
        loadVehicles(user.email);
    } else {
        console.warn("Usuário não autenticado ou Firebase não carregado.");
    }

    // 3. Configurar Eventos
    const btnCarregar = document.getElementById("btnCarregarTrajeto");
    if (btnCarregar) {
        btnCarregar.addEventListener("click", carregarTrajeto);
    }
    const btnCsv = document.getElementById("btnExportarCsv");
    if (btnCsv) {
        btnCsv.addEventListener("click", exportCSV);
    }
    const btnPdf = document.getElementById("btnExportarPdf");
    if (btnPdf) {
        btnPdf.addEventListener("click", exportPDF);
    }
    const btnClear = document.getElementById("btnLimparFiltro");
    if (btnClear) {
        btnClear.addEventListener("click", limparFiltros);
    }
    
    // Definir data padrão para hoje
    const dateInput = document.getElementById("filtroData");
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
});

function initMap() {
    const mapElement = document.getElementById("mapaHistorico");
    if (!mapElement) return;

    // Se a API do Google Maps não estiver carregada ainda, tentar novamente em breve
    if (typeof google === "undefined" || !google.maps) {
        setTimeout(initMap, 500);
        return;
    }

    // Remove placeholder content
    mapElement.innerHTML = "";

    map = new google.maps.Map(mapElement, {
        center: { lat: -23.5505, lng: -46.6333 }, // Centro em SP (padrão)
        zoom: 10,
    });
}

function waitForAuth() {
    return new Promise((resolve) => {
        if (typeof firebase === "undefined") {
            // Se firebase não estiver definido, espera um pouco (script loading)
            setTimeout(() => {
                if (typeof firebase !== "undefined") {
                    resolve(firebase.auth());
                } else {
                    resolve(null);
                }
            }, 1000);
            return;
        }
        
        const auth = firebase.auth();
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(auth);
        });
    });
}

async function loadVehicles(email) {
    const select = document.getElementById("filtroVeiculo");
    if (!select) return;
    
    try {
        // 1. Buscar usuário pelo email para obter o ID
        const resUsers = await fetch("/usuarios"); // Rota usada em outros scripts
        if (!resUsers.ok) throw new Error("Erro ao buscar usuários");
        
        const users = await resUsers.json();
        const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            select.innerHTML = '<option disabled selected>Usuário não encontrado no sistema</option>';
            return;
        }

        // 2. Buscar veículos do cliente
        const resVehicles = await fetch(`/veiculos/cliente/${user.id}`);
        let vehicles = [];
        
        if (resVehicles.ok) {
            vehicles = await resVehicles.json();
        } else {
            // Fallback: tentar rota geral e filtrar
            const resAll = await fetch("/veiculos");
            if (resAll.ok) {
                const all = await resAll.json();
                vehicles = all.filter(v => v.cliente_id === user.id);
            }
        }

        if (!vehicles || vehicles.length === 0) {
            select.innerHTML = '<option disabled selected>Nenhum veículo cadastrado</option>';
            return;
        }

        select.innerHTML = vehicles.map(v => 
            `<option value="${v.placa}">${v.modelo || 'Veículo'} - ${v.placa}</option>`
        ).join("");
        
    } catch (e) {
        console.error("Erro ao carregar veículos:", e);
        select.innerHTML = '<option disabled selected>Erro ao carregar veículos</option>';
    }
}

async function carregarTrajeto() {
    const select = document.getElementById("filtroVeiculo");
    const placa = select.value;
    const data = document.getElementById("filtroData").value;
    const inicio = document.getElementById("filtroHoraInicio").value;
    const fim = document.getElementById("filtroHoraFim").value;

    if (!placa) {
        alert("Por favor, selecione um veículo.");
        return;
    }

    const btn = document.getElementById("btnCarregarTrajeto");
    const originalText = btn.innerText;
    btn.innerText = "Carregando...";
    btn.disabled = true;

    try {
        let url = `/localizacao/${placa}/historico`;
        const params = new URLSearchParams();
        if (data) params.append("data", data);
        if (inicio) params.append("inicio", inicio);
        if (fim) params.append("fim", fim);
        
        const fullUrl = `${url}?${params.toString()}`;
        console.log("Fetching:", fullUrl);

        const res = await fetch(fullUrl);
        
        if (!res.ok) {
            if (res.status === 404) {
                 alert("Nenhum histórico encontrado para este período.");
                 clearMap();
                 updateStats(null);
                 return;
            }
            throw new Error("Erro ao buscar histórico");
        }

        const locations = await res.json();
        if (!locations || locations.length === 0) {
            alert("Nenhum histórico encontrado para este período.");
            clearMap();
            updateStats(null);
            return;
        }

        lastLocations = locations;
        plotRoute(locations);
        updateStats(locations);

    } catch (e) {
        console.error(e);
        alert("Erro ao carregar trajeto: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function clearMap() {
    if (routePath) routePath.setMap(null);
    markers.forEach(m => m.setMap(null));
    markers = [];
}

function plotRoute(locations) {
    if (!map) return;
    
    clearMap();

    // Ordenar por data
    locations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const pathCoordinates = locations.map(loc => ({
        lat: parseFloat(loc.latitude),
        lng: parseFloat(loc.longitude)
    }));

    // Desenhar Linha
    routePath = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: "#0d6efd", // Bootstrap Primary
        strokeOpacity: 0.8,
        strokeWeight: 4,
    });

    routePath.setMap(map);

    // Marcador de Início
    const startMarker = new google.maps.Marker({
        position: pathCoordinates[0],
        map: map,
        title: "Início: " + new Date(locations[0].timestamp).toLocaleTimeString(),
        label: "I"
    });
    markers.push(startMarker);

    // Marcador de Fim
    const endMarker = new google.maps.Marker({
        position: pathCoordinates[pathCoordinates.length - 1],
        map: map,
        title: "Fim: " + new Date(locations[locations.length - 1].timestamp).toLocaleTimeString(),
        label: "F"
    });
    markers.push(endMarker);

    // Ajustar Zoom
    const bounds = new google.maps.LatLngBounds();
    pathCoordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds);
}

function updateStats(locations) {
    const elDist = document.getElementById("statDistancia");
    const elTempo = document.getElementById("statTempo");
    const elParadas = document.getElementById("statParadas");
    const elVel = document.getElementById("statVelocidade");

    if (!locations || locations.length < 2) {
        if (elDist) elDist.innerText = "-";
        if (elTempo) elTempo.innerText = "-";
        if (elParadas) elParadas.innerText = "-";
        if (elVel) elVel.innerText = "-";
        return;
    }

    // Calcular Distância Total
    let totalDistKm = 0;
    for (let i = 0; i < locations.length - 1; i++) {
        totalDistKm += getDistanceFromLatLonInKm(
            locations[i].latitude, locations[i].longitude,
            locations[i+1].latitude, locations[i+1].longitude
        );
    }

    // Calcular Tempo
    const start = new Date(locations[0].timestamp);
    const end = new Date(locations[locations.length - 1].timestamp);
    const diffMs = end - start;
    const diffMins = Math.round(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    // Calcular Velocidade Média
    // Evitar divisão por zero
    const avgSpeed = diffMins > 0 ? (totalDistKm / (diffMins/60)) : 0;

    if (elDist) elDist.innerText = `${totalDistKm.toFixed(1)} km`;
    if (elTempo) elTempo.innerText = `${hours}h ${mins}min`;
    if (elParadas) elParadas.innerText = `${locations.length} pts`;
    if (elVel) elVel.innerText = `${avgSpeed.toFixed(1)} km/h`;
}

// Fórmula de Haversine para calcular distância entre coords
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; 
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; 
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function limparFiltros() {
  const dateInput = document.getElementById("filtroData");
  const inicio = document.getElementById("filtroHoraInicio");
  const fim = document.getElementById("filtroHoraFim");
  if (dateInput) dateInput.value = "";
  if (inicio) inicio.value = "";
  if (fim) fim.value = "";
  lastLocations = [];
  clearMap();
  updateStats(null);
}

function exportCSV() {
  if (!lastLocations || lastLocations.length === 0) {
    alert("Carregue um trajeto antes de exportar.");
    return;
  }
  const select = document.getElementById("filtroVeiculo");
  const placa = select && select.value ? select.value : "veiculo";
  const data = document.getElementById("filtroData")?.value || "periodo";
  const header = ["timestamp","latitude","longitude"];
  const rows = lastLocations.map(l => {
    const ts = new Date(l.timestamp).toISOString();
    return [ts, l.latitude, l.longitude].join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historico_${placa}_${data}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF() {
  if (!lastLocations || lastLocations.length === 0) {
    alert("Carregue um trajeto antes de exportar.");
    return;
  }
  const select = document.getElementById("filtroVeiculo");
  const placa = select && select.value ? select.value : "veiculo";
  const data = document.getElementById("filtroData")?.value || "";
  const inicio = document.getElementById("filtroHoraInicio")?.value || "";
  const fim = document.getElementById("filtroHoraFim")?.value || "";
  const titulo = `Histórico de Rotas - ${placa}`;
  const subtitulo = data ? `Data: ${data} ${inicio ? "de " + inicio : ""} ${fim ? "até " + fim : ""}` : "Últimas 24h";
  const distKm = (() => {
    if (!lastLocations || lastLocations.length < 2) return "-";
    let d = 0;
    for (let i = 0; i < lastLocations.length - 1; i++) {
      d += getDistanceFromLatLonInKm(lastLocations[i].latitude, lastLocations[i].longitude, lastLocations[i+1].latitude, lastLocations[i+1].longitude);
    }
    return `${d.toFixed(1)} km`;
  })();
  const start = lastLocations[0];
  const end = lastLocations[lastLocations.length - 1];
  const tempo = (() => {
    if (!start || !end) return "-";
    const s = new Date(start.timestamp);
    const e = new Date(end.timestamp);
    const diff = e - s;
    const mins = Math.round(diff / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}min`;
  })();
  const vel = (() => {
    if (!start || !end) return "-";
    const s = new Date(start.timestamp);
    const e = new Date(end.timestamp);
    const diff = e - s;
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return "-";
    const km = parseFloat(distKm) || 0;
    const v = km / (mins / 60);
    return `${v.toFixed(1)} km/h`;
  })();
  const linhas = lastLocations.map(l => {
    const ts = new Date(l.timestamp).toLocaleString("pt-BR");
    return `<tr><td>${ts}</td><td>${l.latitude}</td><td>${l.longitude}</td></tr>`;
  }).join("");
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin: 0 0 4px 0; }
          h2 { font-size: 14px; color: #555; margin: 0 0 12px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
          th { background: #f5f5f5; }
          .stats { margin: 12px 0; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${titulo}</h1>
        <h2>${subtitulo}</h2>
        <div class="stats">
          <div>Distância total: ${distKm}</div>
          <div>Tempo em movimento: ${tempo}</div>
          <div>Pontos de parada: ${lastLocations.length}</div>
          <div>Velocidade média: ${vel}</div>
        </div>
        <table>
          <thead>
            <tr><th>Timestamp</th><th>Latitude</th><th>Longitude</th></tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup bloqueado. Autorize popups para exportar PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.print();
  };
}
