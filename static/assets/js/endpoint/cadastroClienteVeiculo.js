/**
 * services/api.js
 * Camada simples para centralizar chamadas HTTP da tela.
 */
const ApiService = (() => {
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  async function request(url, options = {}) {
    const config = {
      headers: defaultHeaders,
      ...options
    };

    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const defaultMessage = response.status === 405
        ? 'A API não possui este método habilitado. Verifique se a rota suporta esta operação.'
        : 'Erro ao comunicar com o servidor.';
      const error = new Error(data?.error || defaultMessage);
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  }

  return {
    listClients: () => request('/clientes'),
    getClient: (id) => request(`/clientes/${id}`),
    createClient: (payload) => request('/clientes', { method: 'POST', body: payload }),
    updateClient: (id, payload) => request(`/clientes/${id}`, { method: 'PUT', body: payload }),
    deleteClient: (id) => request(`/clientes/${id}`, { method: 'DELETE' }),
    listClientVehicles: (id) => request(`/clientes/${id}/veiculos`),
    listVehicles: () => request('/veiculos'),
    createVehicle: (payload) => request('/veiculos', { method: 'POST', body: payload }),
    listAdministradores: () => request('/administradores')
  };
})();

class ClientesUI {
  constructor() {
    this.state = {
      clients: [],
      searchTerm: '',
      loading: false,
      vehiclesByClient: new Map(),
      selectedClientId: null
    };

    this.rootElement = document.getElementById('clientes-app');
    this.adminId = null;

    this.elements = {
      tableBody: document.getElementById('tabela-clientes'),
      searchInput: document.getElementById('campo-busca-clientes'),
      feedbackArea: document.getElementById('feedback-area'),
      btnAbrirModalNovoCliente: document.getElementById('btnAbrirModalNovoCliente'),
      formNovoCliente: document.getElementById('formNovoCliente'),
      formEditarCliente: document.getElementById('formEditarCliente'),
      formCadastrarVeiculo: document.getElementById('formCadastrarVeiculo'),
      btnConfirmarRemocaoCliente: document.getElementById('btnConfirmarRemocaoCliente'),
      tabela: document.getElementById('tabela-clientes'),
      modalNovoCliente: document.getElementById('modalNovoCliente'),
      modalEditarCliente: document.getElementById('modalEditarCliente'),
      modalRemoverCliente: document.getElementById('modalRemoverCliente'),
      modalVeiculosCliente: document.getElementById('modalVeiculosCliente'),
      modalCadastrarVeiculo: document.getElementById('modalCadastrarVeiculo'),
      btnGerarSenhaNovoCliente: document.getElementById('btnGerarSenhaNovoCliente'),
      btnVerSenhaNovoCliente: document.getElementById('btnVerSenhaNovoCliente'),
      btnAbrirModalCadastrarVeiculo: document.getElementById('btnAbrirModalCadastrarVeiculo'),
      listaVeiculosCliente: document.getElementById('listaVeiculosCliente'),
      veiculosClienteNome: document.getElementById('veiculosClienteNome'),
      veiculosClienteResumo: document.getElementById('veiculosClienteResumo'),
      veiculoClienteId: document.getElementById('veiculoClienteId'),
      removerClienteId: document.getElementById('removerClienteId'),
      editarClienteId: document.getElementById('editarClienteId'),
      novoClienteSenha: document.getElementById('novoClienteSenha'),
      novoClienteCep: document.getElementById('novoClienteCep'),
      editarClienteCep: document.getElementById('editarClienteCep')
    };

    this.modals = {
      novoCliente: this.elements.modalNovoCliente ? new bootstrap.Modal(this.elements.modalNovoCliente) : null,
      editarCliente: this.elements.modalEditarCliente ? new bootstrap.Modal(this.elements.modalEditarCliente) : null,
      removerCliente: this.elements.modalRemoverCliente ? new bootstrap.Modal(this.elements.modalRemoverCliente) : null,
      veiculosCliente: this.elements.modalVeiculosCliente ? new bootstrap.Modal(this.elements.modalVeiculosCliente) : null,
      cadastrarVeiculo: this.elements.modalCadastrarVeiculo ? new bootstrap.Modal(this.elements.modalCadastrarVeiculo) : null
    };
  }

  async init() {
    await this.resolveAdminId();
    this.registerEvents();
    this.setupCepAutoFill();
    this.loadClients();
  }

  async resolveAdminId() {
    const datasetId = this.rootElement?.dataset?.adminId;
    if (datasetId) {
      this.adminId = Number(datasetId);
      return;
    }

    if (window.ADMIN_ID) {
      this.adminId = Number(window.ADMIN_ID);
      return;
    }

    try {
      const admins = await ApiService.listAdministradores();
      if (Array.isArray(admins) && admins.length) {
        this.adminId = Number(admins[0].id);
        return;
      }
    } catch (_) {
      // ignoramos para exibir feedback logo abaixo
    }

    this.showFeedback('Não foi possível identificar um administrador ativo. O cadastro ficará indisponível até que um seja criado.', 'warning');
  }

  async ensureAdminId() {
    if (this.adminId) {
      return true;
    }
    await this.resolveAdminId();
    if (!this.adminId) {
      this.showFeedback('Selecione ou cadastre um administrador para continuar.', 'danger');
      return false;
    }
    return true;
  }

  registerEvents() {
    this.elements.searchInput?.addEventListener('input', (event) => {
      this.state.searchTerm = event.target.value;
      this.renderClients();
    });

    this.elements.btnAbrirModalNovoCliente?.addEventListener('click', () => {
      this.resetNovoClienteForm();
      this.modals.novoCliente?.show();
    });

    this.elements.formNovoCliente?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleCreateClient(event.currentTarget);
    });

    this.elements.formEditarCliente?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleUpdateClient(event.currentTarget);
    });

    this.elements.btnConfirmarRemocaoCliente?.addEventListener('click', async () => {
      const clientId = this.elements.removerClienteId?.value;
      if (!clientId) return;
      await this.handleDeleteClient(clientId);
    });

    this.elements.formCadastrarVeiculo?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleCreateVehicle(event.currentTarget);
    });

    this.elements.btnGerarSenhaNovoCliente?.addEventListener('click', () => {
      this.setRandomPassword();
    });

    this.elements.btnVerSenhaNovoCliente?.addEventListener('click', () => {
      this.togglePasswordVisibility();
    });

    this.elements.modalNovoCliente?.addEventListener('show.bs.modal', () => {
      this.setRandomPassword();
    });

    this.elements.btnAbrirModalCadastrarVeiculo?.addEventListener('click', () => {
      if (!this.state.selectedClientId) return;
      this.setCadastrarVeiculoClient(this.state.selectedClientId);
      this.modals.cadastrarVeiculo?.show();
    });

    this.elements.tableBody?.addEventListener('click', (event) => this.handleTableAction(event));
  }

  handleTableAction(event) {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;

    const clientId = actionBtn.getAttribute('data-id');
    if (!clientId) return;

    if (actionBtn.dataset.action === 'edit') {
      this.openEditModal(clientId);
    }

    if (actionBtn.dataset.action === 'delete') {
      this.elements.removerClienteId.value = clientId;
      this.modals.removerCliente?.show();
    }

    if (actionBtn.dataset.action === 'vehicles') {
      this.openVehiclesModal(clientId);
    }
  }

  async loadClients() {
    this.state.loading = true;
    this.renderClients();
    try {
      const data = await ApiService.listClients();
      this.state.clients = Array.isArray(data) ? data : [];
      await this.refreshVehicleIndex();
      this.showFeedback('Clientes carregados com sucesso.', 'success', true);
    } catch (error) {
      this.state.clients = [];
      this.showFeedback(error.message || 'Erro ao carregar clientes.', 'danger');
    } finally {
      this.state.loading = false;
      this.renderClients();
    }
  }

  async refreshVehicleIndex() {
    try {
      const vehicles = await ApiService.listVehicles();
      if (!Array.isArray(vehicles)) {
        return;
      }
      const mapped = vehicles.reduce((acc, vehicle) => {
        if (!vehicle.cliente_id) return acc;
        if (!acc.has(vehicle.cliente_id)) {
          acc.set(vehicle.cliente_id, []);
        }
        acc.get(vehicle.cliente_id).push(vehicle);
        return acc;
      }, new Map());
      this.state.vehiclesByClient = mapped;
    } catch (error) {
      console.warn('Não foi possível indexar veículos. Consulta continuará funcionando sem placas.', error);
    }
  }

  renderClients() {
    if (!this.elements.tableBody) {
      return;
    }

    if (this.state.loading) {
      this.elements.tableBody.innerHTML = this.renderLoadingRow();
      return;
    }

    const clients = this.getFilteredClients();

    if (!clients.length) {
      this.elements.tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-5">
            Nenhum cliente encontrado.
          </td>
        </tr>
      `;
      return;
    }

    this.elements.tableBody.innerHTML = clients.map((client) => this.renderClientRow(client)).join('');
  }

  renderLoadingRow() {
    return `
      <tr>
        <td colspan="6" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="text-muted mt-3 mb-0">Carregando clientes...</p>
        </td>
      </tr>
    `;
  }

  renderClientRow(client) {
    const location = client.cidade && client.estado ? `${client.cidade} / ${client.estado}` : '-';
    const phones = client.telefone || '-';
    const lastUpdate = this.formatDate(client.ultima_atualizacao || client.criado_em);
    return `
      <tr>
        <td>
          <strong>${client.nome || '-'}</strong>
        </td>
        <td>${client.email || '-'}</td>
        <td>${phones}</td>
        <td>${location}</td>
        <td>${lastUpdate}</td>
        <td class="text-end">
          <div class="btn-group" role="group">
            <button class="btn btn-light btn-sm" data-action="vehicles" data-id="${client.id}">
              Ver/Cadastrar Veículos
            </button>
            <button class="btn btn-outline-secondary btn-sm" data-action="edit" data-id="${client.id}">Editar</button>
            <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${client.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }

  getFilteredClients() {
    const term = this.state.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.state.clients;
    }

    return this.state.clients.filter((client) => {
      const baseFields = [
        client.nome,
        client.email,
        client.telefone,
        client.cidade,
        client.estado
      ].filter(Boolean);

      const vehicles = this.state.vehiclesByClient.get(client.id) || [];
      const vehicleFields = vehicles.map((vehicle) => vehicle.placa);

      const values = [...baseFields, ...vehicleFields].map((value) => (value || '').toLowerCase());
      return values.some((value) => value.includes(term));
    });
  }

  async handleCreateClient(form) {
    const hasAdmin = await this.ensureAdminId();
    if (!hasAdmin) {
      return;
    }
    const payload = this.collectClientPayload(form, true);
    if (!payload) {
      return;
    }
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Salvando...`;
    try {
      await ApiService.createClient(payload);
      this.modals.novoCliente?.hide();
      this.showFeedback('Cliente salvo com sucesso.', 'success');
      form.reset();
      await this.loadClients();
    } catch (error) {
      this.showFeedback(error.message || 'Erro ao salvar cliente.', 'danger');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar cliente';
    }
  }

  async openEditModal(clientId) {
    try {
      const client = await ApiService.getClient(clientId);
      this.fillEditForm(client);
      this.modals.editarCliente?.show();
    } catch (error) {
      this.showFeedback(error.message || 'Erro ao carregar cliente.', 'danger');
    }
  }

  fillEditForm(client) {
    this.elements.editarClienteId.value = client.id;
    document.getElementById('editarClienteNome').value = client.nome || '';
    document.getElementById('editarClienteEmail').value = client.email || '';
    document.getElementById('editarClienteTelefone').value = client.telefone || '';
    document.getElementById('editarClienteRua').value = client.rua || '';
    document.getElementById('editarClienteNumero').value = client.numero || '';
    document.getElementById('editarClienteCidade').value = client.cidade || '';
    document.getElementById('editarClienteEstado').value = client.estado || '';
    document.getElementById('editarClienteCep').value = client.cep || '';
  }

  async handleUpdateClient(form) {
    const clientId = this.elements.editarClienteId?.value;
    if (!clientId) return;

    const payload = this.collectClientPayload(form, false);
    if (!payload) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Salvando...`;

    try {
      await ApiService.updateClient(clientId, payload);
      this.modals.editarCliente?.hide();
      this.showFeedback('Cliente atualizado com sucesso.', 'success');
      await this.loadClients();
    } catch (error) {
      const message = error.status === 405
        ? 'O backend não possui rota PUT /clientes/<id>. Crie essa rota para habilitar edições.'
        : (error.message || 'Erro ao atualizar cliente.');
      this.showFeedback(message, 'danger');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar alterações';
    }
  }

  async handleDeleteClient(clientId) {
    try {
      await ApiService.deleteClient(clientId);
      this.modals.removerCliente?.hide();
      this.showFeedback('Cliente removido.', 'success');
      await this.loadClients();
    } catch (error) {
      const message = error.status === 405
        ? 'O backend não possui rota DELETE /clientes/<id>. Crie essa rota para habilitar exclusões.'
        : (error.message || 'Erro ao remover cliente.');
      this.showFeedback(message, 'danger');
    }
  }

  async openVehiclesModal(clientId) {
    this.state.selectedClientId = clientId;
    const client = this.state.clients.find((item) => String(item.id) === String(clientId));
    if (client) {
      this.elements.veiculosClienteNome.textContent = client.nome;
      this.elements.veiculosClienteResumo.textContent = `${client.email || '-'} • ${client.telefone || '-'}`;
    }

    this.elements.listaVeiculosCliente.innerHTML = `<p class="text-muted mb-0">Carregando veículos...</p>`;
    this.modals.veiculosCliente?.show();

    const vehicles = await this.fetchVehiclesForClient(clientId);
    this.renderVehicleList(vehicles);
    this.setCadastrarVeiculoClient(clientId);
  }

  async fetchVehiclesForClient(clientId) {
    if (this.state.vehiclesByClient.has(Number(clientId))) {
      return this.state.vehiclesByClient.get(Number(clientId));
    }

    try {
      const vehicles = await ApiService.listClientVehicles(clientId);
      this.state.vehiclesByClient.set(Number(clientId), vehicles);
      return vehicles;
    } catch (error) {
      if (error.status !== 404) {
        this.showFeedback(error.message || 'Erro ao buscar veículos.', 'danger');
      }
      try {
        const allVehicles = await ApiService.listVehicles();
        const filtered = allVehicles.filter((vehicle) => String(vehicle.cliente_id) === String(clientId));
        this.state.vehiclesByClient.set(Number(clientId), filtered);
        return filtered;
      } catch (fallbackError) {
        this.showFeedback(fallbackError.message || 'Não foi possível obter os veículos.', 'danger');
        return [];
      }
    }
  }

  renderVehicleList(vehicles) {
    if (!vehicles?.length) {
      this.elements.listaVeiculosCliente.innerHTML = `<p class="text-muted mb-0">Nenhum veículo cadastrado para este cliente.</p>`;
      return;
    }

    const html = `
      <div class="list-group">
        ${vehicles.map((vehicle) => `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>${vehicle.placa}</strong>
              <div class="text-muted small">${vehicle.marca || '-'} ${vehicle.modelo || '-'} • ${vehicle.ano || '-'}</div>
            </div>
            <span class="badge bg-light text-dark">${vehicle.status_ignicao ? 'Ativo' : 'Desligado'}</span>
          </div>
        `).join('')}
      </div>
    `;

    this.elements.listaVeiculosCliente.innerHTML = html;
  }

  setCadastrarVeiculoClient(clientId) {
    this.elements.veiculoClienteId.value = clientId;
  }

  async handleCreateVehicle(form) {
    const clientId = this.elements.veiculoClienteId?.value;
    if (!clientId) return;

    const payload = {
      cliente_id: Number(clientId),
      placa: document.getElementById('veiculoPlaca').value.trim().toUpperCase(),
      modelo: document.getElementById('veiculoModelo').value.trim(),
      marca: document.getElementById('veiculoMarca').value.trim(),
      ano: Number(document.getElementById('veiculoAno').value)
    };

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Salvando...`;

    try {
      await ApiService.createVehicle(payload);
      this.modals.cadastrarVeiculo?.hide();
      form.reset();
      this.showFeedback('Veículo cadastrado com sucesso.', 'success');
      this.state.vehiclesByClient.delete(Number(clientId));
      const isVehiclesModalOpen = document.getElementById('modalVeiculosCliente')?.classList.contains('show');
      if (isVehiclesModalOpen) {
        const vehicles = await this.fetchVehiclesForClient(clientId);
        this.renderVehicleList(vehicles);
      }
      await this.refreshVehicleIndex();
    } catch (error) {
      this.showFeedback(error.message || 'Erro ao cadastrar veículo.', 'danger');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar veículo';
    }
  }

  collectClientPayload(form, includePassword = true) {
    const prefix = form.id === 'formNovoCliente' ? 'novoCliente' : 'editarCliente';
    const getValue = (field) => document.getElementById(`${prefix}${field}`)?.value?.trim() || '';

    const payload = {
      nome: getValue('Nome'),
      email: getValue('Email'),
      telefone: this.normalizePhone(getValue('Telefone')),
      rua: getValue('Rua'),
      numero: getValue('Numero'),
      cidade: getValue('Cidade'),
      estado: getValue('Estado'),
      cep: getValue('Cep')
    };

    if (!this.adminId) {
      this.showFeedback('Administrador não identificado. Recarregue a página ou entre em contato com o suporte.', 'danger');
      return null;
    }
    payload.administrador_id = this.adminId;

    if (includePassword) {
      payload.senha = document.getElementById('novoClienteSenha')?.value || '';
      if (!payload.senha) {
        this.showFeedback('Senha temporária é obrigatória.', 'warning');
        return null;
      }
    }

    const requiredFields = ['nome', 'email', 'telefone', 'rua', 'numero', 'cidade', 'estado', 'cep'];
    const missingFields = requiredFields.filter((field) => !payload[field]);
    if (missingFields.length) {
      this.showFeedback('Preencha todos os campos obrigatórios.', 'warning');
      return null;
    }

    if (!includePassword) {
      delete payload.senha;
    }

    return payload;
  }

  normalizePhone(value) {
    if (!value) return '';
    let telefone = value.replace(/\D/g, '');
    if (telefone.length === 11 && !telefone.startsWith('55')) {
      telefone = `+55${telefone}`;
    } else if (telefone.length === 10) {
      telefone = `+55${telefone}`;
    } else if (!telefone.startsWith('+')) {
      telefone = `+${telefone}`;
    }
    return telefone;
  }

  resetNovoClienteForm() {
    this.elements.formNovoCliente?.reset();
    this.setRandomPassword();
  }

  setRandomPassword() {
    if (!this.elements.novoClienteSenha) return;
    const password = `Senha#${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    this.elements.novoClienteSenha.value = password;
    this.elements.novoClienteSenha.type = 'password';
    if (this.elements.btnVerSenhaNovoCliente) {
      this.elements.btnVerSenhaNovoCliente.innerHTML = '<i class="bi bi-eye"></i>';
    }
  }

  togglePasswordVisibility() {
    if (!this.elements.novoClienteSenha) return;
    const input = this.elements.novoClienteSenha;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    this.elements.btnVerSenhaNovoCliente.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  }

  async setupCepAutoFill() {
    this.attachCepListener('novoClienteCep', {
      cidadeId: 'novoClienteCidade',
      estadoId: 'novoClienteEstado',
      ruaId: 'novoClienteRua'
    });

    this.attachCepListener('editarClienteCep', {
      cidadeId: 'editarClienteCidade',
      estadoId: 'editarClienteEstado',
      ruaId: 'editarClienteRua'
    });
  }

  attachCepListener(cepId, targets) {
    const cepInput = document.getElementById(cepId);
    if (!cepInput) return;

    cepInput.addEventListener('blur', async () => {
      const cep = cepInput.value.replace(/\D/g, '');
      if (cep.length !== 8) {
        return;
      }
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
          this.showFeedback('CEP não encontrado.', 'warning');
          return;
        }
        document.getElementById(targets.cidadeId).value = data.localidade || '';
        document.getElementById(targets.estadoId).value = data.uf || '';
        document.getElementById(targets.ruaId).value = data.logradouro || '';
      } catch (error) {
        console.error('Erro ao consultar CEP:', error);
      }
    });
  }

  showFeedback(message, variant = 'info', transient = false) {
    if (!this.elements.feedbackArea || !message) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${variant} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    this.elements.feedbackArea.prepend(alert);
    if (transient) {
      setTimeout(() => {
        alert.classList.remove('show');
        alert.addEventListener('transitionend', () => alert.remove(), { once: true });
      }, 2500);
    }
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        return '-';
      }
      return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return '-';
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const clientesUI = new ClientesUI();
  await clientesUI.init();
});