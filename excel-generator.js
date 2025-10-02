// === Excel Generation Module ===
window.BoundouExcelGenerator = (() => {
    'use strict';

    // Generate individual deliberation list with improved error handling
    const generateIndividualDeliberationList = async () => {
        try {
            const data = window.BoundouDashboard.processedIndividualData;
            
            if (!data || data.length === 0) {
                throw new Error(BoundouConfig.MESSAGES.ERRORS.NO_DATA);
            }

            BoundouUtils.showLoading('loadingIndicator', BoundouConfig.MESSAGES.INFO.GENERATING);

            // Validate data structure
            const validationErrors = BoundouDataProcessor.validateDataStructure(data);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join(', '));
            }

            // Create workbook
            const wb = XLSX.utils.book_new();
            const sheets = [];

            // Generate Personnes Physiques sheet
            const physiquesResult = BoundouDataProcessor.generateEntityData(data, 'personne_physique');
            if (physiquesResult.data.length > 0) {
                const wsPhysiques = XLSX.utils.json_to_sheet(physiquesResult.data);
                XLSX.utils.book_append_sheet(wb, wsPhysiques, BoundouConfig.EXCEL.SHEET_NAMES.PERSONNE_PHYSIQUE);
                sheets.push({
                    name: BoundouConfig.EXCEL.SHEET_NAMES.PERSONNE_PHYSIQUE,
                    count: physiquesResult.data.length
                });
            }

            // Generate Personnes Morales sheet
            const moralesResult = BoundouDataProcessor.generateEntityData(data, 'personne_morale');
            if (moralesResult.data.length > 0) {
                const wsMorales = XLSX.utils.json_to_sheet(moralesResult.data);
                XLSX.utils.book_append_sheet(wb, wsMorales, BoundouConfig.EXCEL.SHEET_NAMES.PERSONNE_MORALE);
                sheets.push({
                    name: BoundouConfig.EXCEL.SHEET_NAMES.PERSONNE_MORALE,
                    count: moralesResult.data.length
                });
            }

            // Generate Groupements sheet
            const groupementsResult = BoundouDataProcessor.generateEntityData(data, 'groupement');
            if (groupementsResult.data.length > 0) {
                const wsGroupements = XLSX.utils.json_to_sheet(groupementsResult.data);
                XLSX.utils.book_append_sheet(wb, wsGroupements, BoundouConfig.EXCEL.SHEET_NAMES.GROUPEMENT);
                sheets.push({
                    name: BoundouConfig.EXCEL.SHEET_NAMES.GROUPEMENT,
                    count: groupementsResult.data.length
                });
            }

            if (sheets.length === 0) {
                throw new Error('Aucune donnée à exporter');
            }

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `liste_deliberation_${timestamp}.xlsx`;

            // Write and download file
            XLSX.writeFile(wb, filename);

            BoundouUtils.hideLoading('loadingIndicator');
            
            // Show success message with details
            const sheetDetails = sheets.map(sheet => `${sheet.name}: ${sheet.count} entrées`).join(', ');
            BoundouUtils.showSuccess(`${BoundouConfig.MESSAGES.SUCCESS.EXCEL_GENERATED} (${sheetDetails})`);

            return { filename, sheets };

        } catch (error) {
            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showError(`Erreur lors de la génération: ${error.message}`);
            throw error;
        }
    };

    // Generate collective deliberation list (placeholder for future implementation)
    const generateCollectiveDeliberationList = async () => {
        try {
            const data = window.BoundouDashboard.processedCollectiveData;
            
            if (!data || data.length === 0) {
                throw new Error('Aucune donnée collective à traiter');
            }

            // Implementation for collective data processing
            // This can be extended based on specific requirements
            
            BoundouUtils.showSuccess('Génération collective non implémentée');
            
        } catch (error) {
            BoundouUtils.showError(`Erreur collective: ${error.message}`);
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