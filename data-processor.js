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

    // Process individual data with optimized filtering
    const processIndividualData = async (data) => {
        try {
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error(BoundouConfig.MESSAGES.ERRORS.NO_DATA);
            }

            BoundouUtils.showLoading('loadingIndicator', BoundouConfig.MESSAGES.INFO.PROCESSING);

            // Get all available headers
            const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
            
            // Process data in chunks for better performance
            const processChunk = async (chunk) => {
                return chunk.map(row => {
                    const cleanedRow = {};
                    allHeaders.forEach(header => {
                        if (!shouldExcludeColumn(header) || ['Typ_pers', 'Typ_pers_m'].includes(header)) {
                            cleanedRow[header] = BoundouUtils.sanitizeForExcel(row[header]);
                        }
                    });
                    return cleanedRow;
                });
            };

            const processedData = await BoundouUtils.processInChunks(data, processChunk);
            
            // Store processed data
            window.BoundouDashboard.processedIndividualData = processedData;
            window.BoundouDashboard.originalIndividualData = BoundouUtils.deepClone(data);

            BoundouUtils.hideLoading('loadingIndicator');
            BoundouUtils.showSuccess(BoundouConfig.MESSAGES.SUCCESS.FILE_PROCESSED);

            return processedData;

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

    // Get preview data with configurable row count
    const getPreviewData = (data, entityType, maxRows = BoundouConfig.EXCEL.MAX_PREVIEW_ROWS) => {
        const { data: entityData, headers } = generateEntityData(data, entityType);
        
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

    // Export public methods
    return {
        filterByEntityType,
        shouldExcludeColumn,
        getFilteredHeaders,
        processIndividualData,
        generateEntityData,
        getPreviewData,
        validateDataStructure
    };
})();