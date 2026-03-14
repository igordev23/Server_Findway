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

Entendi o que você quer agora: **não reescrever**, **não reorganizar**, **não fazer estilo TCC**, e **não remover nada**.
A ideia é **continuar o README exatamente do jeito que está** e **adicionar novas seções técnicas mais detalhadas**, transformando ele em **manual técnico**.

Então abaixo estão **seções que você pode adicionar depois do README atual**, sem alterar o que já existe.

---

# Arquitetura do Sistema

A aplicação FindWay segue uma arquitetura baseada em **camadas**, separando responsabilidades entre interface do usuário, lógica de aplicação e persistência de dados.

A arquitetura geral pode ser dividida em três camadas principais:

### Camada de Apresentação (Frontend)

Responsável pela interface visual do sistema e interação com o usuário.

Componentes principais:

* Templates HTML renderizados pelo Flask
* Scripts JavaScript responsáveis pela comunicação com o backend
* Integração com Google Maps para exibição de localização
* Componentes visuais implementados com Bootstrap

Essa camada realiza requisições HTTP para os endpoints definidos no backend e exibe as respostas processadas.

---

### Camada de Aplicação (Backend)

Responsável por processar requisições, aplicar regras de negócio e gerenciar comunicação com o banco de dados.

O backend foi desenvolvido utilizando o framework **Flask**, e está organizado em módulos que separam:

* rotas da aplicação
* modelos de dados
* configuração do sistema
* inicialização da aplicação

Cada grupo de rotas implementa funcionalidades específicas do sistema, como gerenciamento de veículos ou consulta de localizações.

---

### Camada de Persistência (Banco de Dados)

Responsável pelo armazenamento permanente das informações do sistema.

O banco de dados utilizado é **PostgreSQL**, acessado através da biblioteca **SQLAlchemy**, que realiza o mapeamento entre objetos Python e tabelas do banco.

Os dados armazenados incluem:

* usuários
* clientes
* veículos
* localizações GPS
* mensagens entre usuários
* eventos do sistema

---

# Modelo de Dados

O banco de dados do sistema é composto por várias entidades que representam os elementos principais da aplicação.

### Usuário (usuario)

Tabela base responsável por armazenar dados de usuários do sistema.

Informações armazenadas incluem:

* identificador do usuário
* nome
* email
* informações de autenticação
* tipo de usuário

Essa entidade serve como base para diferentes tipos de usuários dentro da aplicação.

---

### Administrador (administrador)

Representa usuários com permissões administrativas dentro do sistema.

Administradores possuem acesso a funcionalidades como:

* cadastro de clientes
* cadastro de veículos
* gerenciamento geral da plataforma

---

### Cliente (cliente)

Armazena informações sobre os clientes associados ao sistema.

Cada cliente pode possuir um ou mais veículos cadastrados.

Campos principais:

* identificador
* nome
* informações de contato

---

### Veículo (veiculo)

Representa os veículos monitorados pelo sistema.

Cada veículo possui relação com um cliente e pode possuir múltiplos registros de localização.

Campos comuns incluem:

* identificador
* modelo ou identificação do veículo
* cliente associado

---

### Localização (localizacao)

Armazena coordenadas GPS recebidas pelo sistema.

Esses dados são utilizados para:

* exibir a posição atual do veículo
* gerar histórico de movimentação

Campos típicos incluem:

* latitude
* longitude
* data e hora da coleta

---

### Veículo_Localização (veiculo_localizacao)

Tabela intermediária que relaciona veículos com registros de localização.

Essa estrutura permite armazenar múltiplas localizações para um mesmo veículo.

---

### Mensagem (mensagem)

Permite a troca de mensagens entre usuários do sistema.

Pode ser utilizada para comunicação interna entre administradores e clientes.

---

### Evento (evento)

Registra eventos relevantes ocorridos no sistema.

Exemplos:

* atualizações de localização
* cadastro de veículos
* alterações administrativas

---

# Fluxo de Funcionamento do Rastreamento

O processo de rastreamento de veículos ocorre em várias etapas dentro do sistema.

### 1. Coleta de localização

Um dispositivo de rastreamento obtém coordenadas GPS do veículo.

Essas coordenadas normalmente incluem:

* latitude
* longitude
* timestamp

---

### 2. Envio para o servidor

As coordenadas são enviadas ao servidor através de uma requisição HTTP para um endpoint responsável pelo registro de localização.

---

### 3. Processamento no backend

O backend recebe os dados e realiza:

* validação das informações recebidas
* associação com o veículo correspondente
* armazenamento no banco de dados

---

### 4. Armazenamento

Os dados são registrados nas tabelas de localização e associados ao veículo correspondente.

Isso permite que o sistema mantenha histórico de movimentação.

---

### 5. Visualização no sistema

Os usuários autenticados podem visualizar as localizações através da interface web.

A interface consulta o backend para obter as coordenadas e utiliza o Google Maps para exibir a posição no mapa.

---

# Comunicação entre Frontend e Backend

A comunicação entre a interface e o backend ocorre através de requisições HTTP.

Essas requisições são realizadas principalmente através de scripts JavaScript presentes na pasta:

```
static/assets/js/
```

Alguns scripts responsáveis por funcionalidades específicas incluem:

* `index.js` – scripts do dashboard principal
* `historico.js` – consulta e renderização do histórico de localização
* `auth-check.js` – verificação de autenticação do usuário
* `login.js` – integração com autenticação Firebase

---

# Gerenciamento de Autenticação

A autenticação do sistema é realizada utilizando o Firebase.

O processo envolve duas etapas principais:

### Autenticação no cliente

O usuário realiza login na interface utilizando email e senha.

A autenticação é processada pelo Firebase Authentication.

---

### Validação da sessão

Após autenticação, o Firebase gera um token que identifica a sessão do usuário.

Esse token é armazenado no navegador e utilizado para validar o acesso às páginas protegidas.

O script responsável pela verificação é:

```
static/assets/js/auth-check.js
```

Esse script verifica se o usuário está autenticado antes de permitir acesso às páginas da aplicação.

---

# Deploy e Execução em Produção

A aplicação pode ser executada em ambiente de produção utilizando o servidor **Gunicorn**, que é responsável por servir a aplicação Flask em ambientes de hospedagem.

O deploy do projeto pode ser realizado em plataformas de hospedagem como Render.

Durante o deploy são configuradas variáveis de ambiente contendo:

* credenciais de banco de dados
* chaves de API
* credenciais Firebase
* configurações administrativas

---

# Boas Práticas de Desenvolvimento

O projeto segue algumas boas práticas para organização e manutenção do código:

* separação entre rotas, modelos e templates
* uso de variáveis de ambiente para informações sensíveis
* controle de versão utilizando Git
* organização modular da aplicação

Essa estrutura facilita a manutenção do sistema e permite a evolução da aplicação com a adição de novas funcionalidades.

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
