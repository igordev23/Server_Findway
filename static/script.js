let map, marker;

window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("map")) {
    initMap();
  }
});

async function getGPSData() {
  try {
    const response = await fetch("/gps");
    const data = await response.json();
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      atualizarPainel(lat, lng);
      return { lat, lng };
    }
  } catch (error) {
    console.error("Erro ao buscar dados GPS:", error);
  }
  return null;
}

function atualizarPainel(lat, lng) {
  document.getElementById("lat").textContent = lat.toFixed(6);
  document.getElementById("lng").textContent = lng.toFixed(6);
  document.getElementById("ultima-atualizacao").textContent = new Date().toLocaleString("pt-BR");
}

async function initMap() {
  let location = null;

  while (!location) {
    location = await getGPSData();
    if (!location) await new Promise((r) => setTimeout(r, 1000));
  }

  map = new google.maps.Map(document.getElementById("map"), {
    center: location,
    zoom: 17,
  });

  marker = new google.maps.Marker({
    position: location,
    map,
    title: "Localização Atual",
    icon: {
      url: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
      scaledSize: new google.maps.Size(40, 40)
    }
  });

  setInterval(async () => {
    const newLocation = await getGPSData();
    if (newLocation) {
      marker.setPosition(newLocation);
      map.setCenter(newLocation);
    }
  }, 3000);
}