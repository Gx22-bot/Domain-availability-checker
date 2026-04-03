const express = require('express');
const dns = require('dns');
const path = require('path');
const app = express();


app.use(express.static('public'));
app.use(express.json());

app.post('/check-domain', async (req, res) => {
    let domain = req.body.domain;
    
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    // Basic cleanup to handle "https://google.com" or "www.google.com"
    try {
        // If it doesn't start with http, URL might fail, so prepend
        const domainStr = domain.startsWith('http') ? domain : `http://${domain}`;
        const url = new URL(domainStr);
        domain = url.hostname;
    } catch (e) {
        // If URL parsing fails, just use the original string
    }

    console.log(`Checking Google Workspace status for: ${domain}`);

            try {
                // User specifically requested to use the logic from the Google Recovery Tool
                // URL: https://toolbox.googleapps.com/apps/recovery/domain_in_use
                // We fetch this page directly to see what it reports.
                const toolboxUrl = `https://toolbox.googleapps.com/apps/recovery/domain_in_use?domain=${domain}`;
                const response = await fetch(toolboxUrl);
                const body = await response.text();

                // Logic based on Toolbox response HTML:
                // 1. "is available for sign-up" -> AVAILABLE
                // 2. "We need your contact email" -> OCCUPIED (It asks for email to help recover the account)
                // 3. "This domain is already in use" -> OCCUPIED
                
                if (body.includes("is available for sign-up")) {
                    return res.json({ 
                        available: true, 
                        message: `Domain ${domain} is available for Google Workspace sign up.`,
                        domain: domain
                    });
                } else if (body.includes("We need your contact email") || body.includes("This domain is already in use")) {
                    return res.json({ 
                        available: false, 
                        message: `Domain ${domain} is already using Google Workspace.`,
                        domain: domain
                    });
                } else {
                    // Fallback if neither signal is found (unexpected response)
                    // We treat it as occupied/unavailable to be safe, or return an error.
                    // But if it doesn't explicitly say available, it's safer to flag it.
                    console.log("Toolbox response did not contain standard signals. Defaulting to unavailable or check manually.");
                    return res.json({ 
                        available: false, 
                        message: `Domain ${domain} status is unclear. It does not appear to be available.`,
                        domain: domain
                    });
                }

            } catch (error) {
        console.error('Error checking Google:', error);
        return res.json({ 
            available: false, 
            error: true,
            message: `Error checking domain: ${error.message}`,
            domain: domain
        });
    }
});

const http = require('http');

// Export the app for Vercel Serverless
module.exports = app;

// Only start the server if running directly (e.g. node server.js)
if (require.main === module) {
    function startServer(port) {
        const server = http.createServer(app);

        server.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is busy, trying ${port + 1}...`);
                startServer(port + 1);
            } else {
                console.error('Server error:', err);
            }
        });
    }

    const startPort = 3000;
    startServer(startPort);
}
