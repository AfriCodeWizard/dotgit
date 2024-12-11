const fs = require('fs').promises;
const isBinary = require('is-binary-buffer');
const crypto = require('crypto');
const { logger } = require('./Logger');

/**
 * Handle file content: reads and detects if the file is binary or text.
 * @param {string} filePath - Path to the file
 * @returns {object} - The content of the file, binary flag, size, encoding, and MIME type.
 */
async function handleFileContent(filePath) {
    try {
        // Read file as buffer
        const content = await fs.readFile(filePath);
        const isBinaryResult = detectBinaryContent(content);
        
        // Log file processing details
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

/**
 * Detect if the content is binary or text, and identify MIME type.
 * @param {Buffer} buffer - The file content buffer
 * @returns {object} - Whether the content is binary and its MIME type
 */
function detectBinaryContent(buffer) {
    const binaryCheck = isBinary(buffer);
    
    // Secondary checks for enhanced reliability
    const secondaryChecks = {
        hasNullBytes: buffer.includes(0x00),
        hasHighNonPrintable: (() => {
            const nonPrintable = buffer.filter(byte => (byte < 32 && ![9, 10, 13].includes(byte)) || byte >= 127);
            return nonPrintable.length / buffer.length > 0.3;
        })(),
        hasKnownBinarySignature: checkBinarySignature(buffer)
    };

    // Determine MIME type
    const mimeType = determineMimeType(buffer);

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

/**
 * Check for binary file signatures (magic numbers) for common formats.
 * @param {Buffer} buffer - The file content buffer
 * @returns {boolean} - Whether a known binary signature is found
 */
function checkBinarySignature(buffer) {
    const signatures = {
        PNG: [0x89, 0x50, 0x4E, 0x47],
        JPEG: [0xFF, 0xD8, 0xFF],
        GIF: [0x47, 0x49, 0x46],
        ZIP: [0x50, 0x4B, 0x03, 0x04],
        GZIP: [0x1F, 0x8B],
        PDF: [0x25, 0x50, 0x44, 0x46],
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

/**
 * Determine MIME type based on the file's signature (magic numbers).
 * @param {Buffer} buffer - The file content buffer
 * @returns {string} - The MIME type of the file
 */
function determineMimeType(buffer) {
    const signatures = {
        '89504E47': 'image/png',
        'FFD8FF': 'image/jpeg',
        '474946': 'image/gif',
        '504B0304': 'application/zip',
        '1F8B': 'application/gzip',
        '25504446': 'application/pdf',
        '4D5A': 'application/x-msdownload'
    };

    const hex = buffer.slice(0, 4).toString('hex').toUpperCase();

    for (const [signature, mimeType] of Object.entries(signatures)) {
        if (hex.startsWith(signature)) {
            return mimeType;
        }
    }

    return 'application/octet-stream';
}

/**
 * Write content to a file, validating binary and text content.
 * @param {string} filePath - Path where to write the file
 * @param {object} fileData - The file data, including content and binary flag
 */
async function writeFileContent(filePath, fileData) {
    if (!fileData || typeof fileData.binary !== 'boolean') {
        throw new Error(`Invalid file data for ${filePath}`);
    }

    try {
        let content;
        if (fileData.binary) {
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileData.content)) {
                throw new Error('Invalid base64 encoding');
            }
            content = Buffer.from(fileData.content, 'base64');
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
