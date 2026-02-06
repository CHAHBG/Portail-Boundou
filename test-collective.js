// Test script for collective data processing - Node.js compatible
const fs = require('fs');

console.log('Testing enhanced collective data processing...');

// Load and parse the data
try {
    const rawData = fs.readFileSync('./data/parcelles.json', 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`[STAT] Loaded ${data.length} total records`);
    
    // Find the test parcel 0522010201096
    const testParcel = data.find(row => row.Num_parcel_2 === '0522010201096');
    
    if (testParcel) {
        console.log('\n[DBG] Found test parcel 0522010201096:');
        console.log('Raw data inspection:');
        
        // List all fields that contain names or IDs
        Object.keys(testParcel).forEach(key => {
            if (key.toLowerCase().includes('prenom') || 
                key.toLowerCase().includes('nom') || 
                key.toLowerCase().includes('piece')) {
                console.log(`- ${key}: "${testParcel[key]}"`);
            }
        });
        
        // Count how many affectataires we should expect
        let affectataireCount = 0;
        for (let i = 1; i <= 10; i++) {
            const prenom = testParcel[`Prenom_${i}`];
            const nom = testParcel[`Nom_${i}`];
            const piece = testParcel[`Num_piece_${i}`];
            
            if (prenom && nom && piece) {
                affectataireCount++;
                console.log(`  Affectataire ${i}: ${prenom} ${nom} (ID: ${piece})`);
            }
        }
        
        // Check mandataire
        const mandataire = {
            prenom: testParcel.Prenom_M,
            nom: testParcel.Nom_M,
            piece: testParcel.Num_piec || testParcel.Num_piece
        };
        
        console.log(`\n<i class="bi bi-list-check"></i> Mandataire: ${mandataire.prenom} ${mandataire.nom} (ID: ${mandataire.piece})`);
        console.log(`[LIST] Expected affectataires: ${affectataireCount}`);
        console.log(`[LIST] Total expected individuals: ${affectataireCount + 1} (${affectataireCount} affectataires + 1 mandataire)`);
        
        // Check for homonyms (same name, different ID)
        const allIndividuals = [];
        
        // Add mandataire
        if (mandataire.prenom && mandataire.nom) {
            allIndividuals.push({
                prenom: mandataire.prenom,
                nom: mandataire.nom,
                piece: mandataire.piece,
                role: 'mandataire'
            });
        }
        
        // Add affectataires
        for (let i = 1; i <= 10; i++) {
            const prenom = testParcel[`Prenom_${i}`];
            const nom = testParcel[`Nom_${i}`];
            const piece = testParcel[`Num_piece_${i}`];
            
            if (prenom && nom && piece) {
                allIndividuals.push({
                    prenom: prenom,
                    nom: nom,
                    piece: piece,
                    role: 'affectataire'
                });
            }
        }
        
        console.log('\n[DBG] All individuals analysis:');
        allIndividuals.forEach((ind, idx) => {
            console.log(`${idx + 1}. ${ind.prenom} ${ind.nom} (ID: ${ind.piece}) [${ind.role}]`);
        });
        
        // Check for duplicates by name only vs name+ID
        const nameGroups = {};
        allIndividuals.forEach(ind => {
            const nameKey = `${ind.prenom}_${ind.nom}`;
            if (!nameGroups[nameKey]) {
                nameGroups[nameKey] = [];
            }
            nameGroups[nameKey].push(ind);
        });
        
        console.log('\n[DBG] Name group analysis:');
        Object.keys(nameGroups).forEach(nameKey => {
            const group = nameGroups[nameKey];
            if (group.length > 1) {
                console.log(`[WARN]  Homonym group "${nameKey}": ${group.length} individuals`);
                group.forEach((ind, idx) => {
                    console.log(`   ${idx + 1}. ID: ${ind.piece} [${ind.role}]`);
                });
            } else {
                console.log(`[OK] Unique: "${nameKey}" - ID: ${group[0].piece} [${group[0].role}]`);
            }
        });
        
    } else {
        console.log('[ERR] Test parcel 0522010201096 not found in data');
        
        // Show available parcels with Num_parcel_2 values
        const collectiveParcels = data.filter(row => row.Num_parcel_2).slice(0, 5);
        console.log('\n<i class="bi bi-list-check"></i> Sample collective parcels found:');
        collectiveParcels.forEach(row => {
            console.log(`- ${row.Num_parcel_2} (Village: ${row.Village})`);
        });
    }
    
} catch (error) {
    console.error('[ERR] Test failed:', error.message);
}