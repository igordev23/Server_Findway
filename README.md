# FindWay - Sistema de Rastreamento de Veículos em Tempo Real

FindWay é uma aplicação web completa para rastreamento e monitoramento de veículos em tempo real. O sistema permite que administradores gerenciem clientes e veículos, enquanto oferece visualização de localização GPS, histórico de movimentação e mensagens entre usuários.

## Características Principais

- **Autenticação com Firebase** - Login seguro com Firebase Authentication
- **Rastreamento em Tempo Real** - Visualização de localização de veículos no Google Maps
- **Histórico de Localização** - Consulta de movimentação dos últimos 24 horas
- **Gerenciamento de Clientes** - CRUD completo de clientes
- **Gerenciamento de Veículos** - Cadastro e monitoramento de frotas
- **Proteção de Rotas** - Verificação de autenticação em todas as páginas
- **Interface Responsiva** - Layout adaptável para desktop e mobile
- **Dashboard Intuitivo** - Painél de controle com dados em tempo real

## Tecnologias Utilizadas

### Backend
- **Flask** - Framework web Python
- **SQLAlchemy** - ORM para banco de dados
- **PostgreSQL** - Banco de dados relacional
- **Firebase Admin SDK** - Gerenciamento de autenticação e usuários
- **Pytz** - Manipulação de fusos horários
- **Gunicorn** - Servidor WSGI para produção
- **python-dotenv** - Gerenciamento de variáveis de ambiente

### Frontend
- **HTML5** - Estrutura
- **Bootstrap 5** - Framework CSS
- **Themify Icons** - Ícones da interface
- **Google Maps API** - Visualização de mapas
- **Firebase Auth** - Autenticação client-side
- **JavaScript Vanilla** - Lógica e interatividade

### Infraestrutura
- **Render** - Hospedagem (banco remoto)
- **GitHub** - Versionamento

## Estrutura do Projeto

```
Server_Findway/
├── app.py                           # Aplicação principal Flask
├── config.py                        # Configurações (banco local/remoto)
├── database.py                      # Inicialização do banco de dados
├── requirements.txt                 # Dependências Python
├── Procfile                         # Configuração para deploy
│
├── models/                          # Modelos de banco de dados
│   ├── usuario.py                   # Modelo base de usuários
│   ├── administrador.py             # Usuários administradores
│   ├── cliente.py                   # Clientes
│   ├── veiculo.py                   # Veículos
│   ├── localizacao.py               # Localizações GPS
│   ├── veiculo_localizacao.py       # Relação veículo-localização
│   ├── mensagem.py                  # Mensagens entre usuários
│   ├── evento.py                    # Eventos do sistema
│
├── routes/                          # Rotas e endpoints da API
│   ├── administrador_routes.py      # Rotas de administração
│   ├── cliente_routes.py            # Rotas de clientes
│   ├── veiculo_routes.py            # Rotas de veículos
│   ├── localizacao_routes.py        # Rotas de localização GPS
│   ├── mensagem_routes.py           # Rotas de mensagens
│   ├── usuario_routes.py            # Rotas de usuários
│   ├── evento_routes.py             # Rotas de eventos
│   └── veiculo_localizacao_routes.py # Rotas de relação veículo-localização
│
├── templates/                       # Templates HTML
│   ├── layouts/
│   │   ├── base.html                # Template base (com sidebar, navbar)
│   │   └── base-authentication.html # Template para tela de login
│   ├── includes/
│   │   ├── navigation.html          # Navbar
│   │   ├── sidebar.html             # Menu lateral
│   │   ├── scripts.html             # Scripts globais
│   │   └── footer.html              # Rodapé
│   ├── index.html                   # Dashboard principal
│   ├── historico.html               # Histórico de localização
│   ├── login.html                   # Página de login
│   └── admin/
│       ├── cadastrar_cliente.html   # Cadastro de clientes
│       └── cadastrar_veiculo.html   # Cadastro de veículos
│
├── static/                          # Arquivos estáticos
│   └── assets/
│       ├── css/                     # Estilos CSS
│       ├── js/
│       │   ├── auth-check.js        # Verificação centralizada de auth
│       │   ├── index.js             # Scripts principais
│       │   ├── historico.js         # Scripts do histórico
│       │   └── loginFirebase/
│       │       └── login.js         # Scripts de login Firebase
│       ├── images/                  # Imagens e logos
│       └── fonts/                   # Fontes e ícones
│
└── __pycache__/                     # Cache Python (ignorar)
```

## Como Executar Localmente

### Pré-requisitos
- Python 3.8+
- PostgreSQL instalado e rodando
- Conta Firebase configurada
- Chaves de API configuradas

### 1. Clonar o Repositório
```bash
git clone https://github.com/igordev23/Server_Findway.git
cd Server_Findway
```

### 2. Criar Ambiente Virtual
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate
```

### 3. Instalar Dependências
```bash
pip install -r requirements.txt
```

### 4. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Banco de Dados
USE_LOCAL_DB=true
DATABASE_LOCAL=postgresql://user:password@localhost:5432/findway_db
DATABASE_URL=postgresql://user:password@db-host.render.com/findway_db

# Firebase (obtenha em: https://console.firebase.google.com)
FIREBASE_API_KEY=sua_api_key
FIREBASE_AUTH_DOMAIN=seu_auth_domain.firebaseapp.com
FIREBASE_PROJECT_ID=seu_project_id
FIREBASE_STORAGE_BUCKET=seu_storage_bucket.appspot.com
FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
FIREBASE_APP_ID=seu_app_id
FIREBASE_MEASUREMENT_ID=seu_measurement_id
FIREBASE_CREDENTIALS=/caminho/para/serviceAccountKey.json

# Google Maps API
GOOGLE_MAPS_API_KEY=sua_chave_google_maps_api

# Email do super administrador
ADMIN_EMAIL=exemplo@findway.com
```

### 5. Inicializar Banco de Dados
```bash
python app.py
```

A primeira execução criará as tabelas automaticamente.

### 6. Executar a Aplicação
```bash
python -m flask run
# ou
python app.py
```

Acesse em: `http://localhost:5000`

## Autenticação e Segurança

### Fluxo de Autenticação
1. Usuário acessa a aplicação e é redirecionado para `/login`
2. Faz login com email e senha via Firebase Authentication
3. Firebase gera token de autenticação
4. Script `auth-check.js` verifica estado de autenticação
5. Se autenticado, usuário acessa as páginas protegidas
6. Se não autenticado, é redirecionado para `/login`

### Proteção de Rotas
- Todas as rotas (exceto `/login`) requerem autenticação
- Verificação centralizada em `static/assets/js/auth-check.js`
- Redirecionamento automático para login se sessão expirar
- Token armazenado no localStorage do navegador


## Licença

Este projeto é parte do projeto de pesquisa FindWay-EmbarcaTech.

## Autores

- Igor ([@igordev23](https://github.com/igordev23))
- Larissa Souza ([@larissaNa](https://github.com/larissaNa))
- Mª Isabelly ([@Isabellybrt](https://github.com/Isabellybrt))
- Vanessa Pereira([vanessapereiracunha](https://github.com/vanessapereiracunha))

## Contato

Para dúvidas ou sugestões, entre em contato através da Central de Ajuda da aplicação.

---

**Última atualização**: Novembro 2025
