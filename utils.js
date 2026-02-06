// === Utility Functions ===
window.BoundouUtils = (() => {
    'use strict';

    // Debounce function for performance optimization
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // Throttle function for scroll/resize events
    const throttle = (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // Show loading indicator
    const showLoading = (elementId, message = BoundouConfig.MESSAGES.INFO.LOADING) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                    <span class="loading-text">${message}</span>
                </div>
            `;
            element.style.display = 'block';
        }
    };

    // Hide loading indicator
    const hideLoading = (elementId) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
            element.innerHTML = '';
        }
    };

    // Show error message with improved styling
    const showError = (message, containerId = 'error-container') => {
        const container = document.getElementById(containerId) || document.body;
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message fade-in';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="error-icon">[WARN]</i>
                <span class="error-text">${message}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        container.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.classList.add('fade-out');
                setTimeout(() => errorDiv.remove(), 300);
            }
        }, 5000);
    };

    // Show success message
    const showSuccess = (message, containerId = 'success-container') => {
        const container = document.getElementById(containerId) || document.body;
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message fade-in';
        successDiv.innerHTML = `
            <div class="success-content">
                <i class="success-icon">[OK]</i>
                <span class="success-text">${message}</span>
                <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        container.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.classList.add('fade-out');
                setTimeout(() => successDiv.remove(), 300);
            }
        }, 3000);
    };

    // Format file size for display
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Validate file before processing
    const validateFile = (file) => {
        const errors = [];
        
        if (!file) {
            errors.push('Aucun fichier sélectionné');
            return errors;
        }
        
        // Check file size
        if (file.size > BoundouConfig.DATA.MAX_FILE_SIZE) {
            errors.push(BoundouConfig.MESSAGES.ERRORS.FILE_TOO_LARGE);
        }
        
        // Check file format
        const fileName = file.name.toLowerCase();
        const isValidFormat = BoundouConfig.DATA.SUPPORTED_FORMATS.some(format => 
            fileName.endsWith(format)
        );
        
        if (!isValidFormat) {
            errors.push(BoundouConfig.MESSAGES.ERRORS.INVALID_FORMAT);
        }
        
        return errors;
    };

    // Sanitize string for Excel
    const sanitizeForExcel = (value) => {
        if (value === null || value === undefined) return '';
        return String(value).trim().replace(/[\r\n\t]/g, ' ');
    };

    // Deep clone object
    const deepClone = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = deepClone(obj[key]);
            });
            return cloned;
        }
        return obj;
    };

    // Process data in chunks for better performance
    const processInChunks = async (data, processFn, chunkSize = BoundouConfig.DATA.CHUNK_SIZE) => {
        const results = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const chunkResults = await processFn(chunk);
            results.push(...chunkResults);
            
            // Allow UI to update between chunks
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        return results;
    };

    // Get ordered columns for Excel generation
    const getOrderedColumns = (data) => {
        if (!data || data.length === 0) return [];
        
        const allColumns = Object.keys(data[0]);
        const priorityColumns = [
            'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Date_naiss',
            'superficie', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'Sexe'
        ];
        
        const orderedColumns = [];
        
        // Add priority columns first if they exist
        priorityColumns.forEach(col => {
            if (allColumns.includes(col)) {
                orderedColumns.push(col);
            }
        });
        
        // Add remaining columns
        allColumns.forEach(col => {
            if (!orderedColumns.includes(col)) {
                orderedColumns.push(col);
            }
        });
        
        return orderedColumns;
    };

    // Export public methods
    return {
        debounce,
        throttle,
        showLoading,
        hideLoading,
        showError,
        showSuccess,
        formatFileSize,
        validateFile,
        sanitizeForExcel,
        deepClone,
        processInChunks,
        getOrderedColumns
    };
})();