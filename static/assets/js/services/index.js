let mapa;
let marcador;

function initMapa() {
    mapa = new google.maps.Map(document.getElementById("mapaTempoReal"), {
        center: { lat: -23.5, lng: -46.6 },
        zoom: 15,
    });

    marcador = new google.maps.Marker({
        position: { lat: -23.5, lng: -46.6 },
        map: mapa,
        title: "Localização atual",
    });
}

function atualizarMapa(latitude, longitude) {
    if (!mapa || !marcador) return;

    const novaPosicao = { lat: latitude, lng: longitude };

    marcador.setPosition(novaPosicao);
    mapa.setCenter(novaPosicao);
}

async function buscarLocalizacao(placa) {
    const res = await fetch(`/localizacao/${placa}`);
    return res.json();
}

setInterval(async () => {
    const dados = await buscarLocalizacao("ABC1");

    atualizarMapa(dados.latitude, dados.longitude);
    document.getElementById("ultima-att").innerText =
        new Date(dados.timestamp).toLocaleString("pt-BR");
}, 5000);


window.initMapa = initMapa;
window.atualizarMapa = atualizarMapa;
