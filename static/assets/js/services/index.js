let ui;

class TempoRealUI {
    constructor() {
        this._bust = (u) => u + (u.includes("?") ? "&" : "?") + "_t=" + Date.now();
        this.map = null;
        this.marker = null;
        this.markers = [];
        this.generalMode = false;
        this.vehicles = [];
        this.currentVehicle = null;
        this.selectEl = document.getElementById("selectPlaca");
        this.lastUpdateEl = document.getElementById("ultima-att");
        this.statusEl = document.getElementById("status-gps");
        this.brandModelEl = document.getElementById("marca-modelo");
        this.eventsEl = document.getElementById("eventos");
        this.btnGeral = document.getElementById("btnGeral");
        this.panelIndividual = document.getElementById("info-individual");
        this.panelGeneral = document.getElementById("info-geral");
        this.listGeneral = document.getElementById("listaVeiculosGeral");
    }

    async init() {
        this.initMap();
        await this.loadVehiclesForCurrentUser();
        this.setupHandlers();
        this.renderInitialSelection();
        this.checkPaymentSuccess(); // Adicionado verificação de pagamento
        this.loop();
    }

    initMap() {
        const el = document.getElementById("mapaTempoReal");
        if (!el) return;
        this.map = new google.maps.Map(el, {
            center: { lat: -23.5, lng: -46.6 },
            zoom: 13
        });
        this.marker = new google.maps.Marker({
            position: { lat: -23.5, lng: -46.6 },
            map: this.map,
            title: "Localização atual"
        });
    }

    // Função de verificação de pagamento reintegrada
    checkPaymentSuccess() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("payment") === "success") {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path:newUrl}, '', newUrl);

            const alertDiv = document.createElement("div");
            alertDiv.className = "alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x m-3 shadow";
            alertDiv.style.zIndex = "9999";
            alertDiv.innerHTML = `
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>Pagamento realizado com sucesso!</strong>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            document.body.appendChild(alertDiv);
            
            setTimeout(() => {
                alertDiv.classList.remove("show");
                setTimeout(() => alertDiv.remove(), 150);
            }, 5000);
        }
    }

    async loadVehiclesForCurrentUser() {
        try {
            let email = null;
            try {
                const u = JSON.parse(localStorage.getItem("fw_current_user") || "{}");
                email = u.email || null;
            } catch (_) {}
            let userId = null;
            let adminId = null;
            if (email) {
                try {
                    const roleRes = await fetch(this._bust(`/usuarios/verificar-role?email=${encodeURIComponent(email)}`));
                    if (roleRes.ok) {
                        const roleData = await roleRes.json();
                        if (roleData.found) {
                            if (roleData.role === "cliente") {
                                userId = roleData.user_id;
                            } else if (roleData.role === "administrador" || roleData.role === "admin") {
                                adminId = roleData.user_id;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Erro ao verificar role do usuário:", e);
                }
            }
            let res;
            if (userId) {
                res = await fetch(this._bust(`/veiculos/cliente/${userId}`));
                if (res.status === 404) {
                    this.vehicles = [];
                } else {
                    this.vehicles = await res.json();
                }
            } else if (adminId) {
                res = await fetch(this._bust(`/veiculos/admin/${adminId}`));
                if (res.status === 404) {
                    this.vehicles = [];
                } else {
                    this.vehicles = await res.json();
                }
            } else {
                const all = await fetch(this._bust("/veiculos"));
                this.vehicles = await all.json();
            }
            this.updateSelect();
        } catch (_) {
            this.vehicles = [];
            this.updateSelect();
        }
    }

    updateSelect() {
        if (!this.selectEl) return;
        const options = this.vehicles.map(v => `<option value="${v.id}">${v.placa}</option>`).join("");
        this.selectEl.innerHTML = options;
    }

    setupHandlers() {
        if (this.selectEl) {
            this.selectEl.addEventListener("change", () => {
                const id = this.selectEl.value;
                this.currentVehicle = this.vehicles.find(v => String(v.id) === String(id)) || null;
                if (!this.generalMode) {
                    this.updateSingleView();
                }
            });
        }
        if (this.btnGeral) {
            this.btnGeral.addEventListener("click", () => {
                this.toggleMode(!this.generalMode);
            });
        }
    }

    renderInitialSelection() {
        if (!this.vehicles.length) {
            this.clearSidePanel();
            return;
        }
        const first = this.vehicles[0];
        if (this.selectEl) this.selectEl.value = String(first.id);
        this.currentVehicle = first;
        this.updateSingleView();
    }
    
    toggleMode(isGeneral) {
        this.generalMode = isGeneral;
        if (this.generalMode) {
            if (this.btnGeral) {
                this.btnGeral.textContent = "Visualizar por placa";
                this.btnGeral.classList.add("active");
            }
            if (this.panelIndividual) this.panelIndividual.style.display = "none";
            if (this.panelGeneral) this.panelGeneral.style.display = "block";
            this.renderGeneral();
            this.renderVehicleList();
        } else {
            if (this.btnGeral) {
                this.btnGeral.textContent = "Visualizar geral";
                this.btnGeral.classList.remove("active");
            }
            if (this.panelIndividual) this.panelIndividual.style.display = "block";
            if (this.panelGeneral) this.panelGeneral.style.display = "none";
            this.updateSingleView();
        }
    }

    renderVehicleList() {
        if (!this.listGeneral) return;
        if (!this.vehicles.length) {
            this.listGeneral.innerHTML = '<div class="p-3 text-muted text-center">Nenhum veículo encontrado.</div>';
            return;
        }

        const html = this.vehicles.map(v => {
            const statusColor = v.status_gps === "Online" ? "text-success" : "text-secondary";
            const statusText = v.status_gps === "Online" ? "Online" : "Offline";
            return `
                <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    onclick="ui.selectFromList('${v.id}')">
                    <span>
                        <strong>${v.placa}</strong>
                        <small class="d-block text-muted">${v.modelo || ""}</small>
                    </span>
                    <span class="badge bg-light ${statusColor}">${statusText}</span>
                </button>
            `;
        }).join("");
        this.listGeneral.innerHTML = html;
    }

    selectFromList(vehicleId) {
        if (this.selectEl) {
            this.selectEl.value = vehicleId;
            this.currentVehicle = this.vehicles.find(v => String(v.id) === String(vehicleId));
            this.toggleMode(false);
        }
    }

    clearSidePanel() {
        if (this.statusEl) this.statusEl.innerText = "-";
        if (this.lastUpdateEl) this.lastUpdateEl.innerText = "-";
        if (this.brandModelEl) this.brandModelEl.innerText = "-";
    }

    clearMarkers() {
        if (this.markers && this.markers.length) {
            this.markers.forEach(m => m.setMap(null));
        }
        this.markers = [];
    }

    async updateSingleView() {
        if (!this.currentVehicle) return;
        
        try {
            const sres = await fetch(this._bust(`/localizacao/status/${this.currentVehicle.placa}`));
            if (!sres.ok) throw new Error();
            const st = await sres.json();
            const lat = parseFloat(st.latitude);
            const lng = parseFloat(st.longitude);
            const pos = { lat, lng };
            this.marker.setPosition(pos);
            this.map.setCenter(pos);
            this.map.setZoom(15);
            if (this.lastUpdateEl) {
                const dt = new Date(st.timestamp);
                this.lastUpdateEl.textContent = dt.toLocaleString("pt-BR");
                this.lastUpdateEl.classList.remove("text-bg-secondary");
                this.lastUpdateEl.classList.add("text-bg-success");
            }
            if (this.statusEl) this.statusEl.innerText = this.currentVehicle.status_gps || "Online";
            if (this.brandModelEl) this.brandModelEl.innerText = `${this.currentVehicle.marca || ''} / ${this.currentVehicle.modelo || ''}`;
            
            this.updateEventsFor(this.currentVehicle.id);
        } catch (e) {
            console.error(e);
        }
    }

    async updateEventsFor(veiculoId) {
        try {
            const er = await fetch(this._bust("/eventos"));
            const all = await er.json();
            let list = Array.isArray(all) ? all.filter(e => String(e.veiculo_id) === String(veiculoId)) : [];
            
            // Limit to last 10 events
            list = list.slice(0, 10);

            if (!this.eventsEl) return;
            if (!list.length) {
                this.eventsEl.innerHTML = `<small>Nenhum evento detectado.</small>`;
                return;
            }
            const html = list.map(e => {
                const d = new Date(e.timestamp);
                return `<div class="list-group-item d-flex justify-content-between"><span>${e.tipo}</span><small>${d.toLocaleString("pt-BR")}</small></div>`;
            }).join("");
            this.eventsEl.innerHTML = html;
        } catch (_) {
            if (this.eventsEl) this.eventsEl.innerHTML = `<small>Nenhum evento detectado.</small>`;
        }
    }

    async renderGeneral() {
        try {
            this.clearMarkers();
            const url = this.userId ? `/localizacao/cliente/${this.userId}` : "/localizacao";
            const lr = await fetch(this._bust(url));
            const locs = await lr.json();
            const latestByVehicle = {};
            if (Array.isArray(locs)) {
                locs.forEach(l => {
                    const k = String(l.veiculo_id);
                    const t = new Date(l.timestamp).getTime();
                    if (!latestByVehicle[k] || t > latestByVehicle[k].t) {
                        latestByVehicle[k] = { l, t };
                    }
                });
            }
            const bounds = new google.maps.LatLngBounds();
            let count = 0;
            Object.values(latestByVehicle).forEach(item => {
                const lat = parseFloat(item.l.latitude);
                const lng = parseFloat(item.l.longitude);
                const p = { lat, lng };
                const m = new google.maps.Marker({
                    position: p,
                    map: this.map,
                    title: "Veículo " + item.l.veiculo_id
                });
                this.markers.push(m);
                bounds.extend(p);
                count++;
            });
            if (count > 0) {
                this.map.fitBounds(bounds);
            }
        } catch (e) {
            console.error(e);
        }
    }

    loop() {
        setInterval(() => {
            if (this.generalMode) {
                this.renderGeneral();
                this.renderVehicleList();
            } else {
                this.updateSingleView();
            }
        }, 5000);
    }
}

window.initMapa = function () {
    if (!ui) ui = new TempoRealUI();
    ui.init();
};
