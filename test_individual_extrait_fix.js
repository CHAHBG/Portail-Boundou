// Test the individual data extrait document age separation fix

console.log('🧪 Testing Individual Data Extrait Document Age Separation...\n');

console.log('🔧 PROBLEM IDENTIFIED:');
console.log('  - Individual data processing was using wrong birth date field');
console.log('  - Used Date_nai (collective mandataire field) instead of Date_naiss (individual field)');
console.log('  - This caused age calculation failures for individual people with extrait documents');

console.log('\n✅ FIX IMPLEMENTED:');
console.log('  - Changed getRecordAge function to use Date_naiss for individual data');
console.log('  - Updated variable names from mandataireDateField to individualDateField');
console.log('  - Fixed field reference from Date_nai to Date_naiss');

console.log('\n🎯 EXPECTED BEHAVIOR AFTER FIX:');
console.log('  📋 For individual files with extrait_de_naissance documents:');
console.log('    ✓ Age calculated from Date_naiss field (not Date_nai)');
console.log('    ✓ People with extrait documents separated by habitat/agricole usage');
console.log('    ✓ Within each usage type, separated by major/minor age groups');
console.log('    ✓ Sheets like: "Habitat_Physiques_Mineurs", "Habitat_Physiques_Majeurs"');
console.log('    ✓ Sheets like: "Agricole_Physiques_Mineurs", "Agricole_Physiques_Majeurs"');

console.log('\n📊 EXAMPLE EXPECTED SHEETS:');
console.log('  For person with: Date_naiss=2010-05-15, Type_piece=extrait_de_naissance, type_usag=Habitat');
console.log('  → Should appear in: "Habitat_Physiques_Mineurs" (age 15, ≤15 threshold)');
console.log('');
console.log('  For person with: Date_naiss=1990-05-15, Type_piece=extrait_de_naissance, type_usag=Agricole');
console.log('  → Should appear in: "Agricole_Physiques_Majeurs" (age 35, >15 threshold)');

console.log('\n🔍 DEBUG INFO TO LOOK FOR:');
console.log('  ✓ "Using individual birth date (Date_naiss): YYYY-MM-DD"');
console.log('  ✓ "Calculated individual age: XX"');
console.log('  ✓ "Found extrait document: extrait_de_naissance"');
console.log('  ✓ "Found underage/major mandataire: age XX, doc: extrait_de_naissance"');

console.log('\n🚀 TESTING INSTRUCTIONS:');
console.log('  1. Upload an individual file with people having extrait_de_naissance documents');
console.log('  2. Enable advanced options: ✓ Dual Lists ✓ Mandataire Separation');
console.log('  3. Set age threshold (e.g., 15 years)');
console.log('  4. Generate enhanced individual lists');
console.log('  5. Check console for proper Date_naiss field usage');
console.log('  6. Verify separate sheets for habitat/agricole major/minor extrait documents');

console.log('\n✅ Fix completed - ready for testing!');