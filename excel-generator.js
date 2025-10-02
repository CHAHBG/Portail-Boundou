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
            const dateStr = String(dateValue).trim();
            
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
                    const columns = ['Village', 'Prenom', 'Nom', 'Sexe', 'Date_naiss', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'superficie', 'nicad'];
                    columns.forEach(col => {
                        if (col === 'Date_naiss') {
                            // Apply date formatting to Date_naiss field
                            orderedRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else {
                            orderedRow[col] = row[col] || '';
                        }
                    });
                    return orderedRow;
                });

                const wsPhysiques = XLSX.utils.json_to_sheet(physiquesData);
                
                // Set column widths
                const colWidthsPhysiques = [
                    { wch: 20 }, // Village
                    { wch: 15 }, // Prenom
                    { wch: 15 }, // Nom
                    { wch: 10 }, // Sexe
                    { wch: 12 }, // Date_naiss
                    { wch: 15 }, // Num_piece
                    { wch: 15 }, // Telephone
                    { wch: 20 }, // Vocation
                    { wch: 12 }, // type_usag
                    { wch: 15 }, // superficie
                    { wch: 15 }  // nicad
                ];
                wsPhysiques['!cols'] = colWidthsPhysiques;
                
                XLSX.utils.book_append_sheet(wb, wsPhysiques, 'Personnes physiques');
                totalExported += physiquesData.length;
            }

            // Sheet 2: Personnes morales (excluding groupements)
            if (data.personne_morale && data.personne_morale.length > 0) {
                const selectedColumns = window.BoundouDashboard.selectedColumns;
                const columns = selectedColumns?.personne_morale || ['Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse'];
                
                const moralesData = data.personne_morale.map(row => {
                    const orderedRow = {};
                    columns.forEach(col => {
                        if (col === 'Creation') {
                            // Apply date formatting to Creation field
                            orderedRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else {
                            orderedRow[col] = row[col] || '';
                        }
                    });
                    return orderedRow;
                });

                const wsMorales = XLSX.utils.json_to_sheet(moralesData, { header: columns });
                
                // Set column widths
                const colWidthsMorales = [
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
                    { wch: 25 }  // Adresse
                ];
                wsMorales['!cols'] = colWidthsMorales;
                
                XLSX.utils.book_append_sheet(wb, wsMorales, 'Personne Morale');
                totalExported += moralesData.length;
            }

            // Sheet 3: Groupements
            if (data.groupement && data.groupement.length > 0) {
                const selectedColumns = window.BoundouDashboard.selectedColumns;
                const columns = selectedColumns?.groupement || ['Village', 'Denominat', 'Creation', 'Siege', 'Type_num', 'Autre_pr_ciser', 'Numero', 'PhotoPieMo', 'PhotoPieMo_URL', 'Mandataire', 'Telephone_001', 'Adresse', 'superficie', 'nicad', 'Vocation', 'type_usag'];
                
                const groupementsData = data.groupement.map(row => {
                    const orderedRow = {};
                    columns.forEach(col => {
                        if (col === 'Creation') {
                            // Apply date formatting to Creation field
                            orderedRow[col] = formatDateToDDMMYYYY(row[col]) || '';
                        } else {
                            orderedRow[col] = row[col] || '';
                        }
                    });
                    return orderedRow;
                });

                const wsGroupements = XLSX.utils.json_to_sheet(groupementsData, { header: columns });
                
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

    // Generate collective deliberation list
    const generateCollectiveDeliberationList = async () => {
        try {
            BoundouUtils.showLoading('loadingIndicator', 'Génération de la liste collective...');
            
            const data = window.BoundouDashboard.processedCollectiveData;
            
            if (!data || data.length === 0) {
                throw new Error('Aucune donnée collective à traiter');
            }

            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Get ordered columns for collective data
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
            
            // Create worksheet with ordered columns
            const ws = XLSX.utils.json_to_sheet(processedData, { header: orderedColumns });
            
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
            const filename = `liste_deliberation_collective_${timestamp}.xlsx`;

            // Write and download file
            XLSX.writeFile(wb, filename);

            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showSuccess(
                `Fichier Excel généré avec succès: ${filename}\n${data.length} parcelles exportées`
            );

            return {
                filename,
                totalExported: data.length,
                sheets: ['Liste Collective']
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
            const ws = XLSX.utils.json_to_sheet(data);
            const sheetName = BoundouConfig.EXCEL.SHEET_NAMES[entityType.toUpperCase()] || entityType;
            
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            
            const filename = `preview_${entityType}_${Date.now()}.xlsx`;
            XLSX.writeFile(wb, filename);
            
            BoundouUtils.showSuccess(`Prévisualisation exportée: ${filename}`);
            
        } catch (error) {
            BoundouUtils.showError(`Erreur d'export: ${error.message}`);
        }
    };

    // Export public methods
    return {
        generateIndividualDeliberationList,
        generateCollectiveDeliberationList,
        exportPreviewData
    };
})();