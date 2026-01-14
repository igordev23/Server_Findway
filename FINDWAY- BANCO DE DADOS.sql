\c postgres;

DROP DATABASE IF EXISTS findway;
CREATE DATABASE findway;
\c findway;

CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" BIGSERIAL PRIMARY KEY,
    "nome" varchar(100) NOT NULL,
    "email" varchar(100) NOT NULL UNIQUE,
    "telefone" varchar(20) NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    "tipo_usuario" varchar(20) NOT NULL,
    "firebase_uid" varchar(128) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "Administrador" (
    "id" BIGINT PRIMARY KEY,
    "stripe_connected_account_id" VARCHAR(255) UNIQUE,
    FOREIGN KEY ("id") REFERENCES "Usuario" ("id") ON DELETE CASCADE
);

CREATE TABLE "Cliente" (
    id BIGINT PRIMARY KEY,
    administrador_id BIGINT NOT NULL,
    rua VARCHAR(255) NOT NULL,
    cidade VARCHAR(255) NOT NULL,
    estado VARCHAR(255) NOT NULL,
    cep VARCHAR(255) NOT NULL,
    numero VARCHAR(255) NOT NULL,
    pin VARCHAR(4) NOT NULL,
    -- Campos Stripe
    stripe_customer_id VARCHAR(255) UNIQUE,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'ativo',
    -- Controle de Pagamento
    dia_pagamento INTEGER NOT NULL DEFAULT 15,
    plano_id VARCHAR(100),
    plano_nome VARCHAR(100),
    plano_valor NUMERIC(10, 2),
    data_ultimo_pagamento DATE,
    data_proximo_vencimento DATE,
    data_inicio_cobranca DATE,

    FOREIGN KEY (id) REFERENCES "Usuario"(id) ON DELETE CASCADE,
    FOREIGN KEY (administrador_id) REFERENCES "Administrador"(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS "Veiculo" (
    "id" BIGSERIAL PRIMARY KEY,
    "cliente_id" BIGINT NOT NULL,
    "placa" varchar(10) NOT NULL UNIQUE,
    "modelo" varchar(50) NOT NULL,
    "marca" varchar(50) NOT NULL,
    "ano" smallint NOT NULL,
    "status_ignicao" boolean NOT NULL,
    "ultima_atualizacao" timestamp with time zone NOT NULL,
    "ativo" boolean NOT NULL,
    "criado_em" timestamp with time zone NOT NULL,
    FOREIGN KEY ("cliente_id") REFERENCES "Cliente" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Localizacao" (
    "id" BIGSERIAL PRIMARY KEY,
    "placa" varchar(10) NOT NULL,
    "latitude" numeric(10,7) NOT NULL,
    "longitude" numeric(10,7) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    FOREIGN KEY ("placa") REFERENCES "Veiculo" ("placa") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Evento" (
    "id" BIGSERIAL PRIMARY KEY,
    "veiculo_id" BIGINT NOT NULL,
    "tipo" varchar(50) NOT NULL,
    "descricao" varchar(255) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    FOREIGN KEY ("veiculo_id") REFERENCES "Veiculo" ("id") ON DELETE CASCADE
);
