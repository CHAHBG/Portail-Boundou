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
                    console.log(`[OK] Found superficie variant "${variant}" with value:`, row[variant]);
                    return row[variant];
                }
            }
        }

        // For num_parcel field, try common variations
        if (fieldName.toLowerCase() === 'num_parcel') {
            const numParcelVariants = [
                'num_parcel', 'Num_parcel', 'NUM_PARCEL',
                'num_parcelle', 'Num_parcelle', 'NUM_PARCELLE',
                'Num_parcel_2', 'num_parcel_2', 'NUM_PARCEL_2',
                'numero_parcelle', 'Numero_parcelle', 'NUMERO_PARCELLE',
                'parcel_number', 'Parcel_number', 'PARCEL_NUMBER',
                'id_parcelle', 'Id_parcelle', 'ID_PARCELLE'
            ];

            for (const variant of numParcelVariants) {
                if (row[variant] !== undefined && row[variant] !== null && row[variant] !== '') {
                    console.log(`[OK] Found num_parcel variant "${variant}" with value:`, row[variant]);
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
        console.log(`[DBG] Filtering data for entity type: ${entityType}`);
        console.log(`[STAT] Total rows in data: ${data.length}`);

        let filtered = [];
        switch (entityType) {
            case 'personne_physique':
                filtered = data.filter(row => {
                    const typePers = getValue(row, 'Typ_pers');
                    return typePers && typePers.toLowerCase().includes('personne_physique');
                });
                break;

            case 'personne_morale':
                filtered = data.filter(row => {
                    const typePers = getValue(row, 'Typ_pers');
                    const typePersM = getValue(row, 'Typ_pers_m');
                    return typePers &&
                        typePers.toLowerCase().includes('personne_morale') &&
                        !(typePersM && typePersM.toLowerCase().includes('groupement'));
                });
                break;

            case 'groupement':
                filtered = data.filter(row => {
                    const typePersM = getValue(row, 'Typ_pers_m');
                    return typePersM && typePersM.toLowerCase().includes('groupement');
                });
                break;

            default:
                filtered = [];
        }

        console.log(`[LIST] Filtered results for ${entityType}: ${filtered.length} rows`);
        if (filtered.length > 0) {
            console.log(`[NOTE] First ${entityType} row sample:`, filtered[0]);
            console.log(`[STAT] Sample ${entityType} superficie values:`, filtered.slice(0, 3).map(row => {
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
                personne_physique: ['Village', 'Prenom', 'Nom', 'Sexe', 'Date_naiss', 'Num_piece', 'Type_piece', 'Telephone', 'Vocation', 'type_usag', 'superficie', 'nicad', 'Num_parcel'],
                personne_morale: ['Denominat', 'Creation', 'Siege', 'Numero', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Typ_pers_m', 'Num_parcel'],
                groupement: ['Village', 'Denominat', 'Creation', 'Siege', 'Numero', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Vocation', 'type_usa', 'Date_nai', 'Typ_pers_m', 'Num_parcel']
            };

            // Categorize data by entity type
            const categorizedData = {
                personne_physique: [],
                personne_morale: [],
                groupement: []
            };

            // Track excluded rows for reporting
            const excludedRows = [];
            let rowIndex = 0;

            // Process data in chunks for better performance
            const processChunk = async (chunk) => {
                chunk.forEach(row => {
                    rowIndex++;
                    const rawTypePers = getValue(row, 'Typ_pers');
                    const rawTypePersM = getValue(row, 'Typ_pers_m');

                    const rowTypePers = rawTypePers ? rawTypePers.toLowerCase() : '';
                    const rowTypePersM = rawTypePersM ? rawTypePersM.toLowerCase() : '';

                    // Determine entity type - FIXED LOGIC to match filterByEntityType
                    let entityType = null;
                    if (rowTypePers.includes('personne_physique')) {
                        entityType = 'personne_physique';
                    } else if (rowTypePersM.includes('groupement')) {
                        entityType = 'groupement';
                    } else if (rowTypePers.includes('personne_morale') && !rowTypePersM.includes('groupement')) {
                        entityType = 'personne_morale';
                    }

                    if (!entityType || !entityFieldMappings[entityType]) {
                        // Track the excluded row with reason
                        const parcelId = getValue(row, 'Num_parcel') || getValue(row, 'nicad') || '';
                        const nom = getValue(row, 'Nom') || getValue(row, 'Denominat') || '';
                        excludedRows.push({
                            row: rowIndex + 1, // +1 for header row in original file
                            reason: `Type de personne non reconnu (Typ_pers="${rawTypePers || ''}", Typ_pers_m="${rawTypePersM || ''}")`,
                            data: parcelId ? `Parcelle: ${parcelId}` : (nom ? `Nom: ${nom}` : 'données non identifiables')
                        });
                        return;
                    }

                    if (entityType && entityFieldMappings[entityType]) {
                        console.log(`[CFG] Processing ${entityType} entity:`, {
                            rowTypePers,
                            rowTypePersM,
                            hasSuperficie: !!row['superficie'],
                            superficieValue: row['superficie'],
                            allKeys: Object.keys(row).filter(k => k.toLowerCase().includes('superficie')),
                            allFieldNames: Object.keys(row).slice(0, 10) // Show first 10 field names
                        });

                        // Special debugging for personne_morale
                        if (entityType === 'personne_morale') {
                            console.log(`[CORP] PERSONNE_MORALE DEBUG - All available fields:`, Object.keys(row));
                            const superficieVariants = Object.keys(row).filter(k => k.toLowerCase().includes('superficie'));
                            console.log(`[CORP] PERSONNE_MORALE - Superficie variants found:`, superficieVariants);
                            superficieVariants.forEach(variant => {
                                console.log(`[CORP] PERSONNE_MORALE - ${variant} value:`, row[variant]);
                            });
                        }

                        const cleanedRow = {};
                        // Date columns that need special formatting (Date objects or serial numbers)
                        const dateColumns = ['Date_naiss', 'Date_nai', 'Creation'];
                        entityFieldMappings[entityType].forEach(field => {
                            // Use case-sensitive lookup for ALL fields to ensure data is found
                            // even if Excel headers have different casing (e.g. PRENOM vs Prenom)
                            const fieldValue = getValue(row, field);

                            // Use special formatting for decimal fields like superficie
                            if (field === 'superficie') {
                                console.log(`[RULER] Processing ${entityType} superficie:`, fieldValue, 'from getValue lookup');
                                cleanedRow[field] = formatDecimalValue(fieldValue || '');
                            } else if (dateColumns.includes(field)) {
                                // Format dates before sanitization — sanitizeForExcel would
                                // destroy Date objects and might lose precision on serial numbers.
                                // Use the Excel generator's date formatter via a local helper.
                                if (fieldValue instanceof Date) {
                                    const day = String(fieldValue.getDate()).padStart(2, '0');
                                    const month = String(fieldValue.getMonth() + 1).padStart(2, '0');
                                    const year = String(fieldValue.getFullYear());
                                    cleanedRow[field] = `${day}/${month}/${year}`;
                                } else if (typeof fieldValue === 'number' && isFinite(fieldValue)) {
                                    // Excel serial number — convert inline
                                    const serial = Math.round(fieldValue);
                                    if (serial > 0 && serial < 100000) {
                                        const epoch = new Date(1900, 0, 1);
                                        const msPerDay = 86400000;
                                        const adj = serial >= 60 ? serial - 1 : serial;
                                        const d = new Date(epoch.getTime() + (adj - 1) * msPerDay);
                                        const dd = String(d.getDate()).padStart(2, '0');
                                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                                        const yyyy = String(d.getFullYear());
                                        cleanedRow[field] = `${dd}/${mm}/${yyyy}`;
                                    } else {
                                        cleanedRow[field] = BoundouUtils.sanitizeForExcel(fieldValue || '');
                                    }
                                } else {
                                    // Already a string — pass through sanitization
                                    cleanedRow[field] = BoundouUtils.sanitizeForExcel(fieldValue || '');
                                }
                            } else {
                                cleanedRow[field] = BoundouUtils.sanitizeForExcel(fieldValue || '');
                            }
                        });
                        // Keep original type fields for reference
                        cleanedRow['Typ_pers'] = getValue(row, 'Typ_pers') || '';
                        cleanedRow['Typ_pers_m'] = getValue(row, 'Typ_pers_m') || '';

                        categorizedData[entityType].push(cleanedRow);
                    }
                });
                return []; // Return empty array since we're modifying categorizedData directly
            };

            await BoundouUtils.processInChunks(data, processChunk);

            // Store categorized data
            window.BoundouDashboard.processedIndividualData = categorizedData;
            window.BoundouDashboard.originalIndividualData = BoundouUtils.deepClone(data);

            // Store processing report for excluded rows
            const totalOutput = categorizedData.personne_physique.length +
                categorizedData.personne_morale.length +
                categorizedData.groupement.length;
            window.BoundouDashboard._lastProcessingReport = {
                totalInput: data.length,
                totalOutput: totalOutput,
                excludedRows: excludedRows
            };
            if (excludedRows.length > 0) {
                console.warn(`[REPORT] ${excludedRows.length} lignes exclues sur ${data.length} total:`);
                excludedRows.forEach(e => console.warn(`  Ligne ${e.row}: ${e.reason} ${e.data ? '[' + e.data + ']' : ''}`));
            }

            // DEBUG: Check what's actually stored for each entity type
            console.log(`[STAT] STORED DATA SUMMARY:`);
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
                console.log(`[NUM] Decimal formatting: "${value}" -> "${numericValue.toString()}"`);
                return numericValue.toString();
            }
        }

        // If not a valid number pattern, return original cleaned value
        console.log(`[WARN] Invalid decimal format: "${value}" -> "${stringValue}" (keeping original)`);
        return stringValue;
    };

    // Process collective data with proper parcel handling
    const processCollectiveData = (data) => {
        if (!data || data.length <= 1) return [];

        const collectiveParcelErrors = []; // Track errors
        const excludedRows = []; // Track excluded rows for report
        const headers = data[0];
        const allRows = data.slice(1);
        const nonEmptyRows = allRows.filter(row => row.some(cell => cell !== ''));

        // Track completely empty rows
        const emptyCount = allRows.length - nonEmptyRows.length;
        if (emptyCount > 0) {
            // Find which rows were empty
            allRows.forEach((row, idx) => {
                if (!row.some(cell => cell !== '')) {
                    excludedRows.push({
                        row: idx + 2, // +2 for header + 0-index
                        reason: 'Ligne entièrement vide',
                        data: ''
                    });
                }
            });
        }

        const results = [];
        nonEmptyRows.forEach((row, idx) => {
            // Find the original row index in the full data
            const originalIndex = allRows.indexOf(row);
            const rowNumber = originalIndex + 2; // +2 for header + 0-index

            const processed = formatParcelData(row, headers, collectiveParcelErrors);
            if (processed !== null) {
                results.push(processed);
            } else {
                // Determine reason for null return
                const getVal = (colName) => {
                    const i = headers.findIndex(h => String(h).toLowerCase() === String(colName).toLowerCase());
                    return i !== -1 ? row[i] : undefined;
                };
                const numParcel = getVal('Num_parcel_2') || getVal('Num_parcel') || '';
                excludedRows.push({
                    row: rowNumber,
                    reason: 'Parcelle invalide (mandataire manquant ou données insuffisantes)',
                    data: numParcel ? `Parcelle: ${numParcel}` : ''
                });
            }
        });

        // Store errors and report
        window.BoundouDashboard.collectiveParcelErrors = collectiveParcelErrors;
        window.BoundouDashboard._lastProcessingReport = {
            totalInput: allRows.length,
            totalOutput: results.length,
            excludedRows: excludedRows
        };
        if (excludedRows.length > 0) {
            console.warn(`[REPORT] Collective: ${excludedRows.length} lignes exclues sur ${allRows.length} total`);
            excludedRows.forEach(e => console.warn(`  Ligne ${e.row}: ${e.reason} ${e.data ? '[' + e.data + ']' : ''}`));
        }

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

        const individuals = []; // Store all individuals with their info

        // Process mandataire (main person) first
        const prenomM = getValue('Prenom_M');
        const nomM = getValue('Nom_M');

        if (prenomM && nomM && prenomM !== '' && nomM !== '') {
            const mandataireInfo = {
                prenom: cleanValue(prenomM),
                nom: cleanValue(nomM),
                sexe: cleanValue(getValue('Sexe_Mndt') || getValue('Sexe_M') || getValue('Sexe')),
                numero_piece: cleanValue(getValue('Num_piec') || getValue('Num_piece')),
                date_naissance: cleanValue(getValue('Date_nai') || getValue('Date_nais') || getValue('Date_naissance')),
                lieu_naissance: cleanValue(getValue('Lieu_nais')),
                type_piece: cleanValue(getValue('Type_piec')),
                lieu_residence: cleanValue(getValue('Lieu_resi2') || getValue('Residence_M') || getValue('Residence')),
                telephone: (() => {
                    const tel1 = getValue('Telephon1');
                    const tel2 = getValue('Telephon2');
                    const telephone = getValue('Telephone');
                    if (tel1 && tel1 !== '') return cleanValue(tel1);
                    if (tel2 && tel2 !== '') return cleanValue(tel2);
                    if (telephone && telephone !== '') return cleanValue(telephone);
                    return '-';
                })(),
                isMandataire: true,
                source: 'mandataire'
            };
            individuals.push(mandataireInfo);
        }

        // Process all affectataires (including those who might be duplicates of mandataire)
        const affectataires = new Map();

        // Find all affectataire fields with improved detection
        headers.forEach((col, index) => {
            if (!col) return;
            let affectataireId = null;
            let fieldType = null;

            const colStr = String(col);

            // Prenom fields
            if (colStr === 'Prenom' || (colStr.startsWith('Prenom_') && colStr !== 'Prenom_M')) {
                fieldType = 'prenom';
                affectataireId = colStr === 'Prenom' ? '1' : colStr.replace('Prenom_', '');
            }
            // Nom fields
            else if (colStr === 'Nom' || (colStr.startsWith('Nom_') && colStr !== 'Nom_M')) {
                fieldType = 'nom';
                affectataireId = colStr === 'Nom' ? '1' : colStr.replace('Nom_', '');
            }
            // Sexe fields
            else if ((colStr === 'Sexe' || colStr.startsWith('Sexe_')) && !['Sexe_Mndt', 'Sexe_M'].includes(colStr)) {
                fieldType = 'sexe';
                affectataireId = colStr === 'Sexe' ? '1' : colStr.replace('Sexe_', '');
            }
            // Numero piece fields — match Num_piece, Num_piece_2, etc. but not Num_piec (mandataire)
            else if (/^Num_piece(_\d+)?$/i.test(colStr)) {
                fieldType = 'numero_piece';
                const m = colStr.match(/_((\d+))$/);
                affectataireId = m ? m[1] : '1';
            }
            // Type piece fields — match Type_piec_2, Type_piece, etc. but not bare Type_piec (mandataire)
            else if (/^Type_piec[e]?_\d+$/i.test(colStr) || colStr === 'Type_piece') {
                fieldType = 'type_piece';
                const m = colStr.match(/(\d+)$/);
                affectataireId = m ? m[1] : '1';
            }
            // Date naissance fields — match Date_nais, Date_nais_2, Date_naiss, Date_naiss_2, Dat_nais_2 etc.
            // but NOT Date_nai (mandataire, no trailing 's')
            else if (/^(Date_naiss?|Dat_naiss?)(_\d+)?$/i.test(colStr)) {
                fieldType = 'date_naissance';
                const m = colStr.match(/(\d+)$/);
                affectataireId = m ? m[1] : '1';
            }
            // Lieu naissance fields — match Lieu_nais_2 etc. but not bare Lieu_nais (mandataire)
            else if (/^Lieu_nais_\d+$/i.test(colStr)) {
                fieldType = 'lieu_naissance';
                const m = colStr.match(/(\d+)$/);
                affectataireId = m ? m[1] : '1';
            }
            // Residence fields — match Residence, Residence_2 etc. but not Residence_M (mandataire)
            else if (/^Residence(_\d+)?$/i.test(colStr) && colStr !== 'Residence_M') {
                fieldType = 'residence';
                const m = colStr.match(/(\d+)$/);
                affectataireId = m ? m[1] : '1';
            }
            // Lieu residence fields — match Lieu_resi, Lieu_resi_2 etc. but not Lieu_resi2 (mandataire)
            else if (/^Lieu_resi(_\d+)?$/i.test(colStr) && colStr !== 'Lieu_resi2') {
                fieldType = 'lieu_residence';
                const m = colStr.match(/(\d+)$/);
                affectataireId = m ? m[1] : '1';
            }
            // Telephone fields — match Telephon3-N, Telephon_3, Telephone_3 etc.
            // Telephon1/Telephon2 are mandataire phones
            else if (/^Telephon[e]?[_]?(\d+)?$/i.test(colStr) && !['Telephon1', 'Telephon2'].includes(colStr)) {
                fieldType = 'telephone';
                const m = colStr.match(/(\d+)$/);
                if (m) {
                    const num = parseInt(m[1]);
                    // Telephon3 → affectataire 1, Telephon4 → 2, etc.
                    affectataireId = num > 2 ? String(num - 2) : String(num);
                } else {
                    affectataireId = '1';
                }
            }

            if (affectataireId && fieldType) {
                // Clean up affectataireId
                affectataireId = String(affectataireId).replace(/^0+/, '') || '1';

                if (!affectataires.has(affectataireId)) {
                    affectataires.set(affectataireId, {});
                }

                const value = row[index];
                if (value !== undefined && value !== null && value !== '') {
                    affectataires.get(affectataireId)[fieldType] = cleanValue(value);
                }
            }
        });

        // Convert affectataires to individuals array
        const sortedIds = Array.from(affectataires.keys()).sort((a, b) => {
            const numA = parseInt(a) || 999;
            const numB = parseInt(b) || 999;
            return numA - numB;
        });

        sortedIds.forEach(affectataireId => {
            const info = affectataires.get(affectataireId);

            // Only include if has both prenom and nom
            if (info.prenom && info.nom) {
                const affectataireInfo = {
                    prenom: info.prenom,
                    nom: info.nom,
                    sexe: info.sexe || '-',
                    numero_piece: info.numero_piece || '-',
                    date_naissance: info.date_naissance || '-',
                    lieu_naissance: info.lieu_naissance || '-',
                    type_piece: info.type_piece || '-',
                    lieu_residence: info.lieu_residence || info.residence || '-',
                    telephone: info.telephone || '-',
                    isMandataire: false,
                    source: `affectataire_${affectataireId}`
                };

                // Check if this affectataire is the same person as mandataire
                // Two people are the same ONLY if they have the same name AND same Num_piece
                const mandataire = individuals.find(ind => ind.isMandataire);
                const isSamePersonAsMandataire = mandataire &&
                    affectataireInfo.prenom === mandataire.prenom &&
                    affectataireInfo.nom === mandataire.nom &&
                    affectataireInfo.numero_piece === mandataire.numero_piece &&
                    affectataireInfo.numero_piece !== '-' &&
                    mandataire.numero_piece !== '-';

                // If different name or different Num_piece, it's a different person (even if homonym)
                if (!isSamePersonAsMandataire) {
                    individuals.push(affectataireInfo);
                } else {
                    // Same person as mandataire - still add them but mark as duplicate
                    affectataireInfo.isDuplicateOfMandataire = true;
                    individuals.push(affectataireInfo);
                }
            }
        });

        // Debug logging for the specific parcel mentioned
        const numParcel2 = getValue('Num_parcel_2');
        if (numParcel2 === '0522010201096') {
            console.log(`[DBG] DEBUG - Parcel ${numParcel2}:`);
            console.log(`[STAT] Total individuals found: ${individuals.length}`);
            individuals.forEach((ind, idx) => {
                console.log(`  ${idx + 1}. ${ind.prenom} ${ind.nom} (${ind.numero_piece}) [${ind.source}]${ind.isMandataire ? ' **MANDATAIRE**' : ''}`);
            });
        }

        // Prepare output arrays with bold formatting for mandataire
        const prenoms = [];
        const noms = [];
        const sexes = [];
        const pieces = [];
        const telephones = [];
        const datesNaissance = [];
        const residences = [];

        individuals.forEach(ind => {
            if (ind.isMandataire) {
                // Mark mandataire with uppercase for visibility
                prenoms.push(ind.prenom.toUpperCase());
                noms.push(ind.nom.toUpperCase());
                sexes.push(ind.sexe);
                pieces.push(ind.numero_piece);
                telephones.push(ind.telephone);
                datesNaissance.push(ind.date_naissance);
                residences.push(ind.lieu_residence);
            } else {
                // Regular formatting for affectataires
                prenoms.push(ind.prenom);
                noms.push(ind.nom);
                sexes.push(ind.sexe);
                pieces.push(ind.numero_piece);
                telephones.push(ind.telephone);
                datesNaissance.push(ind.date_naissance);
                residences.push(ind.lieu_residence);
            }
        });

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
                console.log(`[RULER] Processing superficie for parcel:`, superficieValue);
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
            'Village', 'nicad', 'Num_parcel_2', 'num_parcel', 'Prenom', 'Nom', 'Sexe',
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