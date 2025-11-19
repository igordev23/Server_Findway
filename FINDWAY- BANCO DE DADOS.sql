CREATE DATABASE findway_local;
\c findway_local;

CREATE TABLE IF NOT EXISTS "Administrador" (
	"id" bigint NOT NULL UNIQUE,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Cliente" (
	"id" bigint NOT NULL UNIQUE,
	"administrador_id" bigint NOT NULL,
	"rua" varchar(255) NOT NULL,
	"cidade" varchar(255) NOT NULL,
	"estado" varchar(255) NOT NULL,
	"cep" varchar(255) NOT NULL,
	"numero" varchar(255) NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Veiculo" (
	"id" bigint NOT NULL UNIQUE,
	"cliente_id" bigint NOT NULL,
	"placa" varchar(10) NOT NULL UNIQUE,
	"modelo" varchar(50) NOT NULL,
	"marca" varchar(50) NOT NULL,
	"ano" smallint NOT NULL,
	"status_ignicao" boolean NOT NULL,
	"ultima_atualizacao" timestamp with time zone NOT NULL,
	"ativo" boolean NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Localizacao" (
	"id" bigint NOT NULL UNIQUE,
	"nome" varchar(100) NOT NULL,
	"latitude" numeric(10,7) NOT NULL,
	"longitude" numeric(10,7) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Veiculo_Localizacao" (
	"id" bigint NOT NULL UNIQUE,
	"veiculo_id" bigint NOT NULL,
	"localizacao_id" bigint NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Evento" (
	"id" bigint NOT NULL UNIQUE,
	"veiculo_id" bigint NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Usuario" (
	"id" bigint NOT NULL UNIQUE,
	"nome" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL UNIQUE,
	"telefone" varchar(20) NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"tipo_usuario" varchar(20) NOT NULL,
	"firebase_uid" varchar(128) NOT NULL UNIQUE,
	PRIMARY KEY ("id")
);

ALTER TABLE "Administrador" ADD CONSTRAINT "Administrador_fk0" FOREIGN KEY ("id") REFERENCES "Usuario"("id");
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_fk0" FOREIGN KEY ("id") REFERENCES "Usuario"("id");

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_fk1" FOREIGN KEY ("administrador_id") REFERENCES "Administrador"("id");
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_fk1" FOREIGN KEY ("cliente_id") REFERENCES "Cliente"("id");

ALTER TABLE "Veiculo_Localizacao" ADD CONSTRAINT "Veiculo_Localizacao_fk1" FOREIGN KEY ("veiculo_id") REFERENCES "Veiculo"("id");

ALTER TABLE "Veiculo_Localizacao" ADD CONSTRAINT "Veiculo_Localizacao_fk2" FOREIGN KEY ("localizacao_id") REFERENCES "Localizacao"("id");
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_fk1" FOREIGN KEY ("veiculo_id") REFERENCES "Veiculo"("id");

