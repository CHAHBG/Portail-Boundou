/* ================================================================
   PROCASEF Boundou – Main Application v2
   Top-Tab SPA · Leaflet · Chart.js · SheetJS
   ================================================================ */
(() => {
    'use strict';

    /* ── Communes Configuration ── */
    /* Commune names must match CCRCA field in GeoJSON (uppercase)
       and 'commune' field in parcelles.json (mixed case).
       We store a normalized lookup map for case-insensitive matching. */
    const COMMUNES_CONFIG = {
        "Bala": { center: [13.35, -12.30], zoom: 12, color: "#2D6A4F" },
        "Ballou": { center: [13.42, -12.08], zoom: 12, color: "#40916C" },
        "Bandafassi": { center: [12.45, -12.52], zoom: 12, color: "#52B788" },
        "Bembou": { center: [12.55, -12.20], zoom: 12, color: "#74C69D" },
        "Dimboli": { center: [12.60, -12.05], zoom: 12, color: "#95D5B2" },
        "Dindefello": { center: [12.37, -12.30], zoom: 12, color: "#38A3A5" },
        "Fongolembi": { center: [12.52, -12.13], zoom: 12, color: "#57CC99" },
        "Gabou": { center: [13.38, -12.18], zoom: 12, color: "#22577A" },
        "Koar": { center: [13.50, -12.35], zoom: 12, color: "#80ED99" },
        "Medina Baffe": { center: [13.68, -12.40], zoom: 12, color: "#0A9396" },
        "Missirah": { center: [13.60, -12.25], zoom: 12, color: "#E9D8A6" },
        "Moudery": { center: [13.85, -12.25], zoom: 12, color: "#94D2BD" },
        "Ndoga Babacar": { center: [13.98, -12.10], zoom: 12, color: "#FFB703" },
        "Netteboulou": { center: [14.08, -12.18], zoom: 12, color: "#8338EC" },
        "Sabodala": { center: [12.80, -12.30], zoom: 12, color: "#3A86FF" },
        "Sinthiou Maleme": { center: [14.18, -12.00], zoom: 12, color: "#FB5607" },
        "Tomboronkoto": { center: [12.65, -12.50], zoom: 12, color: "#FF006E" }
    };

    /* Case-insensitive lookup helper: "BALA" → "Bala", "sinthiou maleme" → "Sinthiou Maleme" */
    const _communeLookup = {};
    Object.keys(COMMUNES_CONFIG).forEach(k => { _communeLookup[k.toUpperCase()] = k; });
    function resolveCommune(raw) {
        if (!raw) return null;
        const up = String(raw).toUpperCase().trim();
        return _communeLookup[up] || null;
    }

    /* ── Global State ── */
    const AppState = {
        activeSection: 'map',
        theme: localStorage.getItem('boundou_theme') || 'light',
        map: null,
        geoLayer: null,
        parcelsData: null,
        communeFilter: '',
        usageFilter: '',
        charts: {},
        dashLoaded: {},
        // Deliberation wizard state
        individualWizardStep: 1,
        collectiveWizardStep: 1,
        individualFile: null,
        collectiveFile: null,
        selectedIndividualConfig: null,
        selectedCollectiveConfig: null
    };

    // Initialize global dashboard object used by supporting modules
    window.BoundouDashboard = window.BoundouDashboard || {
        processedIndividualData: null,
        processedCollectiveData: null,
        originalIndividualData: null,
        originalCollectiveData: null,
        selectedColumns: {},
        advancedOptionsIndividual: { ageThreshold: 18 },
        advancedOptionsCollective: {},
        collectiveParcelErrors: []
    };

    /* ================================================================
       UI CONTROLLER
       ================================================================ */
    const UI = {
        /* ── Skeleton ── */
        hideSkeleton() {
            const sk = document.getElementById('skeleton-screen');
            if (sk) { sk.classList.add('hidden'); setTimeout(() => sk.remove(), 800); }
        },

        /* ── Theme ── */
        initTheme() {
            document.documentElement.setAttribute('data-theme', AppState.theme);
            this._updateThemeIcon();
        },
        toggleTheme() {
            AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', AppState.theme);
            localStorage.setItem('boundou_theme', AppState.theme);
            this._updateThemeIcon();
        },
        _updateThemeIcon() {
            const moon = document.getElementById('theme-icon-moon');
            const sun = document.getElementById('theme-icon-sun');
            if (moon && sun) {
                moon.style.display = AppState.theme === 'dark' ? 'none' : 'block';
                sun.style.display = AppState.theme === 'dark' ? 'block' : 'none';
            }
        },

        /* ── Tab Navigation ── */
        switchSection(sectionId) {
            if (sectionId === AppState.activeSection) return;
            AppState.activeSection = sectionId;

            // Update tab buttons
            document.querySelectorAll('.tab-item').forEach(btn => {
                const isActive = btn.dataset.section === sectionId;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive);
            });

            // Show/hide sections
            document.querySelectorAll('.section').forEach(s => {
                s.classList.toggle('active', s.id === `section-${sectionId}`);
            });

            // Lazy-load actions per section
            if (sectionId === 'map' && AppState.map) {
                setTimeout(() => AppState.map.invalidateSize(), 200);
            }
            if (sectionId === 'stats') STATS.render();
            if (sectionId === 'dashboards') this._loadDashboard();
            if (sectionId === 'suivi') this._loadSuivi();
            if (sectionId === 'sif') this._loadSIF();
        },

        /* ── Search ── */
        initSearch() {
            const input = document.getElementById('search-input');
            const results = document.getElementById('search-results');
            if (!input || !results) return;

            const debouncedSearch = this._debounce((query) => {
                if (!query || query.length < 2) { results.classList.remove('show'); return; }
                const matches = this._searchParcels(query);
                if (matches.length === 0) {
                    results.innerHTML = '<div class="search-no-results">Aucun résultat</div>';
                } else {
                    results.innerHTML = matches.slice(0, 10).map(m =>
                        `<div class="search-result-item" data-commune="${m.commune}" data-nicad="${m.nicad}">
                            <div class="search-result-title">${m.nicad || m.numParcel}</div>
                            <div class="search-result-details">${m.commune} · ${m.village || ''}</div>
                        </div>`
                    ).join('');
                }
                results.classList.add('show');
            }, 250);

            input.addEventListener('input', () => debouncedSearch(input.value.trim()));

            results.addEventListener('click', e => {
                const item = e.target.closest('.search-result-item');
                if (!item) return;
                const commune = item.dataset.commune;
                if (commune) {
                    const filter = document.getElementById('commune-filter');
                    if (filter) { filter.value = commune; MAP.filterByCommune(commune); }
                    this.switchSection('map');
                }
                results.classList.remove('show');
                input.value = '';
            });

            // Close on outside click
            document.addEventListener('click', e => {
                if (!e.target.closest('#search-box')) results.classList.remove('show');
            });
        },
        _searchParcels(query) {
            if (!AppState.parcelsData) return [];
            const q = query.toLowerCase();
            return AppState.parcelsData.filter(p =>
                (p.nicad && p.nicad.toLowerCase().includes(q)) ||
                (p.Num_parcel && p.Num_parcel.toLowerCase().includes(q)) ||
                (p.Village && p.Village.toLowerCase().includes(q)) ||
                (p.Nom && p.Nom.toLowerCase().includes(q)) ||
                (p.Prenom && p.Prenom.toLowerCase().includes(q))
            ).slice(0, 30).map(p => ({
                commune: p.commune || p.Commune || '',
                village: p.Village || '',
                nicad: p.nicad || '',
                numParcel: p.Num_parcel || ''
            }));
        },

        /* ── Mobile Search ── */
        initMobileSearch() {
            const btn = document.getElementById('mobile-search-btn');
            const overlay = document.getElementById('mobile-search-overlay');
            const input = document.getElementById('mobile-search-input');
            const results = document.getElementById('mobile-search-results');
            const closeBtn = document.getElementById('mobile-search-close');
            if (!btn || !overlay) return;

            btn.addEventListener('click', () => {
                overlay.style.display = 'flex';
                setTimeout(() => input?.focus(), 100);
            });

            closeBtn?.addEventListener('click', () => {
                overlay.style.display = 'none';
                if (input) input.value = '';
                if (results) results.innerHTML = '';
            });

            const debouncedSearch = this._debounce((query) => {
                if (!results) return;
                if (!query || query.length < 2) { results.innerHTML = ''; return; }
                const matches = this._searchParcels(query);
                if (matches.length === 0) {
                    results.innerHTML = '<div class="search-no-results">Aucun résultat pour « ' + query + ' »</div>';
                } else {
                    results.innerHTML = matches.slice(0, 20).map(m =>
                        `<div class="search-result-item" data-commune="${m.commune}" data-nicad="${m.nicad}">
                            <div class="search-result-title">${m.nicad || m.numParcel}</div>
                            <div class="search-result-details">${m.commune} · ${m.village || ''}</div>
                        </div>`
                    ).join('');
                }
            }, 250);

            input?.addEventListener('input', () => debouncedSearch(input.value.trim()));

            results?.addEventListener('click', e => {
                const item = e.target.closest('.search-result-item');
                if (!item) return;
                const commune = item.dataset.commune;
                if (commune) {
                    const filter = document.getElementById('commune-filter');
                    if (filter) { filter.value = commune; MAP.filterByCommune(commune); }
                    this.switchSection('map');
                }
                overlay.style.display = 'none';
                if (input) input.value = '';
                if (results) results.innerHTML = '';
            });

            // Close on escape
            overlay.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    overlay.style.display = 'none';
                    if (input) input.value = '';
                }
            });
        },

        /* ── Date Label ── */
        setDateLabel() {
            const el = document.getElementById('last-updated-label');
            if (el) {
                const d = new Date();
                el.textContent = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },

        /* ── Dashboard & Suivi ── */
        _loadDashboard() {
            const frame = document.getElementById('dashboard-frame');
            const loader = document.getElementById('dashboard-loading');
            if (!frame) return;

            const url = 'https://boundoudash.netlify.app/';
            if (!frame.src || frame.src === '' || frame.src === 'about:blank' || !frame.src.includes('boundoudash')) {
                if (loader) loader.style.display = 'flex';
                frame.src = url;
                frame.onload = () => { if (loader) loader.style.display = 'none'; };
                frame.onerror = () => { if (loader) loader.innerHTML = '<span>Impossible de charger le dashboard</span>'; };
            }
        },
        _loadSuivi() {
            const frame = document.getElementById('suivi-frame');
            const loader = document.getElementById('suivi-loading');
            if (!frame) return;

            const url = 'https://suivioperation.netlify.app/';
            if (!frame.src || frame.src === '' || frame.src === 'about:blank' || !frame.src.includes('suivioperation')) {
                if (loader) loader.style.display = 'flex';
                frame.src = url;

                let loaded = false;
                frame.onload = () => {
                    loaded = true;
                    if (loader) loader.style.display = 'none';
                    frame.style.display = 'block';
                };
                frame.onerror = () => { loaded = true; this._showSuiviFallback(frame, loader, url); };

                // CSP blocks don't fire onerror — use timeout fallback
                setTimeout(() => {
                    if (!loaded) this._showSuiviFallback(frame, loader, url);
                }, 3000);
            }
        },
        _showSuiviFallback(frame, loader, url) {
            if (loader) loader.style.display = 'none';
            const container = frame.parentElement;
            if (container && !container.querySelector('.suivi-fallback')) {
                const fallback = document.createElement('div');
                fallback.className = 'sif-fallback suivi-fallback';
                fallback.style.display = 'flex';
                fallback.innerHTML = `<span style="font-size:2rem;margin-bottom:0.5rem"><i class="bi bi-link-45deg"></i></span>
                    <h3>Ce site bloque l'intégration</h3>
                    <p style="color:var(--text-muted);margin-bottom:1rem;font-size:0.88rem">Le serveur bloque l'affichage en iframe (politique CSP)</p>
                    <a href="${url}" target="_blank" class="btn btn-primary btn-lg">Ouvrir Suivi Opération ↗</a>`;
                container.appendChild(fallback);
            }
        },
        _loadSIF() {
            const frame = document.getElementById('sif-frame');
            const fallback = document.getElementById('sif-fallback');
            const loader = document.getElementById('sif-loading');
            if (!frame) return;
            const url = 'https://sifboundou.netlify.app/';
            if (!frame.getAttribute('src') || frame.getAttribute('src') === '' || frame.src === 'about:blank' || !frame.src.includes('sifboundou')) {
                if (loader) loader.style.display = 'flex';
                frame.src = url;
                let loaded = false;
                frame.onload = () => {
                    loaded = true;
                    if (loader) loader.style.display = 'none';
                    if (fallback) fallback.style.display = 'none';
                };
                frame.onerror = () => {
                    loaded = true;
                    if (loader) loader.style.display = 'none';
                    if (fallback) { fallback.style.display = 'flex'; frame.style.display = 'none'; }
                };
                // CSP blocks don't fire onerror — use timeout fallback
                setTimeout(() => {
                    if (!loaded) {
                        if (loader) loader.style.display = 'none';
                        if (fallback) { fallback.style.display = 'flex'; frame.style.display = 'none'; }
                    }
                }, 6000);
            }
        },

        /* ── Export Button ── */
        initExportButton() {
            const btn = document.getElementById('export-data');
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (AppState.activeSection === 'map' && AppState.parcelsData) {
                    this._exportParcelData();
                } else {
                    this._toast('Naviguez vers la carte pour exporter', 'info');
                }
            });
        },
        _exportParcelData() {
            if (!AppState.parcelsData || !window.XLSX) return;
            try {
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(AppState.parcelsData);
                XLSX.utils.book_append_sheet(wb, ws, 'Parcelles');
                XLSX.writeFile(wb, 'parcelles_boundou.xlsx');
                this._toast('Export réussi !', 'success');
            } catch (e) {
                this._toast('Erreur lors de l\'export', 'error');
                console.error(e);
            }
        },

        /* ── Toast ── */
        _toast(msg, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const icons = { success: '<i class="bi bi-check-circle-fill"></i>', error: '<i class="bi bi-x-circle-fill"></i>', warning: '<i class="bi bi-exclamation-triangle-fill"></i>', info: '<i class="bi bi-info-circle-fill"></i>' };
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${msg}</span>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
            container.appendChild(toast);
            setTimeout(() => { if (toast.parentElement) { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); } }, 4500);
        },

        /* ── Debounce ── */
        _debounce(fn, ms) {
            let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
        }
    };

    /* ================================================================
       MAP ENGINE
       ================================================================ */
    const MAP = {
        _highlightLayer: null,     // currently highlighted GeoJSON layer
        _statsDelayTimer: null,    // 2-second delay timer for stats reveal

        init() {
            if (typeof L === 'undefined') { console.warn('Leaflet not loaded yet'); return; }
            const mapEl = document.getElementById('map');
            if (!mapEl || AppState.map) return;

            AppState.map = L.map('map', {
                center: [13.0, -12.25],
                zoom: 9,
                zoomControl: true,
                attributionControl: false
            });

            // Tile layers
            const osmLight = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 });
            const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });
            osmLight.addTo(AppState.map);

            L.control.layers({ 'OSM': osmLight, 'Satellite': satellite }, null, { position: 'topright' }).addTo(AppState.map);
            L.control.attribution({ prefix: '© PROCASEF Boundou' }).addTo(AppState.map);

            this._loadGeoJSON();
            this._loadParcels();
        },

        async _loadGeoJSON() {
            try {
                const resp = await fetch('data/communes_boundou.geojson');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();

                AppState.geoLayer = L.geoJSON(data, {
                    style: feature => {
                        const raw = feature.properties.CCRCA || feature.properties.CCRCA_1 || feature.properties.nom || '';
                        const resolved = resolveCommune(raw);
                        const cfg = resolved ? COMMUNES_CONFIG[resolved] : null;
                        return {
                            fillColor: cfg ? cfg.color : '#999',
                            weight: 2,
                            opacity: 0.8,
                            color: '#fff',
                            fillOpacity: 0.45
                        };
                    },
                    onEachFeature: (feature, layer) => {
                        const raw = feature.properties.CCRCA || feature.properties.CCRCA_1 || feature.properties.nom || 'Inconnu';
                        const resolved = resolveCommune(raw) || raw;
                        layer.bindTooltip(resolved, { sticky: true, className: 'commune-tooltip' });
                        layer.on('click', () => this._onCommuneClick(resolved, feature));
                    }
                }).addTo(AppState.map);

                // Fit bounds
                AppState.map.fitBounds(AppState.geoLayer.getBounds(), { padding: [20, 20] });

                // Populate commune filter
                this._populateCommuneFilter(data);
                this._buildLegend(data);

                console.log('[OK] GeoJSON loaded:', data.features.length, 'features');
            } catch (e) {
                console.warn('[WARN] GeoJSON load failed:', e);
            }
        },

        async _loadParcels() {
            try {
                const resp = await fetch('data/parcelles.json');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                AppState.parcelsData = await resp.json();
                console.log('[OK] Parcelles loaded:', AppState.parcelsData.length);
                this._populateUsageFilter();
            } catch (e) {
                console.warn('[WARN] Parcelles load failed:', e);
            }
        },

        _populateUsageFilter() {
            const sel = document.getElementById('usage-filter');
            if (!sel || !AppState.parcelsData) return;

            // Extract unique usage types
            const usages = new Set();
            AppState.parcelsData.forEach(p => {
                const u = p.type_usag || p.Vocation || '';
                if (u && u.trim()) usages.add(u.trim());
            });

            // Sort and add as options
            const sorted = [...usages].sort((a, b) => a.localeCompare(b, 'fr'));
            sorted.forEach(u => {
                const o = document.createElement('option');
                o.value = u;
                // Format label: replace underscores with spaces and capitalize
                o.textContent = u.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                sel.appendChild(o);
            });
            console.log('[OK] Usage filter populated:', sorted.length, 'types');
        },

        _populateCommuneFilter(geojson) {
            const sel = document.getElementById('commune-filter');
            if (!sel) return;
            const names = geojson.features
                .map(f => {
                    const raw = f.properties.CCRCA || f.properties.CCRCA_1 || f.properties.nom || '';
                    return resolveCommune(raw) || raw;
                })
                .filter(Boolean).sort();
            names.forEach(n => {
                const o = document.createElement('option'); o.value = n; o.textContent = n;
                sel.appendChild(o);
            });
        },

        _buildLegend(geojson) {
            const legend = document.getElementById('map-legend');
            if (!legend) return;
            let html = '<h4>Communes</h4>';
            const names = geojson.features.map(f => {
                const raw = f.properties.CCRCA || f.properties.CCRCA_1 || f.properties.nom || '';
                return resolveCommune(raw) || raw;
            }).filter(Boolean).sort();
            names.forEach(n => {
                const c = COMMUNES_CONFIG[n]?.color || '#999';
                html += `<div class="legend-item"><span class="legend-color" style="background:${c}"></span><span>${n}</span></div>`;
            });
            legend.innerHTML = html;
        },

        /* ── Highlight a commune contour on the map & zoom to its real bounds ── */
        _highlightCommune(name, opts = {}) {
            if (!AppState.geoLayer) return;
            const cfg = COMMUNES_CONFIG[name];
            const highlightColor = cfg ? cfg.color : '#52B788';
            const flyDuration = opts.duration ?? 1;

            let matchedLayer = null;

            // Reset every layer, then highlight the match
            AppState.geoLayer.eachLayer(layer => {
                const raw = layer.feature?.properties?.CCRCA || layer.feature?.properties?.CCRCA_1 || '';
                const resolved = resolveCommune(raw) || raw;

                if (resolved === name) {
                    layer.setStyle({
                        weight: 4,
                        color: highlightColor,
                        opacity: 1,
                        fillOpacity: 0.55,
                        dashArray: ''
                    });
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        layer.bringToFront();
                    }
                    this._highlightLayer = layer;
                    matchedLayer = layer;
                } else {
                    layer.setStyle({
                        weight: 2,
                        color: '#fff',
                        opacity: 0.8,
                        fillOpacity: 0.15
                    });
                }
            });

            // Fly to the ACTUAL geometry bounds (not hardcoded coords)
            if (matchedLayer) {
                AppState.map.flyToBounds(matchedLayer.getBounds(), {
                    padding: [40, 40],
                    duration: flyDuration,
                    maxZoom: 13
                });
            }
        },

        /* ── Reset highlight to default ── */
        _resetHighlight() {
            if (!AppState.geoLayer) return;
            AppState.geoLayer.eachLayer(layer => {
                const raw = layer.feature?.properties?.CCRCA || layer.feature?.properties?.CCRCA_1 || '';
                const resolved = resolveCommune(raw);
                const cfg = resolved ? COMMUNES_CONFIG[resolved] : null;
                layer.setStyle({
                    fillColor: cfg ? cfg.color : '#999',
                    weight: 2,
                    color: '#fff',
                    opacity: 0.8,
                    fillOpacity: 0.45
                });
            });
            this._highlightLayer = null;
        },

        /* ── Commune click: highlight contour, then 2 s delay → stats bubble ── */
        _onCommuneClick(name, feature) {
            // Cancel any pending stats reveal
            clearTimeout(this._statsDelayTimer);

            // 1. Close any existing stats popup
            if (this._statsPopup) {
                AppState.map.closePopup(this._statsPopup);
                this._statsPopup = null;
            }

            // 2. Highlight contour + fly to actual geometry bounds
            this._highlightCommune(name, { duration: 1 });

            // 3. After 2 s reveal the stats bubble at top of commune
            this._statsDelayTimer = setTimeout(() => {
                this._showCommuneStats(name);
            }, 2000);
        },

        /* ── Build & open stats as Leaflet info-bulle at top of commune ── */
        _showCommuneStats(name) {
            if (!this._highlightLayer) return;

            // Calculate stats
            const nameUp = name.toUpperCase();
            const parcels = AppState.parcelsData
                ? AppState.parcelsData.filter(p => {
                    const c = (p.commune || p.Commune || '').toUpperCase().trim();
                    return c === nameUp;
                })
                : [];

            const total = parcels.length;
            const superficie = parcels.reduce((s, p) => s + (parseFloat(p.superficie) || 0), 0);
            const nicad = parcels.filter(p => p.nicad && p.nicad.trim() !== '').length;
            const deliberees = parcels.filter(p => p.deliberee === true || p.deliberee === 'Oui').length;
            const pctNicad = total ? Math.round((nicad / total) * 100) + '%' : '0%';
            const pctDelib = total ? Math.round((deliberees / total) * 100) + '%' : '0%';

            // Build HTML
            const html = `
                <div class="stats-bubble">
                    <div class="stats-bubble-header">
                        <h3>${name}</h3>
                        <button class="stats-bubble-close" onclick="MAP._closeStatsPopup()">&times;</button>
                    </div>
                    <div class="kpi-grid">
                        <div class="kpi-item highlight"><span class="val">${total.toLocaleString('fr-FR')}</span><span class="lbl">Parcelles</span></div>
                        <div class="kpi-item"><span class="val">${Math.round(superficie).toLocaleString('fr-FR')}</span><span class="lbl">M² Total</span></div>
                        <div class="kpi-item"><span class="val">${pctNicad}</span><span class="lbl">NICAD</span></div>
                        <div class="kpi-item"><span class="val">${pctDelib}</span><span class="lbl">Délibérées</span></div>
                    </div>
                    <div class="charts-row">
                        <div class="chart-cell"><canvas id="usage-chart"></canvas></div>
                        <div class="chart-cell"><canvas id="status-chart"></canvas></div>
                    </div>
                </div>
            `;

            // Position at the top-center of the commune bounds
            const bounds = this._highlightLayer.getBounds();
            const topCenter = L.latLng(bounds.getNorth(), bounds.getCenter().lng);

            // Close existing popup
            if (this._statsPopup) {
                AppState.map.closePopup(this._statsPopup);
            }

            this._statsPopup = L.popup({
                className: 'commune-stats-popup',
                maxWidth: 620,
                minWidth: 520,
                closeButton: false,
                autoClose: false,
                closeOnClick: false,
                offset: [0, -5]
            })
                .setLatLng(topCenter)
                .setContent(html)
                .openOn(AppState.map);

            // Render charts after popup is in the DOM
            requestAnimationFrame(() => {
                this._renderCommuneCharts(parcels);
            });
        },

        /* ── Close the stats popup and reset map ── */
        _closeStatsPopup() {
            clearTimeout(this._statsDelayTimer);
            if (this._statsPopup) {
                AppState.map.closePopup(this._statsPopup);
                this._statsPopup = null;
            }
            this._resetHighlight();
            // Destroy existing charts
            Object.keys(AppState.charts).forEach(k => {
                if (AppState.charts[k]) { AppState.charts[k].destroy(); delete AppState.charts[k]; }
            });
            // Reset commune filter dropdown
            const cf = document.getElementById('commune-filter');
            if (cf) cf.value = '';
        },

        _renderCommuneCharts(parcels) {
            // Usage chart
            this._renderChart('usage-chart', 'doughnut', () => {
                const usage = {};
                parcels.forEach(p => { const u = p.type_usag || p.Vocation || 'Autre'; usage[u] = (usage[u] || 0) + 1; });
                return { labels: Object.keys(usage), data: Object.values(usage) };
            });

            // Status chart
            this._renderChart('status-chart', 'doughnut', () => {
                const status = { 'Délibéré': 0, 'Non délibéré': 0 };
                parcels.forEach(p => {
                    if (p.deliberee === true || p.deliberee === 'Oui') status['Délibéré']++;
                    else status['Non délibéré']++;
                });
                return { labels: Object.keys(status), data: Object.values(status) };
            });
        },

        _renderChart(canvasId, type, dataFn) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            if (AppState.charts[canvasId]) AppState.charts[canvasId].destroy();

            const { labels, data } = dataFn();
            const colors = ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7',
                '#D8F3DC', '#FFB703', '#FB5607', '#FF006E', '#8338EC', '#3A86FF'];

            AppState.charts[canvasId] = new Chart(canvas.getContext('2d'), {
                type,
                data: {
                    labels,
                    datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: 'Public Sans', size: 9 }, padding: 6, boxWidth: 10 } }
                    }
                }
            });
        },

        filterByCommune(commune) {
            AppState.communeFilter = commune;
            if (!AppState.geoLayer) return;

            // Cancel pending stats reveal
            clearTimeout(this._statsDelayTimer);

            if (!commune) {
                this._closeStatsPopup();
                AppState.map.fitBounds(AppState.geoLayer.getBounds(), { padding: [20, 20] });
                return;
            }

            // 1. Close existing popup
            if (this._statsPopup) {
                AppState.map.closePopup(this._statsPopup);
                this._statsPopup = null;
            }

            // 2. Highlight contour + fly to actual geometry bounds
            this._highlightCommune(commune, { duration: 1.2 });

            // 3. Reveal stats after 2 s delay
            this._statsDelayTimer = setTimeout(() => {
                this._showCommuneStats(commune);
            }, 2000);
        },

        filterByUsage(usage) {
            AppState.usageFilter = usage;
            if (!AppState.geoLayer || !AppState.parcelsData) return;

            if (!usage) {
                // Reset: show all communes equally
                AppState.geoLayer.eachLayer(layer => {
                    const raw = layer.feature?.properties?.CCRCA || layer.feature?.properties?.CCRCA_1 || '';
                    const resolved = resolveCommune(raw);
                    const cfg = resolved ? COMMUNES_CONFIG[resolved] : null;
                    layer.setStyle({ fillColor: cfg ? cfg.color : '#999', fillOpacity: 0.45 });
                });
                return;
            }

            // Find which communes have parcels with this usage
            const communeUsageCounts = {};
            let maxCount = 0;
            AppState.parcelsData.forEach(p => {
                const u = p.type_usag || p.Vocation || '';
                if (u !== usage) return;
                const raw = p.commune || p.Commune || '';
                const c = resolveCommune(raw) || raw;
                communeUsageCounts[c] = (communeUsageCounts[c] || 0) + 1;
                if (communeUsageCounts[c] > maxCount) maxCount = communeUsageCounts[c];
            });

            // Highlight communes proportionally
            AppState.geoLayer.eachLayer(layer => {
                const raw = layer.feature?.properties?.CCRCA || layer.feature?.properties?.CCRCA_1 || '';
                const resolved = resolveCommune(raw) || raw;
                const count = communeUsageCounts[resolved] || 0;
                const cfg = COMMUNES_CONFIG[resolved];
                layer.setStyle({
                    fillColor: cfg ? cfg.color : '#999',
                    fillOpacity: count > 0 ? 0.3 + (count / maxCount) * 0.5 : 0.08
                });
            });

            // Show toast with count
            const total = Object.values(communeUsageCounts).reduce((s, c) => s + c, 0);
            const label = usage.replace(/_/g, ' ');
            UI._toast(`${label}: ${total.toLocaleString('fr-FR')} parcelles dans ${Object.keys(communeUsageCounts).length} communes`, 'info');
        }
    };

    /* ================================================================
       STATS ENGINE
       ================================================================ */
    const STATS = {
        rendered: false,

        render() {
            if (this.rendered || typeof Chart === 'undefined') return;
            this.rendered = true;

            // Global KPIs
            const communes = Object.keys(COMMUNES_CONFIG).length;
            const parcels = AppState.parcelsData ? AppState.parcelsData.length : 0;
            const hectares = AppState.parcelsData
                ? Math.round(AppState.parcelsData.reduce((s, p) => s + (parseFloat(p.superficie) || 0), 0) / 10000)
                : 0;

            const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val.toLocaleString('fr-FR'); };
            setKpi('total-communes', communes);
            setKpi('total-parcelles-global', parcels);
            setKpi('superficie-globale', hectares);

            // Communes bar chart
            this._renderCommunesChart();
            this._renderGlobalUsageChart();
        },

        _renderCommunesChart() {
            if (!AppState.parcelsData) return;
            const canvas = document.getElementById('communes-chart');
            if (!canvas) return;

            const counts = {};
            AppState.parcelsData.forEach(p => {
                const raw = p.commune || p.Commune || 'Autre';
                const c = resolveCommune(raw) || raw;
                counts[c] = (counts[c] || 0) + 1;
            });

            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const labels = sorted.map(e => e[0]);
            const data = sorted.map(e => e[1]);
            const colors = labels.map(l => COMMUNES_CONFIG[l]?.color || '#999');

            if (AppState.charts['communes-chart']) AppState.charts['communes-chart'].destroy();
            AppState.charts['communes-chart'] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: { labels, datasets: [{ label: 'Parcelles', data, backgroundColor: colors, borderRadius: 6 }] },
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { family: 'Public Sans', size: 11 } } },
                        y: { grid: { display: false }, ticks: { font: { family: 'Public Sans', size: 11 } } }
                    }
                }
            });
        },

        _renderGlobalUsageChart() {
            if (!AppState.parcelsData) return;
            const canvas = document.getElementById('global-usage-chart');
            if (!canvas) return;

            const usage = {};
            AppState.parcelsData.forEach(p => {
                const u = p.type_usag || p.Vocation || 'Autre';
                usage[u] = (usage[u] || 0) + 1;
            });

            const labels = Object.keys(usage);
            const data = Object.values(usage);
            const colors = ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#FFB703', '#FB5607', '#FF006E', '#8338EC'];

            if (AppState.charts['global-usage-chart']) AppState.charts['global-usage-chart'].destroy();
            AppState.charts['global-usage-chart'] = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: 'var(--bg-surface)' }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: 'Public Sans', size: 11 }, padding: 14, usePointStyle: true } }
                    }
                }
            });
        }
    };

    /* ================================================================
       DELIBERATION WIZARD CONTROLLER
       ================================================================ */
    const DELIB = {
        init() {
            this._initToggle();
            this._initWizard('individual', 4);
            this._initWizard('collective', 3);
            this._initDropZones();
            this._initModeCards();
            this._initGenerateButtons();
        },

        /* Toggle between individual / collective */
        _initToggle() {
            document.querySelectorAll('.delib-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.delib-toggle-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const mode = btn.dataset.delib;
                    document.getElementById('wizard-individual').classList.toggle('active', mode === 'individual');
                    document.getElementById('wizard-collective').classList.toggle('active', mode === 'collective');
                });
            });
        },

        /* Wizard navigation */
        _initWizard(type, totalSteps) {
            const container = document.getElementById(`wizard-${type}`);
            if (!container) return;

            const prevBtn = document.getElementById(`wizard-prev-${type}`);
            const nextBtn = document.getElementById(`wizard-next-${type}`);
            const resetBtn = document.getElementById(`wizard-reset-${type}`);

            const updateWizard = () => {
                const step = type === 'individual' ? AppState.individualWizardStep : AppState.collectiveWizardStep;

                // Update step indicators
                container.querySelectorAll('.wizard-step-indicator').forEach(ind => {
                    const s = parseInt(ind.dataset.step);
                    ind.classList.toggle('active', s === step);
                    ind.classList.toggle('completed', s < step);
                });
                container.querySelectorAll('.wizard-step-line').forEach((line, i) => {
                    line.classList.toggle('active', i + 1 < step);
                });

                // Show/hide panes
                container.querySelectorAll('.wizard-pane').forEach(pane => {
                    pane.classList.toggle('active', parseInt(pane.dataset.wizardStep) === step);
                });

                // Button visibility
                if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
                if (nextBtn) {
                    const canAdvance = this._canAdvanceWizard(type, step);
                    nextBtn.style.display = step < totalSteps ? 'inline-flex' : 'none';
                    nextBtn.disabled = !canAdvance;
                }
            };

            if (prevBtn) prevBtn.addEventListener('click', () => {
                if (type === 'individual') AppState.individualWizardStep = Math.max(1, AppState.individualWizardStep - 1);
                else AppState.collectiveWizardStep = Math.max(1, AppState.collectiveWizardStep - 1);
                updateWizard();
            });

            if (nextBtn) nextBtn.addEventListener('click', () => {
                if (type === 'individual') {
                    if (AppState.individualWizardStep < totalSteps) {
                        AppState.individualWizardStep++;
                        if (AppState.individualWizardStep === 3) this._renderPreview('individual');
                        if (AppState.individualWizardStep === 4) this._enableGenerate('individual');
                    }
                } else {
                    if (AppState.collectiveWizardStep < totalSteps) {
                        AppState.collectiveWizardStep++;
                        if (AppState.collectiveWizardStep === 2) this._renderPreview('collective');
                        if (AppState.collectiveWizardStep === 3) this._enableGenerate('collective');
                    }
                }
                updateWizard();
            });

            if (resetBtn) resetBtn.addEventListener('click', () => {
                this._resetWizard(type);
                updateWizard();
            });

            // Initial state
            updateWizard();
        },

        _canAdvanceWizard(type, step) {
            if (type === 'individual') {
                if (step === 1) return !!AppState.individualFile;
                if (step === 2) return !!AppState.selectedIndividualConfig;
                return true;
            } else {
                if (step === 1) return !!AppState.collectiveFile;
                if (step === 2) return !!AppState.selectedCollectiveConfig;
                return true;
            }
        },

        _resetWizard(type) {
            if (type === 'individual') {
                AppState.individualWizardStep = 1;
                AppState.individualFile = null;
                AppState.selectedIndividualConfig = null;
                window.BoundouDashboard.processedIndividualData = null;
                if (window.BoundouDashboard.advancedOptions) {
                    window.BoundouDashboard.advancedOptions.enableDualLists = false;
                    window.BoundouDashboard.advancedOptions.enableMandataireSeparation = false;
                }
                const fileInfo = document.getElementById('fileInfoIndividual');
                if (fileInfo) fileInfo.style.display = 'none';
                const fileInput = document.getElementById('individual-file');
                if (fileInput) fileInput.value = '';
                document.querySelectorAll('#wizard-individual .mode-card').forEach(c => c.classList.remove('selected'));
                const validate = document.getElementById('file-validation-individual');
                if (validate) validate.textContent = '';
                const preview = document.getElementById('previewIndividual');
                if (preview) preview.innerHTML = '';
                const genBtn = document.getElementById('generate-individual');
                if (genBtn) genBtn.disabled = true;
            } else {
                AppState.collectiveWizardStep = 1;
                AppState.collectiveFile = null;
                AppState.selectedCollectiveConfig = null;
                window.BoundouDashboard.processedCollectiveData = null;
                if (window.BoundouDashboard.advancedOptionsCollective) {
                    window.BoundouDashboard.advancedOptionsCollective.enableDualLists = false;
                    window.BoundouDashboard.advancedOptionsCollective.enableMandataireSeparation = false;
                }
                const fileInfo = document.getElementById('fileInfoCollective');
                if (fileInfo) fileInfo.style.display = 'none';
                const fileInput = document.getElementById('collective-file');
                if (fileInput) fileInput.value = '';
                document.querySelectorAll('#wizard-collective .mode-card').forEach(c => c.classList.remove('selected'));
                const validate = document.getElementById('file-validation-collective');
                if (validate) validate.textContent = '';
                const preview = document.getElementById('previewCollective');
                if (preview) preview.innerHTML = '';
                const genBtn = document.getElementById('generate-collective');
                if (genBtn) genBtn.disabled = true;
            }
        },

        /* Drop zones & file handling */
        _initDropZones() {
            this._setupDropZone('individual');
            this._setupDropZone('collective');
        },

        _setupDropZone(type) {
            const zone = document.getElementById(`dropzone-${type}`);
            const input = document.getElementById(`${type}-file`);
            const clearBtn = document.getElementById(`clearFile${type.charAt(0).toUpperCase() + type.slice(1)}`);

            if (!zone || !input) return;

            // Drag & drop
            zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', e => {
                e.preventDefault(); zone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) this._handleFile(file, type);
            });

            // Click to browse
            zone.addEventListener('click', e => {
                if (!e.target.closest('.drop-zone-info') && !e.target.closest('.link-btn')) {
                    input.click();
                }
            });
            input.addEventListener('change', () => { if (input.files[0]) this._handleFile(input.files[0], type); });

            // Clear button
            if (clearBtn) {
                clearBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    this._resetWizard(type);
                    // Re-trigger wizard update
                    const container = document.getElementById(`wizard-${type}`);
                    if (container) {
                        container.querySelectorAll('.wizard-step-indicator').forEach(ind => {
                            ind.classList.toggle('active', parseInt(ind.dataset.step) === 1);
                            ind.classList.remove('completed');
                        });
                        container.querySelectorAll('.wizard-step-line').forEach(line => line.classList.remove('active'));
                        container.querySelectorAll('.wizard-pane').forEach(pane => {
                            pane.classList.toggle('active', parseInt(pane.dataset.wizardStep) === 1);
                        });
                    }
                });
            }
        },

        async _handleFile(file, type) {
            // Validate
            if (typeof BoundouUtils !== 'undefined') {
                const errors = BoundouUtils.validateFile(file);
                const validateEl = document.getElementById(`file-validation-${type}`);
                if (errors.length > 0) {
                    if (validateEl) { validateEl.textContent = errors.join(', '); validateEl.className = 'validation-msg error'; }
                    return;
                }
                if (validateEl) { validateEl.textContent = ''; validateEl.className = 'validation-msg'; }
            }

            // Show file info
            const capType = type.charAt(0).toUpperCase() + type.slice(1);
            const fileInfo = document.getElementById(`fileInfo${capType}`);
            const fileName = document.getElementById(`fileName${capType}`);
            const fileMeta = document.getElementById(`fileMeta${capType}`);

            if (fileInfo) fileInfo.style.display = 'flex';
            if (fileName) fileName.textContent = file.name;
            if (fileMeta) fileMeta.textContent = this._formatSize(file.size);

            // Store
            if (type === 'individual') AppState.individualFile = file;
            else AppState.collectiveFile = file;

            // Process file
            try {
                const data = await this._readExcelFile(file, type);
                if (type === 'individual') {
                    if (typeof BoundouDataProcessor !== 'undefined') {
                        await BoundouDataProcessor.processIndividualData(data);
                    }
                } else {
                    if (typeof BoundouDataProcessor !== 'undefined') {
                        const processed = BoundouDataProcessor.processCollectiveData(data);
                        window.BoundouDashboard.processedCollectiveData = processed;
                        window.BoundouDashboard.originalCollectiveData = data;
                    }
                }
                const validateEl = document.getElementById(`file-validation-${type}`);
                if (validateEl) { validateEl.innerHTML = '<i class="bi bi-check-circle-fill"></i> Fichier charg\u00e9 avec succ\u00e8s'; validateEl.className = 'validation-msg success'; }

                // Enable next button
                this._refreshWizardButtons(type);

            } catch (err) {
                console.error('File processing error:', err);
                const validateEl = document.getElementById(`file-validation-${type}`);
                if (validateEl) { validateEl.innerHTML = `<i class="bi bi-x-circle-fill"></i> Erreur: ${err.message}`; validateEl.className = 'validation-msg error'; }
            }
        },

        _readExcelFile(file, type) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => {
                    try {
                        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                        const sheet = wb.Sheets[wb.SheetNames[0]];
                        const data = type === 'collective'
                            ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
                            : XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
                        resolve(data);
                    } catch (err) { reject(err); }
                };
                reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
                reader.readAsArrayBuffer(file);
            });
        },

        _refreshWizardButtons(type) {
            const totalSteps = type === 'individual' ? 4 : 3;
            const step = type === 'individual' ? AppState.individualWizardStep : AppState.collectiveWizardStep;
            const nextBtn = document.getElementById(`wizard-next-${type}`);
            if (nextBtn && step < totalSteps) {
                nextBtn.style.display = 'inline-flex';
                nextBtn.disabled = !this._canAdvanceWizard(type, step);
            }
        },

        /* Mode cards */
        _initModeCards() {
            document.querySelectorAll('.mode-card').forEach(card => {
                card.addEventListener('click', () => {
                    const type = card.dataset.type;
                    const config = card.dataset.config;

                    // Deselect siblings
                    const container = card.closest('.wizard-container');
                    if (container) container.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');

                    if (type === 'individual') {
                        AppState.selectedIndividualConfig = config;
                        window.BoundouDashboard.advancedOptions = window.BoundouDashboard.advancedOptions || {};
                        window.BoundouDashboard.advancedOptions.enableDualLists = config === 'habitat-agricole' || config === 'complete';
                        window.BoundouDashboard.advancedOptions.enableMandataireSeparation = config === 'mandataire' || config === 'complete';
                    } else {
                        AppState.selectedCollectiveConfig = config;
                        window.BoundouDashboard.advancedOptionsCollective = window.BoundouDashboard.advancedOptionsCollective || {};
                        window.BoundouDashboard.advancedOptionsCollective.enableDualLists = config === 'habitat-agricole' || config === 'complete';
                        window.BoundouDashboard.advancedOptionsCollective.enableMandataireSeparation = config === 'complete';
                    }

                    this._refreshWizardButtons(type);
                });
            });
        },

        /* Preview */
        _renderPreview(type) {
            const containerId = type === 'individual' ? 'previewIndividual' : 'previewCollective';
            const container = document.getElementById(containerId);
            if (!container) return;

            if (type === 'individual' && window.BoundouDashboard.processedIndividualData) {
                const data = window.BoundouDashboard.processedIndividualData;
                let html = '';
                ['personne_physique', 'personne_morale', 'groupement'].forEach(entityType => {
                    const items = data[entityType] || [];
                    if (items.length === 0) return;
                    const headers = Object.keys(items[0]).filter(h => h !== 'Typ_pers' && h !== 'Typ_pers_m');
                    const displayRows = items.slice(0, 5);

                    const labels = { personne_physique: 'Personnes Physiques', personne_morale: 'Personnes Morales', groupement: 'Groupements' };
                    html += `<div style="margin-bottom:1.5rem">
                        <div class="preview-stats"><span><strong>${items.length}</strong> ${labels[entityType]}</span></div>
                        <div style="overflow-x:auto"><table class="preview-table"><thead><tr><th>#</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>${displayRows.map((row, i) => `<tr><td class="row-number">${i + 1}</td>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
                        ${items.length > 5 ? `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">… et ${items.length - 5} de plus</p>` : ''}</div>`;
                });
                container.innerHTML = html || '<p style="color:var(--text-muted)">Aucune donnée à afficher</p>';
            } else if (type === 'collective' && window.BoundouDashboard.processedCollectiveData) {
                const items = window.BoundouDashboard.processedCollectiveData;
                if (items.length === 0) { container.innerHTML = '<p style="color:var(--text-muted)">Aucune donnée collective</p>'; return; }
                const headers = Object.keys(items[0]).slice(0, 10);
                const displayRows = items.slice(0, 5);
                container.innerHTML = `<div class="preview-stats"><span><strong>${items.length}</strong> parcelles collectives</span></div>
                    <div style="overflow-x:auto"><table class="preview-table"><thead><tr><th>#</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${displayRows.map((row, i) => `<tr><td class="row-number">${i + 1}</td>${headers.map(h => `<td>${String(row[h] || '').substring(0, 50)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
                    ${items.length > 5 ? `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">… et ${items.length - 5} de plus</p>` : ''}`;
            } else {
                container.innerHTML = '<p style="color:var(--text-muted)">Aucune donnée disponible</p>';
            }
        },

        /* Enable generate buttons */
        _enableGenerate(type) {
            const btn = document.getElementById(`generate-${type}`);
            if (btn) btn.disabled = false;
        },

        /* Generate buttons */
        _initGenerateButtons() {
            const genInd = document.getElementById('generate-individual');
            const genCol = document.getElementById('generate-collective');

            if (genInd) {
                genInd.addEventListener('click', async () => {
                    if (!window.BoundouDashboard.processedIndividualData) { UI._toast('Aucune donnée', 'error'); return; }
                    genInd.disabled = true;
                    const progress = document.getElementById('export-progress-individual');
                    const fill = document.getElementById('progress-fill-individual');
                    const label = document.getElementById('progress-label-individual');
                    if (progress) progress.style.display = 'block';

                    try {
                        // Animate progress
                        this._animateProgress(fill, label, 'Génération en cours…');

                        if (typeof BoundouExcelGenerator !== 'undefined') {
                            const config = AppState.selectedIndividualConfig || 'basic';
                            if (config === 'basic') {
                                await BoundouExcelGenerator.generateIndividualDeliberationList();
                            } else {
                                await BoundouExcelGenerator.generateEnhancedIndividualDeliberationList();
                            }
                        }

                        this._completeProgress(fill, label, 'Terminé !');
                        UI._toast('Liste individuelle générée !', 'success');

                        // Show processing report if any lines were excluded
                        if (window.BoundouDashboard._lastProcessingReport) {
                            this._showProcessingReport(window.BoundouDashboard._lastProcessingReport);
                        }
                    } catch (err) {
                        console.error(err);
                        this._completeProgress(fill, label, 'Erreur');
                        UI._toast('Erreur lors de la génération', 'error');
                    }
                    setTimeout(() => { genInd.disabled = false; }, 2000);
                });
            }

            if (genCol) {
                genCol.addEventListener('click', async () => {
                    if (!window.BoundouDashboard.processedCollectiveData) { UI._toast('Aucune donnée', 'error'); return; }
                    genCol.disabled = true;
                    const progress = document.getElementById('export-progress-collective');
                    const fill = document.getElementById('progress-fill-collective');
                    const label = document.getElementById('progress-label-collective');
                    if (progress) progress.style.display = 'block';

                    try {
                        this._animateProgress(fill, label, 'Génération en cours…');

                        if (typeof BoundouExcelGenerator !== 'undefined') {
                            await BoundouExcelGenerator.generateCollectiveDeliberationList();
                        }

                        this._completeProgress(fill, label, 'Terminé !');
                        UI._toast('Liste collective générée !', 'success');

                        // Show processing report if any lines were excluded
                        if (window.BoundouDashboard._lastProcessingReport) {
                            this._showProcessingReport(window.BoundouDashboard._lastProcessingReport);
                        }
                    } catch (err) {
                        console.error(err);
                        this._completeProgress(fill, label, 'Erreur');
                        UI._toast('Erreur lors de la génération', 'error');
                    }
                    setTimeout(() => { genCol.disabled = false; }, 2000);
                });
            }

            // Stats Excel buttons
            const statsInd = document.getElementById('generateStats');
            if (statsInd) {
                statsInd.addEventListener('click', () => {
                    if (typeof generateStatisticsReport === 'function') {
                        generateStatisticsReport();
                    } else {
                        UI._toast('Fonction statistiques non disponible', 'error');
                    }
                });
            }
            const statsCol = document.getElementById('generateCollectiveStats');
            if (statsCol) {
                statsCol.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof generateCollectiveStatisticsReport === 'function') {
                        generateCollectiveStatisticsReport();
                    } else {
                        UI._toast('Fonction statistiques non disponible', 'error');
                    }
                });
            }

            // Stats PDF buttons
            const pdfInd = document.getElementById('generateStatsPDF');
            if (pdfInd) {
                pdfInd.addEventListener('click', () => {
                    if (typeof generateStatisticsPDFReport === 'function') {
                        generateStatisticsPDFReport();
                    } else {
                        UI._toast('Fonction PDF non disponible', 'error');
                    }
                });
            }
            const pdfCol = document.getElementById('generateCollectiveStatsPDF');
            if (pdfCol) {
                pdfCol.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof generateCollectiveStatisticsPDFReport === 'function') {
                        generateCollectiveStatisticsPDFReport();
                    } else {
                        UI._toast('Fonction PDF non disponible', 'error');
                    }
                });
            }
        },

        _animateProgress(fillEl, labelEl, msg) {
            if (!fillEl) return;
            // Clear any previous interval
            if (fillEl._progressInterval) {
                clearInterval(fillEl._progressInterval);
                fillEl._progressInterval = null;
            }
            fillEl.style.transition = 'width 0.3s ease';
            fillEl.style.width = '0%';
            if (labelEl) labelEl.textContent = msg;
            let w = 0;
            const interval = setInterval(() => {
                w += Math.random() * 10 + 2;
                if (w >= 90) { clearInterval(interval); w = 90; }
                fillEl.style.width = w + '%';
            }, 200);
            fillEl._progressInterval = interval;
        },

        _completeProgress(fillEl, labelEl, msg) {
            if (!fillEl) return;
            // Clear the animation interval
            if (fillEl._progressInterval) {
                clearInterval(fillEl._progressInterval);
                fillEl._progressInterval = null;
            }
            fillEl.style.transition = 'width 0.5s ease';
            fillEl.style.width = '100%';
            if (labelEl) labelEl.textContent = msg || 'Terminé !';
        },

        _showProcessingReport(report) {
            if (!report) return;
            const { totalInput, totalOutput, excludedRows } = report;
            // Clear the report so it doesn't show again
            window.BoundouDashboard._lastProcessingReport = null;

            if (!excludedRows || excludedRows.length === 0) return;

            // Build report message
            let msg = `⚠️ Rapport de traitement:\n`;
            msg += `• Lignes en entrée: ${totalInput}\n`;
            msg += `• Lignes exportées: ${totalOutput}\n`;
            msg += `• Lignes exclues: ${excludedRows.length}\n\n`;
            msg += `Détail des lignes exclues:\n`;
            excludedRows.forEach(item => {
                msg += `  - Ligne ${item.row}: ${item.reason}\n`;
            });

            console.warn('[REPORT]', msg);

            // Show in UI as a dismissable alert
            const alertDiv = document.createElement('div');
            alertDiv.className = 'processing-report-alert';
            alertDiv.style.cssText = 'position:fixed;top:80px;right:20px;max-width:500px;max-height:60vh;overflow-y:auto;background:var(--bg-card,#1e1e2e);color:var(--text-primary,#cdd6f4);border:1px solid #f9e2af;border-radius:12px;padding:1.2rem;z-index:10000;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-size:0.85rem;';
            
            let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem">`;
            html += `<strong style="color:#f9e2af">⚠️ Rapport de traitement</strong>`;
            html += `<button onclick="this.closest('.processing-report-alert').remove()" style="background:none;border:none;color:var(--text-primary,#cdd6f4);cursor:pointer;font-size:1.2rem">&times;</button></div>`;
            html += `<div style="margin-bottom:0.5rem">Entrée: <strong>${totalInput}</strong> | Exportées: <strong>${totalOutput}</strong> | Exclues: <strong style="color:#f38ba8">${excludedRows.length}</strong></div>`;
            html += `<div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:0.5rem;font-size:0.8rem">`;
            excludedRows.slice(0, 50).forEach(item => {
                html += `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05)">`;
                html += `<span style="color:#f9e2af">Ligne ${item.row}</span>: ${item.reason}`;
                if (item.data) html += ` <span style="color:#6c7086">[${item.data}]</span>`;
                html += `</div>`;
            });
            if (excludedRows.length > 50) {
                html += `<div style="padding:4px 0;color:#6c7086;font-style:italic">... et ${excludedRows.length - 50} de plus</div>`;
            }
            html += `</div>`;
            alertDiv.innerHTML = html;
            document.body.appendChild(alertDiv);

            // Also download the report as a text file
            const reportText = `RAPPORT DE TRAITEMENT - ${new Date().toLocaleString('fr-FR')}\n${'='.repeat(50)}\n\nLignes en entrée: ${totalInput}\nLignes exportées: ${totalOutput}\nLignes exclues: ${excludedRows.length}\n\n${'─'.repeat(50)}\nDÉTAIL DES LIGNES EXCLUES:\n${'─'.repeat(50)}\n` + 
                excludedRows.map(item => `Ligne ${item.row}: ${item.reason}${item.data ? ' [' + item.data + ']' : ''}`).join('\n');
            const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rapport_traitement_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        },

        _formatSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
    };

    /* ================================================================
       BOOTSTRAP — Wire everything when DOM is ready
       ================================================================ */
    function boot() {
        console.log('[START] PROCASEF Boundou v2 -- Starting...');

        // Theme
        UI.initTheme();
        UI.setDateLabel();

        // Tab navigation
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => UI.switchSection(tab.dataset.section));
        });

        // Filter listeners
        const communeFilter = document.getElementById('commune-filter');
        if (communeFilter) communeFilter.addEventListener('change', e => MAP.filterByCommune(e.target.value));
        const usageFilter = document.getElementById('usage-filter');
        if (usageFilter) usageFilter.addEventListener('change', e => MAP.filterByUsage(e.target.value));

        // Theme toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.addEventListener('click', () => UI.toggleTheme());

        // Close stats popup (no longer a static element — handled by MAP._closeStatsPopup)

        // Search
        UI.initSearch();
        UI.initMobileSearch();

        // Export button
        UI.initExportButton();

        // Deliberation wizard
        DELIB.init();

        // Handle window resize — invalidate map
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (AppState.map) AppState.map.invalidateSize();
            }, 200);
        });

        // Wait for libraries to load, then initialize map
        const waitForLibs = setInterval(() => {
            if (typeof L !== 'undefined') {
                clearInterval(waitForLibs);
                MAP.init();

                // Hide skeleton after map init
                setTimeout(() => UI.hideSkeleton(), 600);
            }
        }, 100);

        // Fallback: hide skeleton after 4s regardless
        setTimeout(() => UI.hideSkeleton(), 4000);

        console.log('[OK] Boot sequence complete');
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
