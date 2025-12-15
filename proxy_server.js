const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Middleware pour logger les requêtes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Proxy vers Polymarket
app.use('/', createProxyMiddleware({
    target: 'https://clob.polymarket.com',
    changeOrigin: true,
    secure: true,
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
        console.log(`→ Proxying to: https://clob.polymarket.com${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`← Response: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(500).json({ error: 'Proxy error', message: err.message });
    }
}));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('🚀 Proxy server started!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Target: https://clob.polymarket.com`);
    console.log(`✅ Ready to proxy requests from Germany → Netherlands → Polymarket`);
});
