async function carregarHistoricoGPS() {
  try {
    const response = await fetch("/gps/historico");
    if (!response.ok) throw new Error("Erro na requisição");

    const dados = await response.json();
    const tabela = document.getElementById("tabela-historico");
    tabela.innerHTML = "";

    if (!dados || dados.length === 0) {
      tabela.innerHTML = "<tr><td colspan='4'>Nenhum dado GPS nas últimas 24 horas.</td></tr>";
      return;
    }

    const formatadorData = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short"
    });

    const formatadorHora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      timeStyle: "medium"
    });

    dados.forEach((item) => {
      const timestamp = new Date(item.timestamp);
      const data = formatadorData.format(timestamp);
      const hora = formatadorHora.format(timestamp);

      const linha = document.createElement("tr");
      linha.innerHTML = `
        <td>${item.latitude.toFixed(6)}</td>
        <td>${item.longitude.toFixed(6)}</td>
        <td>${data}</td>
        <td>${hora}</td>
      `;
      tabela.appendChild(linha);
    });
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    document.getElementById("tabela-historico").innerHTML =
      "<tr><td colspan='4' class='text-danger'>Erro ao carregar dados.</td></tr>";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("tabela-historico")) {
    carregarHistoricoGPS();
  }
});
