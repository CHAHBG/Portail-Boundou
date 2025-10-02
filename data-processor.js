// === Data Processing Module ===
window.BoundouDataProcessor = (() => {
    'use strict';

    // Case-insensitive field lookup helper with superficie variants
    const getValue = (row, fieldName) => {
        // First try exact match
        if (row[fieldName] !== undefined) {
            return row[fieldName];
        }
        
        // For superficie field, try common variations
        if (fieldName.toLowerCase() === 'superficie') {
            const superficieVariants = [
                'superficie', 'Superficie', 'SUPERFICIE',
                'superficie_m2', 'Superficie_m2', 'SUPERFICIE_M2',
                'superficie_ha', 'Superficie_ha', 'SUPERFICIE_HA',
                'area', 'Area', 'AREA',
                'surface', 'Surface', 'SURFACE'
            ];
            
            for (const variant of superficieVariants) {
                if (row[variant] !== undefined && row[variant] !== null && row[variant] !== '') {
                    console.log(`✅ Found superficie variant "${variant}" with value:`, row[variant]);
                    return row[variant];
                }
            }
        }
        
        // Try case-insensitive lookup for other fields
        const keys = Object.keys(row);
        const matchingKey = keys.find(key => 
            key.toLowerCase() === fieldName.toLowerCase()
        );
        
        return matchingKey ? row[matchingKey] : undefined;
    };

    // Filter data based on entity type
    const filterByEntityType = (data, entityType) => {
        console.log(`🔍 Filtering data for entity type: ${entityType}`);
        console.log(`📊 Total rows in data: ${data.length}`);
        
        let filtered = [];
        switch (entityType) {
            case 'personne_physique':
                filtered = data.filter(row => 
                    row['Typ_pers'] && 
                    row['Typ_pers'].toLowerCase().includes('personne_physique')
                );
                break;
            
            case 'personne_morale':
                filtered = data.filter(row => 
                    row['Typ_pers'] && 
                    row['Typ_pers'].toLowerCase().includes('personne_morale') &&
                    !(row['Typ_pers_m'] && row['Typ_pers_m'].toLowerCase().includes('groupement'))
                );
                break;
            
            case 'groupement':
                filtered = data.filter(row => 
                    row['Typ_pers_m'] && 
                    row['Typ_pers_m'].toLowerCase().includes('groupement')
                );
                break;
            
            default:
                filtered = [];
        }
        
        console.log(`📋 Filtered results for ${entityType}: ${filtered.length} rows`);
        if (filtered.length > 0) {
            console.log(`📝 First ${entityType} row sample:`, filtered[0]);
            console.log(`📊 Sample ${entityType} superficie values:`, filtered.slice(0, 3).map(row => {
                const keys = Object.keys(row);
                const superficieKeys = keys.filter(k => k.toLowerCase().includes('superficie'));
                console.log(`  Found superficie-related keys: ${superficieKeys.join(', ')}`);
                return superficieKeys.map(k => `${k}: ${row[k]}`).join(', ');
            }));
        }
        
        return filtered;
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
                personne_morale: ['Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'Typ_pers_m'],
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

                    // Determine entity type - FIXED LOGIC to match filterByEntityType
                    let entityType = null;
                    if (rowTypePers.includes('personne_physique')) {
                        entityType = 'personne_physique';
                    } else if (rowTypePersM.includes('groupement')) {
                        entityType = 'groupement';
                    } else if (rowTypePers.includes('personne_morale') && !rowTypePersM.includes('groupement')) {
                        // FIXED: Added the same exclusion condition as in filterByEntityType
                        entityType = 'personne_morale';
                    }

                    if (entityType && entityFieldMappings[entityType]) {
                        console.log(`🔧 Processing ${entityType} entity:`, {
                            rowTypePers, 
                            rowTypePersM,
                            hasSuperficie: !!row['superficie'],
                            superficieValue: row['superficie'],
                            allKeys: Object.keys(row).filter(k => k.toLowerCase().includes('superficie')),
                            allFieldNames: Object.keys(row).slice(0, 10) // Show first 10 field names
                        });
                        
                        // Special debugging for personne_morale
                        if (entityType === 'personne_morale') {
                            console.log(`🏢 PERSONNE_MORALE DEBUG - All available fields:`, Object.keys(row));
                            const superficieVariants = Object.keys(row).filter(k => k.toLowerCase().includes('superficie'));
                            console.log(`🏢 PERSONNE_MORALE - Superficie variants found:`, superficieVariants);
                            superficieVariants.forEach(variant => {
                                console.log(`🏢 PERSONNE_MORALE - ${variant} value:`, row[variant]);
                            });
                        }
                        
                        const cleanedRow = {};
                        entityFieldMappings[entityType].forEach(field => {
                            // Use special formatting for decimal fields like superficie
                            if (field === 'superficie') {
                                // Try case-insensitive lookup for superficie field
                                const superficieValue = getValue(row, 'superficie');
                                console.log(`📏 Processing ${entityType} superficie:`, superficieValue, 'from getValue lookup');
                                cleanedRow[field] = formatDecimalValue(superficieValue || '');
                            } else {
                                cleanedRow[field] = BoundouUtils.sanitizeForExcel(row[field] || '');
                            }
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

            // DEBUG: Check what's actually stored for each entity type
            console.log(`📊 STORED DATA SUMMARY:`);
            ['personne_physique', 'personne_morale', 'groupement'].forEach(entityType => {
                const count = categorizedData[entityType].length;
                console.log(`${entityType}: ${count} entities`);
                
                if (count > 0) {
                    const firstEntity = categorizedData[entityType][0];
                    console.log(`${entityType} first entity superficie:`, firstEntity.superficie);
                    console.log(`${entityType} first entity keys:`, Object.keys(firstEntity).slice(0, 15));
                    
                    // Sample superficie values
                    const superficieSample = categorizedData[entityType].slice(0, 3).map(e => e.superficie);
                    console.log(`${entityType} superficie sample:`, superficieSample);
                }
            });

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

    // Helper function to format decimal values (handles both comma and period separators)
    const formatDecimalValue = (value) => {
        if (value === null || value === undefined || value === '') return '';
        
        let stringValue = String(value).trim();
        
        // Handle empty or invalid values
        if (!stringValue || stringValue === '-' || stringValue === 'N/A') return '';
        
        // Remove any whitespace
        stringValue = stringValue.replace(/\s+/g, '');
        
        // Check if it looks like a number (with comma or period as decimal separator)
        const numberPattern = /^-?\d+([,.]\d+)?$/;
        
        if (numberPattern.test(stringValue)) {
            // Replace comma with period for standardization
            const standardizedValue = stringValue.replace(',', '.');
            
            // Parse as float and return formatted with period as decimal separator
            const numericValue = parseFloat(standardizedValue);
            
            if (!isNaN(numericValue)) {
                // Return the number with period as decimal separator
                console.log(`🔢 Decimal formatting: "${value}" -> "${numericValue.toString()}"`);
                return numericValue.toString();
            }
        }
        
        // If not a valid number pattern, return original cleaned value
        console.log(`⚠️ Invalid decimal format: "${value}" -> "${stringValue}" (keeping original)`);
        return stringValue;
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
            'superficie': (() => {
                const superficieValue = getValue('superficie');
                console.log(`📏 Processing superficie for parcel:`, superficieValue);
                return formatDecimalValue(superficieValue);
            })(),
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