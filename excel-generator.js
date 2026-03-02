window.BoundouExcelGenerator = (() => {
    'use strict';

    // Helper function to format dates to DD/MM/YYYY format
    const formatDateToDDMMYYYY = (dateValue) => {
        if (!dateValue) return '';
        
        // Handle different date formats
        let date;
        
        // If it's already a Date object
        if (dateValue instanceof Date) {
            date = dateValue;
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
                const columns = selectedColumns?.personne_morale || ['Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Typ_pers_m', 'Num_parcel'];
                
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
                    { wch: 20 }, // Type_num
                    { wch: 20 }, // Autre_pr_ciser
                    { wch: 15 }, // Numero
                    { wch: 15 }, // PhotoPieMo
                    { wch: 25 }, // PhotoPieMo_URL
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
                const columns = selectedColumns?.groupement || ['Village', 'Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'Type_piec', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Vocation', 'type_usa', 'Date_nai', 'Typ_pers_m', 'Num_parcel'];
                
                const groupementsData = data.groupement.map(row => {
                    const orderedRow = {};
                    columns.forEach(col => {
                        if (col === 'Creation') {
                            // Apply date formatting to Creation field
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
                    { wch: 20 }, // Village
                    { wch: 25 }, // Denominat
                    { wch: 12 }, // Creation
                    { wch: 25 }, // Siege
                    { wch: 20 }, // Type_num
                    { wch: 20 }, // Autre_pr_ciser
                    { wch: 15 }, // Numero
                    { wch: 15 }, // PhotoPieMo
                    { wch: 25 }, // PhotoPieMo_URL
                    { wch: 20 }, // Mandataire
                    { wch: 15 }, // Telephone_001
                    { wch: 25 }, // Adresse
                    { wch: 15 }, // superficie
                    { wch: 15 }, // nicad
                    { wch: 20 }, // Vocation
                    { wch: 12 }  // type_usag
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
                return usage === 'agriculture_pluviale' || usage === 'agriculture_traditionnelle';
            });
            
            console.log(`[HOME] Habitat records: ${habitatRecords.length}`);
            console.log(`[FIELD] Agricole records: ${agricoleRecords.length}`);
            
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
    
    // Check if a person should be mandataire based on document type and age (individual version)
    const isPersonMandataire = (person, ageThreshold) => {
        // For individual data, use the standard field names
        const docType = person.numero_piece || '';
        const docTypeStr = String(docType).toLowerCase().trim();
        
        // Check for extrait de naissance (non-mandataire)
        const hasExtraitDocument = docTypeStr === 'extrait_de_naissance' || 
                                   docTypeStr === 'extrait de naissance' ||
                                   (docTypeStr.includes('extrait') && docTypeStr.includes('naissance'));
        
        if (hasExtraitDocument) {
            console.log(`[TGT] Person with extrait document (non-mandataire): ${person.prenom} ${person.nom}`);
            return false;
        }
        
        // Check age if date is available
        if (person.date_naissance) {
            const age = calculateAge(person.date_naissance);
            if (age !== null && age < ageThreshold) {
                console.log(`[TGT] Person under ${ageThreshold} years (non-mandataire): ${person.prenom} ${person.nom}, age: ${age}`);
                return false;
            }
        }
        
        // Default to mandataire
        return true;
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
            
            // Helper function to check if collective record has extrait document
            const hasExtraitDocument = (row) => {
                // Check only collective field
                const docField = row.Type_piec;  // Collective data only
                
                if (!docField) return false;
                
                const fieldStr = String(docField).toLowerCase().trim();
                // More flexible matching for extrait de naissance
                const hasExtrait = fieldStr === 'extrait_de_naissance' || 
                                  fieldStr === 'extrait de naissance' ||
                                  fieldStr.includes('extrait') && fieldStr.includes('naissance');
                
                if (hasExtrait) {
                    console.log(`[TGT] Found collective extrait document: "${docField}"`);
                }
                
                return hasExtrait;
            };
            
            // Helper function to check if collective record has CNI or other standard ID documents
            const hasStandardDocument = (row) => {
                const docField = row.Type_piec;  // Collective data only
                
                if (!docField) return false;
                
                const fieldStr = String(docField).toLowerCase().trim();
                
                // For collective files (Type_piec) - exact matching based on provided values
                const isStandard = fieldStr === 'cni' || 
                                  fieldStr === 'passeport' ||
                                  fieldStr === 'passport' ||
                                  fieldStr === 'carte_nationale_identite' ||
                                  fieldStr === 'carte d\'identité' ||
                                  fieldStr === 'carte d\'identite';
                
                if (isStandard && !hasExtraitDocument(row)) {
                    console.log(`[TGT] Found collective standard document: "${docField}"`);
                    return true;
                }
                
                return false;
            };
            
            // Helper function to check if collective record has "Autres" or unknown documents
            const hasOtherDocument = (row) => {
                const docField = row.Type_piec;  // Collective data only
                
                if (!docField) return false;
                
                const fieldStr = String(docField).toLowerCase().trim();
                
                // For individual files
                if (row.Type_piece) {
                    const isOther = fieldStr === 'autres' || fieldStr.includes('autre');
                    if (isOther) {
                        console.log(`[TGT] Found other individual document: "${docField}"`);
                    }
                    return isOther;
                }
                
                // For collective files
                if (row.Type_piec) {
                    const isOther = fieldStr === 'option_7' || fieldStr.includes('option');
                    if (isOther) {
                        console.log(`[TGT] Found other collective document: "${docField}"`);
                    }
                    return isOther;
                }
                
                return false;
            };
            
            // Helper function to get age from record
            const getRecordAge = (row) => {
                console.log(`[DBG] Getting age for record with fields:`, Object.keys(row));
                
                // For collective data, use Date_nai field (not Date_naiss which is for individual data)
                const collectiveDateField = row.Date_nai;
                
                if (collectiveDateField) {
                    console.log(`   [TGT] Using collective birth date (Date_nai): ${collectiveDateField}`);
                    const calculatedAge = calculateAge(collectiveDateField);
                    if (calculatedAge !== null) {
                        console.log(`   [OK] Calculated mandataire age: ${calculatedAge}`);
                        return calculatedAge;
                    }
                } else {
                    console.log(`   [ERR] No Date_nai field found for mandataire`);
                }
                
                // Fallback: try direct Age field if Date_nai is not available
                if (row.Age && typeof row.Age === 'number' && row.Age < 150) {
                    console.log(`   [OK] Using direct age field: ${row.Age}`);
                    return row.Age;
                }
                
                console.log(`   [ERR] No valid mandataire age found for record`);
                return null;
            };

            // Separate mandataires by age and document type
            const underageMandataires = data.filter(row => {
                const hasExtrait = hasExtraitDocument(row);
                const age = getRecordAge(row);
                
                // Minor mandataires: Records with extrait documents and age <= threshold
                const isUnderage = hasExtrait && age !== null && age <= ageThreshold;
                
                console.log(`[DBG] MINOR check: hasExtrait=${hasExtrait}, age=${age}, threshold=${ageThreshold}, isUnderage=${isUnderage}`);
                console.log(`   - Doc type: ${row.Type_piece || row.Type_piec || 'N/A'}`);
                console.log(`   - Birth date field: ${row.Date_naiss || row.Date_nai || 'N/A'}`);
                
                if (hasExtrait) {
                    console.log(`[DBG] Age check - Date_naiss: ${row.Date_naiss}, Date_nai: ${row.Date_nai}, Age: ${age}, Threshold: ${ageThreshold}, IsUnderage: ${isUnderage}`);
                }
                
                if (isUnderage) {
                    console.log(`[CHILD] Found underage mandataire: age ${age}, doc: ${row.Type_piece || row.Type_piec || 'N/A'}`);
                }
                
                return isUnderage;
            });

            const majorMandataires = data.filter(row => {
                const hasExtrait = hasExtraitDocument(row);
                const hasStandard = hasStandardDocument(row);
                const age = getRecordAge(row);
                
                // Major mandataires: Records with standard documents (CNI, passport, etc.) OR adults with extrait documents
                const isMajor = (hasStandard && age !== null && age > ageThreshold) || 
                               (hasExtrait && age !== null && age > ageThreshold);
                
                console.log(`[DBG] MAJOR check: hasExtrait=${hasExtrait}, hasStandard=${hasStandard}, age=${age}, threshold=${ageThreshold}, isMajor=${isMajor}`);
                console.log(`   - Doc type: ${row.Type_piece || row.Type_piec || 'N/A'}`);
                console.log(`   - Date_nai: ${row.Date_nai}`);
                console.log(`   - Standard doc check: ${hasStandard && age !== null && age > ageThreshold}`);
                console.log(`   - Adult extrait check: ${hasExtrait && age !== null && age > ageThreshold}`);
                
                if (isMajor) {
                    console.log(`[MAN] Found major mandataire: age ${age || 'unknown'}, doc: ${row.Type_piece || row.Type_piec || 'N/A'}`);
                }
                
                return isMajor;
            });

            // Records with CNI, passport, etc. (standard ID documents)
            const standardDocuments = data.filter(row => {
                const hasStandard = hasStandardDocument(row);
                
                if (hasStandard) {
                    console.log(`[DOC] Found standard document: doc: ${row.Type_piece || row.Type_piec || 'N/A'}`);
                }
                
                return hasStandard;
            });

            // Records with "Autres" or option_7 documents
            const otherDocuments = data.filter(row => {
                const hasOther = hasOtherDocument(row);
                
                if (hasOther) {
                    console.log(` Found other document: doc: ${row.Type_piece || row.Type_piec || 'N/A'}`);
                }
                
                return hasOther;
            });

            // Records with no clear document type or completely missing document fields
            const unknownDocuments = data.filter(row => {
                const hasExtrait = hasExtraitDocument(row);
                const hasStandard = hasStandardDocument(row);
                const hasOther = hasOtherDocument(row);
                const hasNoDocInfo = !hasExtrait && !hasStandard && !hasOther;
                
                if (hasNoDocInfo) {
                    const docField = row.Type_piece || row.Type_piec || 'NO_DOC';
                    console.log(`[?]“ Found record with unknown/missing document: "${docField}" (original value)`);
                    console.log(`   - Row data:`, {Type_piece: row.Type_piece, Type_piec: row.Type_piec, Date_naiss: row.Date_naiss, Age: row.Age});
                }
                
                return hasNoDocInfo;
            });

            console.log(`[LIST] Separation results for ${entityType}:`);
            console.log(`   - Underage mandataires (extrait_de_naissance + ≤${ageThreshold}): ${underageMandataires.length}`);
            console.log(`   - Major mandataires (extrait_de_naissance + >${ageThreshold}): ${majorMandataires.length}`);
            console.log(`   - Standard documents (CNI, passeport, etc.): ${standardDocuments.length}`);
            console.log(`   - Other documents (Autres/option_7): ${otherDocuments.length}`);
            console.log(`   - Unknown documents: ${unknownDocuments.length}`);
            console.log(`   - Total: ${underageMandataires.length + majorMandataires.length + standardDocuments.length + otherDocuments.length + unknownDocuments.length} / ${data.length}`);

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
                
                // Apply date formatting to specific columns
                if (col === 'Date_naiss' || col === 'Creation' || col === 'Date_naissance') {
                    value = formatDateToDDMMYYYY(value) || value;
                } else if (col === 'Date_nai') {
                    // Keep Date_nai in YYYY-MM-DD format for collective data
                    if (value && typeof value === 'string' && value.includes('\n')) {
                        // For multi-line dates, take the first valid date line
                        const dateLines = value.split('\n').filter(line => line.trim() && line.trim() !== '-');
                        if (dateLines.length > 0) {
                            value = dateLines[0].trim();
                        }
                    }
                    // Keep YYYY-MM-DD format as is
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
    // Generate comprehensive statistics Excel file with enhanced categorization
    const generateStatisticsExcel = (stats) => {
        const wb = XLSX.utils.book_new();
        
        // 1. EXECUTIVE SUMMARY SHEET
        const summaryData = [
            ['RAPPORT DE STATISTIQUES PORTAIL BOUNDOU'],
            ['Date de génération:', stats.summary.processingDate],
            [''],
            ['=== RÉSUMÉ EXÉCUTIF ==='],
            ['Total parcelles individuelles:', stats.summary.totalIndividualParcels],
            ['Total parcelles collectives:', stats.summary.totalCollectiveParcels],
            ['TOTAL GÉNÉRAL:', stats.summary.totalRecords],
            [''],
            ['=== RÉPARTITION PAR SOURCE ==='],
            ['Données individuelles:', stats.summary.totalIndividualParcels, `${((stats.summary.totalIndividualParcels / stats.summary.totalRecords) * 100).toFixed(1)}%`],
            ['Données collectives:', stats.summary.totalCollectiveParcels, `${((stats.summary.totalCollectiveParcels / stats.summary.totalRecords) * 100).toFixed(1)}%`]
        ];

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé Exécutif');

        // 2. INDIVIDUAL DATA STATISTICS SHEET
        if (stats.individual && Object.keys(stats.individual).length > 0) {
            const individualData = [
                ['STATISTIQUES DONNÉES INDIVIDUELLES'],
                [''],
                ['=== RÉPARTITION PAR TYPE DE PERSONNE (Typ_pers) ==='],
                ['Type de Personne', 'Nombre', 'Pourcentage']
            ];

            // Add entity type statistics
            const individualTotal = stats.individual.totalParcels || 0;
            Object.entries(stats.individual.byEntityType || {}).forEach(([type, count]) => {
                const percentage = individualTotal > 0 ? ((count / individualTotal) * 100).toFixed(1) : '0.0';
                individualData.push([type, count, `${percentage}%`]);
            });

            individualData.push([''], ['=== RÉPARTITION PAR USAGE (type_usag) ==='], ['Type d\'Usage', 'Nombre', 'Pourcentage']);
            
            // Add usage type statistics
            Object.entries(stats.individual.byUsageType || {}).forEach(([usage, count]) => {
                const percentage = individualTotal > 0 ? ((count / individualTotal) * 100).toFixed(1) : '0.0';
                individualData.push([usage, count, `${percentage}%`]);
            });

            individualData.push([''], ['=== RÉPARTITION PAR TRANCHE D\'ÂGE ==='], ['Tranche d\'Âge', 'Nombre', 'Pourcentage']);
            
            // Add age group statistics
            Object.entries(stats.individual.byAgeGroup || {}).forEach(([age, count]) => {
                const percentage = individualTotal > 0 ? ((count / individualTotal) * 100).toFixed(1) : '0.0';
                individualData.push([age, count, `${percentage}%`]);
            });

            individualData.push([''], ['=== RÉPARTITION PAR TYPE DE DOCUMENT (Type_piece) ==='], ['Type de Document', 'Nombre', 'Pourcentage']);
            
            // Add document type statistics
            Object.entries(stats.individual.byDocumentType || {}).forEach(([doc, count]) => {
                const percentage = individualTotal > 0 ? ((count / individualTotal) * 100).toFixed(1) : '0.0';
                individualData.push([doc, count, `${percentage}%`]);
            });

            individualData.push([''], ['=== RÉPARTITION PAR TYPE DE PERSONNE MORALE (Typ_pers_m) ==='], ['Type Personne Morale', 'Nombre', 'Pourcentage']);
            
            // Add morale person type statistics
            Object.entries(stats.individual.byMoraleType || {}).forEach(([moraleType, count]) => {
                const percentage = individualTotal > 0 ? ((count / individualTotal) * 100).toFixed(1) : '0.0';
                individualData.push([moraleType, count, `${percentage}%`]);
            });

            individualData.push([''], ['=== RÉPARTITION PAR STATUT NICAD ==='], ['Statut NICAD', 'Nombre', 'Pourcentage']);
            
            // Add NICAD status statistics
            Object.entries(stats.individual.byNicad || {}).forEach(([nicadStatus, count]) => {
                const percentage = individualTotal > 0 ? ((count / individualTotal) * 100).toFixed(1) : '0.0';
                individualData.push([nicadStatus, count, `${percentage}%`]);
            });

            const wsIndividual = XLSX.utils.aoa_to_sheet(individualData);
            XLSX.utils.book_append_sheet(wb, wsIndividual, 'Stats Individuelles');
        }

        // 3. COLLECTIVE DATA STATISTICS SHEET
        if (stats.collective && Object.keys(stats.collective).length > 0) {
            const collectiveData = [
                ['STATISTIQUES DONNÉES COLLECTIVES'],
                [''],
                ['Total parcelles collectives:', stats.collective.totalParcels],
                ['Total affectataires:', stats.collective.totalAffectataires],
                [''],
                ['=== RÉPARTITION PAR USAGE (type_usa/type_usag) ==='],
                ['Type d\'Usage', 'Nombre', 'Pourcentage']
            ];

            // Add usage type statistics
            const collectiveTotal = stats.collective.totalParcels || 0;
            Object.entries(stats.collective.byUsageType || {}).forEach(([usage, count]) => {
                const percentage = collectiveTotal > 0 ? ((count / collectiveTotal) * 100).toFixed(1) : '0.0';
                collectiveData.push([usage, count, `${percentage}%`]);
            });

            collectiveData.push([''], ['=== RÉPARTITION PAR TYPE DE DOCUMENT (Type_piec) ==='], ['Type de Document', 'Nombre', 'Pourcentage']);
            
            // Add document type statistics
            Object.entries(stats.collective.byDocumentType || {}).forEach(([doc, count]) => {
                const percentage = collectiveTotal > 0 ? ((count / collectiveTotal) * 100).toFixed(1) : '0.0';
                collectiveData.push([doc, count, `${percentage}%`]);
            });

            collectiveData.push([''], ['=== RÉPARTITION PAR TRANCHE D\'ÂGE ==='], ['Tranche d\'Âge', 'Nombre', 'Pourcentage']);
            
            // Add age group statistics
            Object.entries(stats.collective.byAgeGroup || {}).forEach(([age, count]) => {
                const percentage = collectiveTotal > 0 ? ((count / collectiveTotal) * 100).toFixed(1) : '0.0';
                collectiveData.push([age, count, `${percentage}%`]);
            });

            collectiveData.push([''], ['=== RÉPARTITION PAR STATUT NICAD ==='], ['Statut NICAD', 'Nombre', 'Pourcentage']);
            
            // Add NICAD status statistics
            Object.entries(stats.collective.byNicad || {}).forEach(([nicadStatus, count]) => {
                const percentage = collectiveTotal > 0 ? ((count / collectiveTotal) * 100).toFixed(1) : '0.0';
                collectiveData.push([nicadStatus, count, `${percentage}%`]);
            });

            const wsCollective = XLSX.utils.aoa_to_sheet(collectiveData);
            XLSX.utils.book_append_sheet(wb, wsCollective, 'Stats Collectives');
        }

        // Download the file
        const fileName = `Statistiques_Boundou_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        return wb;
    };

    // Export public methods
    return {
        generateIndividualDeliberationList,
        generateEnhancedIndividualDeliberationList,
        generateCollectiveDeliberationList,
        generateStatisticsExcel,
        exportPreviewData,
        testDocumentDetection  // For debugging purposes
    };
})();
