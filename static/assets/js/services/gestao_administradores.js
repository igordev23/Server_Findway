
const AdminService = (() => {
  const defaultHeaders = { 'Content-Type': 'application/json' };

  async function request(url, options = {}) {
    // Adicionar token do Firebase no header
    const auth = firebase.auth();
    const user = auth.currentUser;
    
    const config = { headers: { ...defaultHeaders }, ...options };
    
    if (user) {
        try {
            const token = await user.getIdToken();
            config.headers['Authorization'] = `Bearer ${token}`;
        } catch (e) {
            console.error("Erro ao obter token:", e);
        }
    }

    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }
    const response = await fetch(url, config);
    let data = null;
    try { data = await response.json(); } catch (_) { data = null; }
    
    if (!response.ok) {
      const error = new Error(data?.error || 'Erro ao comunicar com o servidor.');
      throw error;
    }
    return data;
  }

  return {
    list: () => request('/administradores'),
    get: (id) => request(`/administradores/${id}`),
    create: (payload) => request('/usuarios', { method: 'POST', body: { ...payload, tipo_usuario: 'administrador' } }),
    update: (id, payload) => request(`/administradores/${id}`, { method: 'PUT', body: payload }),
    delete: (id) => request(`/administradores/${id}`, { method: 'DELETE' })
  };
})();

class AdminUI {
  constructor() {
    this.state = {
      admins: [],
      searchTerm: '',
      loading: false
    };

    this.elements = {
      tableBody: document.getElementById('tabela-admins'),
      searchInput: document.getElementById('campo-busca-admins'),
      feedbackArea: document.getElementById('feedback-area'),
      
      btnAbrirModalNovo: document.getElementById('btnAbrirModalNovoAdmin'),
      formNovo: document.getElementById('formNovoAdmin'),
      btnGerarSenha: document.getElementById('btnGerarSenhaNovoAdmin'),
      btnVerSenha: document.getElementById('btnVerSenhaNovoAdmin'),
      inputSenhaNovo: document.getElementById('novoAdminSenha'),
      
      formEditar: document.getElementById('formEditarAdmin'),
      inputEditarId: document.getElementById('editarAdminId'),
      
      btnConfirmarRemocao: document.getElementById('btnConfirmarRemocaoAdmin'),
      inputRemoverId: document.getElementById('removerAdminId'),

      modalNovo: document.getElementById('modalNovoAdmin'),
      modalEditar: document.getElementById('modalEditarAdmin'),
      modalRemover: document.getElementById('modalRemoverAdmin')
    };

    this.modals = {
      novo: this.elements.modalNovo ? new bootstrap.Modal(this.elements.modalNovo) : null,
      editar: this.elements.modalEditar ? new bootstrap.Modal(this.elements.modalEditar) : null,
      remover: this.elements.modalRemover ? new bootstrap.Modal(this.elements.modalRemover) : null
    };
  }

  init() {
    this.registerEvents();
    this.waitForAuth().then(() => {
        this.loadAdmins();
    });
  }

  waitForAuth() {
    return new Promise((resolve) => {
        const checkAuth = () => {
            if (typeof firebase !== 'undefined' && firebase.auth()) {
                const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                    unsubscribe();
                    if (user) {
                        resolve(user);
                    } else {
                        // Se não houver usuário logado, redireciona ou avisa
                        console.warn("Usuário não autenticado na gestão de administradores.");
                        window.location.href = "/login";
                    }
                });
            } else {
                setTimeout(checkAuth, 100);
            }
        };
        checkAuth();
    });
  }

  registerEvents() {
    this.elements.searchInput?.addEventListener('input', (e) => {
      this.state.searchTerm = e.target.value;
      this.render();
    });

    this.elements.btnAbrirModalNovo?.addEventListener('click', () => {
      this.elements.formNovo.reset();
      this.setRandomPassword();
      this.modals.novo?.show();
    });

    this.elements.btnGerarSenha?.addEventListener('click', () => this.setRandomPassword());
    this.elements.btnVerSenha?.addEventListener('click', () => {
      const type = this.elements.inputSenhaNovo.type === 'password' ? 'text' : 'password';
      this.elements.inputSenhaNovo.type = type;
    });

    this.elements.formNovo?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleCreate(e.currentTarget);
    });

    this.elements.formEditar?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleUpdate(e.currentTarget);
    });

    this.elements.tableBody?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') this.openEdit(id);
      if (btn.dataset.action === 'delete') this.openDelete(id);
    });

    this.elements.btnConfirmarRemocao?.addEventListener('click', () => this.handleDelete());
  }

  async loadAdmins() {
    this.state.loading = true;
    this.render();
    try {
      this.state.admins = await AdminService.list();
    } catch (e) {
      this.showFeedback(e.message, 'danger');
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  render() {
    if (this.state.loading) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-5">Carregando...</td></tr>`;
      return;
    }

    const term = this.state.searchTerm.toLowerCase();
    const filtered = this.state.admins.filter(a => 
      (a.nome || '').toLowerCase().includes(term) || 
      (a.email || '').toLowerCase().includes(term)
    );

    if (!filtered.length) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-5">Nenhum administrador encontrado.</td></tr>`;
      return;
    }

    this.elements.tableBody.innerHTML = filtered.map(a => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar-initial rounded-circle bg-primary text-white me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
              ${(a.nome || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <h6 class="mb-0">${a.nome}</h6>
            </div>
          </div>
        </td>
        <td>${a.email}</td>
        <td>${a.telefone || '-'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${a.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${a.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  async handleCreate(form) {
    const payload = {
      nome: form.nome.value,
      email: form.email.value,
      telefone: form.telefone.value,
      senha: form.senha.value
    };
    
    try {
      await AdminService.create(payload);
      this.modals.novo?.hide();
      this.showFeedback('Administrador criado com sucesso!', 'success');
      this.loadAdmins();
    } catch (e) {
      this.showFeedback(e.message, 'danger');
    }
  }

  async openEdit(id) {
    try {
      const admin = await AdminService.get(id);
      this.elements.inputEditarId.value = admin.id;
      document.getElementById('editarAdminNome').value = admin.nome;
      document.getElementById('editarAdminEmail').value = admin.email;
      document.getElementById('editarAdminTelefone').value = admin.telefone || '';
      document.getElementById('editarAdminSenha').value = ''; 
      this.modals.editar?.show();
    } catch (e) {
      this.showFeedback('Erro ao carregar dados.', 'danger');
    }
  }

  async handleUpdate(form) {
    const id = this.elements.inputEditarId.value;
    const payload = {
      nome: document.getElementById('editarAdminNome').value,
      email: document.getElementById('editarAdminEmail').value,
      telefone: document.getElementById('editarAdminTelefone').value,
      senha: document.getElementById('editarAdminSenha').value || undefined
    };

    try {
      await AdminService.update(id, payload);
      this.modals.editar?.hide();
      this.showFeedback('Administrador atualizado!', 'success');
      this.loadAdmins();
    } catch (e) {
      this.showFeedback(e.message, 'danger');
    }
  }

  openDelete(id) {
    this.elements.inputRemoverId.value = id;
    this.modals.remover?.show();
  }

  async handleDelete() {
    const id = this.elements.inputRemoverId.value;
    try {
      await AdminService.delete(id);
      this.modals.remover?.hide();
      this.showFeedback('Administrador removido!', 'success');
      this.loadAdmins();
    } catch (e) {
      this.showFeedback(e.message, 'danger');
    }
  }

  setRandomPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (this.elements.inputSenhaNovo) {
      this.elements.inputSenhaNovo.value = password;
      this.elements.inputSenhaNovo.type = "text"; 
    }
  }

  showFeedback(msg, type = 'info') {
    this.elements.feedbackArea.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    setTimeout(() => {
        this.elements.feedbackArea.innerHTML = '';
    }, 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminUI().init();
});
