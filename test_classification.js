// Test the simplified classification system
const fs = require('fs').promises;

// Test the getCollectiveRecordCategory function
const getCollectiveRecordCategory = (record, ageThreshold) => {
    // Calculate age from Date_nai field (mandataire birth date)
    const calculateAge = (dateStr) => {
        if (!dateStr) return null;
        
        try {
            const dateValue = String(dateStr).trim();
            
            // Handle different date formats
            let birthDate;
            
            if (dateValue.includes('-')) {
                // Handle YYYY-MM-DD format
                const parts = dateValue.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                    const day = parseInt(parts[2]);
                    birthDate = new Date(year, month, day);
                }
            } else if (dateValue.length === 4 && !isNaN(dateValue)) {
                // Handle year-only format (YYYY)
                const year = parseInt(dateValue);
                birthDate = new Date(year, 0, 1); // January 1st of that year
            }
            
            if (!birthDate || isNaN(birthDate.getTime())) {
                return null;
            }
            
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            return age >= 0 && age < 150 ? age : null;
        } catch (error) {
            return null;
        }
    };

    // Check document type (for collective data, use Type_piec field)
    const docField = record.Type_piec;
    if (!docField) {
        console.log(`⚠️ No Type_piec field found, classifying as standard`);
        return 'standard';
    }
    
    const docType = String(docField).toLowerCase().trim();
    console.log(`🔍 Checking document type: "${docType}" for mandataire with Date_nai: ${record.Date_nai}`);
    
    // Check if it's an extrait de naissance document
    const isExtrait = docType === 'extrait_de_naissance' || 
                      docType === 'extrait de naissance' ||
                      (docType.includes('extrait') && docType.includes('naissance'));
    
    if (isExtrait) {
        // For extrait documents, apply age-based classification
        const age = calculateAge(record.Date_nai);
        
        if (age === null) {
            console.log(`⚠️ Could not calculate age for extrait document, defaulting to standard`);
            return 'standard';
        }
        
        const category = age <= ageThreshold ? 'extrait_minor' : 'extrait_major';
        console.log(`📋 Extrait document with age ${age} (threshold: ${ageThreshold}) → ${category}`);
        return category;
    } else {
        // For standard documents (CNI, passport, etc.), no age separation
        console.log(`📋 Standard document (${docType}) → standard (no age separation)`);
        return 'standard';
    }
};

// Test cases
const testRecords = [
    {
        Date_nai: '1984-05-15',
        Type_piec: 'cni',
        name: 'Adult with CNI (should go to standard sheet)'
    },
    {
        Date_nai: '2010-03-20',
        Type_piec: 'cni',
        name: 'Minor with CNI (should go to standard sheet)'
    },
    {
        Date_nai: '1995-08-10',
        Type_piec: 'extrait_de_naissance',
        name: 'Adult with extrait (should go to extrait_major)'
    },
    {
        Date_nai: '2015-12-05',
        Type_piec: 'extrait_de_naissance',
        name: 'Minor with extrait (should go to extrait_minor)'
    },
    {
        Date_nai: '1988-01-01',
        Type_piec: 'passeport',
        name: 'Adult with passport (should go to standard sheet)'
    }
];

console.log('🧪 Testing simplified classification system...\n');

const ageThreshold = 15;
testRecords.forEach((record, index) => {
    console.log(`Test ${index + 1}: ${record.name}`);
    console.log(`  Input: Date_nai=${record.Date_nai}, Type_piec=${record.Type_piec}`);
    
    const category = getCollectiveRecordCategory(record, ageThreshold);
    console.log(`  Result: ${category}\n`);
});

console.log('Expected results:');
console.log('- Standard documents (CNI, passport): All go to "standard" category regardless of age');
console.log('- Extrait documents: Age-based separation (extrait_minor ≤15, extrait_major >15)');
console.log('- This should create only 3 types of sheets: Standard_Mandataire, Extrait_MIN_Mandataire, Extrait_MAJ_Mandataire');