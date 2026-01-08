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
        this.lastLocations = [];
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
        this.loop();
    }

    initMap() {
        this.map = new google.maps.Map(document.getElementById("mapaTempoReal"), {
            center: { lat: -23.5, lng: -46.6 },
            zoom: 13
        });
        this.marker = new google.maps.Marker({
            position: { lat: -23.5, lng: -46.6 },
            map: this.map,
            title: "Localização atual"
        });
    }

    setupHandlers() {
        if (this.selectEl) {
            this.selectEl.addEventListener("change", () => {
                const id = this.selectEl.value;
                this.currentVehicle = this.vehicles.find(v => String(v.id) === String(id)) || null;
                // Se mudar select enquanto estiver em geral, volta para individual?
                // Normalmente sim, o usuário quer ver aquele carro.
                if (this.generalMode) {
                    this.toggleMode(false);
                } else {
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

    toggleMode(isGeneral) {
        this.generalMode = isGeneral;
        
        if (this.generalMode) {
            this.btnGeral.textContent = "Visualizar por placa";
            this.btnGeral.classList.add("active");
            if (this.panelIndividual) this.panelIndividual.style.display = "none";
            if (this.panelGeneral) this.panelGeneral.style.display = "block";
            
            this.clearSidePanel(); // Opcional, limpa dados antigos
            this.renderGeneral();
            this.renderVehicleList(); // Renderiza a lista lateral
        } else {
            this.btnGeral.textContent = "Visualizar geral";
            this.btnGeral.classList.remove("active");
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
        // Ao clicar num item da lista geral, volta para o modo individual focando naquele carro
        if (this.selectEl) {
            this.selectEl.value = vehicleId;
            // Dispara evento change manualmente ou chama logica
            this.currentVehicle = this.vehicles.find(v => String(v.id) === String(vehicleId));
            this.toggleMode(false);
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

    clearMarkers() {
        if (this.markers && this.markers.length) {
            this.markers.forEach(m => m.setMap(null));
        }
        this.markers = [];
    }

    async updateSingleView() {
        if (!this.currentVehicle) {
            this.clearSidePanel();
            return;
        }
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
            if (this.statusEl) {
                this.statusEl.textContent = st.status_gps;
                this.statusEl.classList.remove("text-muted");
                this.statusEl.classList.add(st.status_gps === "Online" ? "text-success" : "text-secondary");
            }
            if (this.brandModelEl) {
                const txt = `${this.currentVehicle.marca || "-"} / ${this.currentVehicle.modelo || "-"}`;
                this.brandModelEl.textContent = txt;
            }
            await this.updateEventsFor(this.currentVehicle.id);
        } catch (_) {
            this.clearSidePanel();
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
            // Se for cliente logado, busca apenas localizações dele
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
            Object.values(latestByVehicle).forEach(({ l }) => {
                const v = this.vehicles.find(x => String(x.id) === String(l.veiculo_id));
                const pos = { lat: parseFloat(l.latitude), lng: parseFloat(l.longitude) };
                const m = new google.maps.Marker({
                    position: pos,
                    map: this.map,
                    title: v ? `${v.placa}` : `${l.placa}`
                });
                // Prioriza status do backend para consistência
                const status = l.status_gps ? l.status_gps : ((Date.now() - new Date(l.timestamp).getTime()) <= 9000 ? "Online" : "Offline");
                const dt = new Date(l.timestamp);
                const content = `<div style="color:black"><h6 style="margin-bottom:4px">${v ? v.placa : l.placa}</h6><div>${v ? (v.marca || "-") : (l.marca || "-")} / ${v ? (v.modelo || "-") : (l.modelo || "-")}</div><div>${status}</div><div>Atualizado ${this.relativeTime(dt)}</div></div>`;
                const iw = new google.maps.InfoWindow({ content });
                m.addListener("click", () => iw.open(this.map, m));
                this.markers.push(m);
                bounds.extend(pos);
            });
            if (this.markers.length) {
                this.map.fitBounds(bounds);
            }
        } catch (_) {}
    }

    relativeTime(date) {
        const diff = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diff < 60) return `há ${diff}s`;
        const m = Math.floor(diff / 60);
        if (m < 60) return `há ${m}min`;
        const h = Math.floor(m / 60);
        return `há ${h}h`;
    }

    clearSidePanel() {
        if (this.lastUpdateEl) this.lastUpdateEl.textContent = "carregando...";
        if (this.statusEl) this.statusEl.textContent = "carregando...";
        if (this.brandModelEl) this.brandModelEl.textContent = "carregando...";
        if (this.eventsEl) this.eventsEl.innerHTML = `<small>Nenhum evento detectado.</small>`;
    }

    loop() {
        setInterval(async () => {
            if (this.generalMode) {
                await this.renderGeneral();
            } else {
                await this.updateSingleView();
            }
        }, 5000);
    }
}

window.initMapa = function () {
    if (!ui) ui = new TempoRealUI();
    ui.init();
};
