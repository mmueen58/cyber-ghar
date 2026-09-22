const http = require('http');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

const DATA_FILE = path.join(__dirname, 'orders.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

function getStoredOrders() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading orders file:', err);
    }
    return [];
}

function saveOrders(orders) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving orders file:', err);
    }
}

const server = http.createServer((req, res) => {
    let parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = parsedUrl.pathname;

    // 1. API: Receive new order AND uploaded files using Formidable
    if (pathname === '/api/create-order' && req.method === 'POST') {
        const form = formidable({ uploadDir: UPLOAD_DIR, keepExtensions: true });

        form.parse(req, (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'File upload failed' }));
                return;
            }

            // Extract single values from form fields
            const fullname = Array.isArray(fields.fullname) ? fields.fullname[0] : fields.fullname;
            const phone = Array.isArray(fields.phone) ? fields.phone[0] : fields.phone;
            const service = Array.isArray(fields.service) ? fields.service[0] : fields.service;
            const notes = Array.isArray(fields.notes) ? fields.notes[0] : fields.notes;

            // Handle uploaded file path if present
            let uploadedFile = files.documents;
            if (Array.isArray(uploadedFile)) uploadedFile = uploadedFile[0];
            
            let fileName = uploadedFile ? path.basename(uploadedFile.filepath) : null;

            const newOrder = {
                id: 'CYBER-' + Math.floor(100000 + Math.random() * 900000),
                fullname: fullname,
                phone: phone,
                service: service,
                notes: notes || 'No notes provided',
                filename: fileName,
                status: 'Pending'
            };

            let orders = getStoredOrders();
            orders.unshift(newOrder);
            saveOrders(orders);

            console.log('--- ORDER WITH FILE SAVED ---');
            console.log(`ID: ${newOrder.id} | File: ${fileName || 'None'}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Order created with files!',
                orderId: newOrder.id
            }));
        });
        return;
    }

    // 2. API: Provide orders list to Admin
    if (pathname === '/api/get-orders' && req.method === 'GET') {
        const orders = getStoredOrders();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(orders));
        return;
    }

    // 3. API: Download specific customer document
    if (pathname.startsWith('/download/')) {
        const filename = pathname.replace('/download/', '');
        const filePath = path.join(UPLOAD_DIR, filename);

        if (fs.existsSync(filePath)) {
            res.writeHead(200, {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/octet-stream'
            });
            fs.createReadStream(filePath).pipe(res);
            return;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
    }

    // 4. Serve HTML and static files dynamically
    let filePath = path.join(__dirname, pathname === '/' ? 'web.html' : pathname);
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        } else {
            let ext = path.extname(filePath);
            let contentType = 'text/html';
            if (ext === '.css') contentType = 'text/css';
            if (ext === '.js') contentType = 'text/javascript';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});