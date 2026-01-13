const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;
const basePath = __dirname;

const server = http.createServer((req, res) => {
    console.log(`Request received: ${req.url}`);
    
    // Handle different file types with appropriate content types
    let filePath = basePath + req.url;
    
    // Default to index.html if root is requested
    if (req.url === '/') {
        filePath = path.join(basePath, 'index.html');
    }
    
    // Determine content type based on file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.svg': 'application/image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                console.error(`File not found: ${filePath}`);
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                // Other server error
                console.error(`Server error: ${error.code}`);
                res.writeHead(500);
                res.end('500 Internal Server Error');
            }
        } else {
            // Success - send file
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});