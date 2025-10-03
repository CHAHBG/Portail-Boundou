// === Configuration Constants ===
window.BoundouConfig = {
    // Excel generation settings
    EXCEL: {
        SHEET_NAMES: {
            PERSONNE_PHYSIQUE: 'Personnes physiques',
            PERSONNE_MORALE: 'Personne Morale',
            GROUPEMENT: 'Groupement'
        },
        COLUMNS: {
            PERSONNE_PHYSIQUE: [
                'Village', 'Prenom', 'Nom', 'Sexe', 
                'Date_naiss', 'Num_piece', 'Telephone', 
                'Vocation', 'type_usag', 'superficie', 'nicad', 'Num_parcel'
            ],
            PERSONNE_MORALE: [
                'Village', 'Denomination', 'Forme_jurid', 
                'Num_piece', 'Telephone', 'Vocation', 
                'type_usag', 'superficie', 'nicad', 'Num_parcel'
            ],
            GROUPEMENT: [
                'Village', 'Denomination', 'Forme_jurid', 
                'Num_piece', 'Telephone', 'Vocation', 
                'type_usag', 'superficie', 'nicad', 'Num_parcel'
            ]
        },
        MAX_PREVIEW_ROWS: 10,
        EXCLUDE_PATTERNS: ['_001', '_002', '_003', '_004', '_005']
    },
    
    // UI settings
    UI: {
        LOADING_DELAY: 100,
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 300,
        MAX_ERROR_DISPLAY: 5
    },
    
    // Map settings
    MAP: {
        DEFAULT_ZOOM: 10,
        MIN_ZOOM: 8,
        MAX_ZOOM: 18,
        DEFAULT_CENTER: [12.0, -12.0] // Approximate Senegal coordinates
    },
    
    // Data processing
    DATA: {
        CHUNK_SIZE: 1000,
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        SUPPORTED_FORMATS: ['.xlsx', '.xls', '.csv']
    },
    
    // Error messages
    MESSAGES: {
        ERRORS: {
            FILE_TOO_LARGE: 'Le fichier est trop volumineux (max 50MB)',
            INVALID_FORMAT: 'Format de fichier non supporté',
            PROCESSING_ERROR: 'Erreur lors du traitement des données',
            NETWORK_ERROR: 'Erreur de connexion réseau',
            NO_DATA: 'Aucune donnée trouvée dans le fichier'
        },
        SUCCESS: {
            FILE_PROCESSED: 'Fichier traité avec succès',
            EXCEL_GENERATED: 'Fichier Excel généré avec succès',
            DATA_LOADED: 'Données chargées avec succès'
        },
        INFO: {
            PROCESSING: 'Traitement en cours...',
            LOADING: 'Chargement...',
            GENERATING: 'Génération du fichier...'
        }
    }
};