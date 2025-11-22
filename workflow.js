// Workflow management for Generation Liste tab
(function() {
    'use strict';

    let currentStep = 1;
    let currentCollectiveStep = 1;
    const totalSteps = 4;
    const totalCollectiveSteps = 3;

    // Initialize workflow when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeWorkflow();
        initializeCollectiveWorkflow();
        setupQuickConfig();
        setupNavigationControls();
    });

    function initializeWorkflow() {
        console.log('🚀 Initializing workflow interface');
        
        // Show only the first step initially
        showStep(1);
        updateNavigationButtons();
        
        // Set up file upload listener (don't replace the input element)
        const fileInput = document.getElementById('individual-file');
        if (fileInput) {
            console.log('✅ Individual file input found');
            // Event listener is handled by generatedeliblist.js
        }
    }

    function initializeCollectiveWorkflow() {
        console.log('🚀 Initializing collective workflow interface');
        
        // Show only the first step initially
        showCollectiveStep(1);
        updateCollectiveNavigationButtons();
        
        // Set up file upload listener (don't replace the input element)
        const fileInput = document.getElementById('collective-file');
        if (fileInput) {
            console.log('✅ Collective file input found');
            // Event listener is handled by generatedeliblist.js
        }
    }

    function showCollectiveStep(stepNumber) {
        console.log(`📋 Showing collective step ${stepNumber}`);
        
        // Hide all collective steps
        for (let i = 1; i <= totalCollectiveSteps; i++) {
            const step = document.getElementById(`collective-step${i}`);
            if (step) {
                step.style.display = 'none';
                step.classList.remove('active');
            }
        }
        
        // Show current step
        const currentStepElement = document.getElementById(`collective-step${stepNumber}`);
        if (currentStepElement) {
            currentStepElement.style.display = 'block';
            currentStepElement.classList.add('active');
            
            // Mark previous steps as completed
            for (let i = 1; i < stepNumber; i++) {
                const prevStep = document.getElementById(`collective-step${i}`);
                if (prevStep) {
                    prevStep.classList.add('completed');
                }
            }
        }
        
        currentCollectiveStep = stepNumber;
        updateCollectiveNavigationButtons();
        
        // Special handling for specific steps
        if (stepNumber === 2) {
            // Show configuration options
            console.log('Collective Step 2: Configuration options visible');
        }
        
        if (stepNumber === 3) {
            // Show preview and generation options
            console.log('Collective Step 3: Showing preview and generation');
            const previewContainer = document.getElementById('previewCollective');
            if (previewContainer) {
                previewContainer.style.display = 'block';
                if (window.DeliberationListUI && window.DeliberationListUI.displayCollectivePreview) {
                    window.DeliberationListUI.displayCollectivePreview();
                }
            }
            
            // Show statistics section
            const statsSection = document.getElementById('statisticsCollectiveSection');
            if (statsSection) {
                statsSection.style.display = 'block';
            }
        }
    }

    function updateCollectiveNavigationButtons() {
        const prevButton = document.getElementById('prevStepCollective');
        const nextButton = document.getElementById('nextStepCollective');
        
        if (prevButton) {
            // Show previous button for steps 2 and 3
            prevButton.style.display = currentCollectiveStep > 1 ? 'inline-block' : 'none';
        }
        
        if (nextButton) {
            // Show next button only for step 2 (to go to step 3)
            nextButton.style.display = currentCollectiveStep === 2 ? 'inline-block' : 'none';
        }
    }

    function setupQuickConfig() {
        const configCards = document.querySelectorAll('.quick-option-card');
        
        configCards.forEach(card => {
            card.addEventListener('click', function() {
                const config = this.dataset.config;
                const type = this.dataset.type || 'individual'; // Default to individual
                
                // Remove selected class from all cards of the same type
                const sameTypeCards = document.querySelectorAll(`.quick-option-card[data-type="${type}"]`);
                sameTypeCards.forEach(c => c.classList.remove('selected'));
                
                // Add selected class to clicked card
                this.classList.add('selected');
                
                // Apply configuration based on selection
                if (type === 'collective') {
                    applyCollectiveQuickConfiguration(config);
                    // Show preview and auto-advance to next step after configuration
                    setTimeout(() => {
                        if (window.DeliberationListUI && window.DeliberationListUI.displayCollectivePreview) {
                            window.DeliberationListUI.displayCollectivePreview();
                        }
                        showCollectiveStep(3);
                    }, 300);
                } else {
                    applyQuickConfiguration(config);
                    // Show preview and auto-advance to next step after configuration
                    setTimeout(() => {
                        if (window.DeliberationListUI && window.DeliberationListUI.displayIndividualPreview) {
                            window.DeliberationListUI.displayIndividualPreview();
                        }
                        showStep(3);
                    }, 300);
                }
            });
        });
    }

    function applyQuickConfiguration(config) {
        console.log(`🔧 Applying quick configuration: ${config}`);
        
        // Initialize advanced options if not exists
        if (!window.BoundouDashboard.advancedOptions) {
            window.BoundouDashboard.advancedOptions = {};
        }
        
        // Get checkbox elements
        const dualListsCheckbox = document.getElementById('enableDualLists');
        const mandataireCheckbox = document.getElementById('enableMandataireSeparation');
        const dateNormalizationCheckbox = document.getElementById('enableDateNormalization');
        
        // Reset all options first
        if (dualListsCheckbox) dualListsCheckbox.checked = false;
        if (mandataireCheckbox) mandataireCheckbox.checked = false;
        if (dateNormalizationCheckbox) dateNormalizationCheckbox.checked = true; // Always enable date normalization
        
        // Reset advanced options object
        window.BoundouDashboard.advancedOptions = {
            enableDualLists: false,
            enableMandataireSeparation: false,
            enableDateNormalization: true,
            ageThreshold: 15
        };
        
        // Apply specific configuration
        switch (config) {
            case 'basic':
                // No additional options needed - just basic three sheets
                console.log('✅ Basic configuration applied');
                break;
                
            case 'habitat-agricole':
                if (dualListsCheckbox) {
                    dualListsCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptions.enableDualLists = true;
                    // Trigger the change event to update the UI and internal state
                    dualListsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('✅ Habitat & Agricole separation enabled');
                }
                break;
                
            case 'mandataire':
                if (mandataireCheckbox) {
                    mandataireCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptions.enableMandataireSeparation = true;
                    // Trigger the change event to update the UI and internal state
                    mandataireCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('✅ Mandataire separation enabled');
                }
                break;
                
            case 'complete':
                if (dualListsCheckbox) {
                    dualListsCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptions.enableDualLists = true;
                    dualListsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (mandataireCheckbox) {
                    mandataireCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptions.enableMandataireSeparation = true;
                    mandataireCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                console.log('✅ Complete configuration applied');
                break;
                
            default:
                console.log('⚠️ Unknown configuration:', config);
        }
        
        // Store the selected configuration for use during generation
        window.selectedQuickConfig = config;
        console.log(`📋 Configuration stored: ${config}`, window.BoundouDashboard.advancedOptions);
    }

    function applyCollectiveQuickConfiguration(config) {
        console.log(`🔧 Applying collective quick configuration: ${config}`);
        
        // Initialize advanced options if not exists
        if (!window.BoundouDashboard.advancedOptionsCollective) {
            window.BoundouDashboard.advancedOptionsCollective = {};
        }
        
        // Get checkbox elements for collective
        const dualListsCheckbox = document.getElementById('enableDualListsCollective');
        const mandataireCheckbox = document.getElementById('enableMandataireSeparationCollective');
        const dateNormalizationCheckbox = document.getElementById('enableDateNormalizationCollective');
        
        // Reset all options first
        if (dualListsCheckbox) dualListsCheckbox.checked = false;
        if (mandataireCheckbox) mandataireCheckbox.checked = false;
        if (dateNormalizationCheckbox) dateNormalizationCheckbox.checked = true; // Always enable date normalization
        
        // Reset advanced options object
        window.BoundouDashboard.advancedOptionsCollective = {
            enableDualLists: false,
            enableMandataireSeparation: false,
            enableDateNormalization: true,
            ageThreshold: 15
        };
        
        // Apply specific configuration
        switch (config) {
            case 'basic':
                // No additional options needed - just basic collective sheets
                console.log('✅ Basic collective configuration applied');
                break;
                
            case 'habitat-agricole':
                if (dualListsCheckbox) {
                    dualListsCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptionsCollective.enableDualLists = true;
                    // Trigger the change event to update the UI and internal state
                    dualListsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('✅ Collective Habitat & Agricole separation enabled');
                }
                break;
                
            case 'mandataire':
                if (mandataireCheckbox) {
                    mandataireCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptionsCollective.enableMandataireSeparation = true;
                    // Trigger the change event to update the UI and internal state
                    mandataireCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('✅ Collective Mandataire separation enabled');
                }
                break;
                
            case 'complete':
                if (dualListsCheckbox) {
                    dualListsCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptionsCollective.enableDualLists = true;
                    dualListsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (mandataireCheckbox) {
                    mandataireCheckbox.checked = true;
                    window.BoundouDashboard.advancedOptionsCollective.enableMandataireSeparation = true;
                    mandataireCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                console.log('✅ Complete collective configuration applied');
                break;
                
            default:
                console.log('⚠️ Unknown collective configuration:', config);
        }
        
        // Store the selected configuration for use during generation
        window.selectedCollectiveQuickConfig = config;
        console.log(`📋 Collective configuration stored: ${config}`, window.BoundouDashboard.advancedOptionsCollective);
    }

    function setupNavigationControls() {
        // Individual navigation controls
        const prevButton = document.getElementById('prevStep');
        const nextButton = document.getElementById('nextStep');
        
        if (prevButton) {
            prevButton.addEventListener('click', function() {
                if (currentStep > 1) {
                    showStep(currentStep - 1);
                }
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', function() {
                if (currentStep < totalSteps) {
                    // Advance to next step
                    showStep(currentStep + 1);
                }
            });
        }
        
        // Collective navigation controls
        const prevButtonCollective = document.getElementById('prevStepCollective');
        const nextButtonCollective = document.getElementById('nextStepCollective');
        
        if (prevButtonCollective) {
            prevButtonCollective.addEventListener('click', function() {
                if (currentCollectiveStep > 1) {
                    showCollectiveStep(currentCollectiveStep - 1);
                }
            });
        }
        
        if (nextButtonCollective) {
            nextButtonCollective.addEventListener('click', function() {
                if (currentCollectiveStep < totalCollectiveSteps) {
                    // For collective, step 2 goes directly to step 3 (generation)
                    showCollectiveStep(currentCollectiveStep + 1);
                }
            });
        }
    }

    function showStep(stepNumber) {
        console.log(`📋 Showing step ${stepNumber}`);
        
        // Hide all steps
        for (let i = 1; i <= totalSteps; i++) {
            const step = document.getElementById(`step${i}`);
            if (step) {
                step.style.display = 'none';
                step.classList.remove('active');
            }
        }
        
        // Show current step
        const currentStepElement = document.getElementById(`step${stepNumber}`);
        if (currentStepElement) {
            currentStepElement.style.display = 'block';
            currentStepElement.classList.add('active');
            
            // Mark previous steps as completed
            for (let i = 1; i < stepNumber; i++) {
                const prevStep = document.getElementById(`step${i}`);
                if (prevStep) {
                    prevStep.classList.add('completed');
                }
            }
        }
        
        currentStep = stepNumber;
        updateNavigationButtons();
        
        // Special handling for specific steps
        if (stepNumber === 2) {
            // Show configuration options
            console.log('Step 2: Configuration options visible');
        }
        
        if (stepNumber === 3) {
            // Show preview
            console.log('Step 3: Showing preview');
            const previewContainer = document.getElementById('previewIndividual');
            if (previewContainer) {
                previewContainer.style.display = 'block';
                if (window.DeliberationListUI && window.DeliberationListUI.displayIndividualPreview) {
                    window.DeliberationListUI.displayIndividualPreview();
                }
            }
        }
        
        if (stepNumber === 4) {
            // Show generation options
            console.log('Step 4: Generation options visible');
            const statsSection = document.getElementById('statisticsSection');
            if (statsSection) {
                statsSection.style.display = 'block';
            }
        }
    }

    function updateNavigationButtons() {
        const prevButton = document.getElementById('prevStep');
        const nextButton = document.getElementById('nextStep');
        
        if (prevButton) {
            // Show previous button for steps 2, 3, 4
            prevButton.style.display = currentStep > 1 ? 'inline-block' : 'none';
        }
        
        if (nextButton) {
            // Show next button for steps 2 and 3 (not for step 1 or 4)
            if (currentStep === 2 || currentStep === 3) {
                nextButton.style.display = 'inline-block';
            } else {
                nextButton.style.display = 'none';
            }
        }
    }

    function updateCollectiveNavigationButtons() {
        // Individual advanced options toggle
        const toggleButton = document.getElementById('toggleAdvancedOptions');
        const advancedSection = document.getElementById('advancedOptionsIndividual');
        
        if (toggleButton && advancedSection) {
            toggleButton.addEventListener('click', function() {
                const isVisible = advancedSection.style.display !== 'none';
                
                if (isVisible) {
                    advancedSection.style.display = 'none';
                    this.textContent = '🔧 Options Avancées';
                } else {
                    advancedSection.style.display = 'block';
                    this.textContent = '📋 Options Simples';
                }
            });
        }
        
        // Collective advanced options toggle
        const toggleButtonCollective = document.getElementById('toggleAdvancedOptionsCollective');
        const advancedSectionCollective = document.getElementById('advancedOptionsCollective');
        
        if (toggleButtonCollective && advancedSectionCollective) {
            toggleButtonCollective.addEventListener('click', function() {
                const isVisible = advancedSectionCollective.style.display !== 'none';
                
                if (isVisible) {
                    advancedSectionCollective.style.display = 'none';
                    this.textContent = '🔧 Options Avancées';
                } else {
                    advancedSectionCollective.style.display = 'block';
                    this.textContent = '📋 Options Simples';
                }
            });
        }
    }

    function updateNavigationButtons() {
        const prevButton = document.getElementById('prevStep');
        const nextButton = document.getElementById('nextStep');
        
        if (prevButton) {
            prevButton.style.display = currentStep > 1 ? 'inline-block' : 'none';
        }
        
        if (nextButton) {
            nextButton.style.display = currentStep < totalSteps ? 'inline-block' : 'none';
        }
    }

    // Make functions available globally for integration with existing code
    window.WorkflowManager = {
        showStep: showStep,
        getCurrentStep: () => currentStep,
        nextStep: () => {
            if (currentStep < totalSteps) {
                showStep(currentStep + 1);
            }
        },
        prevStep: () => {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        },
        // Collective workflow functions
        showCollectiveStep: showCollectiveStep,
        getCurrentCollectiveStep: () => currentCollectiveStep,
        nextCollectiveStep: () => {
            if (currentCollectiveStep < totalCollectiveSteps) {
                showCollectiveStep(currentCollectiveStep + 1);
            }
        },
        prevCollectiveStep: () => {
            if (currentCollectiveStep > 1) {
                showCollectiveStep(currentCollectiveStep - 1);
            }
        }
    };

    // Integration hooks for existing functionality
    
    // Hook into column validation to advance to generation step
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            const validateButton = document.getElementById('validateColumns');
            if (validateButton) {
                validateButton.addEventListener('click', function(event) {
                    console.log('✅ Columns validated, advancing to generation step');
                    setTimeout(() => showStep(4), 500);
                });
            }
        }, 500);
    });
    
    // Listen for collective data processing completion
    window.addEventListener('collectiveDataProcessed', function() {
        console.log('📊 Collective data processed, updating workflow');
        
        // Update collective count (all records are physical persons)
        const data = window.BoundouDashboard.processedCollectiveData;
        const physicalCount = document.getElementById('count-personne_physique');
        
        if (data && Array.isArray(data) && physicalCount) {
            physicalCount.textContent = data.length;
            console.log(`📊 Updated collective physical persons count: ${data.length}`);
        }
        
        // Automatically advance to step 3 (column selection) if in step 2
        if (currentCollectiveStep === 2) {
            setTimeout(() => {
                showCollectiveStep(3);
            }, 500);
        }
    });

    console.log('✅ Workflow interface initialized');
})();