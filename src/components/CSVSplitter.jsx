import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Upload, FileSpreadsheet, Download, RefreshCw, CheckCircle, AlertTriangle, Loader } from 'lucide-react';

const REQUIRED_FIELDS = [
  'First Name [Required]',
  'Last Name [Required]',
  'Email Address [Required]',
  'Password [Required]',
  'Org Unit Path [Required]'
];

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const GOOGLE_USER_HEADERS = [
  'First Name [Required]',
  'Last Name [Required]',
  'Email Address [Required]',
  'Password [Required]',
  'Password Hash Function [UPLOAD ONLY]',
  'Org Unit Path [Required]',
  'New Primary Email [UPLOAD ONLY]',
  'Recovery Email',
  'Home Secondary Email',
  'Work Secondary Email',
  'Recovery Phone [MUST BE IN THE E.164 FORMAT]',
  'Work Phone',
  'Home Phone',
  'Mobile Phone',
  'Work Address',
  'Home Address',
  'Employee ID',
  'Employee Type',
  'Employee Title',
  'Manager Email',
  'Department',
  'Cost Center',
  'Building ID',
  'Floor Name',
  'Floor Section',
  'Change Password at Next Sign-In',
  'New Status [UPLOAD ONLY]',
  'Advanced Protection Program enrollment'
];

export default function CSVSplitter() {
  const [step, setStep] = useState('upload'); // upload, processing, result
  const [file, setFile] = useState(null);
  const [stats, setStats] = useState({ domains: 0, users: 0, domainCounts: {} });
  const [zipBlob, setZipBlob] = useState(null);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    if (!uploadedFile.name.endsWith('.csv')) {
      alert('Please upload a .csv file.');
      return;
    }

    setFile(uploadedFile);
  };

  const processFile = () => {
    if (!file) return;
    setStep('processing');
    setErrors([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Get raw data as array of arrays to preserve headers exactly
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        
        if (data.length < 2) {
          throw new Error("CSV file is empty or missing headers.");
        }

        const headers = data[0];
        const rows = data.slice(1);

        // Map headers to indices
        const headerMap = {};
        headers.forEach((h, i) => {
          headerMap[h] = i;
        });

        // Verify required email column exists
        const emailColIndex = headerMap['Email Address [Required]'];
        if (emailColIndex === undefined) {
          throw new Error("Missing 'Email Address [Required]' column.");
        }

        const recoveryPhoneIndex = headerMap['Recovery Phone [MUST BE IN THE E.164 FORMAT]'];
        const changePasswordIndex = headerMap['Change Password at Next Sign-In'];
        const advancedProtectionIndex = headerMap['Advanced Protection Program enrollment'];

        const domainGroups = {};
        const domainOrder = [];
        const processingErrors = [];
        let processedUsers = 0;

        rows.forEach((row, rowIndex) => {
          // Handle empty rows
          if (row.length === 0 || row.every(cell => !cell)) return;

          const rowObj = {};
          headers.forEach((h, i) => {
            rowObj[h] = row[i] ?? '';
          });

          // Process required fields
          REQUIRED_FIELDS.forEach(field => {
            if (!rowObj[field] || String(rowObj[field]).trim() === '') rowObj[field] = '/';
          });

          if (changePasswordIndex !== undefined) {
            const v = rowObj['Change Password at Next Sign-In'];
            if (!v || String(v).trim() === '') {
              rowObj['Change Password at Next Sign-In'] = 'FALSE';
            }
          } else {
            rowObj['Change Password at Next Sign-In'] = 'FALSE';
          }

          if (advancedProtectionIndex !== undefined) {
            const v = rowObj['Advanced Protection Program enrollment'];
            if (!v || String(v).trim() === '') {
              rowObj['Advanced Protection Program enrollment'] = 'FALSE';
            }
          } else {
            rowObj['Advanced Protection Program enrollment'] = 'FALSE';
          }

          // Validate E.164 if present
          if (recoveryPhoneIndex !== undefined) {
            const phone = rowObj['Recovery Phone [MUST BE IN THE E.164 FORMAT]'];
            if (phone && String(phone).trim() !== '' && String(phone).trim() !== '/') {
              if (!E164_REGEX.test(String(phone).trim())) {
                processingErrors.push(`Row ${rowIndex + 2}: Invalid E.164 phone number '${phone}'`);
              }
            }
          }

          // Extract domain
          const email = rowObj['Email Address [Required]'];
          if (!email || email === '/') {
            processingErrors.push(`Row ${rowIndex + 2}: Missing email address`);
            return;
          }

          const domain = String(email).split('@')[1];
          if (!domain) {
            processingErrors.push(`Row ${rowIndex + 2}: Invalid email address '${email}'`);
            return;
          }

          if (!domainGroups[domain]) {
            domainGroups[domain] = [];
            domainOrder.push(domain);
          }
          domainGroups[domain].push(rowObj);
          processedUsers += 1;
        });

        if (processingErrors.length > 0) {
          setErrors(processingErrors);
          // We continue processing even with errors, or should we stop?
          // Let's continue but show errors.
        }

        // Create ZIP
        const zip = new JSZip();
        const domainCounts = {};

        domainOrder.forEach((domain, index) => {
          const domainRows = domainGroups[domain];
          domainCounts[domain] = domainRows.length;

          // Convert back to sheet
          const outRows = domainRows.map((r) => GOOGLE_USER_HEADERS.map((h) => r[h] ?? ''));
          const newWs = XLSX.utils.aoa_to_sheet([GOOGLE_USER_HEADERS, ...outRows]);
          const csvContent = XLSX.utils.sheet_to_csv(newWs);
          
          zip.file(`${index + 1}_${domain}.csv`, csvContent);
        });

        const content = await zip.generateAsync({ type: "blob" });
        setZipBlob(content);
        setStats({
          domains: Object.keys(domainGroups).length,
          users: processedUsers,
          domainCounts
        });
        setStep('result');

      } catch (err) {
        console.error(err);
        setErrors([err.message]);
        setStep('upload');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadZip = () => {
    if (!zipBlob) return;
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "split_domains.zip";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setStats({ domains: 0, users: 0, domainCounts: {} });
    setZipBlob(null);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 border-b pb-4">
        <div className="bg-indigo-100 p-3 rounded-full text-indigo-700">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Google CSV Splitter</h2>
          <p className="text-gray-500 text-sm">Split master CSV by domain into separate files</p>
        </div>
      </div>

      {step === 'upload' && (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
             onClick={() => fileInputRef.current.click()}>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv" 
            onChange={handleFileUpload} 
          />
          <Upload className="w-16 h-16 text-indigo-400 mb-4" />
          <p className="text-xl font-medium text-gray-600">
            {file ? file.name : "Click to upload Master CSV"}
          </p>
          <p className="text-gray-400 mt-2">Supports .csv only</p>
          
          {file && (
            <button 
              onClick={(e) => { e.stopPropagation(); processFile(); }}
              className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium transition-colors shadow-lg z-10"
            >
              Split CSV
            </button>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-lg font-medium text-gray-700">Processing...</p>
        </div>
      )}

      {step === 'result' && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-medium text-green-800">Processing Complete</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded shadow-sm">
                <p className="text-sm text-gray-500">Domains Detected</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.domains}</p>
              </div>
              <div className="bg-white p-4 rounded shadow-sm">
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.users}</p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto bg-white rounded border p-4 mb-6">
              <h4 className="font-medium text-gray-700 mb-2">Users per Domain:</h4>
              <ul className="space-y-1">
                {Object.entries(stats.domainCounts).map(([domain, count]) => (
                  <li key={domain} className="flex justify-between text-sm text-gray-600 border-b border-gray-100 py-1 last:border-0">
                    <span>{domain}</span>
                    <span className="font-mono">{count}</span>
                  </li>
                ))}
              </ul>
            </div>

            {errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <h4 className="font-medium text-yellow-800">Warnings</h4>
                </div>
                <ul className="list-disc list-inside text-sm text-yellow-700 max-h-40 overflow-y-auto">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={handleDownloadZip}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md font-medium transition-colors shadow-lg"
              >
                <Download className="w-5 h-5" /> Download ZIP
              </button>
              <button 
                onClick={reset}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-md font-medium transition-colors"
              >
                <RefreshCw className="w-5 h-5" /> Process Another File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
