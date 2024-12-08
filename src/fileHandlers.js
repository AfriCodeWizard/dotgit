const fs = require('fs').promises;
const isBinary = require('is-binary-buffer');
const crypto = require('crypto');

async function handleFileContent(filePath) {
    try {
        // Read file as buffer
        const content = await fs.readFile(filePath);
        const isBinaryResult = detectBinaryContent(content);
        
        // Add debug logging
        logger.debug(`Processing file: ${filePath}`);
        logger.debug(`File size: ${content.length} bytes`);
        logger.debug(`Detected as binary: ${isBinaryResult.binary}`);
        logger.debug(`MIME type: ${isBinaryResult.mimeType}`);
        
        return {
            content: isBinaryResult.binary ? content.toString('base64') : content.toString('utf8'),
            binary: isBinaryResult.binary,
            size: content.length,
            encoding: isBinaryResult.binary ? 'base64' : 'utf8',
            mimeType: isBinaryResult.mimeType
        };
    } catch (error) {
        logger.error(`Failed to read file ${filePath}: ${error.message}`);
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
}

function detectBinaryContent(buffer) {
    // Primary check using is-binary-buffer
    const binaryCheck = isBinary(buffer);
    
    // Secondary checks for enhanced reliability
    const secondaryChecks = {
        // Check for null bytes (common in binary files)
        hasNullBytes: buffer.includes(0x00),
        
        // Check for high concentration of non-printable characters
        hasHighNonPrintable: (() => {
            const nonPrintable = buffer.filter(byte => (byte < 32 && ![9, 10, 13].includes(byte)) || byte >= 127);
            return nonPrintable.length / buffer.length > 0.3;
        })(),
        
        // Check file signature/magic numbers for common binary formats
        hasKnownBinarySignature: checkBinarySignature(buffer)
    };

    // Determine MIME type
    const mimeType = determineMimeType(buffer);

    // Combine all checks for final decision
    const isBinaryFile = binaryCheck || 
                        secondaryChecks.hasNullBytes ||
                        secondaryChecks.hasHighNonPrintable ||
                        secondaryChecks.hasKnownBinarySignature ||
                        mimeType.startsWith('application/') ||
                        mimeType.startsWith('image/') ||
                        mimeType.startsWith('audio/') ||
                        mimeType.startsWith('video/');

    return {
        binary: isBinaryFile,
        mimeType: mimeType
    };
}

function checkBinarySignature(buffer) {
    // Common file signatures (magic numbers)
    const signatures = {
        // Images
        PNG: [0x89, 0x50, 0x4E, 0x47],
        JPEG: [0xFF, 0xD8, 0xFF],
        GIF: [0x47, 0x49, 0x46],
        // Archives
        ZIP: [0x50, 0x4B, 0x03, 0x04],
        GZIP: [0x1F, 0x8B],
        // PDFs
        PDF: [0x25, 0x50, 0x44, 0x46],
        // Executables
        EXE: [0x4D, 0x5A]
    };

    for (const [, signature] of Object.entries(signatures)) {
        if (buffer.length >= signature.length) {
            const matches = signature.every((byte, index) => buffer[index] === byte);
            if (matches) return true;
        }
    }

    return false;
}

function determineMimeType(buffer) {
    // Basic MIME type detection based on file signatures
    const signatures = {
        '89504E47': 'image/png',
        'FFD8FF': 'image/jpeg',
        '474946': 'image/gif',
        '504B0304': 'application/zip',
        '1F8B': 'application/gzip',
        '25504446': 'application/pdf',
        '4D5A': 'application/x-msdownload'
    };

    // Convert first few bytes to hex string
    const hex = buffer.slice(0, 4).toString('hex').toUpperCase();

    // Check against known signatures
    for (const [signature, mimeType] of Object.entries(signatures)) {
        if (hex.startsWith(signature)) {
            return mimeType;
        }
    }

    return 'application/octet-stream';
}

async function writeFileContent(filePath, fileData) {
    if (!fileData || typeof fileData.binary !== 'boolean') {
        throw new Error(`Invalid file data for ${filePath}`);
    }

    try {
        let content;
        if (fileData.binary) {
            // Add additional validation for base64 content
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileData.content)) {
                throw new Error('Invalid base64 encoding');
            }
            content = Buffer.from(fileData.content, 'base64');
            
            // Verify size after decoding
            if (content.length !== fileData.size) {
                logger.error(`Size mismatch: expected ${fileData.size}, got ${content.length}`);
                throw new Error('Size mismatch after base64 decoding');
            }
        } else {
            content = fileData.content;
        }

        // Create directory if it doesn't exist
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        // Write file
        await fs.writeFile(filePath, content);
        
        // Verify written file
        const verificationBuffer = await fs.readFile(filePath);
        if (verificationBuffer.length !== fileData.size) {
            throw new Error('File verification failed: size mismatch');
        }
        
        logger.debug(`Successfully wrote file: ${filePath}`);
        logger.debug(`Size: ${content.length} bytes`);
        logger.debug(`Binary: ${fileData.binary}`);
    } catch (error) {
        logger.error(`Failed to write file ${filePath}: ${error.message}`);
        throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
}

module.exports = {
    handleFileContent,
    detectBinaryContent,
    checkBinarySignature,
    determineMimeType,
    writeFileContent
};
