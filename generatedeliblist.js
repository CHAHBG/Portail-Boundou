// === Enhanced Deliberation List Generation ===
// Improved Preview and UI Management with modular design

// Initialize enhanced deliberation handlers
function initializeDeliberationHandlers() {
    setupDragAndDrop();
    setupFileInputHandlers();
    setupPreviewControls();
    console.log('Enhanced deliberation handlers initialized');
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const uploadSections = ['uploadSectionIndividual', 'uploadSectionCollective'];
    
    uploadSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (!section) {
            console.warn(`Section ${sectionId} not found`);
            return;
        }

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            section.addEventListener(eventName, () => highlight(section), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, () => unhighlight(section), false);
        });

        section.addEventListener('drop', (e) => handleDrop(e, sectionId), false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(section) {
        section.classList.add('dragover');
    }

    function unhighlight(section) {
        section.classList.remove('dragover');
    }

    function handleDrop(e, sectionId) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const fileType = sectionId.includes('Individual') ? 'individual' : 'collective';
            handleFileSelection(files[0], fileType);
        }
    }
}

    uploadSectionIndividual.addEventListener('drop', (e) => handleDrop(e, 'individual'), false);
    uploadSectionCollective.addEventListener('drop', (e) => handleDrop(e, 'collective'), false);

    function handleDrop(e, type) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, type);
    }

    // Gestion des fichiers via input
// Setup file input handlers with validation
function setupFileInputHandlers() {
    const fileInputs = [
        { id: 'individual-file', type: 'individual' },
        { id: 'collective-file', type: 'collective' }
    ];

    fileInputs.forEach(({ id, type }) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileSelection(e.target.files[0], type);
                }
            });
        }
    });
}

// Handle file selection with validation
function handleFileSelection(file, type) {
    try {
        // Validate file
        const validationErrors = BoundouUtils.validateFile(file);
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => BoundouUtils.showError(error));
            return;
        }

        // Show file info
        BoundouUtils.showSuccess(
            `Fichier sélectionné: ${file.name} (${BoundouUtils.formatFileSize(file.size)})`
        );

        // Process file based on type
        if (type === 'individual') {
            processIndividualFile(file);
        } else {
            processCollectiveFile(file);
        }

    } catch (error) {
        BoundouUtils.showError(`Erreur de sélection de fichier: ${error.message}`);
    }
}

// Process individual file with enhanced error handling
function processIndividualFile(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            BoundouUtils.showLoading('individual-preview', BoundouConfig.MESSAGES.INFO.PROCESSING);
            
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error(BoundouConfig.MESSAGES.ERRORS.NO_DATA);
            }

            // Process data through enhanced processor
            await BoundouDataProcessor.processIndividualData(jsonData);
            
            // Display enhanced preview
            displayIndividualPreview();

        } catch (error) {
            BoundouUtils.hideLoading('individual-preview');
            BoundouUtils.showError(`Erreur de traitement: ${error.message}`);
            console.error('Erreur processIndividualFile:', error);
        }
    };

    reader.onerror = function() {
        BoundouUtils.showError('Erreur de lecture du fichier');
    };

    reader.readAsArrayBuffer(file);
}
// Process collective file (placeholder for future enhancement)
function processCollectiveFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Filter data for collective processing
            const filteredData = jsonData.map(row => {
                const filteredRow = {};
                const colonnesAConserver = [
                    'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Date_naiss',
                    'superficie', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'Sexe'
                ];
                
                colonnesAConserver.forEach(col => {
                    if (row[col] !== undefined) {
                        filteredRow[col] = BoundouUtils.sanitizeForExcel(row[col]);
                    }
                });
                
                return filteredRow;
            });

            window.BoundouDashboard.processedCollectiveData = filteredData;
            window.BoundouDashboard.originalCollectiveData = jsonData;

            displayCollectivePreview();
            BoundouUtils.showSuccess(BoundouConfig.MESSAGES.SUCCESS.FILE_PROCESSED);

        } catch (error) {
            BoundouUtils.showError(`Erreur collective: ${error.message}`);
            console.error('Erreur processCollectiveFile:', error);
        }
    };

    reader.readAsArrayBuffer(file);
}

// Enhanced preview display for individual data
function displayIndividualPreview() {
    try {
        // Wait for DOM to be ready if called too early
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', displayIndividualPreview);
            return;
        }
        
        const data = window.BoundouDashboard.processedIndividualData;
        
        if (!data || data.length === 0) {
            BoundouUtils.showError('Aucune donnée à prévisualiser.');
            return;
        }

        const previewContainer = document.getElementById('previewIndividual');
        if (!previewContainer) {
            console.warn('Container de prévisualisation individual non trouvé - attente...');
            // Retry after a short delay
            setTimeout(displayIndividualPreview, 500);
            return;
        }

        // Generate preview for each entity type
        const entityTypes = ['personne_physique', 'personne_morale', 'groupement'];
        let previewHtml = '<div class="preview-wrapper fade-in">';

        entityTypes.forEach(entityType => {
            const previewData = BoundouDataProcessor.getPreviewData(data, entityType);
            
            if (previewData.data.length > 0) {
                const sheetName = BoundouConfig.EXCEL.SHEET_NAMES[entityType.toUpperCase()];
                previewHtml += generateEntityPreviewSection(entityType, sheetName, previewData);
            }
        });

        previewHtml += '</div>';
        previewContainer.innerHTML = previewHtml;
        
        // Add interactivity after DOM update
        setTimeout(() => {
            addPreviewInteractivity();
            addSearchFunctionality();
        }, 100);

    } catch (error) {
        BoundouUtils.showError(`Erreur de prévisualisation: ${error.message}`);
        console.error('Erreur dans displayIndividualPreview:', error);
    }
}

// Generate preview section for specific entity type
function generateEntityPreviewSection(entityType, sheetName, previewData) {
    const { data, headers, totalRows, hasMore } = previewData;
    
    return `
        <div class="preview-section" data-entity="${entityType}">
            <div class="preview-header">
                <h3 class="sheet-title">
                    <span class="sheet-icon">📋</span>
                    ${sheetName}
                </h3>
                <div class="preview-stats">
                    <span class="total-count badge">${totalRows} entrées</span>
                    ${hasMore ? `<span class="preview-note">(${data.length} affichées)</span>` : ''}
                </div>
                <div class="preview-actions">
                    <div class="search-container">
                        <input type="text" 
                               class="search-input" 
                               placeholder="Rechercher..." 
                               data-table="table-${entityType}">
                        <span class="search-icon">🔍</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="togglePreviewExpansion('${entityType}')">
                        <span class="expand-icon">📖</span> 
                        <span class="expand-text">Voir plus</span>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="exportEntityPreview('${entityType}')">
                        <span class="export-icon">📥</span> Exporter
                    </button>
                </div>
            </div>
            <div class="table-container">
                <table class="preview-table" id="table-${entityType}">
                    <thead>
                        <tr>
                            ${headers.map(header => `
                                <th class="sortable" data-column="${header}">
                                    ${header}
                                    <span class="sort-indicator"></span>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((row, index) => `
                            <tr data-row-index="${index}">
                                ${headers.map(header => `
                                    <td title="${BoundouUtils.sanitizeForExcel(row[header] || '')}">
                                        ${BoundouUtils.sanitizeForExcel(row[header] || '')}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="preview-footer">
                <span class="row-count">Lignes visibles: <span class="visible-count">${data.length}</span></span>
            </div>
        </div>
    `;
}

// Enhanced collective preview
function displayCollectivePreview() {
    // Wait for DOM to be ready if called too early
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', displayCollectivePreview);
        return;
    }
    
    const data = window.BoundouDashboard.processedCollectiveData;
    const previewContainer = document.getElementById('previewCollective');
    
    if (!previewContainer) {
        console.warn('Container de prévisualisation collective non trouvé - attente...');
        // Retry after a short delay
        setTimeout(displayCollectivePreview, 500);
        return;
    }
    
    if (!data || data.length === 0) {
        previewContainer.innerHTML = `
            <div class="preview-placeholder">
                <div class="placeholder-content">
                    <span class="placeholder-icon">📄</span>
                    <h3>Aucune donnée collective</h3>
                    <p>Veuillez charger un fichier pour voir la prévisualisation.</p>
                </div>
            </div>
        `;
        return;
    }

    const headers = Object.keys(data[0]);
    const previewData = data.slice(0, BoundouConfig.EXCEL.MAX_PREVIEW_ROWS);

    previewContainer.innerHTML = `
        <div class="preview-section">
            <div class="preview-header">
                <h3 class="sheet-title">
                    <span class="sheet-icon">📋</span>
                    Données Collectives
                </h3>
                <div class="preview-stats">
                    <span class="total-count badge">${data.length} entrées</span>
                    ${data.length > previewData.length ? `<span class="preview-note">(${previewData.length} affichées)</span>` : ''}
                </div>
            </div>
            <div class="table-container">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${previewData.map(row => `
                            <tr>
                                ${headers.map(header => `<td>${BoundouUtils.sanitizeForExcel(row[header] || '')}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Setup preview controls and additional functionality
function setupPreviewControls() {
    console.log('Preview controls setup complete');
}

// Add interactivity to preview tables
function addPreviewInteractivity() {
    // Add column sorting
    document.querySelectorAll('.preview-table th.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const table = this.closest('table');
            const column = this.dataset.column;
            sortTableByColumn(table, column, this);
        });
    });

    // Add row selection
    document.querySelectorAll('.preview-table tbody tr').forEach(row => {
        row.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });
}

// Add search functionality
function addSearchFunctionality() {
    document.querySelectorAll('.search-input').forEach(input => {
        const debouncedSearch = BoundouUtils.debounce((term, tableId) => {
            searchPreviewTable(term, tableId);
        }, BoundouConfig.UI.DEBOUNCE_DELAY);

        input.addEventListener('input', function() {
            const tableId = this.dataset.table;
            debouncedSearch(this.value, tableId);
        });
    });
}

// Search preview table
function searchPreviewTable(searchTerm, tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    const term = searchTerm.toLowerCase();
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const isVisible = text.includes(term);
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });

    // Update visible count
    const section = table.closest('.preview-section');
    const visibleCountSpan = section.querySelector('.visible-count');
    if (visibleCountSpan) {
        visibleCountSpan.textContent = visibleCount;
    }
}

// Sort table by column
function sortTableByColumn(table, columnName, headerElement) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const columnIndex = Array.from(headerElement.parentNode.children).indexOf(headerElement);
    
    // Determine sort direction
    const currentSort = headerElement.dataset.sort;
    const isAscending = currentSort !== 'asc';
    
    // Clear previous sort indicators
    table.querySelectorAll('th').forEach(th => {
        th.dataset.sort = '';
        th.querySelector('.sort-indicator').textContent = '';
    });
    
    // Set current sort indicator
    headerElement.dataset.sort = isAscending ? 'asc' : 'desc';
    headerElement.querySelector('.sort-indicator').textContent = isAscending ? '↑' : '↓';
    
    // Sort rows
    rows.sort((a, b) => {
        const aText = a.children[columnIndex].textContent.trim();
        const bText = b.children[columnIndex].textContent.trim();
        
        // Try numeric comparison first
        const aNum = parseFloat(aText);
        const bNum = parseFloat(bText);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return isAscending ? aNum - bNum : bNum - aNum;
        }
        
        // Fallback to string comparison
        return isAscending ? 
            aText.localeCompare(bText, 'fr', { numeric: true }) : 
            bText.localeCompare(aText, 'fr', { numeric: true });
    });
    
    // Reappend sorted rows
    rows.forEach(row => tbody.appendChild(row));
    
    BoundouUtils.showSuccess(`Trié par ${columnName} ${isAscending ? '(croissant)' : '(décroissant)'}`);
}

// Toggle preview expansion
function togglePreviewExpansion(entityType) {
    try {
        const data = window.BoundouDashboard.processedIndividualData;
        const section = document.querySelector(`[data-entity="${entityType}"]`);
        const button = section.querySelector('.expand-text');
        
        if (button.textContent.includes('Voir plus')) {
            // Show more rows
            const fullPreviewData = BoundouDataProcessor.getPreviewData(
                data, 
                entityType, 
                BoundouConfig.EXCEL.MAX_PREVIEW_ROWS * 5
            );
            
            const tableBody = section.querySelector('tbody');
            const headers = BoundouDataProcessor.getFilteredHeaders(
                Object.keys(data[0]), 
                entityType
            );
            
            // Replace table content with more rows
            tableBody.innerHTML = fullPreviewData.data.map((row, index) => `
                <tr data-row-index="${index}">
                    ${headers.map(header => `
                        <td title="${BoundouUtils.sanitizeForExcel(row[header] || '')}">
                            ${BoundouUtils.sanitizeForExcel(row[header] || '')}
                        </td>
                    `).join('')}
                </tr>
            `).join('');
            
            button.textContent = 'Voir moins';
            section.querySelector('.expand-icon').textContent = '📕';
            
            // Re-add interactivity to new rows
            addPreviewInteractivity();
            
        } else {
            // Restore original view
            displayIndividualPreview();
        }
        
    } catch (error) {
        BoundouUtils.showError(`Erreur d'expansion: ${error.message}`);
    }
}

// Export preview data for specific entity
function exportEntityPreview(entityType) {
    try {
        const data = window.BoundouDashboard.processedIndividualData;
        const entityData = BoundouDataProcessor.generateEntityData(data, entityType);
        
        if (entityData.data.length === 0) {
            BoundouUtils.showError(`Aucune donnée à exporter pour ${entityType}`);
            return;
        }
        
        BoundouExcelGenerator.exportPreviewData(entityType, entityData.data);
        
    } catch (error) {
        BoundouUtils.showError(`Erreur d'export: ${error.message}`);
    }
}

// Export functions for external use
window.DeliberationListUI = {
    initializeDeliberationHandlers,
    displayIndividualPreview,
    displayCollectivePreview,
    togglePreviewExpansion,
    exportEntityPreview
};
