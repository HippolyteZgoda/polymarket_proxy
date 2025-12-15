const http = require('http');
const net = require('net');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer();

// Gestion du CONNECT pour tunneling HTTPS
server.on('connect', (req, clientSocket, head) => {
    console.log(`[CONNECT] Tunneling request to: ${req.url}`);
    
    // Parser l'URL de destination (format: hostname:port)
    const [hostname, port] = req.url.split(':');
    const targetPort = parseInt(port) || 443;
    
    // Créer la connexion vers la destination
    const targetSocket = net.createConnection(targetPort, hostname, () => {
        console.log(`[CONNECT] Connected to ${hostname}:${targetPort}`);
        
        // Envoyer la réponse 200 Connection Established au client
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        
        // Tunnel bidirectionnel
        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
        
        // Gérer les données initiales (head)
        if (head && head.length > 0) {
            targetSocket.write(head);
        }
    });
    
    targetSocket.on('error', (err) => {
        console.error(`[CONNECT] Target error for ${hostname}:${targetPort}: ${err.message}`);
        if (!clientSocket.destroyed) {
            clientSocket.end();
        }
    });
    
    clientSocket.on('error', (err) => {
        console.error(`[CONNECT] Client error: ${err.message}`);
        if (!targetSocket.destroyed) {
            targetSocket.destroy();
        }
    });
    
    targetSocket.on('close', () => {
        if (!clientSocket.destroyed) {
            clientSocket.end();
        }
    });
    
    clientSocket.on('close', () => {
        if (!targetSocket.destroyed) {
            targetSocket.destroy();
        }
    });
});

// Gestion des requêtes HTTP normales (forward proxy)
server.on('request', (req, res) => {
    console.log(`[${req.method}] ${req.url}`);
    
    // Si c'est une requête vers le proxy lui-même (health check)
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            service: 'Polymarket Proxy',
            location: 'Railway (Netherlands)',
            supports: ['HTTP', 'HTTPS CONNECT tunneling']
        }));
        return;
    }
    
    // Forward proxy pour les requêtes HTTP
    let targetUrl = req.url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://clob.polymarket.com${targetUrl}`;
    }
    
    try {
        const url = new URL(targetUrl);
        const https = require('https');
        const http = require('http');
        const client = url.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: req.method,
            headers: {
                ...req.headers,
                host: url.hostname
            }
        };
        
        delete options.headers['host'];
        delete options.headers['connection'];
        
        const proxyReq = client.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error(`[PROXY] Error: ${err.message}`);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        
        req.pipe(proxyReq);
        
    } catch (err) {
        console.error(`[PROXY] Invalid URL: ${err.message}`);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
});

server.listen(PORT, () => {
    console.log('🚀 Proxy server with CONNECT support started!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Supports: HTTP CONNECT tunneling for HTTPS`);
    console.log(`✅ Ready to proxy requests from Germany → Netherlands → Polymarket`);
    console.log(`📡 Listening for CONNECT requests...`);
});

