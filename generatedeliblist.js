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
                                        ${headers.map(header => `<th>${header}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${previewData.map(row => `
                                        <tr>
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
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${previewData.map(row => `
                            <tr>
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
        
        // Update entity counts
        const countElements = {
            'personne_physique': document.getElementById('count-personne_physique'),
            'personne_morale': document.getElementById('count-personne_morale'),
            'groupement': document.getElementById('count-groupement')
        };
        
        Object.keys(countElements).forEach(entityType => {
            const element = countElements[entityType];
            if (element) {
                element.textContent = data[entityType]?.length || 0;
            }
        });
        
        // Generate column checkboxes for each entity type
        const entityTypes = ['personne_physique', 'personne_morale', 'groupement'];
        
        entityTypes.forEach(entityType => {
            const entityData = data[entityType] || [];
            if (entityData.length > 0) {
                const headers = Object.keys(entityData[0]).filter(h => h !== 'Typ_pers' && h !== 'Typ_pers_m');
                console.log(`DEBUG: Generating checkboxes for ${entityType}:`, headers.length, 'columns');
                generateColumnCheckboxes(entityType, headers);
            }
        });
        
        // Show the column selection section
        columnSection.style.display = 'block';
        
        // Make sure we show the first tab by default
        const firstTab = columnSection.querySelector('.entity-tab-button[data-entity="personne_physique"]');
        const firstColumnList = columnSection.querySelector('#columns-personne_physique');
        
        if (firstTab && firstColumnList) {
            firstTab.classList.add('active');
            firstColumnList.style.display = 'block';
        }
        
        // Setup tab switching with delay to ensure DOM is ready
        setTimeout(() => {
            setupEntityTabs();
            setupColumnValidation();
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
            console.error(`Grid not found for ${entityType}`);
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

// Export functions for external use
window.DeliberationListUI = {
    initializeDeliberationHandlers,
    displayIndividualPreview,
    displayCollectivePreview,
    togglePreviewExpansion,
    exportEntityPreview,
    displayColumnSelection,
    selectAllColumns,
    deselectAllColumns,
    validateColumnSelection,
    resetColumnSelection
};
