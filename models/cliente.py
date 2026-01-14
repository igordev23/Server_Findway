from database import db
from models.usuario import Usuario
from datetime import datetime, date

class Cliente(Usuario):
    __tablename__ = "Cliente"

    id = db.Column(db.BigInteger, db.ForeignKey("Usuario.id"), primary_key=True)

    # Quem criou este cliente (um Administrador)
    administrador_id = db.Column(db.BigInteger, db.ForeignKey("Administrador.id"), nullable=False)

    rua = db.Column(db.String(255), nullable=False)
    cidade = db.Column(db.String(255), nullable=False)
    estado = db.Column(db.String(255), nullable=False)
    cep = db.Column(db.String(255), nullable=False)
    numero = db.Column(db.String(255), nullable=False)
    pin = db.Column(db.String(4), nullable=True) # PIN de 4 dígitos

     # Stripe 
    stripe_customer_id = db.Column(db.String(255), unique=True, nullable=True)
    subscription_status = db.Column(db.String(50), nullable=False, default="ativo")
    
    # Campos para controle de pagamento mensal
    dia_pagamento = db.Column(db.Integer, nullable=False, default=15)  # Dia do mês (1-31)
    plano_id = db.Column(db.String(100), nullable=True)  # ID do plano no Stripe
    plano_nome = db.Column(db.String(100), nullable=True)  # Nome do plano para exibição
    plano_valor = db.Column(db.Numeric(10, 2), nullable=True)  # Valor do plano
    data_ultimo_pagamento = db.Column(db.Date, nullable=True)  # Último pagamento realizado
    data_proximo_vencimento = db.Column(db.Date, nullable=True)  # Próxima data de vencimento
    data_inicio_cobranca = db.Column(db.Date, nullable=True)  # Quando começou a cobrar

    __mapper_args__ = {
        "polymorphic_identity": "cliente",
    }
    
    def verificar_status_pagamento(self):
        """Verifica se o cliente está em dia com os pagamentos"""
        status = (getattr(self, "subscription_status", "ativo") or "ativo").strip().lower()
        if status in ("inadimplente", "cancelado", "bloqueado"):
            return False
        if not self.data_proximo_vencimento:
            return True  # Novo cliente, sem vencimento definido
        
        hoje = date.today()
        if hoje > self.data_proximo_vencimento:
            # Verificar se já pagou este mês
            if self.data_ultimo_pagamento:
                # Se o último pagamento foi após o vencimento, está em dia
                if self.data_ultimo_pagamento >= self.data_proximo_vencimento:
                    return True
            
            # Está vencido/inadimplente
            return False
        
        return True
    
    def atualizar_proximo_vencimento(self):
        """Atualiza a data do próximo vencimento"""
        if self.data_ultimo_pagamento:
            # Próximo vencimento é no dia definido, mês seguinte ao último pagamento
            ultimo_mes = self.data_ultimo_pagamento.month
            ultimo_ano = self.data_ultimo_pagamento.year
            
            if ultimo_mes == 12:
                proximo_mes = 1
                proximo_ano = ultimo_ano + 1
            else:
                proximo_mes = ultimo_mes + 1
                proximo_ano = ultimo_ano
            
            # Ajustar para o último dia do mês se o dia de pagamento for inválido
            ultimo_dia_mes = self._ultimo_dia_do_mes(proximo_mes, proximo_ano)
            dia_vencimento = min(self.dia_pagamento, ultimo_dia_mes)
            
            self.data_proximo_vencimento = date(proximo_ano, proximo_mes, dia_vencimento)
        else:
            # Primeiro vencimento - dia definido no mês seguinte ao início
            if self.data_inicio_cobranca:
                inicio_mes = self.data_inicio_cobranca.month
                inicio_ano = self.data_inicio_cobranca.year
                
                if inicio_mes == 12:
                    proximo_mes = 1
                    proximo_ano = inicio_ano + 1
                else:
                    proximo_mes = inicio_mes + 1
                    proximo_ano = inicio_ano
                
                ultimo_dia_mes = self._ultimo_dia_do_mes(proximo_mes, proximo_ano)
                dia_vencimento = min(self.dia_pagamento, ultimo_dia_mes)
                
                self.data_proximo_vencimento = date(proximo_ano, proximo_mes, dia_vencimento)
    
    def _ultimo_dia_do_mes(self, mes, ano):
        """Retorna o último dia de um mês/ano"""
        if mes == 2:
            # Fevereiro - verificar ano bissexto
            if (ano % 4 == 0 and ano % 100 != 0) or (ano % 400 == 0):
                return 29
            else:
                return 28
        elif mes in [4, 6, 9, 11]:
            return 30
        else:
            return 31
    
    def registrar_pagamento(self):
        """Registra um pagamento e atualiza as datas"""
        self.data_ultimo_pagamento = date.today()
        self.subscription_status = "ativo"
        self.atualizar_proximo_vencimento()
    
    def dias_para_vencimento(self):
        """Retorna dias restantes até o vencimento"""
        if not self.data_proximo_vencimento:
            return None
        
        hoje = date.today()
        delta = self.data_proximo_vencimento - hoje
        return delta.days
