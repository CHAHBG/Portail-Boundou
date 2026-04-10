window.BoundouExcelGenerator = (() => {
    'use strict';

    // Helper function to format dates to DD/MM/YYYY format
    const formatDateToDDMMYYYY = (dateValue) => {
        if (dateValue === null || dateValue === undefined || dateValue === '') return '';
        
        // Handle different date formats
        let date;
        
        // If it's already a Date object
        if (dateValue instanceof Date) {
            date = dateValue;
        } else if (typeof dateValue === 'number' && isFinite(dateValue)) {
            // Handle numeric Excel serial dates directly (e.g. 33009, 33009.5)
            const serialNumber = Math.round(dateValue);
            if (serialNumber > 0 && serialNumber < 100000) {
                const excelEpoch = new Date(1900, 0, 1);
                const millisecondsPerDay = 24 * 60 * 60 * 1000;
                let adjustedSerial = serialNumber;
                if (serialNumber >= 60) {
                    adjustedSerial = serialNumber - 1;
                }
                date = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * millisecondsPerDay);
                console.log('DEBUG: Converted numeric serial', dateValue, 'to date:', date);
            }
        } else {
            // Try to parse various string formats
            let dateStr = String(dateValue).trim();
            
            // Handle multi-line dates (for collective data): format each line independently
            // and preserve line positions so each member keeps their own birth date.
            if (dateStr.includes('\n')) {
                return dateStr
                    .split('\n')
                    .map(line => {
                        const trimmed = String(line).trim();
                        if (!trimmed) return '';
                        if (trimmed === '-' || trimmed.toUpperCase() === 'N/A') return trimmed;
                        return formatDateToDDMMYYYY(trimmed) || trimmed;
                    })
                    .join('\n');
            }
            
            // Skip empty or invalid values
            if (!dateStr || dateStr === '-' || dateStr === 'N/A') return '';
            
            // Debug log to see what we're trying to parse
            console.log('DEBUG: Parsing date value:', dateStr);
            
            // Handle already formatted DD/MM/YYYY
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                console.log('DEBUG: Already in DD/MM/YYYY format:', dateStr);
                return dateStr;
            }
            
            // Handle DDMMYYYY format, convert to DD/MM/YYYY
            if (/^\d{8}$/.test(dateStr)) {
                const day = dateStr.slice(0, 2);
                const month = dateStr.slice(2, 4);
                const year = dateStr.slice(4, 8);
                const formatted = `${day}/${month}/${year}`;
                console.log('DEBUG: Converted DDMMYYYY to DD/MM/YYYY:', formatted);
                return formatted;
            }
            
            // Handle DDMMYY format, convert to DD/MM/YYYY
            if (/^\d{6}$/.test(dateStr)) {
                const day = dateStr.slice(0, 2);
                const month = dateStr.slice(2, 4);
                const yearShort = dateStr.slice(4, 6);
                // Convert 2-digit year to 4-digit (assume 1900s for years 00-99)
                const year = parseInt(yearShort) < 50 ? `20${yearShort}` : `19${yearShort}`;
                const formatted = `${day}/${month}/${year}`;
                console.log('DEBUG: Converted DDMMYY to DD/MM/YYYY:', formatted);
                return formatted;
            }
            
            // Handle Excel serial numbers (numeric values representing days since 1900-01-01)
            if (/^\d+$/.test(dateStr) && parseInt(dateStr) > 0 && parseInt(dateStr) < 100000) {
                const serialNumber = parseInt(dateStr);
                // Excel epoch starts at January 1, 1900 (but Excel incorrectly treats 1900 as a leap year)
                // JavaScript Date epoch starts at January 1, 1970
                // Excel serial number 1 = January 1, 1900
                // Convert Excel serial to JavaScript Date
                const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
                const millisecondsPerDay = 24 * 60 * 60 * 1000;
                
                // Account for Excel's leap year bug (Excel thinks 1900 is a leap year)
                let adjustedSerial = serialNumber;
                if (serialNumber >= 60) {
                    adjustedSerial = serialNumber - 1; // Subtract 1 day for dates after Feb 28, 1900
                }
                
                date = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * millisecondsPerDay);
                console.log('DEBUG: Converted Excel serial', serialNumber, 'to date:', date);
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
            console.log('DEBUG: Could not parse date, returning original:', dateValue);
            return dateValue; // Return original value if can't parse
        }
        
        // Ensure reasonable year range (1900-2100)
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) {
            console.log('DEBUG: Year out of range:', year, 'returning original:', dateValue);
            return dateValue; // Return original if year seems wrong
        }
        
        // Format to DD/MM/YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const fullYear = String(date.getFullYear());
        
        const formatted = `${day}/${month}/${fullYear}`;
        console.log('DEBUG: Formatted date:', dateValue, '->', formatted);
        return formatted;
    };

    // Helper function for case-insensitive field lookup
    const getValue = (row, columnName) => {
        if (!row || !columnName) return undefined;
        
        // Direct match first (fastest)
        if (row.hasOwnProperty(columnName)) {
            return row[columnName];
        }
        
        // Case-insensitive search
        const lowerColumnName = columnName.toLowerCase();
        const matchingKey = Object.keys(row).find(key => 
            key.toLowerCase() === lowerColumnName
        );
        
        return matchingKey ? row[matchingKey] : undefined;
    };

    // Helper function to add row numbering to data
    const addRowNumbering = (data, startNumber = 1) => {
        if (!Array.isArray(data)) return data;
        
        return data.map((row, index) => ({
            'N°': startNumber + index,
            ...row
        }));
    };

    // Helper function to truncate sheet names to Excel's 31 character limit
    const truncateSheetName = (name) => {
        if (!name || typeof name !== 'string') return 'Sheet1';
        
        // Remove invalid characters for Excel sheet names
        let cleanName = name.replace(/[\\\/\?\*\[\]:]/g, '_');
        
        // Replace long entity type names with shorter abbreviations
        cleanName = cleanName
            .replace(/personne_physique/g, 'PP')
            .replace(/personne_morale/g, 'PM') 
            .replace(/groupement/g, 'GRP')
            .replace(/Physiques/g, 'PP')
            .replace(/Morales/g, 'PM')
            .replace(/Groupements/g, 'GRP')
            .replace(/Habitat/g, 'HAB')
            .replace(/Agricole/g, 'AGR')
            .replace(/Tous/g, 'ALL')
            .replace(/Standard/g, 'STD')
            .replace(/Collective/g, 'COLL')
            .replace(/Mineurs/g, 'MIN')
            .replace(/Majeurs/g, 'MAJ')
            .replace(/CNI_Autres/g, 'CNI')
            .replace(/CNI/g, 'ID')  // For standard identity documents
            .replace(/Autres/g, 'AUT')
            .replace(/Inconnus/g, 'UNK');
        
        // Truncate to 31 characters maximum
        if (cleanName.length > 31) {
            cleanName = cleanName.substring(0, 31);
        }
        
        return cleanName;
    };

    // Generate individual deliberation list with multi-sheet categorized data
    const generateIndividualDeliberationList = async () => {
        try {
            const data = window.BoundouDashboard.processedIndividualData;
            
            // Check if data is a Promise (async operation still pending)
            if (data && typeof data.then === 'function') {
                throw new Error('Les données sont encore en cours de traitement. Veuillez réessayer dans quelques instants.');
            }
            
            // Validate categorized data structure
            if (!data || typeof data !== 'object' || (!data.personne_physique && !data.personne_morale && !data.groupement)) {
                throw new Error('Aucune donnée catégorisée à exporter');
            }

            BoundouUtils.showLoading('loadingIndicator', BoundouConfig.MESSAGES.INFO.GENERATING);

            // Create workbook with categorized sheets
            const wb = XLSX.utils.book_new();
            let totalExported = 0;

            // Sheet 1: Personnes physiques
            if (data.personne_physique && data.personne_physique.length > 0) {
                const physiquesData = data.personne_physique.map(row => {
                    const orderedRow = {};
                    const columns = ['Village', 'Prenom', 'Nom', 'Sexe', 'Date_naiss', 'Num_piece', 'Type_piece', 'Telephone', 'Vocation', 'type_usag', 'superficie', 'nicad', 'Num_parcel'];
                    columns.forEach(col => {
                        if (col === 'Date_naiss') {
                            // Apply date formatting to Date_naiss field
                            orderedRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else if (col === 'superficie') {
                            // Apply decimal formatting to superficie field  
                            const rawValue = getValue(row, col) || '';
                            // Since formatDecimalValue is not available here, use direct value but with debugging
                            orderedRow[col] = rawValue;
                            console.log(`[RULER] Excel generation - personne_physique superficie:`, rawValue, 'from row:', row.superficie);
                        } else {
                            orderedRow[col] = row[col] || '';
                        }
                    });
                    return orderedRow;
                });

                // Add row numbering to physiques data
                const numberedPhysiquesData = addRowNumbering(physiquesData);
                const wsPhysiques = XLSX.utils.json_to_sheet(numberedPhysiquesData);
                
                // Set column widths (adding width for N° column)
                const colWidthsPhysiques = [
                    { wch: 5 },  // N°
                    { wch: 20 }, // Village
                    { wch: 15 }, // Prenom
                    { wch: 15 }, // Nom
                    { wch: 10 }, // Sexe
                    { wch: 12 }, // Date_naiss
                    { wch: 15 }, // Num_piece
                    { wch: 18 }, // Type_piece
                    { wch: 15 }, // Telephone
                    { wch: 15 }, // Vocation
                    { wch: 12 }, // type_usag
                    { wch: 12 }, // superficie
                    { wch: 15 }  // nicad
                ];
                wsPhysiques['!cols'] = colWidthsPhysiques;
                
                XLSX.utils.book_append_sheet(wb, wsPhysiques, 'Personnes physiques');
                totalExported += physiquesData.length;
            }

            // Sheet 2: Personnes morales (excluding groupements)
            if (data.personne_morale && data.personne_morale.length > 0) {
                console.log(`[CORP] EXCEL GEN - Starting personne_morale processing with ${data.personne_morale.length} entities`);
                
                const selectedColumns = window.BoundouDashboard.selectedColumns;
                const columns = selectedColumns?.personne_morale || ['Denominat', 'Creation', 'Siege', 'Numero', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Typ_pers_m', 'Num_parcel'];
                
                // Debug first personne_morale entity
                if (data.personne_morale.length > 0) {
                    const firstEntity = data.personne_morale[0];
                    console.log(`[CORP] EXCEL GEN - First personne_morale entity keys:`, Object.keys(firstEntity));
                    console.log(`[CORP] EXCEL GEN - First personne_morale superficie field variants:`, 
                        Object.keys(firstEntity).filter(k => k.toLowerCase().includes('superficie')));
                    console.log(`[CORP] EXCEL GEN - First personne_morale superficie values:`, {
                        direct: firstEntity.superficie,
                        getValue: getValue(firstEntity, 'superficie')
                    });
                }
                
                const moralesData = data.personne_morale.map((row, index) => {
                    const orderedRow = {};
                    columns.forEach(col => {
                        if (col === 'Creation') {
                            // Apply date formatting to Creation field
                            orderedRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else if (col === 'superficie') {
                            // Apply decimal formatting to superficie field
                            const rawValue = getValue(row, col) || '';
                            orderedRow[col] = rawValue;
                            console.log(`[RULER] Excel generation - personne_morale ${index + 1} superficie:`, rawValue, 'from row.superficie:', row.superficie);
                        } else {
                            orderedRow[col] = row[col] || '';
                        }
                    });
                    return orderedRow;
                });

                // Add row numbering to morales data
                const numberedMoralesData = addRowNumbering(moralesData);
                const wsMorales = XLSX.utils.json_to_sheet(numberedMoralesData);
                
                // Set column widths (adding width for N° column)
                const colWidthsMorales = [
                    { wch: 5 },  // N°
                    { wch: 25 }, // Denominat
                    { wch: 12 }, // Creation
                    { wch: 25 }, // Siege
                    { wch: 15 }, // Numero
                    { wch: 20 }, // Mandataire
                    { wch: 15 }, // Telephone_001
                    { wch: 25 }, // Adresse
                    { wch: 15 }, // superficie
                    { wch: 15 }, // nicad
                    { wch: 20 }, // Typ_pers_m
                    { wch: 15 }  // Num_parcel
                ];
                wsMorales['!cols'] = colWidthsMorales;
                
                XLSX.utils.book_append_sheet(wb, wsMorales, 'Personne Morale');
                totalExported += moralesData.length;
            }

            // Sheet 3: Groupements
            if (data.groupement && data.groupement.length > 0) {
                const selectedColumns = window.BoundouDashboard.selectedColumns;
                const columns = selectedColumns?.groupement || ['Village', 'Denominat', 'Creation', 'Siege', 'Numero', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Vocation', 'type_usa', 'Date_nai', 'Typ_pers_m', 'Num_parcel'];
                
                const groupementsData = data.groupement.map(row => {
                    const orderedRow = {};
                    columns.forEach(col => {
                        if (col === 'Creation' || col === 'Date_nai') {
                            // Apply date formatting to date fields
                            orderedRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else if (col === 'superficie') {
                            // Apply decimal formatting to superficie field
                            const rawValue = getValue(row, col) || '';
                            orderedRow[col] = rawValue;
                            console.log(`[RULER] Excel generation - groupement superficie:`, rawValue, 'from row:', row.superficie);
                        } else {
                            orderedRow[col] = row[col] || '';
                        }
                    });
                    return orderedRow;
                });

                // Add row numbering to groupements data
                const numberedGroupementsData = addRowNumbering(groupementsData);
                const wsGroupements = XLSX.utils.json_to_sheet(numberedGroupementsData);
                
                // Set column widths
                const colWidthsGroupements = [
                    { wch: 5 },  // N°
                    { wch: 20 }, // Village
                    { wch: 25 }, // Denominat
                    { wch: 12 }, // Creation
                    { wch: 25 }, // Siege
                    { wch: 15 }, // Numero
                    { wch: 20 }, // Mandataire
                    { wch: 15 }, // Telephone_001
                    { wch: 25 }, // Adresse
                    { wch: 15 }, // superficie
                    { wch: 15 }, // nicad
                    { wch: 20 }, // Vocation
                    { wch: 12 }, // type_usa
                    { wch: 12 }, // Date_nai
                    { wch: 20 }, // Typ_pers_m
                    { wch: 15 }  // Num_parcel
                ];
                wsGroupements['!cols'] = colWidthsGroupements;
                
                XLSX.utils.book_append_sheet(wb, wsGroupements, 'Groupement');
                totalExported += groupementsData.length;
            }

            if (totalExported === 0) {
                throw new Error('Aucune donnée à exporter dans les catégories supportées');
            }

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `liste_deliberation_individuelles_${timestamp}.xlsx`;

            // Write and download file
            XLSX.writeFile(wb, filename);

            BoundouUtils.hideLoading('loadingIndicator');
            
            // Show success message with details
            const sheetsInfo = [];
            if (data.personne_physique?.length > 0) sheetsInfo.push(`${data.personne_physique.length} Personnes physiques`);
            if (data.personne_morale?.length > 0) sheetsInfo.push(`${data.personne_morale.length} Personnes morales`);
            if (data.groupement?.length > 0) sheetsInfo.push(`${data.groupement.length} Groupements`);
            
            BoundouUtils.showSuccess(
                `Fichier Excel généré avec succès: ${filename}\n${sheetsInfo.join(', ')}`
            );

            // Enable statistics generation
            if (window.DeliberationListUI && window.DeliberationListUI.enableStatisticsGeneration) {
                window.DeliberationListUI.enableStatisticsGeneration();
            }

            return {
                filename,
                totalExported,
                sheets: wb.SheetNames
            };

        } catch (error) {
            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showError(`Erreur de génération Excel: ${error.message}`);
            throw error;
        }
    };

    // Generate collective deliberation list with enhanced options support
    const generateCollectiveDeliberationList = async () => {
        try {
            const data = window.BoundouDashboard.processedCollectiveData;
            // For collective data, use the collective-specific options
            const advancedOptions = window.BoundouDashboard.advancedOptionsCollective || {};
            
            if (!data || data.length === 0) {
                throw new Error('Aucune donnée collective à traiter');
            }

            BoundouUtils.showLoading('loadingIndicator', 'Génération de la liste collective...');

            console.log('[DBG] Collective advanced options:', advancedOptions);
            console.log('[DBG] Mandataire separation enabled:', advancedOptions.enableMandataireSeparation);
            console.log('[DBG] Dual lists enabled:', advancedOptions.enableDualLists);

            const wb = XLSX.utils.book_new();
            let totalExported = 0;
            let filename;

            // Check if advanced options are enabled for collective data
            if (advancedOptions.enableMandataireSeparation || advancedOptions.enableDualLists) {
                console.log('[TGT] Enhanced collective generation with advanced options');
                
                // For collective data, we process all as physical persons since
                // collective data contains only multiple physical persons (no entity types)
                const collectiveSheets = await generateCollectivePhysicalPersonSheets(
                    data, 
                    'Collective', 
                    BoundouDataProcessor.getCollectiveOrderedColumns(),
                    advancedOptions
                );
                
                collectiveSheets.forEach(sheet => {
                    XLSX.utils.book_append_sheet(wb, sheet.worksheet, sheet.name);
                    totalExported += sheet.count;
                });
                
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                filename = `liste_deliberation_collective_enhanced_${timestamp}.xlsx`;
                
                XLSX.writeFile(wb, filename);
                
                BoundouUtils.hideLoading('loadingIndicator');
                BoundouUtils.showSuccess(
                    `Liste collective avec séparation générée: ${filename}\n${totalExported} entrées exportées`
                );
                
            } else {
                console.log('[LIST] Standard collective generation');
                
                // Standard collective generation
                const orderedColumns = BoundouDataProcessor.getCollectiveOrderedColumns();
                
                // Process data to format dates
                const processedData = data.map(row => {
                    const processedRow = {};
                    orderedColumns.forEach(col => {
                        if (col === 'Date_naissance') {
                            // Apply date formatting to Date_naissance field
                            processedRow[col] = formatDateToDDMMYYYY(row[col]) || row[col] || '';
                        } else {
                            processedRow[col] = row[col] || '';
                        }
                    });
                    return processedRow;
                });
                
                // Add row numbering to collective data
                const numberedProcessedData = addRowNumbering(processedData);
                
                // Create worksheet
                const ws = XLSX.utils.json_to_sheet(numberedProcessedData);
                
                // Set column widths for better readability
                const colWidths = orderedColumns.map(col => {
                    if (['Prenom', 'Nom', 'Sexe', 'Numero_piece', 'Telephone', 'Date_naissance', 'Residence'].includes(col)) {
                        return { wch: 25 }; // Wider for multi-line content
                    } else if (['Village', 'nicad', 'Num_parcel_2'].includes(col)) {
                        return { wch: 15 };
                    } else {
                        return { wch: 12 };
                    }
                });
                ws['!cols'] = colWidths;
                
                XLSX.utils.book_append_sheet(wb, ws, 'Liste Collective');

                // Generate filename with timestamp
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                filename = `liste_deliberation_collective_${timestamp}.xlsx`;

                // Write and download file
                XLSX.writeFile(wb, filename);
                totalExported = data.length;
                
                BoundouUtils.hideLoading('loadingIndicator');
                BoundouUtils.showSuccess(
                    `Fichier Excel généré avec succès: ${filename}\n${data.length} parcelles exportées`
                );
            }

            // Enable statistics generation
            if (window.DeliberationListUI && window.DeliberationListUI.enableStatisticsGeneration) {
                window.DeliberationListUI.enableStatisticsGeneration();
            }

            return {
                filename,
                totalExported,
                sheets: advancedOptions.enableMandataireSeparation ? ['Multiple sheets'] : ['Liste Collective']
            };

        } catch (error) {
            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showError(`Erreur lors de la génération collective: ${error.message}`);
            throw error;
        }
    };

    // Export preview data as Excel (for testing)
    const exportPreviewData = (entityType, data) => {
        try {
            if (!data || data.length === 0) {
                throw new Error('Aucune donnée de prévisualisation');
            }

            const wb = XLSX.utils.book_new();
            
            // Add row numbering to preview data
            const numberedData = addRowNumbering(data);
            const ws = XLSX.utils.json_to_sheet(numberedData);
            const sheetName = BoundouConfig.EXCEL.SHEET_NAMES[entityType.toUpperCase()] || entityType;
            
            XLSX.utils.book_append_sheet(wb, ws, truncateSheetName(sheetName));
            
            const filename = `preview_${entityType}_${Date.now()}.xlsx`;
            XLSX.writeFile(wb, filename);
            
            BoundouUtils.showSuccess(`Prévisualisation exportée: ${filename}`);
            
        } catch (error) {
            BoundouUtils.showError(`Erreur d'export: ${error.message}`);
        }
    };

    // Enhanced individual deliberation list with advanced options
    const generateEnhancedIndividualDeliberationList = async () => {
        try {
            const data = window.BoundouDashboard.processedIndividualData;
            const advancedOptions = window.BoundouDashboard.advancedOptions || {};
            
            console.log('[DBG] Enhanced generation called with data:', data);
            console.log('[CFG] Advanced options:', advancedOptions);
            
            // Diagnostic: Show all document types in the data
            if (data && typeof data === 'object') {
                console.log('[DBG] DIAGNOSTIC: Document types in your data:');
                Object.keys(data).forEach(entityType => {
                    const entityData = data[entityType] || [];
                    if (entityData.length > 0) {
                        const docTypes = entityData.map(row => getValue(row, 'Type_piece') || getValue(row, 'Type_piec') || 'NO_DOC');
                        const uniqueDocTypes = [...new Set(docTypes)];
                        console.log(`   ${entityType}: [${uniqueDocTypes.join(', ')}]`);
                    }
                });
            }
            
            if (!data || typeof data !== 'object') {
                throw new Error('Aucune donnée catégorisée à exporter');
            }

            BoundouUtils.showLoading('loadingIndicator', 'Génération de liste avec options avancées...');

            // Debug: Show which options are enabled
            console.log('[LIST] Options status:');
            console.log(`   - Dual Lists: ${advancedOptions.enableDualLists ? '[OK]' : '[ERR]'}`);
            console.log(`   - Mandataire Separation: ${advancedOptions.enableMandataireSeparation ? '[OK]' : '[ERR]'}`);
            console.log(`   - Age Threshold: ${advancedOptions.ageThreshold || 15}`);

            // Check if dual lists (Habitat/Agricole) are enabled
            if (advancedOptions.enableDualLists) {
                return await generateDualLists(data, advancedOptions);
            } else if (advancedOptions.enableMandataireSeparation) {
                // Even without dual lists, we can still do mandataire separation
                console.log('[TGT] Mandataire separation without dual lists');
                return await generateMandataireSeparatedLists(data, advancedOptions);
            } else {
                // Use standard generation
                return await generateIndividualDeliberationList();
            }

        } catch (error) {
            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showError(`Erreur génération avancée: ${error.message}`);
            throw error;
        }
    };

    // Generate separate Habitat and Agricole lists
    const generateDualLists = async (data, options) => {
        const wb = XLSX.utils.book_new();
        let totalExported = 0;

        // Process each entity type
        const entityTypes = ['personne_physique', 'personne_morale', 'groupement'];
        
        for (const entityType of entityTypes) {
            const entityData = data[entityType] || [];
            if (entityData.length === 0) continue;

            // Get selected columns
            const selectedColumns = window.BoundouDashboard.selectedColumns;
            let columns = selectedColumns?.[entityType] || Object.keys(entityData[0] || {});
            
            // Ensure 'superficie' is always included (case-insensitive check)
            const hasSuperficieVariant = columns.some(col => col.toLowerCase() === 'superficie');
            if (!hasSuperficieVariant) {
                // Check if any case variant exists in the data
                const dataKeys = Object.keys(entityData[0] || {});
                const superficieKey = dataKeys.find(key => key.toLowerCase() === 'superficie');
                if (superficieKey) {
                    columns = [...columns, superficieKey];
                } else {
                    columns = [...columns, 'superficie']; // Add default name if not found
                }
            }
            
            // Ensure 'num_parcel' is always included (case-insensitive check)
            // For individual data, prioritize 'Num_parcel', for collective data prioritize 'Num_parcel_2'
            const hasNumParcelVariant = columns.some(col => 
                col.toLowerCase() === 'num_parcel' || 
                col.toLowerCase() === 'num_parcel_2' ||
                col === 'Num_parcel' ||
                col === 'Num_parcel_2'
            );
            if (!hasNumParcelVariant) {
                // Check if any case variant exists in the data
                const dataKeys = Object.keys(entityData[0] || {});
                // For individual data, prioritize Num_parcel first
                const numParcelKey = dataKeys.find(key => key === 'Num_parcel') ||
                                   dataKeys.find(key => key === 'num_parcel') ||
                                   dataKeys.find(key => key === 'Num_parcel_2') ||
                                   dataKeys.find(key => 
                                       key.toLowerCase() === 'numero_parcelle' ||
                                       key.toLowerCase() === 'id_parcelle'
                                   );
                if (numParcelKey) {
                    columns = [...columns, numParcelKey];
                } else {
                    columns = [...columns, 'Num_parcel']; // Add default individual field name
                }
            }

            // Separate by usage type based on entity type
            let habitatData, agricoleData;
            
            if (entityType === 'personne_physique') {
                // Use type_usag for individual data (case-insensitive)
                habitatData = entityData.filter(row => 
                    (getValue(row, 'type_usag') || '').toLowerCase() === 'habitat'
                );
                agricoleData = entityData.filter(row => 
                    (getValue(row, 'type_usag') || '').toLowerCase() !== 'habitat'
                );
            } else if (entityType === 'groupement') {
                // Use type_usa for collective data (groupement) (case-insensitive)
                habitatData = entityData.filter(row => 
                    (getValue(row, 'type_usa') || '').toLowerCase() === 'habitat'
                );
                agricoleData = entityData.filter(row => 
                    (getValue(row, 'type_usa') || '').toLowerCase() !== 'habitat'
                );
            } else {
                // For personne_morale, don't separate by usage
                habitatData = [];
                agricoleData = [];
            }

            // Only process if we have usage-based separation
            if (entityType === 'personne_physique' || entityType === 'groupement') {
                // Generate Habitat sheets
                if (habitatData.length > 0) {
                    let habitatSheets;
                    if (entityType === 'personne_physique') {
                        // Use individual processing for individual data
                        habitatSheets = await generateIndividualEntitySheets(
                            habitatData, 
                            entityType, 
                            'Habitat', 
                            columns, 
                            options
                        );
                    } else {
                        // Use collective processing for collective data (groupement)
                        habitatSheets = await generateEntitySheets(
                            habitatData, 
                            entityType, 
                            'Habitat', 
                            columns, 
                            options
                        );
                    }
                    habitatSheets.forEach(sheet => {
                        XLSX.utils.book_append_sheet(wb, sheet.worksheet, sheet.name);
                        totalExported += sheet.count;
                    });
                }

                // Generate Agricole sheets
                if (agricoleData.length > 0) {
                    let agricoleSheets;
                    if (entityType === 'personne_physique') {
                        // Use individual processing for individual data
                        agricoleSheets = await generateIndividualEntitySheets(
                            agricoleData, 
                            entityType, 
                            'Agricole', 
                            columns, 
                            options
                        );
                    } else {
                        // Use collective processing for collective data (groupement)
                        agricoleSheets = await generateEntitySheets(
                            agricoleData, 
                            entityType, 
                            'Agricole', 
                            columns, 
                            options
                        );
                    }
                    agricoleSheets.forEach(sheet => {
                        XLSX.utils.book_append_sheet(wb, sheet.worksheet, sheet.name);
                        totalExported += sheet.count;
                    });
                }
            } else {
                // For personne_morale, keep all data together (no usage separation)
                const entitySheets = await generateEntitySheets(
                    entityData, 
                    entityType, 
                    'Tous', // Use "Tous" to indicate all usage types together
                    columns, 
                    options
                );
                entitySheets.forEach(sheet => {
                    XLSX.utils.book_append_sheet(wb, sheet.worksheet, sheet.name);
                    totalExported += sheet.count;
                });
            }
        }

        // Generate and download file
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `liste_deliberation_habitat_agricole_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        
        BoundouUtils.hideLoading('loadingIndicator');
        BoundouUtils.showSuccess(
            `Listes Habitat/Agricole générées: ${filename}\n${totalExported} entrées exportées`
        );

        // Enable statistics generation
        if (window.DeliberationListUI && window.DeliberationListUI.enableStatisticsGeneration) {
            window.DeliberationListUI.enableStatisticsGeneration();
        }

        return { success: true, filename, totalExported };
    };

    // Generate lists with mandataire separation only (no dual lists)
    const generateMandataireSeparatedLists = async (data, options) => {
        const wb = XLSX.utils.book_new();
        let totalExported = 0;

        console.log('[LIST] Generating mandataire-separated lists without dual categories');

        // Process each entity type
        const entityTypes = ['personne_physique', 'personne_morale', 'groupement'];
        
        for (const entityType of entityTypes) {
            const entityData = data[entityType] || [];
            if (entityData.length === 0) continue;

            // Get selected columns
            const selectedColumns = window.BoundouDashboard.selectedColumns;
            let columns = selectedColumns?.[entityType] || Object.keys(entityData[0] || {});
            
            // Ensure 'superficie' is always included (case-insensitive check)
            const hasSuperficieVariant = columns.some(col => col.toLowerCase() === 'superficie');
            if (!hasSuperficieVariant) {
                // Check if any case variant exists in the data
                const dataKeys = Object.keys(entityData[0] || {});
                const superficieKey = dataKeys.find(key => key.toLowerCase() === 'superficie');
                if (superficieKey) {
                    columns = [...columns, superficieKey];
                } else {
                    columns = [...columns, 'superficie']; // Add default name if not found
                }
            }
            
            // Ensure 'num_parcel' is always included (case-insensitive check)
            // For individual data, prioritize 'Num_parcel', for collective data prioritize 'Num_parcel_2'
            const hasNumParcelVariant = columns.some(col => 
                col.toLowerCase() === 'num_parcel' || 
                col.toLowerCase() === 'num_parcel_2' ||
                col === 'Num_parcel' ||
                col === 'Num_parcel_2'
            );
            if (!hasNumParcelVariant) {
                // Check if any case variant exists in the data
                const dataKeys = Object.keys(entityData[0] || {});
                // For individual data, prioritize Num_parcel first
                const numParcelKey = dataKeys.find(key => key === 'Num_parcel') ||
                                   dataKeys.find(key => key === 'num_parcel') ||
                                   dataKeys.find(key => key === 'Num_parcel_2') ||
                                   dataKeys.find(key => 
                                       key.toLowerCase() === 'numero_parcelle' ||
                                       key.toLowerCase() === 'id_parcelle'
                                   );
                if (numParcelKey) {
                    columns = [...columns, numParcelKey];
                } else {
                    columns = [...columns, 'Num_parcel']; // Add default individual field name
                }
            }

            // Generate sheets with mandataire separation - use appropriate function for data type
            let entitySheets;
            if (entityType === 'personne_physique') {
                // Use individual processing for individual data
                entitySheets = await generateIndividualEntitySheets(
                    entityData, 
                    entityType, 
                    'Standard', // Use "Standard" instead of usage type
                    columns, 
                    options
                );
            } else {
                // Use collective processing for collective data (personne_morale, groupement)
                console.log(`[BUILD] Using collective processing for ${entityType}`);
                console.log(`[BUILD] Data sample for ${entityType}:`, entityData.slice(0, 2));
                console.log(`[BUILD] Columns for ${entityType}:`, columns);
                
                // Debug superficie specifically
                if (entityData.length > 0) {
                    const superficieValues = entityData.slice(0, 3).map(row => ({
                        direct: row.superficie,
                        getValue: getValue(row, 'superficie'),
                        allKeys: Object.keys(row).filter(k => k.toLowerCase().includes('superficie'))
                    }));
                    console.log(`[BUILD] ${entityType} superficie debug before collective processing:`, superficieValues);
                }
                
                entitySheets = await generateEntitySheets(
                    entityData, 
                    entityType, 
                    'Standard', // Use "Standard" instead of usage type
                    columns, 
                    options
                );
            }
            
            entitySheets.forEach(sheet => {
                XLSX.utils.book_append_sheet(wb, sheet.worksheet, sheet.name);
                totalExported += sheet.count;
            });
        }

        // Generate and download file
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `liste_deliberation_mandataire_separated_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        
        BoundouUtils.hideLoading('loadingIndicator');
        BoundouUtils.showSuccess(
            `Listes avec séparation mandataire générées: ${filename}\n${totalExported} entrées exportées`
        );

        // Enable statistics generation
        if (window.DeliberationListUI && window.DeliberationListUI.enableStatisticsGeneration) {
            window.DeliberationListUI.enableStatisticsGeneration();
        }

        return { success: true, filename, totalExported };
    };

    // Generate sheets for collective data - all records are physical persons
    const generateCollectivePhysicalPersonSheets = async (data, usageType, columns, options) => {
        const sheets = [];
        
        console.log(`[TGT] Generating collective physical person sheets for ${data.length} records`);
        console.log(`[CFG] Options:`, options);
        
        // Debug: Show sample data fields to verify field names
        if (data.length > 0) {
            const sampleRecord = data[0];
            console.log(`[NOTE] Sample collective record fields:`, Object.keys(sampleRecord));
            console.log(`[NOTE] Sample type_usa:`, sampleRecord.type_usa);
            console.log(`[NOTE] Sample Type_piec:`, sampleRecord.Type_piec);
            console.log(`[NOTE] Sample Date_nai:`, sampleRecord.Date_nai);
            
            // Show all unique usage types in the data (case-insensitive)
            const allUsageTypes = data.map(row => getValue(row, 'type_usa')).filter(Boolean);
            const uniqueUsageTypes = [...new Set(allUsageTypes)];
            console.log(`[NOTE] All unique usage types found:`, uniqueUsageTypes);
            
            // Show all unique document types in the data (case-insensitive)
            const allDocTypes = data.map(row => getValue(row, 'Type_piec')).filter(Boolean);
            const uniqueDocTypes = [...new Set(allDocTypes)];
            console.log(`[NOTE] All unique document types found:`, uniqueDocTypes);
        }
        
        // Check if dual lists (Habitat/Agricole) separation is enabled
        if (options.enableDualLists) {
            console.log('[HOME][FIELD] Dual lists separation enabled for collective data');
            
            // Separate records by usage type using type_usa field
            const habitatRecords = data.filter(record => {
                const usage = (record.type_usa || '').toString().toLowerCase().trim();
                return usage === 'habitat';
            });
            
            const agricoleRecords = data.filter(record => {
                const usage = (record.type_usa || '').toString().toLowerCase().trim();
                return usage === 'agriculture_pluviale' || usage === 'agriculture_traditionnelle' || 
                       usage.includes('agricol');
            });

            // Records that don't fall into habitat or agricole
            const otherUsageRecords = data.filter(record => {
                const usage = (record.type_usa || '').toString().toLowerCase().trim();
                const isHabitat = usage === 'habitat';
                const isAgricole = usage === 'agriculture_pluviale' || usage === 'agriculture_traditionnelle' || 
                                  usage.includes('agricol');
                return !isHabitat && !isAgricole;
            });
            
            console.log(`[HOME] Habitat records: ${habitatRecords.length}`);
            console.log(`[FIELD] Agricole records: ${agricoleRecords.length}`);
            if (otherUsageRecords.length > 0) {
                console.log(`[OTHER] Other usage records: ${otherUsageRecords.length}`);
            }
            
            // Process Habitat records
            if (habitatRecords.length > 0) {
                const habitatSheets = await processCollectiveRecordsByUsage(
                    habitatRecords, 
                    'Habitat', 
                    columns, 
                    options
                );
                sheets.push(...habitatSheets);
            }
            
            // Process Agricole records
            if (agricoleRecords.length > 0) {
                const agricoleSheets = await processCollectiveRecordsByUsage(
                    agricoleRecords, 
                    'Agricole', 
                    columns, 
                    options
                );
                sheets.push(...agricoleSheets);
            }

            // Process Other usage records (don't drop them)
            if (otherUsageRecords.length > 0) {
                const otherSheets = await processCollectiveRecordsByUsage(
                    otherUsageRecords, 
                    'Autres', 
                    columns, 
                    options
                );
                sheets.push(...otherSheets);
            }
            
        } else {
            // Simple processing without usage separation
            const allSheets = await processCollectiveRecordsByUsage(
                data, 
                usageType, 
                columns, 
                options
            );
            sheets.push(...allSheets);
        }
        
        return sheets;
    };

    // Process collective records by usage type with optional mandataire separation
    const processCollectiveRecordsByUsage = async (data, usageType, columns, options) => {
        const sheets = [];
        
        // Check if mandataire separation is enabled
        if (options.enableMandataireSeparation) {
            const ageThreshold = options.ageThreshold || 15;
            
            console.log(`[TGT] Collective mandataire separation enabled for ${usageType} with age threshold: ${ageThreshold}`);
            
            // For collective data, classify entire records into categories
            const standardRecords = [];
            const extraitMajorRecords = [];
            const extraitMinorRecords = [];
            
            data.forEach((record, index) => {
                // Classify the entire collective record based on document type and age
                const category = getCollectiveRecordCategory(record, ageThreshold);
                
                const enrichedRecord = {
                    ...record, // Keep entire record intact with all effectaires
                    _recordType: category,
                    _originalIndex: index
                };
                
                if (category === 'standard') {
                    standardRecords.push(enrichedRecord);
                } else if (category === 'extrait_major') {
                    extraitMajorRecords.push(enrichedRecord);
                } else if (category === 'extrait_minor') {
                    extraitMinorRecords.push(enrichedRecord);
                }
            });
            
            console.log(`[STAT] ${usageType} separation results:`);
            console.log(`   [TGT] Standard (all ages): ${standardRecords.length}`);
            console.log(`    Extrait Major: ${extraitMajorRecords.length}`);
            console.log(`   [CHILD] Extrait Minor: ${extraitMinorRecords.length}`);
            
            // Generate separate sheets for each category
            // VALIDATION: Ensure no data loss in collective processing
            const totalCollectiveProcessed = standardRecords.length + extraitMajorRecords.length + extraitMinorRecords.length;
            if (totalCollectiveProcessed !== data.length) {
                console.error(`MISSING COLLECTIVE RECORDS: ${data.length - totalCollectiveProcessed} not categorized!`);
            } else {
                console.log(`All ${data.length} collective records accounted for`);
            }
            
            if (standardRecords.length > 0) {
                const ws = createEntityWorksheet(standardRecords, columns, 'physiques');
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Standard_Mandataire`),
                    count: standardRecords.length
                });
                console.log(`[OK] Created sheet for ${usageType} standard mandataires (all ages): ${standardRecords.length} records`);
            }
            
            if (extraitMajorRecords.length > 0) {
                const ws = createEntityWorksheet(extraitMajorRecords, columns, 'physiques');
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Extrait_MAJ_Mandataire`),
                    count: extraitMajorRecords.length
                });
                console.log(`[OK] Created sheet for ${usageType} extrait major mandataires: ${extraitMajorRecords.length} records`);
            }

            if (extraitMinorRecords.length > 0) {
                const ws = createEntityWorksheet(extraitMinorRecords, columns, 'physiques');
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Extrait_MIN_Mandataire`),
                    count: extraitMinorRecords.length
                });
                console.log(`[OK] Created sheet for ${usageType} extrait minor mandataires: ${extraitMinorRecords.length} records`);
            }
            
        } else {
            // Simple processing without mandataire separation
            const ws = createEntityWorksheet(data, columns, 'physiques');
            sheets.push({
                worksheet: ws,
                name: truncateSheetName(`${usageType}_Physique`),
                count: data.length
            });
            console.log(`[OK] Created simple sheet for ${usageType}: ${data.length} records`);
        }
        
        return sheets;
    };

    // Check if a collective record should be classified as mandataire based on document type and age
    const getCollectiveRecordCategory = (record, ageThreshold) => {
        // For collective data, use Type_piec field for document type
        const docType = record.Type_piec || '';
        const docTypeStr = String(docType).toLowerCase().trim();
        
        // Check for extrait de naissance
        const hasExtraitDocument = docTypeStr === 'extrait_de_naissance' || 
                                   docTypeStr === 'extrait de naissance';
        
        // Check for standard documents (CNI, passport, etc.)
        const hasStandardDocument = docTypeStr === 'cni' || 
                                   docTypeStr === 'passeport' || 
                                   docTypeStr === 'recepisse_cni' ||
                                   docTypeStr.includes('cni') ||
                                   docTypeStr.includes('passeport') ||
                                   docTypeStr.includes('recepisse');
        
        // Get age
        let age = null;
        if (record.Date_nai) {
            age = calculateAge(record.Date_nai);
        }
        
        // Classification logic:
        // 1. Minor with extrait document → extrait_minor
        // 2. Adult with extrait document → extrait_major  
        // 3. Any age with standard document → standard (no age separation)
        
        if (hasExtraitDocument) {
            if (age !== null && age <= ageThreshold) {
                console.log(`[TGT] Collective record: extrait document, age ${age} ≤ ${ageThreshold} → MINOR: ${record.Nom || 'Unknown'}`);
                return 'extrait_minor';
            } else if (age !== null && age > ageThreshold) {
                console.log(`[TGT] Collective record: extrait document, age ${age} > ${ageThreshold} → MAJOR: ${record.Nom || 'Unknown'}`);
                return 'extrait_major';
            } else {
                console.log(`[TGT] Collective record: extrait document, no age → MINOR (default): ${record.Nom || 'Unknown'}`);
                return 'extrait_minor';
            }
        } else if (hasStandardDocument || !hasExtraitDocument) {
            // Standard documents or unknown documents - no age separation needed
            console.log(`[OK] Collective record: standard document → STANDARD (no age check): ${record.Nom || 'Unknown'}`);
            return 'standard';
        }
        
        // Default fallback
        console.log(`[OK] Collective record: fallback → STANDARD: ${record.Nom || 'Unknown'}`);
        return 'standard';
    };
    
    // Generate sheets specifically for individual data (personne_physique)
    const generateIndividualEntitySheets = async (data, entityType, usageType, columns, options) => {
        const sheets = [];
        
        // Check if mandataire separation is enabled
        if (options.enableMandataireSeparation) {
            const ageThreshold = options.ageThreshold || 15;
            
            console.log(`[DBG] Individual Mandataire separation enabled for ${entityType} with age threshold: ${ageThreshold}`);
            console.log(`[STAT] Processing ${data.length} individual records for separation`);
            
            // Debug: Show sample individual data fields
            if (data.length > 0) {
                const sampleRecord = data[0];
                console.log(`[DBG] Sample individual record fields:`, Object.keys(sampleRecord));
                console.log(`[DBG] Sample Type_piece:`, sampleRecord.Type_piece);
                console.log(`[DBG] Sample Date_naiss:`, sampleRecord.Date_naiss);
                console.log(`[DBG] Sample Age:`, sampleRecord.Age);
                
                // Show all unique document types in the individual data
                const allDocTypes = data.map(row => getValue(row, 'Type_piece')).filter(Boolean);
                const uniqueDocTypes = [...new Set(allDocTypes)];
                console.log(`[DBG] All unique individual document types found:`, uniqueDocTypes);
            }
            
            // Helper function to check if individual record has extrait document
            const hasExtraitDocumentIndividual = (row) => {
                const docField = getValue(row, 'Type_piece');  // Case-insensitive lookup for individual field
                
                if (!docField) return false;
                
                const fieldStr = String(docField).toLowerCase().trim();
                // More flexible matching for extrait de naissance
                const hasExtrait = fieldStr === 'extrait_de_naissance' || 
                                  fieldStr === 'extrait de naissance' ||
                                  fieldStr.includes('extrait') && fieldStr.includes('naissance');
                
                if (hasExtrait) {
                    console.log(`[TGT] Found individual extrait document: "${docField}"`);
                }
                
                return hasExtrait;
            };
            
            // Helper function to check if individual record has CNI or other standard ID documents
            const hasStandardDocumentIndividual = (row) => {
                const docField = getValue(row, 'Type_piece');  // Case-insensitive lookup for individual field
                
                if (!docField) return false;
                
                const fieldStr = String(docField).toLowerCase().trim();
                // Standard documents: CNI, passeport, etc. - but NOT extrait de naissance
                const isStandard = (fieldStr === 'cni' || 
                                   fieldStr === 'passeport' ||
                                   fieldStr === 'passport' ||
                                   fieldStr === 'carte_nationale_identite' ||
                                   fieldStr === 'carte d\'identité' ||
                                   fieldStr === 'carte d\'identite') &&
                                   !hasExtraitDocumentIndividual(row);
                
                return isStandard;
            };
            
            // Helper function to get individual record age
            const getIndividualRecordAge = (row) => {
                // Use Date_naiss for individual data (not Date_nai) - case-insensitive lookup
                const dateField = getValue(row, 'Date_naiss');
                
                if (!dateField) {
                    console.log(`[WARN] Individual record missing Date_naiss field:`, row);
                    return null;
                }
                
                const age = calculateAge(dateField);
                if (age === null) {
                    console.log(`[WARN] Could not calculate age for individual record with Date_naiss: "${dateField}"`);
                }
                
                return age;
            };
            
            // Separate records based on age and document type
            const majorExtraitRecords = [];
            const minorExtraitRecords = [];
            const majorStandardRecords = [];
            const minorStandardRecords = [];
            
            // Process each individual record
            data.forEach(row => {
                const age = getIndividualRecordAge(row);
                
                // Default to treating records without age as adults (major)
                // This ensures NO records are skipped due to missing dates
                const isMajor = age === null ? true : age >= ageThreshold;
                const hasExtrait = hasExtraitDocumentIndividual(row);
                const hasStandard = hasStandardDocumentIndividual(row);
                
                if (age === null) {
                    console.log(`[WARN] Individual record without age, defaulting to MAJOR category:`, row.prenom, row.nom);
                }
                
                if (hasExtrait) {
                    if (isMajor) {
                        majorExtraitRecords.push(row);
                        console.log(`[LIST] Added individual to major extrait: age ${age || 'N/A'}, doc: ${row.Type_piece}`);
                    } else {
                        minorExtraitRecords.push(row);
                        console.log(`[LIST] Added individual to minor extrait: age ${age}, doc: ${row.Type_piece}`);
                    }
                } else if (hasStandard) {
                    if (isMajor) {
                        majorStandardRecords.push(row);
                        console.log(`[LIST] Added individual to major standard: age ${age || 'N/A'}, doc: ${row.Type_piece}`);
                    } else {
                        minorStandardRecords.push(row);
                        console.log(`[LIST] Added individual to minor standard: age ${age}, doc: ${row.Type_piece}`);
                    }
                } else {
                    // Default: Records with unknown/missing document types go to major standard category
                    // This ensures ALL records are included in the output
                    majorStandardRecords.push(row);
                    console.log(`[?] Individual record with unknown document type added to MAJOR STANDARD: ${row.Type_piece}, age: ${age || 'N/A'}`);
                }
            });
            
            console.log(`[STAT] Individual separation results:`);
            console.log(`   - Major extrait: ${majorExtraitRecords.length}`);
            console.log(`   - Minor extrait: ${minorExtraitRecords.length}`);
            console.log(`   - Major standard: ${majorStandardRecords.length}`);
            console.log(`   - Minor standard: ${minorStandardRecords.length}`);
            
            // VALIDATION: Ensure all records are accounted for
            const totalProcessed = majorExtraitRecords.length + minorExtraitRecords.length + 
                                   majorStandardRecords.length + minorStandardRecords.length;
            console.log(`[OK] VALIDATION: Input records: ${data.length}, Output records: ${totalProcessed}`);
            
            if (totalProcessed !== data.length) {
                console.error(`[ERR] MISSING RECORDS: ${data.length - totalProcessed} records were not categorized!`);
                BoundouUtils.showError(`Attention: ${data.length - totalProcessed} enregistrements n'ont pas été catégorisés`);
            } else {
                console.log(`[OK] All ${data.length} records successfully categorized - NO MISSING DATA`);
            }
            
            // Create separate sheets for each category
            if (majorExtraitRecords.length > 0) {
                const sheetName = truncateSheetName(`${entityType}_${usageType}_Majeurs_Extrait`);
                console.log(`[DOC] Creating individual sheet: ${sheetName} with ${majorExtraitRecords.length} records`);
                
                const sheetData = majorExtraitRecords.map(row => {
                    const filteredRow = {};
                    columns.forEach(col => {
                        if (row.hasOwnProperty(col)) {
                            // Apply date formatting to Date_naiss field for individual data
                            if (col === 'Date_naiss') {
                                filteredRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                            } else {
                                filteredRow[col] = row[col];
                            }
                        }
                    });
                    return filteredRow;
                });

                // Add row numbering to sheet data
                const numberedSheetData = addRowNumbering(sheetData);
                const worksheet = XLSX.utils.json_to_sheet(numberedSheetData);
                
                sheets.push({
                    name: sheetName,
                    worksheet: worksheet,
                    count: majorExtraitRecords.length
                });
            }
            
            if (minorExtraitRecords.length > 0) {
                const sheetName = truncateSheetName(`${entityType}_${usageType}_Mineurs_Extrait`);
                console.log(`[DOC] Creating individual sheet: ${sheetName} with ${minorExtraitRecords.length} records`);
                
                const sheetData = minorExtraitRecords.map(row => {
                    const filteredRow = {};
                    columns.forEach(col => {
                        if (row.hasOwnProperty(col)) {
                            // Apply date formatting to Date_naiss field for individual data
                            if (col === 'Date_naiss') {
                                filteredRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                            } else {
                                filteredRow[col] = row[col];
                            }
                        }
                    });
                    return filteredRow;
                });

                // Add row numbering to sheet data
                const numberedSheetData = addRowNumbering(sheetData);
                const worksheet = XLSX.utils.json_to_sheet(numberedSheetData);
                
                sheets.push({
                    name: sheetName,
                    worksheet: worksheet,
                    count: minorExtraitRecords.length
                });
            }
            
            if (majorStandardRecords.length > 0) {
                const sheetName = truncateSheetName(`${entityType}_${usageType}_Majeurs_CNI`);
                console.log(`[DOC] Creating individual sheet: ${sheetName} with ${majorStandardRecords.length} records`);
                
                const sheetData = majorStandardRecords.map(row => {
                    const filteredRow = {};
                    columns.forEach(col => {
                        if (row.hasOwnProperty(col)) {
                            // Apply date formatting to Date_naiss field for individual data
                            if (col === 'Date_naiss') {
                                filteredRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                            } else {
                                filteredRow[col] = row[col];
                            }
                        }
                    });
                    return filteredRow;
                });

                // Add row numbering to sheet data
                const numberedSheetData = addRowNumbering(sheetData);
                const worksheet = XLSX.utils.json_to_sheet(numberedSheetData);
                
                sheets.push({
                    name: sheetName,
                    worksheet: worksheet,
                    count: majorStandardRecords.length
                });
            }
            
            if (minorStandardRecords.length > 0) {
                const sheetName = truncateSheetName(`${entityType}_${usageType}_Mineurs_CNI`);
                console.log(`[DOC] Creating individual sheet: ${sheetName} with ${minorStandardRecords.length} records`);
                
                const sheetData = minorStandardRecords.map(row => {
                    const filteredRow = {};
                    columns.forEach(col => {
                        if (row.hasOwnProperty(col)) {
                            // Apply date formatting to Date_naiss field for individual data
                            if (col === 'Date_naiss') {
                                filteredRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                            } else {
                                filteredRow[col] = row[col];
                            }
                        }
                    });
                    return filteredRow;
                });

                // Add row numbering to sheet data
                const numberedSheetData = addRowNumbering(sheetData);
                const worksheet = XLSX.utils.json_to_sheet(numberedSheetData);
                
                sheets.push({
                    name: sheetName,
                    worksheet: worksheet,
                    count: minorStandardRecords.length
                });
            }
            
        } else {
            // No mandataire separation - create single sheet for individual data
            const sheetName = truncateSheetName(`${entityType}_${usageType}`);
            console.log(`[DOC] Creating individual sheet without separation: ${sheetName} with ${data.length} records`);
            
            const sheetData = data.map(row => {
                const filteredRow = {};
                columns.forEach(col => {
                    if (row.hasOwnProperty(col)) {
                        // Apply date formatting to Date_naiss field for individual data
                        if (col === 'Date_naiss') {
                            filteredRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else {
                            filteredRow[col] = row[col];
                        }
                    }
                });
                return filteredRow;
            });

            // Add row numbering to sheet data
            const numberedSheetData = addRowNumbering(sheetData);
            const worksheet = XLSX.utils.json_to_sheet(numberedSheetData);
            
            sheets.push({
                name: sheetName,
                worksheet: worksheet,
                count: data.length
            });
        }
        
        return sheets;
    };

    // Generate sheets for a specific entity type and usage category (collective data)
    const generateEntitySheets = async (data, entityType, usageType, columns, options) => {
        const sheets = [];
        
        // Check if mandataire separation is enabled
        if (options.enableMandataireSeparation) {
            const ageThreshold = options.ageThreshold || 15;
            
            console.log(`[DBG] Mandataire separation enabled for ${entityType} with age threshold: ${ageThreshold}`);
            console.log(`[STAT] Processing ${data.length} records for separation`);
            
            // Debug: Show sample data fields to verify field names
            if (data.length > 0) {
                const sampleRecord = data[0];
                console.log(`[NOTE] Sample record fields:`, Object.keys(sampleRecord));
                console.log(`[NOTE] Sample Type_piece:`, sampleRecord.Type_piece);
                console.log(`[NOTE] Sample Date_naiss:`, sampleRecord.Date_naiss);
                console.log(`[NOTE] Sample Type_piec:`, sampleRecord.Type_piec);
                console.log(`[NOTE] Sample Age:`, sampleRecord.Age);
                
                // Show all unique document types in the data
                const allDocTypes = data.map(row => row.Type_piec).filter(Boolean);
                const uniqueDocTypes = [...new Set(allDocTypes)];
                console.log(`[NOTE] All unique document types found:`, uniqueDocTypes);
            }
            
            // Helper function to get age from record
            const getRecordAge = (row) => {
                const collectiveDateField = row.Date_nai;
                if (collectiveDateField) {
                    const calculatedAge = calculateAge(collectiveDateField);
                    if (calculatedAge !== null) return calculatedAge;
                }
                if (row.Age && typeof row.Age === 'number' && row.Age < 150) return row.Age;
                return null;
            };

            // Single-pass categorization to prevent overlapping or missing records
            const underageMandataires = [];
            const majorMandataires = [];
            const standardDocuments = [];
            const otherDocuments = [];
            const unknownDocuments = [];

            data.forEach(row => {
                const docField = row.Type_piec || row.Type_piece || '';
                const fieldStr = String(docField).toLowerCase().trim();
                const age = getRecordAge(row);
                const isMajor = age === null ? true : age > ageThreshold;

                const isExtrait = fieldStr === 'extrait_de_naissance' || 
                                 fieldStr === 'extrait de naissance' ||
                                 (fieldStr.includes('extrait') && fieldStr.includes('naissance'));
                
                const isStandard = !isExtrait && (
                    fieldStr === 'cni' || fieldStr === 'passeport' || fieldStr === 'passport' ||
                    fieldStr === 'carte_nationale_identite' || fieldStr === 'acni' ||
                    fieldStr === 'recepisse_cni' || fieldStr === 'attestation_cni_1' ||
                    fieldStr === 'carte residence' ||
                    fieldStr.includes('cni') || fieldStr.includes('passeport') || fieldStr.includes('recepisse')
                );
                
                const isOther = !isExtrait && !isStandard && (
                    fieldStr === 'autres' || fieldStr.includes('autre') ||
                    fieldStr === 'option_7' || fieldStr.includes('option')
                );

                if (isExtrait) {
                    if (isMajor) { majorMandataires.push(row); }
                    else { underageMandataires.push(row); }
                } else if (isStandard) {
                    standardDocuments.push(row);
                } else if (isOther) {
                    otherDocuments.push(row);
                } else {
                    unknownDocuments.push(row);
                }
            });

            const totalCategorized = underageMandataires.length + majorMandataires.length + 
                                    standardDocuments.length + otherDocuments.length + unknownDocuments.length;
            console.log('[LIST] Separation results for ' + entityType + ': ' + totalCategorized + '/' + data.length);
            if (totalCategorized !== data.length) {
                console.error('[ERR] MISSING: ' + (data.length - totalCategorized) + ' records not categorized!');
            }

            // Create sheets for each category (only if they have data)
            if (underageMandataires.length > 0) {
                const ws = createEntityWorksheet(underageMandataires, columns, entityType);
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Extrait_MIN_Mandataire`),
                    count: underageMandataires.length
                });
                console.log(`[OK] Created sheet for underage mandataires: ${underageMandataires.length} records`);
            }

            if (majorMandataires.length > 0) {
                const ws = createEntityWorksheet(majorMandataires, columns, entityType);
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Extrait_MAJ_Mandataire`),
                    count: majorMandataires.length
                });
                console.log(`[OK] Created sheet for major mandataires: ${majorMandataires.length} records`);
            }

            if (standardDocuments.length > 0) {
                const ws = createEntityWorksheet(standardDocuments, columns, entityType);
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Standard_Mandataire`),
                    count: standardDocuments.length
                });
                console.log(`[OK] Created sheet for standard documents (CNI, passeport): ${standardDocuments.length} records`);
            }

            if (otherDocuments.length > 0) {
                const ws = createEntityWorksheet(otherDocuments, columns, entityType);
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Autres_Mandataire`),
                    count: otherDocuments.length
                });
                console.log(`[OK] Created sheet for other documents (Autres/option_7): ${otherDocuments.length} records`);
            }

            if (unknownDocuments.length > 0) {
                const ws = createEntityWorksheet(unknownDocuments, columns, entityType);
                sheets.push({
                    worksheet: ws,
                    name: truncateSheetName(`${usageType}_Inconnus_Mandataire`),
                    count: unknownDocuments.length
                });
                console.log(`[OK] Created sheet for unknown documents: ${unknownDocuments.length} records`);
            }

        } else {
            // Create single sheet for this entity/usage type
            const ws = createEntityWorksheet(data, columns, entityType);
            const entityDisplayName = {
                'personne_physique': 'Physiques',
                'personne_morale': 'Morales', 
                'groupement': 'Groupements'
            }[entityType] || entityType;
            
            sheets.push({
                worksheet: ws,
                name: truncateSheetName(`${usageType}_${entityDisplayName}`),
                count: data.length
            });
        }

        return sheets;
    };

    // Create worksheet for entity data with proper formatting
    const createEntityWorksheet = (data, columns, entityType) => {
        // Apply date formatting and process data
        const processedData = data.map(row => {
            const orderedRow = {};
            columns.forEach(col => {
                let value = row[col] || '';
                
                // Apply date formatting to ALL date columns including Date_nai
                if (col === 'Date_naiss' || col === 'Creation' || col === 'Date_naissance' || col === 'Date_nai') {
                    value = formatDateToDDMMYYYY(value) || value;
                }
                
                // For collective data, preserve multi-line content
                // XLSX handles \n natively — no extra quoting needed
                if (typeof value === 'string' && value.includes('\n')) {
                    value = value.trim();
                }
                
                orderedRow[col] = value;
            });
            return orderedRow;
        });

        // Add row numbering to processed data
        const numberedProcessedData = addRowNumbering(processedData);
        const ws = XLSX.utils.json_to_sheet(numberedProcessedData);
        
        // Enable text wrapping for multi-line content in collective data
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let row = range.s.r; row <= range.e.r; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                if (ws[cellAddress]) {
                    // Enable text wrapping for cells with line breaks
                    if (typeof ws[cellAddress].v === 'string' && ws[cellAddress].v.includes('\n')) {
                        ws[cellAddress].s = { alignment: { wrapText: true, vertical: 'top' } };
                    }
                }
            }
        }
        
        // Set column widths based on entity type and collective data considerations
        const colWidths = columns.map(col => {
            if (['Village', 'Denominat', 'Prenom', 'Nom'].includes(col)) {
                return { wch: 25 }; // Wider for multi-line names
            } else if (['Date_naiss', 'Creation', 'Date_naissance', 'Date_nai'].includes(col)) {
                return { wch: 12 };
            } else if (['Telephone', 'Num_piece', 'Numero', 'Numero_piece'].includes(col)) {
                return { wch: 18 }; // Wider for multi-line phone numbers
            } else if (['Residence'].includes(col)) {
                return { wch: 22 }; // Wider for multi-line addresses
            } else {
                return { wch: 15 };
            }
        });
        ws['!cols'] = colWidths;

        return ws;
    };

    // Calculate age from birth date (duplicate of function in generatedeliblist.js)
    const calculateAge = (birthDate) => {
        if (!birthDate) return null;
        
        let date;
        
        // Handle Excel serial dates first (numbers like 31279, 18853, etc.)
        const birthDateStr = String(birthDate).trim();
        console.log(`[DBG] Processing birth date: "${birthDateStr}" (type: ${typeof birthDate})`);
        
        if (/^\d+$/.test(birthDateStr) && parseInt(birthDateStr) > 0 && parseInt(birthDateStr) < 100000) {
            // This is an Excel serial date - convert it first
            const serialNumber = parseInt(birthDateStr);
            const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
            const millisecondsPerDay = 24 * 60 * 60 * 1000;
            
            // Account for Excel's leap year bug (Excel thinks 1900 is a leap year)
            let adjustedSerial = serialNumber;
            if (serialNumber >= 60) {
                adjustedSerial = serialNumber - 1; // Subtract 1 day for dates after Feb 28, 1900
            }
            
            date = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * millisecondsPerDay);
            console.log(`[DATE] Converted Excel serial ${serialNumber} to date: ${date.toDateString()} (${date.getFullYear()})`);
        } else if (/^\d{4}$/.test(birthDateStr)) {
            // Handle year-only format (like "1972") - treat as January 1st of that year
            const year = parseInt(birthDateStr);
            if (year >= 1900 && year <= new Date().getFullYear()) {
                date = new Date(year, 0, 1); // January 1st of the given year
                console.log(`[DATE] Converted year-only "${birthDateStr}" to date: ${date.toDateString()}`);
            } else {
                console.log(`[ERR] Invalid year: ${year}`);
                return null;
            }
        } else {
            // Handle different date formats including formatted dates
            if (typeof birthDate === 'string') {
                if (birthDate.includes('/')) {
                    const parts = birthDate.split('/');
                    if (parts.length === 3) {
                        // Assume DD/MM/YYYY format
                        date = new Date(parts[2], parts[1] - 1, parts[0]);
                        console.log(`[DATE] Converted DD/MM/YYYY "${birthDateStr}" to date: ${date.toDateString()}`);
                    }
                } else {
                    date = new Date(birthDate);
                    console.log(`[DATE] Converted string "${birthDateStr}" to date: ${date.toDateString()}`);
                }
            } else {
                date = new Date(birthDate);
                console.log(`[DATE] Converted object to date: ${date.toDateString()}`);
            }
        }
        
        if (!date || isNaN(date)) {
            console.log(`[ERR] Invalid date conversion for: "${birthDate}"`);
            return null;
        }
        
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        
        const calculatedAge = Math.max(0, age);
        console.log(`[AGE] Calculated age: ${calculatedAge} years (from birth date: ${date.toDateString()}, original input: "${birthDate}")`);
        return calculatedAge;
    };

    // Test function to verify document detection (for debugging)
    const testDocumentDetection = (sampleData) => {
        console.log('[TEST] Testing document detection logic...');
        console.log('[LIST] Expected document types:');
        console.log('   Individual (Type_piece): attestation_cni_1, Autres, carte residence, CNI, extrait_de_naissance, passeport');
        console.log('   Collective (Type_piec): acni, extrait_de_naissance, option_7 (=Autres), passeport, Recepisse_CNI');
        
        if (!sampleData || sampleData.length === 0) {
            console.log('[ERR] No sample data provided');
            return;
        }

        sampleData.forEach((record, index) => {
            console.log(`\n[LIST] Record ${index + 1}:`);
            console.log(`   Type_piece: "${record.Type_piece || 'N/A'}"`);
            console.log(`   Type_piec: "${record.Type_piec || 'N/A'}"`);
            console.log(`   Date_naiss: "${record.Date_naiss || 'N/A'}"`);
            console.log(`   Date_naissance: "${record.Date_naissance || 'N/A'}"`);
            console.log(`   Age: "${record.Age || 'N/A'}"`);
            
            // Test extrait detection
            const docField = record.Type_piece || record.Type_piec;
            const hasExtrait = docField && String(docField).toLowerCase() === 'extrait_de_naissance';
            
            // Test standard document detection
            let hasStandard = false;
            if (record.Type_piece) {
                const fieldStr = String(record.Type_piece).toLowerCase();
                hasStandard = ['attestation_cni_1', 'cni', 'carte residence', 'passeport'].includes(fieldStr);
            } else if (record.Type_piec) {
                const fieldStr = String(record.Type_piec).toLowerCase();
                hasStandard = ['acni', 'passeport', 'recepisse_cni'].includes(fieldStr);
            }
            
            // Test other document detection
            let hasOther = false;
            if (record.Type_piece) {
                hasOther = String(record.Type_piece).toLowerCase() === 'autres';
            } else if (record.Type_piec) {
                hasOther = String(record.Type_piec).toLowerCase() === 'option_7';
            }
            
            // Test age calculation
            let age = null;
            if (record.Age && typeof record.Age === 'number' && record.Age < 150) {
                age = record.Age;
            } else if (record.Date_naiss || record.Date_naissance) {
                const birthDate = record.Date_naiss || record.Date_naissance;
                if (birthDate) {
                    const today = new Date();
                    const birth = new Date(birthDate);
                    if (!isNaN(birth)) {
                        age = today.getFullYear() - birth.getFullYear();
                    }
                }
            }
            
            console.log(`   [DBG] Detection Results:`);
            console.log(`      Has Extrait de Naissance: ${hasExtrait ? '[OK]' : '[ERR]'}`);
            console.log(`      Has Standard Doc (CNI/passeport): ${hasStandard ? '[OK]' : '[ERR]'}`);
            console.log(`      Has Other Doc (Autres/option_7): ${hasOther ? '[OK]' : '[ERR]'}`);
            console.log(`      Calculated Age: ${age !== null ? age : 'N/A'}`);
            
            let category;
            if (hasExtrait) {
                category = age !== null && age <= 15 ? 'Underage Mandataire (extrait_de_naissance)' : 'Major Mandataire (extrait_de_naissance)';
            } else if (hasStandard) {
                category = 'Standard Documents (CNI, passeport, etc.)';
            } else if (hasOther) {
                category = 'Other Documents (Autres/option_7)';
            } else {
                category = 'Unknown Documents';
            }
            console.log(`      [FOLDER] Category: ${category}`);
        });
    };

    // Generate comprehensive statistics Excel file with enhanced categorization
    const generateStatisticsExcel = (stats) => {
        const wb = XLSX.utils.book_new();
        const accent = { r: 82, g: 183, b: 136 }; // #52B788

        // Helper to build a styled sheet from sections
        const buildStatsSheet = (title, sections, total) => {
            const rows = [[title], ['']];
            const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
            const headerRows = [0]; // title row
            const sectionHeaderRows = [];

            sections.forEach(sec => {
                const startRow = rows.length;
                sectionHeaderRows.push(startRow);
                rows.push([sec.title]);
                merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: 2 } });
                rows.push([sec.col1 || 'Categorie', 'Nombre', 'Pourcentage']);
                sec.entries.forEach(([label, value]) => {
                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0.0%';
                    rows.push([label, value, pct]);
                });
                rows.push(['']);
            });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 35 }, { wch: 14 }, { wch: 14 }];
            ws['!merges'] = merges;
            return ws;
        };

        // 1. Summary sheet
        const hasInd = stats.summary.totalIndividualParcels > 0;
        const hasCol = stats.summary.totalCollectiveParcels > 0;
        const summaryRows = [
            ['RAPPORT DE STATISTIQUES - PORTAIL BOUNDOU'],
            [''],
            ['Date de generation', stats.summary.processingDate],
            [''],
            ['RESUME'],
        ];
        if (hasInd) summaryRows.push(['Total parcelles individuelles', stats.summary.totalIndividualParcels]);
        if (hasCol) summaryRows.push(['Total parcelles collectives', stats.summary.totalCollectiveParcels]);
        summaryRows.push(['Total general', stats.summary.totalRecords]);
        if (hasInd && hasCol) {
            summaryRows.push(['']);
            summaryRows.push(['REPARTITION PAR SOURCE']);
            summaryRows.push(['Donnees individuelles', stats.summary.totalIndividualParcels, ((stats.summary.totalIndividualParcels / stats.summary.totalRecords) * 100).toFixed(1) + '%']);
            summaryRows.push(['Donnees collectives', stats.summary.totalCollectiveParcels, ((stats.summary.totalCollectiveParcels / stats.summary.totalRecords) * 100).toFixed(1) + '%']);
        }
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        wsSummary['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 15 }];
        wsSummary['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
            { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resume');

        // 2. Individual stats
        if (stats.individual && stats.individual.totalParcels > 0) {
            const t = stats.individual.totalParcels;
            const sections = [];
            if (stats.individual.byEntityType) sections.push({ title: 'REPARTITION PAR TYPE DE PERSONNE', col1: 'Type de Personne', entries: Object.entries(stats.individual.byEntityType) });
            if (stats.individual.byUsageType) sections.push({ title: 'REPARTITION PAR USAGE', col1: 'Type d\'Usage', entries: Object.entries(stats.individual.byUsageType) });
            if (stats.individual.byAgeGroup) sections.push({ title: 'REPARTITION PAR TRANCHE D\'AGE', col1: 'Tranche d\'Age', entries: Object.entries(stats.individual.byAgeGroup) });
            if (stats.individual.byDocumentType) sections.push({ title: 'REPARTITION PAR TYPE DE DOCUMENT', col1: 'Type de Document', entries: Object.entries(stats.individual.byDocumentType) });
            if (stats.individual.byMoraleType && Object.keys(stats.individual.byMoraleType).length > 0) sections.push({ title: 'REPARTITION PAR TYPE DE PERSONNE MORALE', col1: 'Type Personne Morale', entries: Object.entries(stats.individual.byMoraleType) });
            if (stats.individual.byNicad) sections.push({ title: 'STATUT NICAD', col1: 'Statut NICAD', entries: Object.entries(stats.individual.byNicad) });
            const ws = buildStatsSheet('STATISTIQUES INDIVIDUELLES (Total: ' + t + ')', sections, t);
            XLSX.utils.book_append_sheet(wb, ws, 'Stats Individuelles');
        }

        // 3. Collective stats
        if (stats.collective && stats.collective.totalParcels > 0) {
            const t = stats.collective.totalParcels;
            const sections = [];
            if (stats.collective.byUsageType) sections.push({ title: 'REPARTITION PAR USAGE', col1: 'Type d\'Usage', entries: Object.entries(stats.collective.byUsageType) });
            if (stats.collective.byDocumentType) sections.push({ title: 'REPARTITION PAR TYPE DE DOCUMENT', col1: 'Type de Document', entries: Object.entries(stats.collective.byDocumentType) });
            if (stats.collective.byAgeGroup) sections.push({ title: 'REPARTITION PAR TRANCHE D\'AGE', col1: 'Tranche d\'Age', entries: Object.entries(stats.collective.byAgeGroup) });
            if (stats.collective.byNicad) sections.push({ title: 'STATUT NICAD', col1: 'Statut NICAD', entries: Object.entries(stats.collective.byNicad) });
            const ws = buildStatsSheet('STATISTIQUES COLLECTIVES (Total: ' + t + ', Affectataires: ' + (stats.collective.totalAffectataires || 0) + ')', sections, t);
            XLSX.utils.book_append_sheet(wb, ws, 'Stats Collectives');
        }

        const label = hasInd && hasCol ? '' : hasInd ? '_Individuelles' : '_Collectives';
        const fileName = `Statistiques_Boundou${label}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        return wb;
    };


    // ===================================================================
    // PDF STATISTICS GENERATION - Portal theme
    // ===================================================================

    // Portal-aligned muted palette (no indigo/violet, no vibrant)
    const PDF_THEME = {
        dark:    [15, 17, 23],       // #0F1117
        surface: [26, 29, 39],       // #1A1D27
        accent:  [82, 183, 136],     // #52B788
        accentL: [116, 198, 157],    // #74C69D
        accentD: [64, 145, 108],     // #40916C
        text:    [50, 55, 65],       // #323741
        muted:   [130, 136, 148],    // #828894
        white:   [255, 255, 255],
        rowAlt:  [247, 250, 248],    // very light green-gray
        // Gradient-friendly palette: each entry is [start, end] for canvas gradient
        palette: [
            { s: [82, 183, 136],  e: [64, 145, 108]  },  // green
            { s: [66, 133, 160],  e: [48, 100, 125]  },  // teal-steel
            { s: [190, 165, 120], e: [160, 135, 90]  },  // warm sand
            { s: [160, 110, 100], e: [130, 85, 78]   },  // terracotta
            { s: [120, 150, 170], e: [90, 120, 140]  },  // slate-blue
            { s: [170, 140, 110], e: [140, 112, 85]  },  // bronze
            { s: [100, 160, 140], e: [75, 130, 112]  },  // sage
            { s: [150, 130, 150], e: [120, 105, 122] },  // mauve-gray
            { s: [130, 155, 105], e: [105, 130, 80]  },  // olive
            { s: [165, 145, 135], e: [135, 118, 108] }   // warm gray
        ],
        flatColor(i) {
            const p = this.palette[i % this.palette.length];
            return p.s;
        }
    };

    const renderDonut = (entries, size) => {
        const scale = 2; // retina
        const canvas = document.createElement('canvas');
        canvas.width = size * scale;
        canvas.height = size * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        const total = entries.reduce((s, e) => s + e.value, 0);
        if (total === 0) return canvas.toDataURL('image/png');

        const cx = size / 2, cy = size / 2, r = size / 2 - 8, inner = r * 0.52;
        let angle = -Math.PI / 2;

        entries.forEach((entry, i) => {
            const slice = (entry.value / total) * 2 * Math.PI;
            const p = PDF_THEME.palette[i % PDF_THEME.palette.length];
            // radial gradient per slice
            const mid = angle + slice / 2;
            const gx = cx + Math.cos(mid) * r * 0.5;
            const gy = cy + Math.sin(mid) * r * 0.5;
            const grad = ctx.createRadialGradient(gx, gy, inner * 0.3, cx, cy, r);
            grad.addColorStop(0, `rgb(${p.s[0]},${p.s[1]},${p.s[2]})`);
            grad.addColorStop(1, `rgb(${p.e[0]},${p.e[1]},${p.e[2]})`);

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
            ctx.arc(cx, cy, r, angle, angle + slice);
            ctx.arc(cx, cy, inner, angle + slice, angle, true);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            // subtle separator
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            angle += slice;
        });
        return canvas.toDataURL('image/png');
    };

    const renderHBar = (entries, width, height) => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        const maxVal = Math.max(...entries.map(e => e.value), 1);
        const margin = { top: 8, right: 12, bottom: 8, left: 100 };
        const chartW = width - margin.left - margin.right;
        const barH = Math.min(18, (height - margin.top - margin.bottom) / entries.length - 4);
        const gap = 4;

        entries.forEach((entry, i) => {
            const y = margin.top + i * (barH + gap);
            const w = (entry.value / maxVal) * chartW;
            const p = PDF_THEME.palette[i % PDF_THEME.palette.length];

            // gradient bar
            const grad = ctx.createLinearGradient(margin.left, 0, margin.left + w, 0);
            grad.addColorStop(0, `rgb(${p.s[0]},${p.s[1]},${p.s[2]})`);
            grad.addColorStop(1, `rgb(${p.e[0]},${p.e[1]},${p.e[2]})`);
            ctx.fillStyle = grad;
            // rounded rect
            const radius = Math.min(3, barH / 3);
            ctx.beginPath();
            ctx.moveTo(margin.left + radius, y);
            ctx.lineTo(margin.left + w - radius, y);
            ctx.arcTo(margin.left + w, y, margin.left + w, y + radius, radius);
            ctx.lineTo(margin.left + w, y + barH - radius);
            ctx.arcTo(margin.left + w, y + barH, margin.left + w - radius, y + barH, radius);
            ctx.lineTo(margin.left + radius, y + barH);
            ctx.arcTo(margin.left, y + barH, margin.left, y + barH - radius, radius);
            ctx.lineTo(margin.left, y + radius);
            ctx.arcTo(margin.left, y, margin.left + radius, y, radius);
            ctx.closePath();
            ctx.fill();

            // label
            ctx.fillStyle = '#323741';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const lbl = entry.label.length > 18 ? entry.label.substring(0, 17) + '..' : entry.label;
            ctx.fillText(lbl, margin.left - 5, y + barH / 2);

            // value
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'left';
            if (w > 30) {
                ctx.fillText(String(entry.value), margin.left + 6, y + barH / 2);
            } else {
                ctx.fillStyle = '#323741';
                ctx.fillText(String(entry.value), margin.left + w + 4, y + barH / 2);
            }
        });
        return canvas.toDataURL('image/png');
    };

    const pdfSectionHeader = (doc, title, y) => {
        const pw = doc.internal.pageSize.getWidth();
        // thin accent line
        doc.setFillColor(...PDF_THEME.accent);
        doc.rect(14, y, pw - 28, 0.6, 'F');
        y += 4;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_THEME.text);
        doc.text(title, 14, y + 4);
        return y + 10;
    };

    const pdfSubTitle = (doc, text, y) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_THEME.muted);
        doc.text(text, 14, y + 4);
        return y + 7;
    };

    const pdfLegend = (doc, entries, x, y) => {
        entries.forEach((entry, i) => {
            const col = PDF_THEME.flatColor(i);
            doc.setFillColor(...col);
            doc.roundedRect(x, y + i * 8, 5, 5, 1, 1, 'F');
            doc.setFontSize(7.5);
            doc.setTextColor(...PDF_THEME.text);
            doc.setFont('helvetica', 'normal');
            doc.text(`${entry.label}  (${entry.value})`, x + 7, y + i * 8 + 4);
        });
        return y + entries.length * 8;
    };

    const pdfTable = (doc, head, body, y) => {
        doc.autoTable({
            startY: y,
            head: [head],
            body: body,
            theme: 'plain',
            headStyles: {
                fillColor: PDF_THEME.surface,
                textColor: PDF_THEME.white,
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 3
            },
            bodyStyles: {
                fontSize: 7.5,
                textColor: PDF_THEME.text,
                cellPadding: 2.5
            },
            alternateRowStyles: { fillColor: PDF_THEME.rowAlt },
            styles: { lineColor: [220, 224, 228], lineWidth: 0.2 },
            margin: { left: 14, right: 14 }
        });
        return doc.lastAutoTable.finalY + 6;
    };

    const pdfCheckPage = (doc, y, need) => {
        if (y > doc.internal.pageSize.getHeight() - need) {
            doc.addPage();
            return 18;
        }
        return y;
    };

    const pdfAddSection = (doc, y, title, entries, total, useBar) => {
        y = pdfCheckPage(doc, y, 75);
        y = pdfSubTitle(doc, title, y);
        const pw = doc.internal.pageSize.getWidth();

        if (useBar) {
            const h = Math.max(entries.length * 22, 40);
            const img = renderHBar(entries, 500, h);
            const imgH = Math.min(h * (pw - 28) / 500, 70);
            doc.addImage(img, 'PNG', 14, y, pw - 28, imgH);
            y += imgH + 4;
        } else {
            const img = renderDonut(entries, 160);
            doc.addImage(img, 'PNG', 14, y, 38, 38);
            const ly = pdfLegend(doc, entries, 56, y + 2);
            y = Math.max(y + 42, ly) + 2;
        }

        const body = entries.map(e => [
            e.label,
            e.value,
            total > 0 ? ((e.value / total) * 100).toFixed(1) + '%' : '0%'
        ]);
        y = pdfTable(doc, [title.split(' ').slice(-1)[0] || 'Categorie', 'Nombre', '%'], body, y);
        return y;
    };

    const entriesFromObj = (obj) => {
        return Object.entries(obj || {}).map(([label, value]) => ({ label, value }));
    };

    const generateStatisticsPDF = (stats) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const hasInd = stats.individual && stats.individual.totalParcels > 0;
        const hasCol = stats.collective && stats.collective.totalParcels > 0;
        let y = 0;

        // ---- HEADER ----
        doc.setFillColor(...PDF_THEME.dark);
        doc.rect(0, 0, pw, 38, 'F');
        doc.setFillColor(...PDF_THEME.accent);
        doc.rect(0, 38, pw, 2, 'F');

        doc.setTextColor(...PDF_THEME.white);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Rapport Statistiques', pw / 2, 16, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_THEME.accentL);
        doc.text('Portail PROCASEF Boundou', pw / 2, 24, { align: 'center' });
        doc.setTextColor(180, 184, 190);
        doc.text(stats.summary.processingDate || new Date().toLocaleString('fr-FR'), pw / 2, 32, { align: 'center' });

        y = 48;

        // ---- SUMMARY CARDS ----
        const cards = [];
        if (hasInd) cards.push({ label: 'Parcelles Individuelles', value: stats.summary.totalIndividualParcels });
        if (hasCol) cards.push({ label: 'Parcelles Collectives', value: stats.summary.totalCollectiveParcels });
        if (hasInd && hasCol) cards.push({ label: 'Total General', value: stats.summary.totalRecords });

        if (cards.length > 0) {
            const cardW = (pw - 28 - (cards.length - 1) * 6) / cards.length;
            cards.forEach((card, i) => {
                const cx = 14 + i * (cardW + 6);
                doc.setFillColor(...PDF_THEME.surface);
                doc.roundedRect(cx, y, cardW, 22, 2, 2, 'F');
                // accent left border
                doc.setFillColor(...PDF_THEME.accent);
                doc.rect(cx, y + 3, 1.2, 16, 'F');
                // value
                doc.setTextColor(...PDF_THEME.accent);
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text(String(card.value), cx + cardW / 2 + 2, y + 10, { align: 'center' });
                // label
                doc.setTextColor(...PDF_THEME.muted);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.text(card.label, cx + cardW / 2 + 2, y + 17, { align: 'center' });
            });
            y += 30;
        }

        // ===== INDIVIDUAL =====
        if (hasInd) {
            const t = stats.individual.totalParcels;
            y = pdfSectionHeader(doc, 'Statistiques Individuelles', y);

            const entityE = entriesFromObj(stats.individual.byEntityType);
            if (entityE.length > 0) y = pdfAddSection(doc, y, 'Type de Personne', entityE, t, false);

            const usageE = entriesFromObj(stats.individual.byUsageType);
            if (usageE.length > 0) y = pdfAddSection(doc, y, "Type d'Usage", usageE, t, true);

            const ageE = entriesFromObj(stats.individual.byAgeGroup);
            if (ageE.length > 0) y = pdfAddSection(doc, y, "Tranche d'Age", ageE, t, false);

            const docE = entriesFromObj(stats.individual.byDocumentType);
            if (docE.length > 0) y = pdfAddSection(doc, y, 'Type de Document', docE, t, true);

            const nicadE = entriesFromObj(stats.individual.byNicad);
            if (nicadE.length > 0) y = pdfAddSection(doc, y, 'Statut NICAD', nicadE, t, false);
        }

        // ===== COLLECTIVE =====
        if (hasCol) {
            if (hasInd) { doc.addPage(); y = 18; }
            const t = stats.collective.totalParcels;
            y = pdfSectionHeader(doc, 'Statistiques Collectives', y);

            // summary line
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...PDF_THEME.muted);
            doc.text(`Parcelles: ${t}   |   Affectataires: ${stats.collective.totalAffectataires || 0}`, 14, y + 2);
            y += 8;

            const usageE = entriesFromObj(stats.collective.byUsageType);
            if (usageE.length > 0) y = pdfAddSection(doc, y, "Type d'Usage", usageE, t, true);

            const docE = entriesFromObj(stats.collective.byDocumentType);
            if (docE.length > 0) y = pdfAddSection(doc, y, 'Type de Document', docE, t, true);

            const ageE = entriesFromObj(stats.collective.byAgeGroup);
            if (ageE.length > 0) y = pdfAddSection(doc, y, "Tranche d'Age", ageE, t, false);

            const nicadE = entriesFromObj(stats.collective.byNicad);
            if (nicadE.length > 0) y = pdfAddSection(doc, y, 'Statut NICAD', nicadE, t, false);
        }

        // ---- FOOTER ----
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(200, 204, 210);
            doc.setLineWidth(0.3);
            doc.line(14, ph - 14, pw - 14, ph - 14);
            doc.setFontSize(7);
            doc.setTextColor(...PDF_THEME.muted);
            doc.setFont('helvetica', 'normal');
            doc.text('Portail PROCASEF Boundou - generated by cabg', 14, ph - 9);
            doc.text(`Page ${i} / ${pageCount}`, pw - 14, ph - 9, { align: 'right' });
        }

        const label = hasInd && hasCol ? '' : hasInd ? '_Individuelles' : '_Collectives';
        const fileName = `Statistiques_Boundou${label}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
        doc.save(fileName);
        return doc;
    };

    // Export public methods
    return {
        generateIndividualDeliberationList,
        generateEnhancedIndividualDeliberationList,
        generateCollectiveDeliberationList,
        generateStatisticsExcel,
        generateStatisticsPDF,
        exportPreviewData,
        testDocumentDetection  // For debugging purposes
    };
})();
