// === Data Processing Module ===
window.BoundouDataProcessor = (() => {
    'use strict';

    // Filter data based on entity type
    const filterByEntityType = (data, entityType) => {
        switch (entityType) {
            case 'personne_physique':
                return data.filter(row => 
                    row['Typ_pers'] && 
                    row['Typ_pers'].toLowerCase().includes('personne_physique')
                );
            
            case 'personne_morale':
                return data.filter(row => 
                    row['Typ_pers'] && 
                    row['Typ_pers'].toLowerCase().includes('personne_morale') &&
                    !(row['Typ_pers_m'] && row['Typ_pers_m'].toLowerCase().includes('groupement'))
                );
            
            case 'groupement':
                return data.filter(row => 
                    row['Typ_pers_m'] && 
                    row['Typ_pers_m'].toLowerCase().includes('groupement')
                );
            
            default:
                return [];
        }
    };

    // Check if column should be excluded based on patterns
    const shouldExcludeColumn = (columnName) => {
        if (!columnName) return true;
        
        return BoundouConfig.EXCEL.EXCLUDE_PATTERNS.some(pattern => 
            columnName.includes(pattern)
        );
    };

    // Get filtered headers for specific entity type
    const getFilteredHeaders = (allHeaders, entityType) => {
        const configuredColumns = BoundouConfig.EXCEL.COLUMNS[entityType.toUpperCase()];
        
        if (configuredColumns) {
            // Use configured columns if available
            return configuredColumns.filter(header => 
                allHeaders.includes(header) && !shouldExcludeColumn(header)
            );
        }
        
        // Fallback: filter all headers
        return allHeaders.filter(header => 
            !shouldExcludeColumn(header) && 
            !['Typ_pers', 'Typ_pers_m'].includes(header)
        );
    };

    // Process individual data with categorization into entity types
    const processIndividualData = async (data) => {
        try {
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error(BoundouConfig.MESSAGES.ERRORS.NO_DATA);
            }

            BoundouUtils.showLoading('loadingIndicator', BoundouConfig.MESSAGES.INFO.PROCESSING);

            // Define field mappings for each entity type
            const entityFieldMappings = {
                personne_physique: ['Village', 'Prenom', 'Nom', 'Sexe', 'Date_naiss', 'Num_piece', 'Type_piece', 'Telephone', 'Vocation', 'type_usag', 'superficie', 'nicad'],
                personne_morale: ['Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse', 'Typ_pers_m'],
                groupement: ['Village', 'Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'Type_piec', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Vocation', 'type_usa', 'Date_nai', 'Typ_pers_m']
            };

            // Categorize data by entity type
            const categorizedData = {
                personne_physique: [],
                personne_morale: [],
                groupement: []
            };

            // Process data in chunks for better performance
            const processChunk = async (chunk) => {
                chunk.forEach(row => {
                    const rowTypePers = row['Typ_pers'] ? row['Typ_pers'].toLowerCase() : '';
                    const rowTypePersM = row['Typ_pers_m'] ? row['Typ_pers_m'].toLowerCase() : '';

                    // Determine entity type
                    let entityType = null;
                    if (rowTypePers.includes('personne_physique')) {
                        entityType = 'personne_physique';
                    } else if (rowTypePersM.includes('groupement')) {
                        entityType = 'groupement';
                    } else if (rowTypePers.includes('personne_morale')) {
                        entityType = 'personne_morale';
                    }

                    if (entityType && entityFieldMappings[entityType]) {
                        const cleanedRow = {};
                        entityFieldMappings[entityType].forEach(field => {
                            cleanedRow[field] = BoundouUtils.sanitizeForExcel(row[field] || '');
                        });
                        // Keep original type fields for reference
                        cleanedRow['Typ_pers'] = row['Typ_pers'] || '';
                        cleanedRow['Typ_pers_m'] = row['Typ_pers_m'] || '';
                        
                        categorizedData[entityType].push(cleanedRow);
                    }
                });
                return []; // Return empty array since we're modifying categorizedData directly
            };

            await BoundouUtils.processInChunks(data, processChunk);
            
            // Store categorized data
            window.BoundouDashboard.processedIndividualData = categorizedData;
            window.BoundouDashboard.originalIndividualData = BoundouUtils.deepClone(data);

            BoundouUtils.hideLoading('loadingIndicator');
            
            const totalProcessed = categorizedData.personne_physique.length + 
                                 categorizedData.personne_morale.length + 
                                 categorizedData.groupement.length;
            
            BoundouUtils.showSuccess(`Fichier traité: ${totalProcessed} entrées catégorisées`);

            return categorizedData;

        } catch (error) {
            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showError(`${BoundouConfig.MESSAGES.ERRORS.PROCESSING_ERROR}: ${error.message}`);
            throw error;
        }
    };

    // Generate Excel data for specific entity type
    const generateEntityData = (data, entityType) => {
        const filteredData = filterByEntityType(data, entityType);
        
        if (filteredData.length === 0) {
            return { data: [], headers: [] };
        }

        const allHeaders = Object.keys(filteredData[0]);
        const headers = getFilteredHeaders(allHeaders, entityType);
        
        const entityData = filteredData.map(row => {
            const entityRow = {};
            headers.forEach(header => {
                entityRow[header] = BoundouUtils.sanitizeForExcel(row[header]);
            });
            return entityRow;
        });

        return { data: entityData, headers };
    };

    // Get preview data with configurable row count for categorized data
    const getPreviewData = (categorizedData, entityType, maxRows = BoundouConfig.EXCEL.MAX_PREVIEW_ROWS) => {
        if (!categorizedData || typeof categorizedData !== 'object') {
            return { data: [], headers: [], totalRows: 0, hasMore: false };
        }
        
        const entityData = categorizedData[entityType] || [];
        const headers = entityData.length > 0 ? Object.keys(entityData[0]).filter(h => h !== 'Typ_pers' && h !== 'Typ_pers_m') : [];
        
        return {
            data: entityData.slice(0, maxRows),
            headers,
            totalRows: entityData.length,
            hasMore: entityData.length > maxRows
        };
    };

    // Validate data structure
    const validateDataStructure = (data) => {
        const errors = [];
        
        if (!Array.isArray(data)) {
            errors.push('Les données doivent être un tableau');
            return errors;
        }
        
        if (data.length === 0) {
            errors.push('Le fichier ne contient aucune donnée');
            return errors;
        }
        
        // Check for required columns
        const firstRow = data[0];
        const requiredColumns = ['Typ_pers'];
        
        requiredColumns.forEach(column => {
            if (!(column in firstRow)) {
                errors.push(`Colonne requise manquante: ${column}`);
            }
        });
        
        return errors;
    };

    // Helper function to clean values
    const cleanValue = (value) => {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    };

    // Process collective data with proper parcel handling
    const processCollectiveData = (data) => {
        if (!data || data.length <= 1) return [];
        
        const collectiveParcelErrors = []; // Track errors
        const headers = data[0];
        const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));

        const results = rows.map(row => formatParcelData(row, headers, collectiveParcelErrors))
                            .filter(row => row !== null);
        
        // Store errors for debugging if needed
        window.BoundouDashboard.collectiveParcelErrors = collectiveParcelErrors;
        
        return results;
    };

    // Format parcel data with multiple individuals
    const formatParcelData = (row, headers, collectiveParcelErrors) => {
        function getValue(columnName) {
            // Case-insensitive column lookup
            const index = headers.findIndex(header => 
                String(header).toLowerCase() === String(columnName).toLowerCase()
            );
            return index !== -1 ? row[index] : undefined;
        }

        const prenoms = [];
        const noms = [];
        const sexes = [];
        const pieces = [];
        const telephones = [];
        const datesNaissance = [];
        const residences = [];

        // Process mandataire (main person)
        const prenomM = getValue('Prenom_M');
        const nomM = getValue('Nom_M');
        
        if (prenomM && nomM && prenomM !== '' && nomM !== '') {
            prenoms.push(cleanValue(prenomM));
            noms.push(cleanValue(nomM));
            const sexeMndt = getValue('Sexe_Mndt') || getValue('Sexe_M') || getValue('Sexe');
            sexes.push(cleanValue(sexeMndt));
            pieces.push(cleanValue(getValue('Num_piec') || getValue('Num_piece')));
            
            // Handle telephone fields
            const tel1 = getValue('Telephon1');
            const tel2 = getValue('Telephon2');
            const telephone = getValue('Telephone');
            if (tel1 && tel1 !== '') {
                telephones.push(cleanValue(tel1));
            } else if (tel2 && tel2 !== '') {
                telephones.push(cleanValue(tel2));
            } else if (telephone && telephone !== '') {
                telephones.push(cleanValue(telephone));
            } else {
                telephones.push('-');
            }
            
            datesNaissance.push(cleanValue(getValue('Date_nai') || getValue('Date_nais') || getValue('Date_naissance')));
            residences.push(cleanValue(getValue('Residence_M') || getValue('Residence')));
        }

        // Process affectataires (other individuals)
        const affectataires = new Map();
        headers.forEach((col, index) => {
            if (!col) return;
            let affectataireId = null;
            let fieldType = null;

            if (col === 'Prenom' || (col.startsWith('Prenom_') && col !== 'Prenom_M')) {
                fieldType = 'prenom';
                affectataireId = col === 'Prenom' ? '1' : col.replace('Prenom_', '');
            } else if (col === 'Nom' || (col.startsWith('Nom_') && col !== 'Nom_M')) {
                fieldType = 'nom';
                affectataireId = col === 'Nom' ? '1' : col.replace('Nom_', '');
            } else if ((col === 'Sexe' || col.startsWith('Sexe_')) && !['Sexe_Mndt', 'Sexe_M'].includes(col)) {
                fieldType = 'sexe';
                affectataireId = col === 'Sexe' ? '1' : col.replace('Sexe_', '');
            } else if (col.startsWith('Num_piece') && !['Num_piec', 'Num_piece'].includes(col)) {
                fieldType = 'numero_piece';
                affectataireId = col.replace('Num_piece_', '').replace('Num_piece', '1');
            } else if (col.startsWith('Telephon') && !['Telephon1', 'Telephon2'].includes(col)) {
                fieldType = 'telephone';
                const telNum = col.replace('Telephon', '');
                if (telNum === '3') affectataireId = '1';
                else if (parseInt(telNum) > 3) affectataireId = String(parseInt(telNum) - 2);
            } else if (col.startsWith('Date_nais') || col.startsWith('Dat_nais')) {
                fieldType = 'date_naissance';
                affectataireId = col.replace('Date_nais', '').replace('Dat_nais', '') || '1';
            } else if (col.startsWith('Residence') && !['Residence_M'].includes(col)) {
                fieldType = 'residence';
                affectataireId = col.replace('Residence', '') || '1';
            }

            if (affectataireId && fieldType) {
                affectataireId = affectataireId.replace(/^0+/, '') || '1';
                if (!affectataires.has(affectataireId)) {
                    affectataires.set(affectataireId, {});
                }
                const value = row[index];
                if (value !== undefined && value !== null && value !== '') {
                    affectataires.get(affectataireId)[fieldType] = cleanValue(value);
                }
            }
        });

        // Sort and add affectataires
        const sortedIds = Array.from(affectataires.keys()).sort((a, b) => {
            const numA = parseInt(a) || 999;
            const numB = parseInt(b) || 999;
            return numA - numB;
        });

        sortedIds.forEach(affectataireId => {
            const info = affectataires.get(affectataireId);
            if (info.prenom && info.nom) {
                const isDuplicate = (info.prenom === cleanValue(prenomM) && info.nom === cleanValue(nomM));
                if (!isDuplicate) {
                    prenoms.push(info.prenom);
                    noms.push(info.nom);
                    sexes.push(info.sexe || '-');
                    pieces.push(info.numero_piece || '-');
                    telephones.push(info.telephone || '-');
                    datesNaissance.push(info.date_naissance || '-');
                    residences.push(info.residence || '-');
                }
            }
        });

        // Include all parcelles regardless of number of affectataires
        // (Previous version excluded parcelles with less than 2 individuals)
        
        return {
            'Village': cleanValue(getValue('Village')),
            'nicad': cleanValue(getValue('nicad') || getValue('Num_parcel_2')),
            'Num_parcel_2': cleanValue(getValue('Num_parcel_2')),
            'Prenom': prenoms.join('\n'),
            'Nom': noms.join('\n'),
            'Sexe': sexes.join('\n'),
            'Numero_piece': pieces.join('\n'),
            'Telephone': telephones.join('\n'),
            'Date_naissance': datesNaissance.join('\n'),
            'Residence': residences.join('\n'),
            'superficie': cleanValue(getValue('superficie')),
            'Vocation_1': cleanValue(getValue('Vocation_1')),
            'type_usa': cleanValue(getValue('type_usa')),
            'Type_piec': cleanValue(getValue('Type_piec')),
            'Date_nai': cleanValue(getValue('Date_nai'))
        };
    };

    // Define preferred order for collective files
    const getCollectiveOrderedColumns = () => {
        return [
            'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Sexe',
            'Numero_piece', 'Type_piec', 'Telephone', 'Date_naissance', 'Date_nai', 'Residence',
            'superficie', 'Vocation_1', 'type_usa'
        ];
    };

    // Export public methods
    return {
        filterByEntityType,
        shouldExcludeColumn,
        getFilteredHeaders,
        processIndividualData,
        generateEntityData,
        getPreviewData,
        validateDataStructure,
        processCollectiveData,
        formatParcelData,
        getCollectiveOrderedColumns,
        cleanValue
    };
})();