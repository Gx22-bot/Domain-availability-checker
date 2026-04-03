import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';

export default function GoogleSplitter() {
  const [step, setStep] = useState('upload'); // upload, mapping, result
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({
    domain: '',
    fullName: '', // Full Name column
    password: '',
    recoveryEmail: ''
  });
  const [orgUnitPath, setOrgUnitPath] = useState('/');
  const [nameMode, setNameMode] = useState('multiple'); // 'single' | 'multiple'
  const [patternColumns, setPatternColumns] = useState([]);
  const [patternNameMap, setPatternNameMap] = useState({});
  const [outputData, setOutputData] = useState([]);
  const fileInputRef = useRef(null);
  const outputHeaders = [
    'Domain',
    'First Name [Required]',
    'Last Name [Required]',
    'Email Address [Required]',
    'Password [Required]',
    'Org Unit Path [Required]',
    'Recovery Email',
    'Change Password at Next Sign-In',
    'Advanced Protection Program enrollment'
  ];
  const toTitle = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
  const normalizeHeader = (h) => String(h || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const guessNameColForPattern = (patternCol, allHeaders, fallback) => {
    const normPattern = normalizeHeader(patternCol);
    const match = normPattern.match(/(\d+)/);
    if (!match) return fallback || '';
    const n = match[1];
    const targets = [`full name ${n}`, `fullname ${n}`, `name ${n}`];
    const normHeaders = (allHeaders || []).filter(Boolean).map(h => ({ raw: h, norm: normalizeHeader(h) }));
    for (const t of targets) {
      const exact = normHeaders.find(h => h.norm === t);
      if (exact) return exact.raw;
    }
    const loose = normHeaders.find(h =>
      h.norm.endsWith(` ${n}`) && (h.norm.includes('full name') || h.norm.includes('fullname') || h.norm.startsWith('name '))
    );
    return loose ? loose.raw : (fallback || '');
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

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
        setHeaders(headerRow);
        setRawData(jsonData);
        
        // Auto-guess mappings
        const newMappings = { ...mappings };
        const potentialPatterns = [];
        
        headerRow.forEach(h => {
          if (!h) return; // Skip empty headers
          const lower = String(h).toLowerCase();
          if (lower.includes('domain')) newMappings.domain = h;
          else if (lower.includes('full name') || lower.includes('fullname') || lower.includes('name')) newMappings.fullName = h;
          else if (lower.includes('pass') || lower.includes('pwd')) newMappings.password = h;
          else if (lower.includes('recovery') && lower.includes('email')) newMappings.recoveryEmail = h;
          else potentialPatterns.push(h);
        });
        
        setMappings(newMappings);
        setPatternColumns(potentialPatterns);
        const initialPatternNameMap = {};
        potentialPatterns.forEach((p) => {
          initialPatternNameMap[p] = guessNameColForPattern(p, headerRow, newMappings.fullName);
        });
        setPatternNameMap(initialPatternNameMap);
        setStep('mapping');
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleGenerate = () => {
    if (!mappings.domain || !mappings.password) {
      alert('Please map Domain and Password columns.');
      return;
    }

    if (nameMode === 'single' && !mappings.fullName) {
      alert('Please map Full Name (or switch to Multiple Names mode).');
      return;
    }
    
    if (patternColumns.length === 0) {
      alert('Please select at least one Email Pattern column.');
      return;
    }

    const expanded = [];
    let previousDomain = null;

    rawData.forEach((row) => {
      const domain = String(row[mappings.domain] || '').trim().toLowerCase();
      const password = row[mappings.password] || '';
      const recoveryEmail = mappings.recoveryEmail ? String(row[mappings.recoveryEmail] || '').trim() : '';
      const inputName = nameMode === 'single' ? String(row[mappings.fullName] || '').trim() : '';

      if (!domain) return;
      if (nameMode === 'single' && !inputName) return;

      // Insert empty row if domain changes
      if (previousDomain && domain !== previousDomain) {
        expanded.push({
          'Domain': '',
          'First Name [Required]': '',
          'Last Name [Required]': '',
          'Email Address [Required]': '',
          'Password [Required]': '',
          'Org Unit Path [Required]': '',
          'Recovery Email': '',
          'Change Password at Next Sign-In': '',
          'Advanced Protection Program enrollment': ''
        });
      }
      previousDomain = domain;

      // Generate a row for each selected pattern column
      patternColumns.forEach(patternCol => {
          let pattern = String(row[patternCol] || '').trim();
          if (!pattern) return; // Skip empty patterns

          // Sanitize email local part (remove special chars except dots, underscores, hyphens)
          // pattern is already the local part usually, e.g. "john.doe"
          const emailLocal = pattern.toLowerCase().replace(/[^a-z0-9._-]/g, '');
          const tokens = emailLocal.split(/[._-]+/).filter(Boolean);
          let firstName = '';
          let lastName = '';

          if (nameMode === 'single') {
            const parts = inputName.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
            if (!lastName && firstName) lastName = firstName;
          } else {
            const nameCol = patternNameMap[patternCol] || mappings.fullName;
            const patternFullName = String(row[nameCol] || '').trim();
            if (patternFullName) {
              const parts = patternFullName.split(/\s+/);
              firstName = parts[0] || '';
              lastName = parts.slice(1).join(' ');
              if (!lastName && firstName) lastName = firstName;
            } else {
              const derivedFirst = tokens[0] ? toTitle(tokens[0]) : '';
              const derivedLast = tokens.length > 1 ? toTitle(tokens[tokens.length - 1]) : '';
              firstName = derivedFirst;
              lastName = derivedLast;
            }
          }

          expanded.push({
            'Domain': domain,
            'First Name [Required]': firstName,
            'Last Name [Required]': lastName,
            'Email Address [Required]': `${emailLocal}@${domain}`,
            'Password [Required]': password,
            'Org Unit Path [Required]': orgUnitPath,
            'Recovery Email': recoveryEmail,
            'Change Password at Next Sign-In': 'FALSE',
            'Advanced Protection Program enrollment': 'FALSE'
          });
      });
    });

    setOutputData(expanded);
    setStep('result');
  };

  const handleDownload = (format) => {
    const ws = XLSX.utils.json_to_sheet(outputData, { header: outputHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outName = `contacts_generated_${timestamp}.${format}`;
    
    if (format === 'csv') {
      XLSX.writeFile(wb, outName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, outName);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Domain': 'example.com',
        'Full Name 1': 'Taylor Black',
        'Pattern 1': 'taylor.black',
        'Full Name 2': 'John Doe',
        'Pattern 2': 'jdoe',
        'Full Name 3': 'Ava Brown',
        'Pattern 3': 'ava.brown',
        'Password': 'pass123',
        'Recovery Email': 'taylor@gmail.com'
      },
      {
        'Domain': 'example.com',
        'Full Name 1': 'Chris Martin',
        'Pattern 1': 'chris.martin',
        'Full Name 2': 'Maria Lopez',
        'Pattern 2': 'mlopez',
        'Full Name 3': 'Sam Green',
        'Pattern 3': 'sam.green',
        'Password': 'secret456',
        'Recovery Email': 'chris@yahoo.com'
      },
      {
        'Domain': 'test.org',
        'Full Name 1': 'Maisie Goodwin',
        'Pattern 1': 'maisie.goodwin',
        'Full Name 2': 'Eli Turner',
        'Pattern 2': 'eturner',
        'Full Name 3': 'Noah King',
        'Pattern 3': 'noah.king',
        'Password': 'singer1',
        'Recovery Email': 'maisie@hotmail.com'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, "google_splitter_sample.csv", { bookType: 'csv' });
  };

  const reset = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setOutputData([]);
    setMappings({ domain: '', fullName: '', password: '', recoveryEmail: '' });
    setOrgUnitPath('/');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 border-b pb-4">
        <div className="bg-indigo-100 p-3 rounded-full text-indigo-700">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Google Splitter</h2>
          <p className="text-gray-500 text-sm">Generate emails from Names/Patterns and Domains</p>
        </div>
      </div>

      {step === 'upload' && (
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
          <p className="text-gray-400 mt-2">Upload file with Domain, Pattern N + Full Name N, Password</p>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDownloadSample(); }}
            className="mt-6 flex items-center gap-2 text-indigo-500 hover:text-indigo-600 font-medium z-10"
          >
            <Download className="w-4 h-4" /> Download Sample Template
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 p-6 rounded-lg space-y-4 h-fit">
            <h3 className="font-semibold text-gray-700 mb-4">Column Configuration</h3>
            
            {[
              { key: 'domain', label: 'Domain', required: true },
              { key: 'fullName', label: 'Full Name', required: nameMode === 'single' },
              { key: 'password', label: 'Password', required: true },
              { key: 'recoveryEmail', label: 'Recovery Email', required: false }
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Org Unit Path <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={orgUnitPath}
                onChange={(e) => setOrgUnitPath(e.target.value)}
                placeholder="/"
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Default is &quot;/&quot; (root). Use format &quot;/Sales&quot; or &quot;/Staff/Teachers&quot;</p>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="text-sm font-medium text-gray-700">Names in CSV</div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="nameMode"
                  checked={nameMode === 'single'}
                  onChange={() => {
                    setNameMode('single');
                    setPatternNameMap({});
                  }}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                One name per row (use Full Name for all patterns)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="nameMode"
                  checked={nameMode === 'multiple'}
                  onChange={() => {
                    setNameMode('multiple');
                    const initMap = {};
                    patternColumns.forEach((p) => { initMap[p] = guessNameColForPattern(p, headers, mappings.fullName); });
                    setPatternNameMap(initMap);
                  }}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Multiple names (each Pattern can have its own Full Name)
              </label>
            </div>

            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Email Pattern Columns ({patternColumns.length} detected) <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3 bg-white">
                {headers.filter(h => h !== mappings.domain && h !== mappings.fullName && h !== mappings.password && h !== mappings.recoveryEmail).map(h => (
                  <label key={h} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={patternColumns.includes(h)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPatternColumns((prev) => (prev.includes(h) ? prev : [...prev, h]));
                          if (nameMode === 'multiple') {
                            setPatternNameMap((prev) => ({
                              ...prev,
                              [h]: prev[h] || guessNameColForPattern(h, headers, mappings.fullName)
                            }));
                          }
                        } else {
                          setPatternColumns(patternColumns.filter(p => p !== h));
                          const nextMap = { ...patternNameMap };
                          delete nextMap[h];
                          setPatternNameMap(nextMap);
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">{h}</span>
                  </label>
                ))}
                {headers.filter(h => h !== mappings.domain && h !== mappings.fullName && h !== mappings.password && h !== mappings.recoveryEmail).length === 0 && (
                  <p className="text-sm text-gray-400 italic">No other columns available</p>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500 flex gap-4">
                <button
                  onClick={() => {
                    const available = headers.filter(h => h !== mappings.domain && h !== mappings.fullName && h !== mappings.password && h !== mappings.recoveryEmail);
                    setPatternColumns(available);
                    if (nameMode === 'multiple') {
                      const initMap = {};
                      available.forEach(a => { initMap[a] = guessNameColForPattern(a, headers, mappings.fullName); });
                      setPatternNameMap(initMap);
                    }
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    setPatternColumns([]);
                    setPatternNameMap({});
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Deselect All
                </button>
              </div>
              {nameMode === 'multiple' && patternColumns.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Full Name per Pattern</h4>
                  {patternColumns.map(pc => (
                    <div key={pc} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                      <div className="text-sm text-gray-600">Pattern: <span className="font-medium">{pc}</span></div>
                      <select
                        value={patternNameMap[pc] || ''}
                        onChange={(e) => setPatternNameMap({ ...patternNameMap, [pc]: e.target.value })}
                        className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">-- Select Full Name Column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={handleGenerate}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              Generate Contacts <ArrowRight className="w-4 h-4" />
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
      )}

      {step === 'result' && (
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
              <button 
                onClick={reset}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Start Over
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
                    {outputHeaders.map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {outputData.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {outputHeaders.map((h) => (
                        <td key={h} className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
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
      )}
    </div>
  );
}
