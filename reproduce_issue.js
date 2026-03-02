
const fs = require('fs');

// Mock browser environment parts needed for BoundouDataProcessor
global.window = {};
global.BoundouConfig = {
    MESSAGES: {
        ERRORS: { NO_DATA: 'No data', PROCESSING_ERROR: 'Processing error' },
        INFO: { PROCESSING: 'Processing...' }
    },
    EXCEL: {
        EXCLUDE_PATTERNS: [],
        COLUMNS: {}
    }
};

global.BoundouUtils = {
    showLoading: () => console.log('Show loading'),
    hideLoading: () => console.log('Hide loading'),
    showSuccess: (msg) => console.log('Success:', msg),
    showError: (msg) => console.error('Error:', msg),
    sanitizeForExcel: (val) => val,
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
    processInChunks: async (data, chunkFn) => {
        // Simple synchronous implementation for test
        await chunkFn(data);
    }
};

global.window.BoundouDashboard = {
    processedIndividualData: {},
    processedCollectiveData: [],
    selectedColumns: {}
};

// Load the file content (we need to evaluate it to add it to window)
const processorCode = fs.readFileSync('/Users/user/Desktop/Applications/Portail-Boundou/data-processor.js', 'utf8');
eval(processorCode);

async function runTest() {
    console.log('--- Starting Reproduction Test ---');

    // Test Data with UPPERCASE headers (which currently fail)
    const testData = [
        {
            'TYP_PERS': 'Personne_Physique', // Case mismatch for entity type
            'VILLAGE': 'TestVillage', // Should map to 'Village'
            'PRENOM': 'TestPrenom',   // Should map to 'Prenom'
            'NOM': 'TestNom',         // Should map to 'Nom'
            'SUPERFICIE': '100'       // Should map to 'superficie' (already handled)
        }
    ];

    try {
        await window.BoundouDataProcessor.processIndividualData(testData);

        const result = window.BoundouDashboard.processedIndividualData['personne_physique'][0];

        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.Village === '' || result.Village === undefined) {
            console.error('FAIL: Village is missing (Case sensitivity issue verified)');
        } else {
            console.log('PASS: Village is present');
        }

        if (result.Prenom === '' || result.Prenom === undefined) {
            console.error('FAIL: Prenom is missing (Case sensitivity issue verified)');
        } else {
            console.log('PASS: Prenom is present');
        }

    } catch (e) {
        console.error('Test passed with error:', e);
    }
}

runTest();
