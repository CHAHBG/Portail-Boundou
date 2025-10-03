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
export {
    generateIndividualDeliberationList,
    generateEnhancedIndividualDeliberationList,
    generateCollectiveDeliberationList,
    generateStatisticsExcel,
    exportPreviewData,
    testDocumentDetection  // For debugging purposes
};