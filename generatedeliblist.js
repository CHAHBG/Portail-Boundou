// === Boundou Deliberation List Generator ===
// Module pour la gestion des fichiers Excel et la génération des listes de délibérations

// Colonnes à conserver pour les fichiers collectifs (les fichiers individuels incluent toutes les colonnes sauf celles avec _001, _002, etc.)
const colonnesAConserver = [
    'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Date_naiss',
    'superficie', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'Sexe'
];

// Initialisation des gestionnaires d'événements
function initializeDeliberationHandlers() {
    const uploadSectionIndividual = document.getElementById('uploadSectionIndividual');
    const uploadSectionCollective = document.getElementById('uploadSectionCollective');
    const fileInputIndividual = document.getElementById('individual-file');
    const fileInputCollective = document.getElementById('collective-file');

    if (!uploadSectionIndividual || !uploadSectionCollective || !fileInputIndividual || !fileInputCollective) {
        console.error('Éléments nécessaires pour le drag & drop non trouvés');
        window.BoundouDashboard.showToast('Erreur : conteneur de téléchargement non trouvé', 'error');
        return;
    }

    // Configuration du drag & drop pour individuel et collectif
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadSectionIndividual.addEventListener(eventName, preventDefaults, false);
        uploadSectionCollective.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadSectionIndividual.addEventListener(eventName, () => highlight('individual'), false);
        uploadSectionCollective.addEventListener(eventName, () => highlight('collective'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadSectionIndividual.addEventListener(eventName, () => unhighlight('individual'), false);
        uploadSectionCollective.addEventListener(eventName, () => unhighlight('collective'), false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(type) {
        document.getElementById(`uploadSection${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.add('dragover');
    }

    function unhighlight(type) {
        document.getElementById(`uploadSection${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.remove('dragover');
    }

    uploadSectionIndividual.addEventListener('drop', (e) => handleDrop(e, 'individual'), false);
    uploadSectionCollective.addEventListener('drop', (e) => handleDrop(e, 'collective'), false);

    function handleDrop(e, type) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, type);
    }

    // Gestion des fichiers via input
    fileInputIndividual.addEventListener('change', (e) => handleFiles(e.target.files, 'individual'));
    fileInputCollective.addEventListener('change', (e) => handleFiles(e.target.files, 'collective'));
}

function handleFiles(files, type) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        window.BoundouDashboard.showToast('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)', 'error');
        return;
    }

    document.getElementById(`fileName${type.charAt(0).toUpperCase() + type.slice(1)}`).textContent = `📄 ${file.name}`;
    window.BoundouDashboard.loadExcelFile(file, type);
}

function displayFileInfo(data, type) {
    if (!['individual', 'collective'].includes(type)) {
        console.error('Type de fichier invalide:', type);
        window.BoundouDashboard.showToast('Erreur : type de fichier invalide', 'error');
        return;
    }

    if (!data || data.length === 0) {
        window.BoundouDashboard.showToast('Aucune donnée valide trouvée dans le fichier', 'error');
        return;
    }

    const headers = data[0];
    const dataRows = data.slice(1);
    const validCount = type === 'individual' ? window.BoundouDashboard.processedIndividualData.length : window.BoundouDashboard.processedCollectiveData.length;

    const infoHtml = `
        <div class="info-section">
            <h3>📊 Informations du fichier</h3>
            <div class="stats">
                <div class="stat-card">
                    <h3>${dataRows.length}</h3>
                    <p>Lignes de données</p>
                </div>
                <div class="stat-card">
                    <h3>${validCount}</h3>
                    <p>Parcelles valides</p>
                </div>
                <div class="stat-card">
                    <h3>${headers.length}</h3>
                    <p>Colonnes</p>
                </div>
            </div>
            <div class="columns-list">
                <h4>Colonnes disponibles :</h4>
                ${headers.map(col => `<span class="column-item">${col || 'Sans nom'}</span>`).join('')}
            </div>
        </div>
    `;
    const fileInfo = document.getElementById(`fileInfo${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (fileInfo) {
        fileInfo.innerHTML = infoHtml;
        fileInfo.style.cssText = 'display: block !important;';
    }
}

function displayResults(totalRows, validCount, errorCount, collectiveErrors = [], type) {
    if (!['individual', 'collective'].includes(type)) {
        console.error('Type de fichier invalide:', type);
        window.BoundouDashboard.showToast('Erreur : type de fichier invalide', 'error');
        return;
    }

    let errorsHtml = '';
    if (type === 'collective' && collectiveErrors.length > 0) {
        errorsHtml = `
            <div class="error-details">
                <h4>⚠️ Parcelles exclues (moins de 2 individus) :</h4>
                <ul>
                    ${collectiveErrors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    const resultsHtml = `
        <div class="results-section">
            <h3>✅ Traitement terminé</h3>
            <div class="stats">
                <div class="stat-card">
                    <h3>${totalRows}</h3>
                    <p>Parcelles traitées</p>
                </div>
                <div class="stat-card">
                    <h3>${validCount}</h3>
                    <p>Parcelles valides</p>
                </div>
                <div class="stat-card">
                    <h3>${errorCount}</h3>
                    <p>Parcelles avec erreurs</p>
                </div>
            </div>
            ${errorsHtml}
        </div>
    `;
    const results = document.getElementById(`results${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (results) {
        results.innerHTML = resultsHtml;
        results.style.cssText = 'display: block !important;';
    }
    // Note: displayPreview is now called separately after data processing
}

function displayPreview(type) {
    if (!type || !['individual', 'collective'].includes(type)) {
        console.error('Type de fichier invalide:', type);
        window.BoundouDashboard.showToast('Erreur : type de fichier invalide pour l\'aperçu', 'error');
        return;
    }

    const data = type === 'individual' ? window.BoundouDashboard.processedIndividualData : window.BoundouDashboard.processedCollectiveData;
    
    if (!data || data.length === 0) {
        console.warn('Aucune donnée pour l\'aperçu');
        window.BoundouDashboard.showToast('Aucune donnée à afficher dans l\'aperçu', 'warning');
        return;
    }

    if (type === 'individual') {
        displayIndividualPreview(data);
    } else {
        displayCollectivePreview(data);
    }
}

function displayIndividualPreview(data) {
    // For individual files, show preview of all three types
    const personnesPhysiques = data.filter(row => 
        row['Typ_pers'] && row['Typ_pers'].toLowerCase().includes('personne_physique')
    );
    
    const personnesMorales = data.filter(row => 
        row['Typ_pers'] && row['Typ_pers'].toLowerCase().includes('personne_morale')
    );

    const groupements = data.filter(row => 
        row['Typ_pers_m'] && row['Typ_pers_m'].toLowerCase().includes('groupement')
    );

    let previewHtml = '<div class="info-section">';
    
    // Preview for Personnes Physiques
    if (personnesPhysiques.length > 0) {
        const physiquesColumns = [
            'Village', 'Prenom', 'Nom', 'Sexe', 'Date_naiss', 'Num_piece', 
            'Telephone', 'Vocation', 'type_usag', 'superficie', 'nicad'
        ];
        const availablePhysiquesColumns = physiquesColumns.filter(col => 
            personnesPhysiques.some(row => row.hasOwnProperty(col) && row[col] !== undefined && row[col] !== '')
        );
        
        previewHtml += `
            <h3>👤 Aperçu Personnes Physiques (${Math.min(5, personnesPhysiques.length)} premières)</h3>
            <div class="preview-scroll">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${availablePhysiquesColumns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        personnesPhysiques.slice(0, 5).forEach(row => {
            previewHtml += '<tr>';
            availablePhysiquesColumns.forEach(col => {
                const value = row[col] || '-';
                const displayValue = typeof value === 'string' && value.length > 30 ? value.substring(0, 30) + '...' : value;
                previewHtml += `<td title="${value}">${displayValue}</td>`;
            });
            previewHtml += '</tr>';
        });
        
        previewHtml += '</tbody></table></div>';
    }
    
    // Preview for Personnes Morales
    if (personnesMorales.length > 0) {
        const moralesColumns = [
            'Village', 'Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 
            'Numero', 'Mandataire', 'Telephone_001', 'Adresse'
        ];
        const availableMoralesColumns = moralesColumns.filter(col => 
            personnesMorales.some(row => row.hasOwnProperty(col) && row[col] !== undefined && row[col] !== '')
        );
        
        previewHtml += `
            <h3>🏢 Aperçu Personnes Morales (${Math.min(5, personnesMorales.length)} premières)</h3>
            <div class="preview-scroll">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${availableMoralesColumns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        personnesMorales.slice(0, 5).forEach(row => {
            previewHtml += '<tr>';
            availableMoralesColumns.forEach(col => {
                const value = row[col] || '-';
                const displayValue = typeof value === 'string' && value.length > 30 ? value.substring(0, 30) + '...' : value;
                previewHtml += `<td title="${value}">${displayValue}</td>`;
            });
            previewHtml += '</tr>';
        });
        
        previewHtml += '</tbody></table></div>';
    }
    
    // Preview for Groupements
    if (groupements.length > 0) {
        const groupementColumns = [
            'Village', 'Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 
            'Numero', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad'
        ];
        const availableGroupementColumns = groupementColumns.filter(col => 
            groupements.some(row => row.hasOwnProperty(col) && row[col] !== undefined && row[col] !== '')
        );
        
        previewHtml += `
            <h3>🏛️ Aperçu Groupements (${Math.min(5, groupements.length)} premières)</h3>
            <div class="preview-scroll">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${availableGroupementColumns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        groupements.slice(0, 5).forEach(row => {
            previewHtml += '<tr>';
            availableGroupementColumns.forEach(col => {
                const value = row[col] || '-';
                const displayValue = typeof value === 'string' && value.length > 30 ? value.substring(0, 30) + '...' : value;
                previewHtml += `<td title="${value}">${displayValue}</td>`;
            });
            previewHtml += '</tr>';
        });
        
        previewHtml += '</tbody></table></div>';
    }
    
    previewHtml += `
        <div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 5px;">
            <strong>📋 Structure du fichier généré :</strong><br>
            <small>• Trois feuilles Excel séparées selon le type d'entité<br>
            • Feuille 1: "Personnes physiques" (${personnesPhysiques.length} enregistrements)<br>
            • Feuille 2: "Personne Morale" (${personnesMorales.length} enregistrements)<br>
            • Feuille 3: "Groupement" (${groupements.length} enregistrements)</small>
        </div>
    </div>`;
    
    const previewDiv = document.getElementById('previewIndividual');
    if (previewDiv) {
        previewDiv.innerHTML = previewHtml;
        previewDiv.style.cssText = 'display: block !important;';
    } else {
        console.error('Element previewIndividual non trouvé');
        window.BoundouDashboard.showToast('Erreur : conteneur d\'aperçu non trouvé', 'error');
    }
}

function displayCollectivePreview(data) {
    const previewData = data.slice(0, 5);
    const columns = getOrderedColumns(data);
    
    // Check if this is collective data (has multi-line values)
    const isCollectiveData = data.some(row => 
        row.Prenom && typeof row.Prenom === 'string' && row.Prenom.includes('\n')
    );

    let tableHtml = `
        <div class="info-section">
            <h3>👀 Aperçu des données (5 premières lignes)</h3>
            <p><strong>Format de sortie :</strong> Chaque parcelle sur une ligne avec tous les individus en colonnes séparées</p>
            <div class="preview-scroll">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    previewData.forEach(row => {
        tableHtml += '<tr>';
        columns.forEach(col => {
            const value = row[col] || '-';
            // Handle both individual (no newlines) and collective (with newlines) data
            let displayValue = value;
            if (typeof value === 'string' && value.includes('\n')) {
                // For collective data with multiple values
                displayValue = value.split('\n')[0] + '...';
            } else if (typeof value === 'string' && value.length > 30) {
                // For long individual values
                displayValue = value.substring(0, 30) + '...';
            }
            const titleValue = typeof value === 'string' ? value.replace(/\n/g, ', ') : value;
            tableHtml += `<td title="${titleValue}">${displayValue}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += `
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 5px;">
                <strong>📋 Structure du fichier :</strong><br>
                <small>• Chaque ligne = une parcelle<br>
                • Tous les affectataires regroupés dans les mêmes colonnes, séparés par des retours à la ligne<br>
                • Colonnes : ${columns.join(', ')}</small>
            </div>
        </div>
    `;
    
    const previewDiv = document.getElementById('previewCollective');
    if (previewDiv) {
        previewDiv.innerHTML = tableHtml;
        previewDiv.style.cssText = 'display: block !important;';
    } else {
        console.error('Element previewCollective non trouvé');
        window.BoundouDashboard.showToast('Erreur : conteneur d\'aperçu collectif non trouvé', 'error');
    }
}

function getOrderedColumns(data) {
    if (!data || data.length === 0) return [];
    
    // Get all available columns from the first data row
    const allColumns = Object.keys(data[0]);
    
    // Define preferred order for collective files
    const collectiveOrderedColumns = [
        'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Sexe',
        'Numero_piece', 'Telephone', 'Date_naissance', 'Residence',
        'superficie', 'Vocation_1', 'type_usa'
    ];
    
    // Check if this looks like collective data (has consolidated fields like multi-line names)
    const isCollectiveData = data.some(row => 
        row.Prenom && typeof row.Prenom === 'string' && row.Prenom.includes('\n')
    );
    
    if (isCollectiveData) {
        // For collective data, use the predefined order
        const availableColumns = collectiveOrderedColumns.filter(col => allColumns.includes(col));
        console.log('Colonnes disponibles (collective):', availableColumns);
        return availableColumns;
    } else {
        // For individual data, return all available columns in a logical order
        const priorityColumns = [
            'Village', 'Prenom', 'Nom', 'Sexe', 'Date_naiss', 'Num_piece', 'Telephone', 
            'Vocation', 'type_usag', 'superficie', 'nicad', 'Num_parcel', 'Num_parcel_2',
            'Typ_pers', 'Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser',
            'Numero', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse'
        ];
        const orderedColumns = [];
        
        // Add priority columns first if they exist
        priorityColumns.forEach(col => {
            if (allColumns.includes(col)) {
                orderedColumns.push(col);
            }
        });
        
        // Add remaining columns
        allColumns.forEach(col => {
            if (!orderedColumns.includes(col)) {
                orderedColumns.push(col);
            }
        });
        
        console.log('Colonnes disponibles (individual):', orderedColumns);
        return orderedColumns;
    }
}

// Export du module
window.DeliberationListGenerator = {
    initializeDeliberationHandlers,
    handleFiles,
    displayFileInfo,
    displayResults,
    displayPreview,
    displayIndividualPreview,
    displayCollectivePreview,
    colonnesAConserver,
    getOrderedColumns
};
