-- ====================================
-- BANCO DE DADOS: findway_local
-- ====================================

-- Cria o banco de dados (caso ainda não exista)
CREATE DATABASE findway_local;

-- Conecta ao banco recém-criado
\c findway_local;

-- ====================================
-- TABELA DE LOCAIS (dados GPS)
-- ====================================

CREATE TABLE locais (
    id SERIAL PRIMARY KEY,
    nome TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- DADOS DE EXEMPLO
-- ====================================

INSERT INTO locais (nome, latitude, longitude)
VALUES
('Ponto Central', -23.55052, -46.633308),
('Estação Norte', -23.48024, -46.612582),
('Parque Sul', -23.610032, -46.701842);

-- ====================================
-- CONSULTA DE VERIFICAÇÃO
-- ====================================

SELECT * FROM locais;

-- ====================================
-- FIM DO SCRIPT
-- ====================================
