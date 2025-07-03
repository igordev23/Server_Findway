function atualizarMensagens() {
    fetch('/mensagens')
        .then(response => response.json())
        .then(data => {
            let mensagensDiv = document.getElementById('mensagens');
            mensagensDiv.innerHTML = '';

            if (data.length > 0) {
                data.forEach(msg => {
                    let div = document.createElement('div');
                    div.className = 'mensagem';
                    div.textContent = msg;
                    mensagensDiv.appendChild(div);
                });

                // Atualiza a bússola com a última mensagem recebida
                let ultimaMensagem = data[data.length - 1];
                atualizarBussola(ultimaMensagem);
            } else {
                mensagensDiv.innerHTML = '<p>Nenhuma mensagem recebida ainda.</p>';
            }
        });
}

function atualizarBussola(direcao) {
    let angulos = {
        "Norte": 0,
        "Nordeste": 45,
        "Leste": 90,
        "Sudeste": 135,
        "Sul": 180,
        "Sudoeste": 225,
        "Oeste": 270,
        "Noroeste": 315
    };

    // Apenas atualiza a bússola se a direção recebida for válida
    if (angulos.hasOwnProperty(direcao)) {
        let angulo = angulos[direcao];
        document.getElementById('ponteiro').style.transform = `translate(-50%, -100%) rotate(${angulo}deg)`;
    }
}

function resetarBussola() {
    document.getElementById('ponteiro').style.transform = `translate(-50%, -100%) rotate(0deg)`;
}

function resetarMensagens() {
    fetch('/reset', { method: 'POST' })
        .then(() => atualizarMensagens());
}

function mostrarSeção(selecao) {
    document.getElementById('compass-container').style.display = 'none';
    document.getElementById('logs-container').style.display = 'none';

    document.getElementById(selecao).style.display = 'block';
}

setInterval(atualizarMensagens, 2000); // Atualiza os logs a cada 2s