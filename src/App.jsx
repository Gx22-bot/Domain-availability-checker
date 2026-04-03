import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { generateUsernames } from './utils/usernameGenerator';
import CSVSplitter from './components/CSVSplitter';
import GoogleSplitter from './components/GoogleSplitter';



function App() {
  const [activeTab, setActiveTab] = useState('generator'); // generator, emailBuilder, csvSplitter, googleSplitter, concatenator

  const [step, setStep] = useState('upload'); // upload, mapping, result
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [mappings, setMappings] = useState({
    domain: '',
    displayName: '',
    count: '',
    password: ''
  });
  const [outputData, setOutputData] = useState([]);
  const [partialGenWarnings, setPartialGenWarnings] = useState([]);
  const fileInputRef = useRef(null);

  const [emailStep, setEmailStep] = useState('upload'); // upload, mapping, result
  const [emailRawData, setEmailRawData] = useState([]);
  const [emailHeaders, setEmailHeaders] = useState([]);
  const [emailFileName, setEmailFileName] = useState('');
  const [emailMappings, setEmailMappings] = useState({
    domain: '',
    pattern: '',
    displayName: '',
    password: ''
  });
  const [emailOutputData, setEmailOutputData] = useState([]);
  const emailFileInputRef = useRef(null);

  const [concatDomain, setConcatDomain] = useState('');
  const [concatPatterns, setConcatPatterns] = useState('');

  const sanitizeDomain = (value) => {
    const str = String(value ?? '').trim().toLowerCase();
    if (!str) return '';
    return str.replace(/^@+/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  };

  const sanitizeLocal = (value) => {
    const str = String(value ?? '').trim().toLowerCase();
    if (!str) return '';
    const beforeAt = str.split('@')[0] || '';
    return beforeAt.replace(/\s+/g, '');
  };

  const normalizedConcatDomain = sanitizeDomain(concatDomain);
  const concatOutput = (() => {
    if (!normalizedConcatDomain) return '';
    const locals = String(concatPatterns ?? '')
      .split(/\r?\n/)
      .map((line) => sanitizeLocal(line))
      .filter(Boolean);
    if (locals.length === 0) return '';
    return locals.map((local) => `${local}@${normalizedConcatDomain}`).join('\n');
  })();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length > 0) {
        const headerRow = data[0];
        
        // Convert rows to objects for easier preview if needed, or keep as arrays
        // Let's keep as array of objects for easier mapping logic
        const jsonData = XLSX.utils.sheet_to_json(ws);
        
        setHeaders(headerRow);
        setRawData(jsonData);
        
        // Auto-guess mappings
        const newMappings = { ...mappings };
        headerRow.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('domain')) newMappings.domain = h;
          if (lower.includes('name') || lower.includes('display')) newMappings.displayName = h;
          if (lower.includes('count') || lower.includes('quantity')) newMappings.count = h;
          if (lower.includes('pass') || lower.includes('pwd')) newMappings.password = h;
        });
        setMappings(newMappings);
        
        setStep('mapping');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleEmailFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setEmailFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length > 0) {
        const headerRow = data[0];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        setEmailHeaders(headerRow);
        setEmailRawData(jsonData);

        const newMappings = { ...emailMappings };
        headerRow.forEach((h) => {
          const lower = String(h).toLowerCase();
          if (!newMappings.domain && lower.includes('domain')) newMappings.domain = h;
          if (!newMappings.pattern) {
            if (lower === 'email_15') newMappings.pattern = h;
            else if (lower.includes('pattern')) newMappings.pattern = h;
            else if (lower.includes('username')) newMappings.pattern = h;
            else if (lower.includes('local')) newMappings.pattern = h;
            else if (lower === 'email') newMappings.pattern = h;
          }
          if (!newMappings.displayName && (lower.includes('display') || lower.includes('name'))) newMappings.displayName = h;
          if (!newMappings.password && (lower.includes('pass') || lower.includes('pwd'))) newMappings.password = h;
        });
        setEmailMappings(newMappings);

        setEmailStep('mapping');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerate = () => {
    if (!mappings.domain || !mappings.displayName || !mappings.password) {
      alert('Please map at least Domain, Display Name, and Password columns.');
      return;
    }

    const expanded = [];
    const warnings = [];
    let previousDomain = null;
    
    rawData.forEach((row, index) => {
      const domain = row[mappings.domain];
      const displayName = row[mappings.displayName];
      const password = row[mappings.password];
      // Default to 25 if count mapping is empty or value is invalid
      let countVal = 25;
      if (mappings.count && row[mappings.count]) {
        countVal = parseInt(row[mappings.count]);
        if (isNaN(countVal) || countVal < 0) countVal = 25;
      }

      if (!domain || !displayName) return; // Skip invalid rows

      // Insert empty row if domain changes (and it's not the first group)
      if (previousDomain && domain !== previousDomain) {
        expanded.push({
          'DOMAIN': '',
          'DISPLAY NAME': '',
          'EMAIL_15': '',
          'PASSWORD': '',
          'SEQUENCER': '',
          'EMAIL GUARD': ''
        });
      }
      previousDomain = domain;

      const usernames = generateUsernames(displayName, countVal);
      
      if (usernames.length < countVal) {
        warnings.push(`Row ${index + 1} (${displayName}): Requested ${countVal}, generated ${usernames.length}. (Ran out of unique patterns)`);
      }

      usernames.forEach(username => {
        expanded.push({
          'DOMAIN': domain,
          'DISPLAY NAME': displayName,
          'EMAIL_15': username,
          'PASSWORD': password,
          'SEQUENCER': '',
          'EMAIL GUARD': ''
        });
      });
    });

    setOutputData(expanded);
    setPartialGenWarnings(warnings);
    setStep('result');
  };

  const handleBuildEmails = () => {
    if (!emailMappings.domain || !emailMappings.pattern || !emailMappings.displayName || !emailMappings.password) {
      alert('Please map Domain, Display Name, Pattern, and Password columns.');
      return;
    }

    const expanded = [];
    let previousDomain = null;

    emailRawData.forEach((row) => {
      const domain = sanitizeDomain(row[emailMappings.domain]);
      const local = sanitizeLocal(row[emailMappings.pattern]);
      const displayName = row[emailMappings.displayName] ?? '';
      const password = row[emailMappings.password] ?? '';

      if (!domain || !local) return;
      if (!/^[a-z]/.test(local)) return;

      if (previousDomain && domain !== previousDomain) {
        expanded.push({
          'DOMAIN': '',
          'DISPLAY NAME': '',
          'EMAIL': '',
          'PASSWORD': ''
        });
      }
      previousDomain = domain;

      expanded.push({
        'DOMAIN': domain,
        'DISPLAY NAME': displayName,
        'EMAIL': `${local}@${domain}`,
        'PASSWORD': password
      });
    });

    setEmailOutputData(expanded);
    setEmailStep('result');
  };

  const handleDownload = (format) => {
    const ws = XLSX.utils.json_to_sheet(outputData, { header: ['DOMAIN', 'DISPLAY NAME', 'EMAIL_15', 'PASSWORD', 'SEQUENCER', 'EMAIL GUARD'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
    // Generate filename based on original + timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    const outName = `${baseName}_expanded_${timestamp}.${format}`;
    
    if (format === 'csv') {
      XLSX.writeFile(wb, outName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, outName);
    }
  };

  const handleEmailDownload = (format) => {
    const ws = XLSX.utils.json_to_sheet(emailOutputData, { header: ['DOMAIN', 'DISPLAY NAME', 'EMAIL', 'PASSWORD'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = emailFileName.replace(/\.[^/.]+$/, "");
    const outName = `${baseName}_emails_${timestamp}.${format}`;

    if (format === 'csv') {
      XLSX.writeFile(wb, outName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, outName);
    }
  };

  const handleEmailSampleDownload = () => {
    const sampleData = [
      { 'DOMAIN': 'example.com', 'DISPLAY NAME': 'Shelby Mccarty', 'PATTERN': 'shelby.mccarty', 'PASSWORD': 'pass123' },
      { 'DOMAIN': 'test.org', 'DISPLAY NAME': 'John Doe', 'PATTERN': 'john_doe', 'PASSWORD': 'secret456' },
      { 'DOMAIN': 'single.net', 'DISPLAY NAME': 'Madonna', 'PATTERN': 'madonna', 'PASSWORD': 'singer1' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: ['DOMAIN', 'DISPLAY NAME', 'PATTERN', 'PASSWORD'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, "email_builder_sample.csv", { bookType: 'csv' });
  };

  const handleDownloadSample = () => {
    const sampleData = [
      { 'DOMAIN': 'example.com', 'DISPLAY NAME': 'Shelby Mccarty', 'COUNT': 30, 'PASSWORD': 'pass123' },
      { 'DOMAIN': 'test.org', 'DISPLAY NAME': 'John Doe', 'COUNT': 5, 'PASSWORD': 'secret456' },
      { 'DOMAIN': 'single.net', 'DISPLAY NAME': 'Madonna', 'COUNT': 10, 'PASSWORD': 'singer1' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: ['DOMAIN', 'DISPLAY NAME', 'COUNT', 'PASSWORD'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, "sample_input.csv", { bookType: 'csv' });
  };

  const resetGenerator = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setFileName('');
    setOutputData([]);
    setPartialGenWarnings([]);
    setMappings({ domain: '', displayName: '', count: '', password: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetEmailBuilder = () => {
    setEmailStep('upload');
    setEmailRawData([]);
    setEmailHeaders([]);
    setEmailFileName('');
    setEmailOutputData([]);
    setEmailMappings({ domain: '', pattern: '', displayName: '', password: '' });
    if (emailFileInputRef.current) emailFileInputRef.current.value = '';
  };

  const resetConcatenator = () => {
    setConcatDomain('');
    setConcatPatterns('');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden">
        
        {/* Header */}
        <header className="bg-indigo-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Sheet Expander</h1>
          </div>
          {activeTab === 'generator' && step !== 'upload' && (
            <button 
              onClick={resetGenerator}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-md transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Start Over
            </button>
          )}
          {activeTab === 'emailBuilder' && emailStep !== 'upload' && (
            <button
              onClick={resetEmailBuilder}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-md transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Start Over
            </button>
          )}
          {activeTab === 'concatenator' && (concatDomain.trim() || concatPatterns.trim()) && (
            <button
              onClick={resetConcatenator}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-md transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Start Over
            </button>
          )}
        </header>

        <main className="p-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'generator'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Generate Usernames
            </button>
            <button
              onClick={() => setActiveTab('emailBuilder')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'emailBuilder'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Build Emails
            </button>
            <button
              onClick={() => setActiveTab('csvSplitter')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'csvSplitter'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              CSV Splitter
            </button>
            <button
              onClick={() => setActiveTab('googleSplitter')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'googleSplitter'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Google Splitter
            </button>
            <button
              onClick={() => setActiveTab('concatenator')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'concatenator'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Concatenator
            </button>
          </div>

          {activeTab === 'concatenator' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="bg-indigo-100 p-3 rounded-full text-indigo-700">
                  <ArrowRight className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email Concatenator</h2>
                  <p className="text-gray-500 text-sm">Build emails from a domain and one pattern per line</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Domain</label>
                  <input
                    type="text"
                    value={concatDomain}
                    onChange={(e) => setConcatDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="text-xs text-gray-500">
                    Normalized: <span className="font-mono">{normalizedConcatDomain || '—'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Email Patterns (one per line)</label>
                  <textarea
                    value={concatPatterns}
                    onChange={(e) => setConcatPatterns(e.target.value)}
                    placeholder={`john.doe\njane_smith\nmadonna`}
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500 min-h-[240px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Output</label>
                  <textarea
                    value={concatOutput}
                    readOnly
                    placeholder="john.doe@example.com"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-gray-50 min-h-[240px] font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Google Splitter Tab */}
          {activeTab === 'googleSplitter' && (
            <GoogleSplitter />
          )}

          {/* CSV Splitter Tab */}
          {activeTab === 'csvSplitter' && (
            <CSVSplitter />
          )}
          
          {/* Step 1: Upload */}
          {activeTab === 'generator' && step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                 onClick={() => fileInputRef.current.click()}>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv, .xlsx, .xls" 
                onChange={handleFileUpload} 
              />
              <Upload className="w-16 h-16 text-indigo-400 mb-4" />
              <p className="text-xl font-medium text-gray-600">Click to upload CSV or XLSX</p>
              <p className="text-gray-400 mt-2">Supports .csv, .xlsx</p>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownloadSample(); }}
                className="mt-6 flex items-center gap-2 text-indigo-500 hover:text-indigo-600 font-medium z-10"
              >
                <Download className="w-4 h-4" /> Download Sample Template
              </button>
            </div>
          )}

          {/* Step 2: Mapping */}
          {activeTab === 'generator' && step === 'mapping' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="bg-indigo-100 p-3 rounded-full text-indigo-700">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Map Columns</h2>
                  <p className="text-gray-500 text-sm">File: {fileName} | {rawData.length} rows</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Mapping Controls */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-4 h-fit">
                  <h3 className="font-semibold text-gray-700 mb-4">Column Configuration</h3>
                  
                  {[
                    { key: 'domain', label: 'Domain', required: true },
                    { key: 'displayName', label: 'Display Name', required: true },
                    { key: 'password', label: 'Password', required: true },
                    { key: 'count', label: 'Count', required: false }
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <select 
                        value={mappings[field.key]}
                        onChange={(e) => setMappings({...mappings, [field.key]: e.target.value})}
                        className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">-- Select Column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <button 
                    onClick={handleGenerate}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    Generate Expanded Table <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview Table */}
                <div className="overflow-hidden border rounded-lg">
                  <div className="bg-gray-100 px-4 py-2 border-b font-medium text-sm text-gray-600">
                    Input Preview (First 10 rows)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rawData.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            {headers.map((h, j) => (
                              <td key={j} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {activeTab === 'generator' && step === 'result' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full text-green-700">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Generation Complete</h2>
                    <p className="text-gray-500 text-sm">{outputData.length} rows generated</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleDownload('csv')}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                  <button 
                    onClick={() => handleDownload('xlsx')}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download XLSX
                  </button>
                </div>
              </div>

              {partialGenWarnings.length > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800">
                        Warning: Some rows did not meet the requested count
                      </h3>
                      <div className="mt-1 text-sm text-amber-700 max-h-32 overflow-y-auto">
                        <p className="mb-2">
                          Because the Add numbers option was disabled, we ran out of unique username patterns for the following rows:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {partialGenWarnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden shadow-sm">
                 <div className="bg-gray-100 px-4 py-2 border-b font-medium text-sm text-gray-600 flex justify-between items-center">
                    <span>Output Preview (First 100 rows)</span>
                  </div>
                  <div className="overflow-auto max-h-[80vh]">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {['DOMAIN', 'DISPLAY NAME', 'EMAIL_15', 'PASSWORD', 'SEQUENCER', 'EMAIL GUARD'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {outputData.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row['DOMAIN']}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row['DISPLAY NAME']}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-indigo-600">{row['EMAIL_15']}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row['PASSWORD']}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row['SEQUENCER']}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row['EMAIL GUARD']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'emailBuilder' && emailStep === 'upload' && (
            <div
              className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => emailFileInputRef.current.click()}
            >
              <input
                type="file"
                ref={emailFileInputRef}
                className="hidden"
                accept=".csv, .xlsx, .xls"
                onChange={handleEmailFileUpload}
              />
              <Upload className="w-16 h-16 text-indigo-400 mb-4" />
              <p className="text-xl font-medium text-gray-600">Click to upload CSV or XLSX</p>
              <p className="text-gray-400 mt-2">Upload a file with Domain, Display Name, Pattern, Password columns</p>
              <button
                onClick={(e) => { e.stopPropagation(); handleEmailSampleDownload(); }}
                className="mt-6 flex items-center gap-2 text-indigo-500 hover:text-indigo-600 font-medium z-10"
              >
                <Download className="w-4 h-4" /> Download Sample Template
              </button>
            </div>
          )}

          {activeTab === 'emailBuilder' && emailStep === 'mapping' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="bg-indigo-100 p-3 rounded-full text-indigo-700">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Map Columns</h2>
                  <p className="text-gray-500 text-sm">File: {emailFileName} | {emailRawData.length} rows</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-lg space-y-4 h-fit">
                  <h3 className="font-semibold text-gray-700 mb-4">Column Configuration</h3>

                  {[
                    { key: 'domain', label: 'Domain', required: true },
                    { key: 'displayName', label: 'Display Name', required: true },
                    { key: 'pattern', label: 'Pattern', required: true },
                    { key: 'password', label: 'Password', required: true }
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        value={emailMappings[field.key]}
                        onChange={(e) => setEmailMappings({ ...emailMappings, [field.key]: e.target.value })}
                        className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">-- Select Column --</option>
                        {emailHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <button
                    onClick={handleBuildEmails}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    Build Emails <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-hidden border rounded-lg">
                  <div className="bg-gray-100 px-4 py-2 border-b font-medium text-sm text-gray-600">
                    Input Preview (First 10 rows)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {emailHeaders.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {emailRawData.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            {emailHeaders.map((h, j) => (
                              <td key={j} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'emailBuilder' && emailStep === 'result' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full text-green-700">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Generation Complete</h2>
                    <p className="text-gray-500 text-sm">{emailOutputData.length} rows generated</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleEmailDownload('csv')}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                  <button
                    onClick={() => handleEmailDownload('xlsx')}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download XLSX
                  </button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-100 px-4 py-2 border-b font-medium text-sm text-gray-600 flex justify-between items-center">
                  <span>Output Preview (First 50 rows)</span>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {['DOMAIN', 'DISPLAY NAME', 'EMAIL', 'PASSWORD'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {emailOutputData.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row['DOMAIN']}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row['DISPLAY NAME']}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-indigo-600">{row['EMAIL']}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row['PASSWORD']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
