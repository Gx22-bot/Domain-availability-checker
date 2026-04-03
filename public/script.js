document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const domainInput = document.getElementById('domainInput');
    const checkBtn = document.getElementById('checkBtn');
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const statusIcon = document.getElementById('statusIcon');
    
    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Bulk Elements
    const bulkInput = document.getElementById('bulkInput');
    const bulkCheckBtn = document.getElementById('bulkCheckBtn');
    const clearBulkBtn = document.getElementById('clearBulkBtn');
    const bulkResults = document.getElementById('bulkResults');
    const bulkList = document.getElementById('bulkList');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const progressCount = document.getElementById('progressCount');
    const statAvailable = document.querySelector('.stat-available');
    const statTaken = document.querySelector('.stat-taken');

    let bulkResultsData = [];

    // SVG Icons
    const checkIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
    const errorIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    const smallCheckIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
    const smallErrorIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    const loaderIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>`; // Simple spinner part

    // Event Listeners
    checkBtn.addEventListener('click', () => checkSingleDomain());
    domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkSingleDomain();
    });

    bulkCheckBtn.addEventListener('click', checkBulkDomains);
    clearBulkBtn.addEventListener('click', () => {
        bulkInput.value = '';
        bulkResults.classList.add('hidden');
        bulkList.innerHTML = '';
        exportCsvBtn.style.display = 'none';
        bulkResultsData = [];
    });
    exportCsvBtn.addEventListener('click', exportToCSV);

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });

    // Single Check Function
    async function checkSingleDomain() {
        const domain = domainInput.value.trim();
        
        if (!domain) {
            showResult('error', 'Please enter a domain name', 'Input Required');
            return;
        }

        // Reset UI
        resultContainer.classList.add('hidden');
        checkBtn.textContent = 'Checking...';
        checkBtn.disabled = true;

        try {
            const data = await fetchDomainStatus(domain);

            if (data.available) {
                showResult('available', data.message, 'Domain Available');
            } else {
                showResult('taken', data.message, 'Domain Unavailable');
            }

        } catch (error) {
            showResult('error', 'An error occurred while checking the domain.', 'Error');
        } finally {
            checkBtn.textContent = 'Check Domain';
            checkBtn.disabled = false;
        }
    }

    function showResult(type, message, title) {
        resultContainer.classList.remove('hidden');
        resultContainer.className = 'result-container'; // Reset classes
        
        // Cleanup old copy button if exists
        const oldBtn = resultContainer.querySelector('.copy-action-btn');
        if (oldBtn) oldBtn.remove();

        if (type === 'available') {
            resultContainer.classList.add('result-available');
            statusIcon.innerHTML = checkIcon;
            resultTitle.textContent = title;
            resultMessage.textContent = message;

            // Add Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'secondary-btn copy-action-btn';
            copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy`;
            copyBtn.style.marginLeft = 'auto';
            copyBtn.style.height = '36px';
            copyBtn.style.fontSize = '0.875rem';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(domainInput.value);
                const originalContent = copyBtn.innerHTML;
                copyBtn.innerHTML = `Copied!`;
                setTimeout(() => copyBtn.innerHTML = originalContent, 2000);
            };
            resultContainer.appendChild(copyBtn);

        } else if (type === 'taken') {
            resultContainer.classList.add('result-taken');
            statusIcon.innerHTML = errorIcon;
            resultTitle.textContent = title;
            resultMessage.textContent = message;
        } else {
            // Error case
            statusIcon.innerHTML = errorIcon;
            resultTitle.textContent = title;
            resultMessage.textContent = message;
        }
    }

    // Bulk Check Function
    async function checkBulkDomains() {
        const text = bulkInput.value.trim();
        if (!text) return;

        // Split by newlines or commas and filter empty strings
        const domains = text.split(/[\n,]+/).map(d => d.trim()).filter(d => d);
        
        if (domains.length === 0) return;

        // Reset Bulk UI
        bulkResults.classList.remove('hidden');
        bulkList.innerHTML = '';
        bulkCheckBtn.disabled = true;
        bulkCheckBtn.textContent = 'Checking...';
        exportCsvBtn.style.display = 'none';
        
        bulkResultsData = [];
        
        let availableCount = 0;
        let takenCount = 0;
        let completedCount = 0;
        const total = domains.length;

        updateStats(availableCount, takenCount, completedCount, total);

        // Process sequentially
        for (const domain of domains) {
            // Create list item (pending state)
            const item = createBulkItem(domain);
            bulkList.appendChild(item);
            item.scrollIntoView({ behavior: 'smooth', block: 'end' });

            try {
                const data = await fetchDomainStatus(domain);
                
                bulkResultsData.push({
                    domain: domain,
                    status: data.available ? 'Available' : 'Taken',
                    message: data.message
                });

                if (data.available) {
                    availableCount++;
                    updateBulkItem(item, 'available', 'Available');
                } else {
                    takenCount++;
                    updateBulkItem(item, 'taken', 'Taken');
                }
            } catch (error) {
                bulkResultsData.push({
                    domain: domain,
                    status: 'Error',
                    message: 'Error checking domain'
                });
                updateBulkItem(item, 'error', 'Error');
            }

            completedCount++;
            updateStats(availableCount, takenCount, completedCount, total);
        }

        bulkCheckBtn.disabled = false;
        bulkCheckBtn.textContent = 'Check All Domains';
        
        if (bulkResultsData.length > 0) {
            exportCsvBtn.style.display = 'block';
        }
    }

    function exportToCSV() {
        if (bulkResultsData.length === 0) return;

        const headers = ['Domain', 'Status', 'Message'];
        const csvContent = [
            headers.join(','),
            ...bulkResultsData.map(row => 
                [row.domain, row.status, `"${row.message ? row.message.replace(/"/g, '""') : ''}"`].join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `domain_check_results_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function createBulkItem(domain) {
        const div = document.createElement('div');
        div.className = 'bulk-item';
        div.innerHTML = `
            <span class="bulk-item-domain">${domain}</span>
            <span class="bulk-item-status">Checking...</span>
        `;
        return div;
    }

    function updateBulkItem(element, status, text) {
        element.className = `bulk-item ${status}`;
        const icon = status === 'available' ? smallCheckIcon : smallErrorIcon;
        element.querySelector('.bulk-item-status').innerHTML = `${icon} ${text}`;
    }

    function updateStats(available, taken, completed, total) {
        statAvailable.textContent = `${available} Available`;
        statTaken.textContent = `${taken} Taken`;
        progressCount.textContent = `(${completed}/${total})`;
    }

    async function fetchDomainStatus(domain) {
        const response = await fetch('/check-domain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        return await response.json();
    }
});
