// === Enhanced Deliberation List Generation ===
// Improved Preview and UI Management with modular design

// Helper function to format dates to DD/MM/YYYY format (shared with excel-generator)
function formatDateForPreview(dateValue) {
    if (!dateValue) return '';
    
    // Handle different date formats
    let date;
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
        date = dateValue;
    } else {
        // Try to parse various string formats
        const dateStr = String(dateValue).trim();
        
        // Skip empty or invalid values
        if (!dateStr || dateStr === '-' || dateStr === 'N/A') return '';
        
        // Handle already formatted DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return dateStr;
        }
        
        // Handle DDMMYYYY format, convert to DD/MM/YYYY
        if (/^\d{8}$/.test(dateStr)) {
            const day = dateStr.slice(0, 2);
            const month = dateStr.slice(2, 4);
            const year = dateStr.slice(4, 8);
            return `${day}/${month}/${year}`;
        }
        
        // Handle DDMMYY format, convert to DD/MM/YYYY
        if (/^\d{6}$/.test(dateStr)) {
            const day = dateStr.slice(0, 2);
            const month = dateStr.slice(2, 4);
            const yearShort = dateStr.slice(4, 6);
            // Convert 2-digit year to 4-digit (assume 1900s for years 00-99)
            const year = parseInt(yearShort) < 50 ? `20${yearShort}` : `19${yearShort}`;
            return `${day}/${month}/${year}`;
        }
        
        // Handle Excel serial numbers (numeric values representing days since 1900-01-01)
        if (/^\d+$/.test(dateStr) && parseInt(dateStr) > 0 && parseInt(dateStr) < 100000) {
            const serialNumber = parseInt(dateStr);
            // Excel epoch starts at January 1, 1900 (but Excel incorrectly treats 1900 as a leap year)
            const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
            const millisecondsPerDay = 24 * 60 * 60 * 1000;
            
            // Account for Excel's leap year bug (Excel thinks 1900 is a leap year)
            let adjustedSerial = serialNumber;
            if (serialNumber >= 60) {
                adjustedSerial = serialNumber - 1; // Subtract 1 day for dates after Feb 28, 1900
            }
            
            date = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * millisecondsPerDay);
        } else if (dateStr.includes('/')) {
            // Handle DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // Assume DD/MM/YYYY format first
                date = new Date(parts[2], parts[1] - 1, parts[0]);
                // If invalid, try MM/DD/YYYY
                if (isNaN(date)) {
                    date = new Date(parts[2], parts[0] - 1, parts[1]);
                }
            }
        } else if (dateStr.includes('-')) {
            // Handle YYYY-MM-DD or DD-MM-YYYY
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    // YYYY-MM-DD format
                    date = new Date(parts[0], parts[1] - 1, parts[2]);
                } else {
                    // DD-MM-YYYY format
                    date = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
        } else {
            // Try direct parsing
            date = new Date(dateStr);
        }
    }
    
    // Check if date is valid
    if (!date || isNaN(date)) {
        return dateValue; // Return original value if can't parse
    }
    
    // Ensure reasonable year range (1900-2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
        return dateValue; // Return original if year seems wrong
    }
    
    // Format to DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const fullYear = String(date.getFullYear());
    
    return `${day}/${month}/${fullYear}`;
}

// Helper function to format multi-line content for HTML display
function formatMultiLineForPreview(value) {
    if (!value) return '';
    
    // Convert newlines to HTML line breaks for proper display
    return String(value).replace(/\n/g, '<br>');
}

// Helper function to check if a column contains multi-line data
function isMultiLineColumn(header) {
    // These columns typically contain multiple values separated by newlines
    const multiLineColumns = [
        'Prenom', 'Nom', 'Sexe', 'Numero_piece', 'Telephone', 
        'Date_naissance', 'Residence', 'Date_naiss'
    ];
    return multiLineColumns.includes(header);
}

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
        console.log(`File selected: ${file.name}, type: ${type}, size: ${file.size}`);
        
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
        console.error('Error in handleFileSelection:', error);
        BoundouUtils.showError(`Erreur de sélection de fichier: ${error.message}`);
    }
}

// Process individual file with enhanced error handling
function processIndividualFile(file) {
    const reader = new FileReader();
    
    // Set processing flag to prevent data reset
    window.BoundouDashboard.isProcessingFile = true;
    
    reader.onload = async function(e) {
        try {
            BoundouUtils.showLoading('previewIndividual', BoundouConfig.MESSAGES.INFO.PROCESSING);
            
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
            
            // Enable the generate button
            document.getElementById('generate-individual').disabled = false;
            
            // Show column selection instead of immediate preview
            displayColumnSelection();
            
            BoundouUtils.showSuccess(`Fichier traité: ${jsonData.length} entrées`);
            
            // Clear processing flag
            window.BoundouDashboard.isProcessingFile = false;

        } catch (error) {
            BoundouUtils.showError(`Erreur de traitement: ${error.message}`);
            document.getElementById('generate-individual').disabled = true;
            // Clear processing flag on error
            window.BoundouDashboard.isProcessingFile = false;
            console.error('Erreur processIndividualFile:', error);
        }
    };

    reader.onerror = function() {
        BoundouUtils.showError('Erreur de lecture du fichier');
        // Clear processing flag on error
        window.BoundouDashboard.isProcessingFile = false;
    };

    reader.readAsArrayBuffer(file);
}
// Process collective file (placeholder for future enhancement)
function processCollectiveFile(file) {
    const reader = new FileReader();
    
    // Set processing flag to prevent data reset
    window.BoundouDashboard.isProcessingFile = true;
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Process collective data with proper parcel handling
            const processedData = BoundouDataProcessor.processCollectiveData(jsonData);

            if (!processedData || processedData.length === 0) {
                throw new Error('Aucune parcelle valide trouvée (minimum 2 individus par parcelle requis)');
            }

            window.BoundouDashboard.processedCollectiveData = processedData;
            window.BoundouDashboard.originalCollectiveData = jsonData;

            // Enable the generate button
            document.getElementById('generate-collective').disabled = false;
            
            // Show collective statistics section  
            const collectiveStatsSection = document.getElementById('statisticsCollectiveSection');
            if (collectiveStatsSection) {
                collectiveStatsSection.style.display = 'block';
                console.log('Collective statistics section displayed');
            }
            
            // Enable collective statistics button
            const collectiveStatsButton = document.getElementById('generateCollectiveStats');
            if (collectiveStatsButton) {
                collectiveStatsButton.disabled = false;
                console.log('Collective statistics button enabled');
                
                // Setup event handlers for collective statistics
                console.log('🔧 Setting up collective statistics button event handlers...');
                setupCollectiveStatsHandler();
            }
            
            displayCollectivePreview();
            
            const totalParcels = processedData.length;
            const errors = window.BoundouDashboard.collectiveParcelErrors || [];
            const excludedParcels = errors.length;
            
            BoundouUtils.showSuccess(
                `Fichier traité: ${totalParcels} parcelles valides` + 
                (excludedParcels > 0 ? `, ${excludedParcels} parcelles exclues` : '')
            );
            
            // Clear processing flag
            window.BoundouDashboard.isProcessingFile = false;

        } catch (error) {
            BoundouUtils.showError(`Erreur collective: ${error.message}`);
            document.getElementById('generate-collective').disabled = true;
            // Clear processing flag on error
            window.BoundouDashboard.isProcessingFile = false;
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
        const previewContainer = document.getElementById('previewIndividual');
        
        console.log('DEBUG: displayIndividualPreview called');
        console.log('DEBUG: data:', data);
        console.log('DEBUG: previewContainer:', previewContainer);
        
        if (!previewContainer) {
            console.warn('Container de prévisualisation individual non trouvé - attente...');
            // Retry after a short delay
            setTimeout(displayIndividualPreview, 500);
            return;
        }

        // Make sure the preview container is visible
        previewContainer.style.display = 'block';
        
        console.log('DEBUG: container display set to block');

        // Check if data is a Promise (async operation still pending)
        if (data && typeof data.then === 'function') {
            console.log('Data is a Promise, waiting...');
            data.then(processedData => {
                window.BoundouDashboard.processedIndividualData = processedData;
                setTimeout(displayIndividualPreview, 100);
            }).catch(err => {
                BoundouUtils.showError(`Erreur de résolution des données: ${err.message}`);
            });
            return;
        }
        
        // Check if data is categorized object (expected structure)
        if (!data || typeof data !== 'object' || (!data.personne_physique && !data.personne_morale && !data.groupement)) {
            previewContainer.innerHTML = `
                <div class="preview-placeholder">
                    <div class="placeholder-content">
                        <span class="placeholder-icon">📄</span>
                        <h3>Aucune donnée catégorisée</h3>
                        <p>Le fichier ne contient pas de données valides pour les types d'entités supportés.</p>
                    </div>
                </div>
            `;
            return;
        }

        // Generate preview sections for each entity type
        let previewHtml = '';
        const entityTypes = [
            { key: 'personne_physique', name: 'Personnes physiques', icon: '👤' },
            { key: 'personne_morale', name: 'Personnes morales', icon: '🏢' },
            { key: 'groupement', name: 'Groupements', icon: '👥' }
        ];

        entityTypes.forEach(entityType => {
            const entityData = data[entityType.key] || [];
            if (entityData.length > 0) {
                // Use selected columns if available, otherwise use all columns
                let headers;
                const selectedColumns = window.BoundouDashboard.selectedColumns;
                if (selectedColumns && selectedColumns[entityType.key]) {
                    headers = selectedColumns[entityType.key];
                } else {
                    headers = Object.keys(entityData[0]).filter(h => h !== 'Typ_pers' && h !== 'Typ_pers_m');
                }
                
                const previewData = entityData.slice(0, BoundouConfig.EXCEL.MAX_PREVIEW_ROWS);

                previewHtml += `
                    <div class="preview-section">
                        <div class="preview-header">
                            <h3 class="sheet-title">
                                <span class="sheet-icon">${entityType.icon}</span>
                                ${entityType.name}
                            </h3>
                            <div class="preview-stats">
                                <span class="total-count badge">${entityData.length} entrées</span>
                                ${entityData.length > previewData.length ? `<span class="preview-note">(${previewData.length} affichées)</span>` : ''}
                            </div>
                        </div>
                        <div class="table-container">
                            <table class="preview-table">
                                <thead>
                                    <tr>
                                        <th>N°</th>
                                        ${headers.map(header => `<th>${header}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${previewData.map((row, index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            ${headers.map(header => {
                                                let cellValue = row[header] || '';
                                                // Apply date formatting to specific date columns
                                                if (header === 'Date_naiss' || header === 'Creation' || header === 'Date_naissance') {
                                                    cellValue = formatDateForPreview(cellValue) || cellValue;
                                                }
                                                // Apply multi-line formatting for better display
                                                if (isMultiLineColumn(header)) {
                                                    cellValue = formatMultiLineForPreview(cellValue);
                                                    return `<td class="multi-line-cell">${cellValue}</td>`;
                                                } else {
                                                    return `<td>${BoundouUtils.sanitizeForExcel(cellValue)}</td>`;
                                                }
                                            }).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
        });

        console.log('DEBUG: previewHtml length:', previewHtml.length);
        console.log('DEBUG: previewHtml sample:', previewHtml.substring(0, 200));

        if (previewHtml === '') {
            previewContainer.innerHTML = `
                <div class="preview-placeholder">
                    <div class="placeholder-content">
                        <span class="placeholder-icon">📄</span>
                        <h3>Aucune donnée à prévisualiser</h3>
                        <p>Le fichier ne contient pas de données dans les catégories supportées.</p>
                    </div>
                </div>
            `;
        } else {
            previewContainer.innerHTML = previewHtml;
            console.log('DEBUG: innerHTML set, container now has:', previewContainer.children.length, 'children');
            console.log('DEBUG: container offsetHeight:', previewContainer.offsetHeight);
            console.log('DEBUG: container style.display:', previewContainer.style.display);
            
            // Scroll to the preview area
            previewContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

    } catch (error) {
        BoundouUtils.showError(`Erreur de prévisualisation: ${error.message}`);
        console.error('Erreur dans displayIndividualPreview:', error);
    }
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
    
    // Make sure the preview container is visible
    previewContainer.style.display = 'block';
    
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
                            <th>N°</th>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${previewData.map((row, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                ${headers.map(header => {
                                    let cellValue = row[header] || '';
                                    // Apply date formatting to specific date columns
                                    if (header === 'Date_naiss' || header === 'Creation' || header === 'Date_naissance') {
                                        cellValue = formatDateForPreview(cellValue) || cellValue;
                                    }
                                    // Apply multi-line formatting for better display
                                    if (isMultiLineColumn(header)) {
                                        cellValue = formatMultiLineForPreview(cellValue);
                                        return `<td class="multi-line-cell">${cellValue}</td>`;
                                    } else {
                                        return `<td>${BoundouUtils.sanitizeForExcel(cellValue)}</td>`;
                                    }
                                }).join('')}
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
            const headers = fullPreviewData.headers;
            
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
        
        if (!data || !data[entityType] || data[entityType].length === 0) {
            BoundouUtils.showError(`Aucune donnée à exporter pour ${entityType}`);
            return;
        }
        
        BoundouExcelGenerator.exportPreviewData(entityType, data[entityType]);
        
    } catch (error) {
        BoundouUtils.showError(`Erreur d'export: ${error.message}`);
    }
}

// === Column Selection Functions ===

// Display column selection interface
function displayColumnSelection() {
    try {
        const data = window.BoundouDashboard.processedIndividualData;
        const columnSection = document.getElementById('columnSelectionIndividual');
        
        console.log('DEBUG: displayColumnSelection called', { data, columnSection });
        
        if (!data || !columnSection) {
            console.error('Missing data or column section');
            return;
        }
        
        // Update entity counts and manage tab visibility
        const countElements = {
            'personne_physique': document.getElementById('count-personne_physique'),
            'personne_morale': document.getElementById('count-personne_morale'),
            'groupement': document.getElementById('count-groupement')
        };
        
        let firstEntityWithData = null;
        
        Object.keys(countElements).forEach(entityType => {
            const element = countElements[entityType];
            const count = data[entityType]?.length || 0;
            
            if (element) {
                element.textContent = count;
            }
            
            // Show/hide tab buttons based on data availability
            const tabButton = document.querySelector(`[data-entity="${entityType}"]`);
            if (tabButton) {
                if (count > 0) {
                    tabButton.style.display = 'inline-block';
                    tabButton.disabled = false;
                    if (!firstEntityWithData) {
                        firstEntityWithData = entityType;
                    }
                } else {
                    tabButton.style.display = 'none';
                    tabButton.disabled = true;
                }
            }
        });
        
        // Generate column checkboxes for each entity type
        const entityTypes = ['personne_physique', 'personne_morale', 'groupement'];
        
        entityTypes.forEach(entityType => {
            const entityData = data[entityType] || [];
            if (entityData.length > 0) {
                const headers = Object.keys(entityData[0]).filter(h => h !== 'Typ_pers' && h !== 'Typ_pers_m');
                console.log(`DEBUG: Generating checkboxes for ${entityType}:`, headers.length, 'columns');
                
                // Only generate if the grid element exists
                const gridElement = document.getElementById(`grid-${entityType}`);
                if (gridElement) {
                    generateColumnCheckboxes(entityType, headers);
                } else {
                    console.warn(`Grid element not found for ${entityType}, skipping checkbox generation`);
                }
            } else {
                console.log(`DEBUG: No data found for ${entityType}, skipping`);
            }
        });
        
        // Show the column selection section
        columnSection.style.display = 'block';
        
        // Make sure we show the first tab that has data by default
        const firstTab = columnSection.querySelector(`.entity-tab-button[data-entity="${firstEntityWithData}"]`);
        const firstColumnList = columnSection.querySelector(`#columns-${firstEntityWithData}`);
        
        if (firstTab && firstColumnList && firstEntityWithData) {
            firstTab.classList.add('active');
            firstColumnList.style.display = 'block';
            console.log(`DEBUG: Activated first tab with data: ${firstEntityWithData}`);
        } else {
            console.warn('No entity data found to display tabs');
        }
        
        // Setup tab switching with delay to ensure DOM is ready
        setTimeout(() => {
            setupEntityTabs();
            setupColumnValidation();
            displayAdvancedOptions();
            setupAdvancedOptionsHandlers();
        }, 100);
        
        // Scroll to the section
        columnSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (error) {
        console.error('Error in displayColumnSelection:', error);
        BoundouUtils.showError(`Erreur de sélection des colonnes: ${error.message}`);
    }
}

// Generate checkboxes for column selection
function generateColumnCheckboxes(entityType, headers) {
    try {
        const grid = document.getElementById(`grid-${entityType}`);
        if (!grid) {
            console.warn(`Grid not found for ${entityType} - this is expected if no data exists for this entity type`);
            return;
        }
        
        console.log(`DEBUG: Generating ${headers.length} checkboxes for ${entityType}`);
        
        // Clear existing content
        grid.innerHTML = '';
        
        if (!headers || headers.length === 0) {
            grid.innerHTML = '<p>Aucune colonne disponible</p>';
            return;
        }
        
        headers.forEach((header, index) => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'column-checkbox';
            
            const checkboxId = `col-${entityType}-${index}`;
            
            checkboxDiv.innerHTML = `
                <input type="checkbox" id="${checkboxId}" value="${header}" checked>
                <label for="${checkboxId}">${header}</label>
            `;
            
            grid.appendChild(checkboxDiv);
        });
        
        console.log(`DEBUG: Generated ${grid.children.length} checkboxes for ${entityType}`);
        
    } catch (error) {
        console.error(`Error generating checkboxes for ${entityType}:`, error);
        BoundouUtils.showError(`Erreur lors de la génération des cases à cocher pour ${entityType}`);
    }
}

// Setup entity tab switching
function setupEntityTabs() {
    console.log('DEBUG: Setting up entity tabs');
    
    // Be very specific about which elements we're targeting
    const tabButtons = document.querySelectorAll('#columnSelectionIndividual .entity-tab-button');
    const columnLists = document.querySelectorAll('#columnSelectionIndividual .column-list');
    
    console.log('DEBUG: Found', tabButtons.length, 'tab buttons and', columnLists.length, 'column lists');
    
    // Remove any existing event listeners to prevent duplicates
    tabButtons.forEach((button, index) => {
        button.onclick = null;
        console.log(`DEBUG: Setting up tab button ${index}:`, button.getAttribute('data-entity'));
    });
    
    tabButtons.forEach((button, index) => {
        button.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('DEBUG: Tab clicked:', button.getAttribute('data-entity'));
            
            try {
                console.log('DEBUG: Tab switching logic started');
                
                // Remove active class from all tabs in this specific container only
                tabButtons.forEach((btn, idx) => {
                    btn.classList.remove('active');
                    console.log(`DEBUG: Removed active from button ${idx}`);
                });
                
                columnLists.forEach((list, idx) => {
                    list.style.display = 'none';
                    console.log(`DEBUG: Hid column list ${idx}`);
                });
                
                // Activate clicked tab
                button.classList.add('active');
                console.log('DEBUG: Added active class to clicked button');
                
                const entityType = button.getAttribute('data-entity');
                const targetList = document.getElementById(`columns-${entityType}`);
                
                console.log('DEBUG: Switching to entity type:', entityType);
                console.log('DEBUG: Target list found:', !!targetList);
                console.log('DEBUG: Button has active class:', button.classList.contains('active'));
                
                if (targetList) {
                    targetList.style.display = 'block';
                    console.log('DEBUG: Successfully switched to', entityType);
                    
                    // Force a style recalculation to ensure the active class is applied
                    button.offsetHeight;
                } else {
                    console.error('DEBUG: Target list not found for', entityType);
                }
            } catch (error) {
                console.error('Error in tab switching:', error);
                BoundouUtils.showError('Erreur lors du changement d\'onglet');
            }
            
            return false;
        };
    });
    
    console.log('DEBUG: Entity tabs setup complete');
}

// Setup column validation
function setupColumnValidation() {
    try {
        const validateBtn = document.getElementById('validateColumns');
        const resetBtn = document.getElementById('resetColumns');
        
        if (validateBtn) {
            validateBtn.onclick = function(e) {
                e.preventDefault();
                validateColumnSelection();
            };
        }
        
        if (resetBtn) {
            resetBtn.onclick = function(e) {
                e.preventDefault();
                resetColumnSelection();
            };
        }
        
        console.log('DEBUG: Column validation setup complete');
        
    } catch (error) {
        console.error('Error setting up column validation:', error);
    }
}

// Validate column selection and show preview
function validateColumnSelection() {
    try {
        const selectedColumns = getSelectedColumns();
        
        // Check if at least one column is selected for each entity with data
        const data = window.BoundouDashboard.processedIndividualData;
        let hasValidSelection = false;
        
        ['personne_physique', 'personne_morale', 'groupement'].forEach(entityType => {
            if (data[entityType]?.length > 0 && selectedColumns[entityType]?.length > 0) {
                hasValidSelection = true;
            }
        });
        
        if (!hasValidSelection) {
            BoundouUtils.showError('Veuillez sélectionner au moins une colonne pour chaque type d\'entité contenant des données.');
            return;
        }
        
        // Store selected columns
        window.BoundouDashboard.selectedColumns = selectedColumns;
        
        // Display preview with selected columns
        displayIndividualPreview();
        
        // Hide column selection and show preview
        document.getElementById('columnSelectionIndividual').style.display = 'none';
        
        BoundouUtils.showSuccess('Colonnes sélectionnées avec succès. Vérifiez la prévisualisation ci-dessous.');
        
    } catch (error) {
        BoundouUtils.showError(`Erreur de validation: ${error.message}`);
    }
}

// Get selected columns for all entity types
function getSelectedColumns() {
    const selectedColumns = {};
    
    ['personne_physique', 'personne_morale', 'groupement'].forEach(entityType => {
        const checkboxes = document.querySelectorAll(`#grid-${entityType} input[type="checkbox"]:checked`);
        selectedColumns[entityType] = Array.from(checkboxes).map(cb => cb.value);
    });
    
    return selectedColumns;
}

// Reset column selection
function resetColumnSelection() {
    ['personne_physique', 'personne_morale', 'groupement'].forEach(entityType => {
        const checkboxes = document.querySelectorAll(`#grid-${entityType} input[type="checkbox"]`);
        checkboxes.forEach(cb => cb.checked = true);
    });
    
    BoundouUtils.showSuccess('Sélection des colonnes réinitialisée.');
}

// Select all columns for an entity type
function selectAllColumns(entityType) {
    const checkboxes = document.querySelectorAll(`#grid-${entityType} input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.checked = true);
    
    BoundouUtils.showSuccess(`Toutes les colonnes sélectionnées pour ${entityType}.`);
}

// Deselect all columns for an entity type
function deselectAllColumns(entityType) {
    const checkboxes = document.querySelectorAll(`#grid-${entityType} input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.checked = false);
    
    BoundouUtils.showSuccess(`Toutes les colonnes désélectionnées pour ${entityType}.`);
}

// Display advanced processing options
function displayAdvancedOptions() {
    const advancedSection = document.getElementById('advancedOptionsIndividual');
    const statsSection = document.getElementById('statisticsSection');
    
    if (advancedSection) {
        advancedSection.style.display = 'block';
        console.log('Advanced options section displayed');
    }
    
    if (statsSection) {
        statsSection.style.display = 'block';
        console.log('Statistics section displayed');
    }
    
    // Enable statistics button
    const statsButton = document.getElementById('generateStats');
    if (statsButton) {
        statsButton.disabled = false;
        console.log('Statistics button enabled');
    }
}

// Setup collective statistics button event handler
function setupCollectiveStatsHandler() {
    const collectiveStatsButton = document.getElementById('generateCollectiveStats');
    console.log('🔍 Setting up collective stats handler for button:', collectiveStatsButton);
    console.log('🔍 Button exists:', !!collectiveStatsButton);
    console.log('🔍 Button innerHTML:', collectiveStatsButton?.innerHTML);
    console.log('🔍 Button disabled:', collectiveStatsButton?.disabled);
    
    if (collectiveStatsButton) {
        console.log('✅ Collective stats button found, adding event listener');
        
        // Remove any existing event listeners
        collectiveStatsButton.onclick = null;
        
        // Remove existing event listeners
        const newButton = collectiveStatsButton.cloneNode(true);
        collectiveStatsButton.parentNode.replaceChild(newButton, collectiveStatsButton);
        
        // Add new event listener to the fresh button
        const freshButton = document.getElementById('generateCollectiveStats');
        
        freshButton.addEventListener('click', function(event) {
            console.log('🔥 Collective stats button clicked!');
            console.log('🔍 Event:', event);
            console.log('🔍 Button disabled state at click:', this.disabled);
            console.log('🔍 Button classList:', this.classList.toString());
            
            // Prevent default action
            event.preventDefault();
            event.stopPropagation();
            
            if (!this.disabled) {
                console.log('✅ Button enabled, calling generateCollectiveStatisticsReport...');
                try {
                    generateCollectiveStatisticsReport();
                } catch (error) {
                    console.error('❌ Error calling generateCollectiveStatisticsReport:', error);
                }
            } else {
                console.log('❌ Button disabled, cannot generate statistics');
            }
        });
        
        console.log('✅ Event listener added to fresh collective stats button');
    } else {
        console.log('❌ Collective stats button not found during handler setup!');
    }
}

// TEST FUNCTION - Call this from console to test the button manually
window.testCollectiveStatsButton = function() {
    console.log('🧪 Testing collective stats button...');
    const button = document.getElementById('generateCollectiveStats');
    console.log('🔍 Button found:', !!button);
    console.log('🔍 Button disabled:', button?.disabled);
    console.log('🔍 Collective data available:', !!window.BoundouDashboard?.processedCollectiveData);
    console.log('🔍 Data length:', window.BoundouDashboard?.processedCollectiveData?.length);
    
    if (button && !button.disabled) {
        console.log('🔥 Manually triggering button click...');
        button.click();
    } else {
        console.log('❌ Button not available or disabled');
    }
    
    // Also try calling the function directly
    console.log('🔥 Calling generateCollectiveStatisticsReport directly...');
    try {
        generateCollectiveStatisticsReport();
    } catch (error) {
        console.error('❌ Error calling function directly:', error);
    }
};

// Setup event handlers for advanced options
function setupAdvancedOptionsHandlers() {
    // Toggle dual lists option
    const dualListsCheckbox = document.getElementById('enableDualLists');
    if (dualListsCheckbox) {
        dualListsCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            console.log('Dual lists generation:', isEnabled ? 'enabled' : 'disabled');
            
            // Store setting in global state
            if (!window.BoundouDashboard.advancedOptions) {
                window.BoundouDashboard.advancedOptions = {};
            }
            window.BoundouDashboard.advancedOptions.enableDualLists = isEnabled;
            
            // Update UI feedback
            if (isEnabled) {
                console.log('✅ Advanced Option: Génération de listes séparées Habitat/Agricole activée');
            }
        });
    }

    // Toggle mandataire separation option
    const mandataireCheckbox = document.getElementById('enableMandataireSeparation');
    if (mandataireCheckbox) {
        mandataireCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            console.log('Mandataire separation:', isEnabled ? 'enabled' : 'disabled');
            
            // Store setting in global state
            if (!window.BoundouDashboard.advancedOptions) {
                window.BoundouDashboard.advancedOptions = {};
            }
            window.BoundouDashboard.advancedOptions.enableMandataireSeparation = isEnabled;
            
            // Enable/disable age threshold input
            const ageInput = document.getElementById('ageThreshold');
            if (ageInput) {
                ageInput.disabled = !isEnabled;
            }
            
            if (isEnabled) {
                console.log('✅ Advanced Option: Séparation des mandataires par âge activée');
            }
        });
    }

    // Handle age threshold changes
    const ageThresholdInput = document.getElementById('ageThreshold');
    if (ageThresholdInput) {
        ageThresholdInput.addEventListener('change', function() {
            const threshold = parseInt(this.value);
            if (threshold && threshold > 0) {
                if (!window.BoundouDashboard.advancedOptions) {
                    window.BoundouDashboard.advancedOptions = {};
                }
                window.BoundouDashboard.advancedOptions.ageThreshold = threshold;
                console.log('Age threshold set to:', threshold);
            }
        });
    }

    // Date normalization toggle
    const dateNormalizationCheckbox = document.getElementById('enableDateNormalization');
    if (dateNormalizationCheckbox) {
        dateNormalizationCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            if (!window.BoundouDashboard.advancedOptions) {
                window.BoundouDashboard.advancedOptions = {};
            }
            window.BoundouDashboard.advancedOptions.enableDateNormalization = isEnabled;
            console.log('Date normalization:', isEnabled ? 'enabled' : 'disabled');
        });
    }

    // Statistics generation button (Individual)
    const statsButton = document.getElementById('generateStats');
    if (statsButton) {
        statsButton.addEventListener('click', function() {
            if (!this.disabled) {
                generateStatisticsReport();
            }
        });
    }

    // Statistics generation button (Collective)
    const collectiveStatsButton = document.getElementById('generateCollectiveStats');
    console.log('🔍 Looking for collective stats button:', collectiveStatsButton);
    console.log('🔍 Button exists:', !!collectiveStatsButton);
    console.log('🔍 Button innerHTML:', collectiveStatsButton?.innerHTML);
    console.log('🔍 Button disabled:', collectiveStatsButton?.disabled);
    console.log('🔍 Button style.display:', collectiveStatsButton?.style.display);
    
    if (collectiveStatsButton) {
        console.log('✅ Collective stats button found, adding event listener');
        
        // Remove any existing event listeners
        collectiveStatsButton.onclick = null;
        
        // Add new event listener
        collectiveStatsButton.addEventListener('click', function(event) {
            console.log('🔥 Collective stats button clicked!');
            console.log('🔍 Event:', event);
            console.log('🔍 Button disabled state at click:', this.disabled);
            console.log('🔍 Button classList:', this.classList.toString());
            
            // Prevent default action
            event.preventDefault();
            event.stopPropagation();
            
            if (!this.disabled) {
                console.log('✅ Button enabled, calling generateCollectiveStatisticsReport...');
                try {
                    generateCollectiveStatisticsReport();
                } catch (error) {
                    console.error('❌ Error calling generateCollectiveStatisticsReport:', error);
                }
            } else {
                console.log('❌ Button disabled, cannot generate statistics');
            }
        });
        
        // Also add onclick for backup
        collectiveStatsButton.onclick = function(event) {
            console.log('🔥 Collective stats button onclick triggered!');
            event.preventDefault();
            event.stopPropagation();
            
            if (!this.disabled) {
                console.log('✅ Button enabled (onclick), calling generateCollectiveStatisticsReport...');
                try {
                    generateCollectiveStatisticsReport();
                } catch (error) {
                    console.error('❌ Error in onclick handler:', error);
                }
            }
        };
        
        console.log('✅ Event listeners added to collective stats button');
    } else {
        console.log('❌ Collective stats button not found!');
        
        // Try to find it by class or other means
        const buttonByClass = document.querySelector('.btn[id="generateCollectiveStats"]');
        const buttonByText = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Générer les Statistiques Collectives')
        );
        
        console.log('🔍 Button by class:', buttonByClass);
        console.log('🔍 Button by text:', buttonByText);
    }

    console.log('Advanced options handlers setup complete');
}

// Generate comprehensive statistics report
function generateStatisticsReport() {
    try {
        BoundouUtils.showLoading('loadingIndicator', 'Génération des statistiques...');
        
        const data = window.BoundouDashboard.processedIndividualData;
        const collectiveData = window.BoundouDashboard.processedCollectiveData;
        
        if (!data && !collectiveData) {
            throw new Error('Aucune donnée à analyser');
        }

        // Calculate statistics
        const stats = calculateComprehensiveStats(data, collectiveData);
        
        // Generate and download statistics Excel file
        const statsExcel = BoundouExcelGenerator.generateStatisticsExcel(stats);
        
        BoundouUtils.hideLoading('loadingIndicator');
        BoundouUtils.showSuccess('Rapport de statistiques généré avec succès!');
        
        console.log('Statistics report generated:', stats);
        
    } catch (error) {
        BoundouUtils.hideLoading('loadingIndicator');
        BoundouUtils.showError(`Erreur génération statistiques: ${error.message}`);
        console.error('Statistics generation error:', error);
    }
}

// Generate collective-only statistics report
function generateCollectiveStatisticsReport() {
    console.log('🔥 generateCollectiveStatisticsReport called!');
    
    try {
        BoundouUtils.showLoading('loadingIndicator', 'Génération des statistiques collectives...');
        
        console.log('🔍 Checking collective data availability...');
        console.log('window.BoundouDashboard:', window.BoundouDashboard);
        
        const collectiveData = window.BoundouDashboard.processedCollectiveData;
        console.log('📊 Collective data:', collectiveData);
        console.log('📊 Collective data length:', collectiveData ? collectiveData.length : 'undefined');
        
        if (!collectiveData || collectiveData.length === 0) {
            console.error('❌ No collective data available');
            throw new Error('Aucune donnée collective à analyser');
        }

        console.log('✅ Collective data found, calculating statistics...');
        
        // Calculate collective-only statistics
        const stats = {
            summary: {
                totalIndividualParcels: 0,
                totalCollectiveParcels: collectiveData.length,
                totalRecords: collectiveData.length,
                processingDate: new Date().toLocaleString('fr-FR')
            },
            individual: {},
            collective: calculateCollectiveStats(collectiveData),
            combined: {}
        };
        
        console.log('📈 Statistics calculated:', stats);
        
        // Generate and download statistics Excel file
        console.log('📁 Generating Excel file...');
        const statsExcel = BoundouExcelGenerator.generateStatisticsExcel(stats);
        
        BoundouUtils.hideLoading('loadingIndicator');
        BoundouUtils.showSuccess('Rapport de statistiques collectives généré avec succès!');
        
        console.log('✅ Collective statistics report generated successfully:', stats);
        
    } catch (error) {
        BoundouUtils.hideLoading('loadingIndicator');
        BoundouUtils.showError(`Erreur génération statistiques collectives: ${error.message}`);
        console.error('❌ Collective statistics generation error:', error);
        console.error('❌ Error stack:', error.stack);
    }
}

// Calculate comprehensive statistics from processed data
function calculateComprehensiveStats(individualData, collectiveData) {
    const stats = {
        summary: {
            totalIndividualParcels: 0,
            totalCollectiveParcels: 0,
            totalRecords: 0,
            processingDate: new Date().toLocaleString('fr-FR')
        },
        individual: {},
        collective: {},
        combined: {}
    };

    // Calculate individual data statistics
    if (individualData) {
        stats.individual = calculateIndividualStats(individualData);
        stats.summary.totalIndividualParcels = 
            (individualData.personne_physique?.length || 0) +
            (individualData.personne_morale?.length || 0) +
            (individualData.groupement?.length || 0);
    }

    // Calculate collective data statistics
    if (collectiveData) {
        stats.collective = calculateCollectiveStats(collectiveData);
        stats.summary.totalCollectiveParcels = collectiveData.length || 0;
    }

    stats.summary.totalRecords = stats.summary.totalIndividualParcels + stats.summary.totalCollectiveParcels;

    return stats;
}

// Calculate statistics for individual data
function calculateIndividualStats(data) {
    const stats = {
        totalParcels: 0,
        byEntityType: {},
        byUsageType: {},
        byDocumentType: {},
        byAgeGroup: {},
        byMoraleType: {}
    };

    // Process each entity type
    ['personne_physique', 'personne_morale', 'groupement'].forEach(entityType => {
        const entities = data[entityType] || [];
        stats.byEntityType[entityType] = entities.length;
        stats.totalParcels += entities.length;

        // Group by usage type
        entities.forEach(entity => {
            const usageType = entity.type_usag || 'Non spécifié';
            
            if (!stats.byUsageType[usageType]) {
                stats.byUsageType[usageType] = 0;
            }
            stats.byUsageType[usageType]++;

            // Group by document type (for person entities)
            if (entityType === 'personne_physique') {
                const docType = entity.Type_piece || 'Non spécifié';
                
                if (!stats.byDocumentType[docType]) {
                    stats.byDocumentType[docType] = 0;
                }
                stats.byDocumentType[docType]++;

                // Calculate age if birth date is available
                const birthDate = entity.Date_naiss;
                if (birthDate) {
                    const age = calculateAge(birthDate);
                    if (age !== null) {
                        const ageThreshold = window.BoundouDashboard.advancedOptions?.ageThreshold || 15;
                        const ageCategory = age <= ageThreshold ? 'Mineur' : 'Majeur';
                        
                        if (!stats.byAgeGroup[ageCategory]) {
                            stats.byAgeGroup[ageCategory] = 0;
                        }
                        stats.byAgeGroup[ageCategory]++;
                    }
                }
            }

            // Group by morale person type (for personne_morale entities)
            if (entityType === 'personne_morale') {
                const moraleType = entity.Typ_pers_m || 'Non spécifié';
                
                if (!stats.byMoraleType[moraleType]) {
                    stats.byMoraleType[moraleType] = 0;
                }
                stats.byMoraleType[moraleType]++;
            }
        });
    });

    return stats;
}

// Calculate statistics for collective data
function calculateCollectiveStats(data) {
    console.log('🔍 DEBUG: calculateCollectiveStats called with data:', data);
    console.log('🔍 DEBUG: Data length:', data?.length);
    
    if (!data || !Array.isArray(data)) {
        console.error('❌ Invalid data passed to calculateCollectiveStats:', data);
        return {
            totalParcels: 0,
            byUsageType: {},
            byDocumentType: {},
            byAgeGroup: {},
            totalAffectataires: 0
        };
    }

    const stats = {
        totalParcels: data.length,
        byUsageType: {},
        byDocumentType: {},
        byAgeGroup: {},
        totalAffectataires: 0
    };

    data.forEach((parcel, index) => {
        console.log(`🔍 DEBUG: Processing parcel ${index}:`, parcel);
        
        // Count usage types (both type_usa and type_usag fields)
        const usageType = parcel.type_usa || parcel.type_usag || 'Non spécifié';
        console.log(`🔍 DEBUG: Usage type for parcel ${index}:`, usageType);
        
        if (!stats.byUsageType[usageType]) {
            stats.byUsageType[usageType] = 0;
        }
        stats.byUsageType[usageType]++;

        // Count document types (field: Type_piec)
        const docType = parcel.Type_piec || 'Non spécifié';
        console.log(`🔍 DEBUG: Document type for parcel ${index}:`, docType);
        
        if (!stats.byDocumentType[docType]) {
            stats.byDocumentType[docType] = 0;
        }
        stats.byDocumentType[docType]++;

        // Calculate age of mandataire (using Date_nai field)
        const mandataireBirthDate = parcel.Date_nai;
        console.log(`🔍 DEBUG: Birth date for parcel ${index}:`, mandataireBirthDate);
        if (mandataireBirthDate) {
            const age = calculateAge(mandataireBirthDate);
            console.log(`🔍 DEBUG: Calculated age for parcel ${index}:`, age);
            if (age !== null) {
                const ageThreshold = window.BoundouDashboard.advancedOptions?.ageThreshold || 15;
                const ageCategory = age <= ageThreshold ? 'Mineur' : 'Majeur';
                
                if (!stats.byAgeGroup[ageCategory]) {
                    stats.byAgeGroup[ageCategory] = 0;
                }
                stats.byAgeGroup[ageCategory]++;
            }
        }

        // Count affectataires (count newlines in multi-person fields)
        const prenoms = parcel.Prenom || '';
        console.log(`🔍 DEBUG: Prenoms for parcel ${index}:`, prenoms);
        const affectataireCount = prenoms.split('\n').filter(p => p.trim()).length;
        console.log(`🔍 DEBUG: Affectataire count for parcel ${index}:`, affectataireCount);
        stats.totalAffectataires += affectataireCount;
    });

    console.log('🔍 DEBUG: Final stats:', stats);
    return stats;
}

// Calculate age from birth date
function calculateAge(birthDate) {
    if (!birthDate) return null;
    
    let date;
    
    // Handle different date formats
    if (typeof birthDate === 'string') {
        // Try to parse formatted date (DD/MM/YYYY)
        if (birthDate.includes('/')) {
            const parts = birthDate.split('/');
            if (parts.length === 3) {
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        } else {
            date = new Date(birthDate);
        }
    } else {
        date = new Date(birthDate);
    }
    
    if (!date || isNaN(date)) return null;
    
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
    }
    
    return Math.max(0, age);
}

// Enable statistics button after successful processing
function enableStatisticsGeneration() {
    const statsButton = document.getElementById('generateStats');
    const statsSection = document.getElementById('statisticsSection');
    
    if (statsButton) {
        statsButton.disabled = false;
        statsButton.style.opacity = '1';
    }
    
    if (statsSection) {
        statsSection.style.display = 'block';
    }
    
    console.log('✅ Statistics generation enabled and section displayed');
}

// Export functions for external use
window.DeliberationListUI = {
    initializeDeliberationHandlers,
    displayIndividualPreview,
    displayCollectivePreview,
    togglePreviewExpansion,
    exportEntityPreview,
    displayColumnSelection,
    displayAdvancedOptions,
    setupAdvancedOptionsHandlers,
    generateStatisticsReport,
    enableStatisticsGeneration,
    selectAllColumns,
    deselectAllColumns,
    validateColumnSelection,
    resetColumnSelection
};
