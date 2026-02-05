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
        const googleUrl = `https://www.google.com/a/${domain}/ServiceLogin`;
        const response = await fetch(googleUrl);
        const body = await response.text();

        // Logic updated based on user feedback:
        // The user wants to replicate the check from https://toolbox.googleapps.com/apps/recovery/domain_in_use
        // That tool checks if a domain is "in use" by Google Workspace.
        // If "ServiceLogin" redirects to a login page, it IS in use.
        // If it shows "Sorry, you've reached a login page for a domain that isn't using Google Workspace", it is NOT in use.
        
        // HOWEVER, the user previously said "techotrends.com" is "Occupied" but my tool said "Available".
        // And they hated the DNS check.
        // If techotrends.com is NOT using Google Workspace, "Available" (for GW sign up) is the correct technical status.
        // But maybe the user interprets "Available" as "I can buy this domain".
        // Since we removed DNS check, we must be clear in our message.
        
        const notUsingMsg = "Sorry, you've reached a login page for a domain that isn't using";
        
        if (body.includes(notUsingMsg)) {
            return res.json({ 
                available: true, 
                message: `Domain ${domain} is available for Google Workspace sign up (Not currently using Google Workspace).`,
                domain: domain
            });
        } else {
            return res.json({ 
                available: false, 
                message: `Domain ${domain} is already using Google Workspace.`,
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
