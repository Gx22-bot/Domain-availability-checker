const https = require('https');

function check(domain) {
    const url = `https://www.google.com/a/${domain}/ServiceLogin`;
    console.log(`Checking ${url}...`);
    
    https.get(url, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Location Header: ${res.headers.location}`);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (data.includes("Sorry, you've reached a login page for a domain that isn't using")) {
                console.log("Result: NOT USING Google Workspace");
            } else if (res.statusCode === 302 && res.headers.location && res.headers.location.includes("ServiceLogin")) {
                console.log("Result: Redirected to ServiceLogin (Likely USING Google Workspace)");
            } else if (data.includes('Sign in')) {
                console.log("Result: Sign in page found (Likely USING Google Workspace)");
            } else {
                console.log("Result: Unknown/Other");
                console.log("Snippet:", data.substring(0, 200));
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

check('aeanimation.ie');
check('google.com');
check('thisdomaindoesnotexist123456.com');
