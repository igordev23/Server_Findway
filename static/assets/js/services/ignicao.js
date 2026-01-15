document.addEventListener("DOMContentLoaded", async () => {
  const firebaseConfigEl = document.getElementById("firebase-config");
  if (!firebaseConfigEl) return;
  const firebaseConfig = JSON.parse(firebaseConfigEl.textContent);
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  let clienteId = null;
  let veiculoId = null;

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    
    // Buscar Cliente ID pelo email
    try {
      const resp = await fetch("/clientes");
      const clientes = await resp.json();
      const cliente = clientes.find(c => c.email === user.email);
      
      if (cliente) {
        clienteId = cliente.id;
        console.log("Cliente encontrado:", clienteId);
        
        // Verifica se tem PIN
        const respDet = await fetch(`/clientes/${clienteId}`);
        const clienteDet = await respDet.json();
        
        if (clienteDet.tem_pin) {
            // Se já tem PIN, oculta o formulário de criação e mostra aviso
            const pinCardBody = document.getElementById("pin-setup-card-body");
            if (pinCardBody) {
                pinCardBody.innerHTML = `
                    <div class="text-center text-muted py-3">
                        <i class="bi bi-shield-check fs-1 text-success"></i>
                        <h6 class="mt-2">PIN configurado</h6>
                        <small>Para alterar seu PIN, acesse <a href="/cliente/configuracoes-seguranca" class="text-decoration-none">Configurações de Segurança</a>.</small>
                    </div>
                `;
            }
        } else {
         document.getElementById("status-ignicao-text").textContent = "Sem PIN definido";
         document.getElementById("status-ignicao-text").classList.remove("text-success", "text-danger");
         document.getElementById("status-ignicao-text").classList.add("text-warning");
         
         Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Você precisa configurar um PIN de segurança na área lateral.'
         });
         return;
        }

        loadVeiculos();
      } else {
        console.error("Cliente não encontrado na base de dados.");
        document.getElementById("status-texto").textContent = "Erro: Cliente não vinculado.";
      }
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
    }
  });

  async function loadVeiculos() {
    if (!clienteId) return;
    try {
      const resp = await fetch(`/veiculos/cliente/${clienteId}`);
      if (!resp.ok) {
          // Se 404, nenhum veiculo
          document.getElementById("status-texto").textContent = "Nenhum veículo";
          return;
      }
      const veiculos = await resp.json();
      
      if (veiculos.length > 0) {
        veiculoId = veiculos[0].id; // Pega o primeiro veículo
        console.log("Veículo selecionado:", veiculoId);
        updateStatus();
        setInterval(updateStatus, 30000); // Atualiza a cada 30s
      } else {
        document.getElementById("status-texto").textContent = "Nenhum veículo";
      }
    } catch (error) {
      console.error(error);
      document.getElementById("status-texto").textContent = "Erro ao carregar veículos";
    }
  }

  async function updateStatus() {
    if (!veiculoId) return;
    try {
      const resp = await fetch(`/veiculos/${veiculoId}/status_ignicao`);
      if (!resp.ok) return;
      const data = await resp.json();
      
      // Update Status
      const statusEl = document.getElementById("status-texto");
      const timestampEl = document.getElementById("status-timestamp");
      
      statusEl.textContent = data.status_atual;
      const headerEl = document.getElementById("ignicao-card-header");

      if (data.status_atual === "Ligada") {
          statusEl.className = "mb-0 text-success";
          if (headerEl) {
            headerEl.classList.remove("bg-danger");
            headerEl.classList.add("bg-success");
          }
      } else {
          statusEl.className = "mb-0 text-danger";
          if (headerEl) {
            headerEl.classList.remove("bg-success");
            headerEl.classList.add("bg-danger");
          }
      }
      timestampEl.textContent = "Atualizado agora";

      // Update Logs
      const tbody = document.getElementById("tabela-logs");
      tbody.innerHTML = "";
      
      data.logs.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${log.data_hora}</td>
          <td>${log.acao}</td>
          <td>${log.origem}</td>
          <td><span class="badge text-bg-${log.status === 'Confirmado' ? 'success' : 'warning'}">${log.status}</span></td>
        `;
        tbody.appendChild(tr);
      });

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  }

  // Comandos
  async function enviarComando(acao, pin, btnElement) {
     if (!veiculoId || !clienteId) {
         Swal.fire({
            icon: 'info',
            title: 'Aguarde',
            text: 'Sistema ainda carregando as informações do veículo. Aguarde um momento.'
         });
         return;
     }

     const originalText = btnElement ? btnElement.textContent : "";
     if (btnElement) {
         btnElement.disabled = true;
         btnElement.textContent = "Processando...";
     }
     
     try {
       const resp = await fetch(`/veiculos/${veiculoId}/comando`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           comando: acao,
           pin: pin,
           cliente_id: clienteId
         })
       });
       
       const data = await resp.json();
       
       if (resp.ok) {
         Swal.fire({
            icon: 'success',
            title: 'Sucesso',
            text: data.message
         });
         // Fechar modal
         const modalId = acao === "cortar" ? "#modalCortar" : "#modalReativar";
         const modalEl = document.querySelector(modalId);
         if (typeof bootstrap !== 'undefined') {
             const modalInstance = bootstrap.Modal.getInstance(modalEl);
             if (modalInstance) modalInstance.hide();
         } else {
             // Fallback jquery if bootstrap obj not found (some older templates)
             $(modalId).modal('hide');
         }
         
         updateStatus();
         
         // Limpa o campo de PIN
         const pinInputId = acao === "cortar" ? "pin-cortar" : "pin-reativar";
         const pinInput = document.getElementById(pinInputId);
         if(pinInput) pinInput.value = "";
         
       } else {
         Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: data.error || "Falha desconhecida"
         });
       }
     } catch (error) {
       console.error(error);
       Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'Erro de conexão ao enviar comando.'
       });
     } finally {
         if (btnElement) {
             btnElement.disabled = false;
             btnElement.textContent = originalText;
         }
     }
  }

  const btnCorte = document.getElementById("btn-confirmar-corte");
  if(btnCorte) {
      btnCorte.addEventListener("click", () => {
        const pin = document.getElementById("pin-cortar").value;
        if (!pin) return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Digite o PIN' });
        enviarComando("cortar", pin, btnCorte);
      });
  }

  const btnReativar = document.getElementById("btn-confirmar-reativar");
  if(btnReativar) {
      btnReativar.addEventListener("click", () => {
        const pin = document.getElementById("pin-reativar").value;
        if (!pin) return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Digite o PIN' });
        enviarComando("reativar", pin, btnReativar);
      });
  }
  
  // Salvar PIN
  const btnSalvarPin = document.getElementById("btn-salvar-pin");
  if(btnSalvarPin) {
      btnSalvarPin.addEventListener("click", async () => {
          const newPin = document.getElementById("input-config-pin").value;
          if (!newPin || newPin.length < 4) return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'PIN deve ter pelo menos 4 dígitos' });
          
          try {
              const resp = await fetch(`/clientes/${clienteId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pin: newPin })
              });
              
              if (resp.ok) {
                  Swal.fire({ icon: 'success', title: 'Sucesso', text: 'PIN salvo com sucesso!' });
                  document.getElementById("input-config-pin").value = "";
              } else {
                  Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao salvar PIN' });
              }
          } catch (e) {
              console.error(e);
              Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao salvar PIN' });
          }
      });
  }
});