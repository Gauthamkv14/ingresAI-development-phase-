// import React, { useState, useCallback } from 'react';
// import { useDropzone } from 'react-dropzone';
// import { motion, AnimatePresence } from 'framer-motion';
// import { 
//   Upload, 
//   File, 
//   CheckCircle, 
//   XCircle, 
//   AlertCircle,
//   Download,
//   Eye,
//   Trash2,
//   RefreshCw
// } from 'lucide-react';
// import { useMCP } from '../contexts/MCPContext';
// import { useLanguage } from '../contexts/LanguageContext';
// import { toast } from 'react-toastify';

// const FileUpload = ({ onUploadSuccess }) => {
//   const [uploadedFiles, setUploadedFiles] = useState([]);
//   const [uploading, setUploading] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [previewData, setPreviewData] = useState(null);
//   const [showPreview, setShowPreview] = useState(false);

//   const { callTool } = useMCP();
//   const { translate } = useLanguage();

//   // Load uploaded files on component mount
//   React.useEffect(() => {
//     loadUploadedFiles();
//   }, []);

//   const loadUploadedFiles = async () => {
//     try {
//       const response = await callTool('list_uploaded_files', {});
//       if (response.success) {
//         setUploadedFiles(response.files || []);
//       }
//     } catch (error) {
//       console.error('Failed to load uploaded files:', error);
//     }
//   };

//   const onDrop = useCallback(async (acceptedFiles) => {
//     const file = acceptedFiles[0];
//     if (!file) return;

//     // Validate file
//     if (!file.name.endsWith('.csv')) {
//       toast.error('Please upload a CSV file');
//       return;
//     }

//     if (file.size > 10 * 1024 * 1024) { // 10MB limit
//       toast.error('File size must be less than 10MB');
//       return;
//     }

//     setUploading(true);
//     setSelectedFile(file);

//     try {
//       // Convert file to base64
//       const fileContent = await fileToBase64(file);
      
//       // Upload file
//       const response = await callTool('upload_csv_data', {
//         file_content: fileContent,
//         filename: file.name,
//         user_info: `Web upload at ${new Date().toISOString()}`
//       });

//       if (response.success) {
//         toast.success(`File "${file.name}" uploaded successfully`);
        
//         // Refresh file list
//         await loadUploadedFiles();
        
//         // Notify parent component
//         if (onUploadSuccess) {
//           onUploadSuccess();
//         }

//         // Reset selected file
//         setSelectedFile(null);
//       } else {
//         toast.error(response.error || 'Upload failed');
//       }
//     } catch (error) {
//       console.error('Upload error:', error);
//       toast.error('Failed to upload file');
//     } finally {
//       setUploading(false);
//     }
//   }, [callTool, onUploadSuccess]);

//   const fileToBase64 = (file) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.readAsDataURL(file);
//       reader.onload = () => {
//         const base64 = reader.result.split(',')[1];
//         resolve(base64);
//       };
//       reader.onerror = error => reject(error);
//     });
//   };

//   const { getRootProps, getInputProps, isDragActive } = useDropzone({
//     onDrop,
//     accept: {
//       'text/csv': ['.csv'],
//       'application/vnd.ms-excel': ['.csv']
//     },
//     maxFiles: 1,
//     multiple: false
//   });

//   const downloadFile = async (fileId, filename) => {
//     try {
//       const response = await callTool('download_data', {
//         file_id: fileId,
//         format: 'csv'
//       });

//       if (response.success) {
//         // Create download link
//         const blob = new Blob([response.content], { type: 'text/csv' });
//         const url = window.URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = filename;
//         a.click();
//         window.URL.revokeObjectURL(url);
        
//         toast.success('File downloaded successfully');
//       } else {
//         toast.error('Failed to download file');
//       }
//     } catch (error) {
//       toast.error('Download error');
//     }
//   };

//   const previewFile = async (file) => {
//     try {
//       // For preview, we'll show the file metadata and summary
//       setPreviewData({
//         filename: file.original_filename,
//         fileSize: formatFileSize(file.file_size),
//         recordCount: file.record_count,
//         uploadDate: new Date(file.upload_date).toLocaleDateString(),
//         citation: file.citation
//       });
//       setShowPreview(true);
//     } catch (error) {
//       toast.error('Failed to preview file');
//     }
//   };

//   const deleteFile = async (fileId, filename) => {
//     if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
//       // Note: You'd need to implement a delete endpoint in your MCP server
//       toast.info('Delete functionality not implemented yet');
//     }
//   };

//   const formatFileSize = (bytes) => {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
//   };

//   const getFileStatusIcon = (processed) => {
//     if (processed) {
//       return <CheckCircle className="w-5 h-5 text-green-500" />;
//     } else {
//       return <AlertCircle className="w-5 h-5 text-yellow-500" />;
//     }
//   };

//   return (
//     <div className="h-full flex flex-col space-y-6">
//       {/* Upload Area */}
//       <div className="bg-white rounded-lg shadow p-6">
//         <h3 className="text-lg font-semibold text-gray-900 mb-4">
//           {translate('Upload Groundwater Data')}
//         </h3>
        
//         <div
//           {...getRootProps()}
//           className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
//             isDragActive 
//               ? 'border-primary-500 bg-primary-50' 
//               : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
//           }`}
//         >
//           <input {...getInputProps()} />
          
//           <div className="flex flex-col items-center space-y-4">
//             {uploading ? (
//               <RefreshCw className="w-12 h-12 text-primary-600 animate-spin" />
//             ) : (
//               <Upload className="w-12 h-12 text-gray-400" />
//             )}
            
//             <div>
//               <p className="text-lg font-medium text-gray-900">
//                 {uploading 
//                   ? translate('Uploading...') 
//                   : isDragActive 
//                     ? translate('Drop the CSV file here')
//                     : translate('Drag & drop a CSV file here, or click to select')
//                 }
//               </p>
//               <p className="text-sm text-gray-600 mt-1">
//                 {translate('Maximum file size: 10MB')}
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Upload Progress */}
//         {selectedFile && uploading && (
//           <motion.div
//             initial={{ opacity: 0, y: 10 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="mt-4 p-4 bg-blue-50 rounded-lg"
//           >
//             <div className="flex items-center space-x-3">
//               <File className="w-5 h-5 text-blue-600" />
//               <div className="flex-1">
//                 <p className="text-sm font-medium text-blue-900">
//                   {selectedFile.name}
//                 </p>
//                 <p className="text-xs text-blue-600">
//                   {formatFileSize(selectedFile.size)} • {translate('Processing...')}
//                 </p>
//               </div>
//               <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
//             </div>
//           </motion.div>
//         )}

//         {/* Upload Requirements */}
//         <div className="mt-4 p-4 bg-gray-50 rounded-lg">
//           <h4 className="text-sm font-medium text-gray-900 mb-2">
//             {translate('CSV File Requirements:')}
//           </h4>
//           <ul className="text-xs text-gray-600 space-y-1">
//             <li>• {translate('Required columns: state, district')}</li>
//             <li>• {translate('Optional columns: water_level, year, month, latitude, longitude, category')}</li>
//             <li>• {translate('Water levels should be in meters below ground level')}</li>
//             <li>• {translate('Coordinates should be in decimal degrees (WGS84)')}</li>
//             <li>• {translate('Categories: Safe, Semi-Critical, Critical, Over-Exploited')}</li>
//           </ul>
//         </div>
//       </div>

//       {/* Uploaded Files List */}
//       <div className="bg-white rounded-lg shadow p-6 flex-1">
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-lg font-semibold text-gray-900">
//             {translate('Uploaded Files')}
//           </h3>
//           <button
//             onClick={loadUploadedFiles}
//             className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
//             title={translate('Refresh list')}
//           >
//             <RefreshCw className="w-4 h-4" />
//           </button>
//         </div>

//         {uploadedFiles.length === 0 ? (
//           <div className="text-center py-8 text-gray-500">
//             <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
//             <p>{translate('No files uploaded yet')}</p>
//           </div>
//         ) : (
//           <div className="space-y-3">
//             <AnimatePresence>
//               {uploadedFiles.map((file) => (
//                 <motion.div
//                   key={file.file_id}
//                   initial={{ opacity: 0, y: 10 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: -10 }}
//                   className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
//                 >
//                   <div className="flex items-center space-x-3">
//                     {getFileStatusIcon(file.processed)}
//                     <div>
//                       <p className="text-sm font-medium text-gray-900">
//                         {file.original_filename}
//                       </p>
//                       <p className="text-xs text-gray-600">
//                         {formatFileSize(file.file_size)} • {file.record_count} records • 
//                         {translate('Uploaded')} {new Date(file.upload_date).toLocaleDateString()}
//                       </p>
//                     </div>
//                   </div>

//                   <div className="flex items-center space-x-2">
//                     <button
//                       onClick={() => previewFile(file)}
//                       className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md"
//                       title={translate('Preview')}
//                     >
//                       <Eye className="w-4 h-4" />
//                     </button>
                    
//                     <button
//                       onClick={() => downloadFile(file.file_id, file.original_filename)}
//                       className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md"
//                       title={translate('Download')}
//                     >
//                       <Download className="w-4 h-4" />
//                     </button>
                    
//                     <button
//                       onClick={() => deleteFile(file.file_id, file.original_filename)}
//                       className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
//                       title={translate('Delete')}
//                     >
//                       <Trash2 className="w-4 h-4" />
//                     </button>
//                   </div>
//                 </motion.div>
//               ))}
//             </AnimatePresence>
//           </div>
//         )}
//       </div>

//       {/* Preview Modal */}
//       {showPreview && previewData && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <motion.div
//             initial={{ opacity: 0, scale: 0.9 }}
//             animate={{ opacity: 1, scale: 1 }}
//             className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
//           >
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="text-lg font-semibold text-gray-900">
//                 {translate('File Preview')}
//               </h3>
//               <button
//                 onClick={() => setShowPreview(false)}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 <XCircle className="w-6 h-6" />
//               </button>
//             </div>

//             <div className="space-y-3 text-sm">
//               <div>
//                 <strong>{translate('Filename')}:</strong> {previewData.filename}
//               </div>
//               <div>
//                 <strong>{translate('File Size')}:</strong> {previewData.fileSize}
//               </div>
//               <div>
//                 <strong>{translate('Records')}:</strong> {previewData.recordCount}
//               </div>
//               <div>
//                 <strong>{translate('Upload Date')}:</strong> {previewData.uploadDate}
//               </div>
//               <div className="pt-3 border-t border-gray-200">
//                 <strong>{translate('Citation')}:</strong>
//                 <p className="text-xs text-gray-600 mt-1 italic">
//                   {previewData.citation}
//                 </p>
//               </div>
//             </div>

//             <div className="mt-6 flex justify-end">
//               <button
//                 onClick={() => setShowPreview(false)}
//                 className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
//               >
//                 {translate('Close')}
//               </button>
//             </div>
//           </motion.div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default FileUpload;

import React, { useState } from 'react';
import './FileUpload.css';

const FileUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file) => {
    const allowedTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      alert('Please select a CSV, Excel, or JSON file');
      return;
    }

    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('description', description);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      setUploadResult(result);
      setSelectedFile(null);
      setDescription('');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <div className="upload-header">
        <h2>📤 Data Upload & Validation</h2>
        <p>Upload groundwater data files for expert review and integration</p>
      </div>

      <div className="upload-info-cards">
        <div className="info-card">
          <div className="card-icon">📋</div>
          <h3>Supported Formats</h3>
          <ul>
            <li>CSV files (.csv)</li>
            <li>Excel files (.xlsx)</li>
            <li>JSON data files (.json)</li>
          </ul>
        </div>
        
        <div className="info-card">
          <div className="card-icon">✅</div>
          <h3>Quality Control</h3>
          <ul>
            <li>Expert validation process</li>
            <li>Data accuracy verification</li>
            <li>Source authentication</li>
          </ul>
        </div>
        
        <div className="info-card">
          <div className="card-icon">🔄</div>
          <h3>Review Process</h3>
          <ul>
            <li>24-hour expert review</li>
            <li>Quality assessment report</li>
            <li>Integration approval</li>
          </ul>
        </div>
      </div>

      <div className="upload-section">
        <div 
          className={`file-drop-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'file-selected' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.json"
            onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />
          
          {selectedFile ? (
            <div className="selected-file-info">
              <div className="file-icon">📄</div>
              <div className="file-details">
                <h4>{selectedFile.name}</h4>
                <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>Type: {selectedFile.type || 'Unknown'}</p>
              </div>
              <button 
                className="remove-file-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="drop-zone-content">
              <div className="upload-icon">📁</div>
              <h3>Drop your data file here</h3>
              <p>or click to select a file</p>
              <div className="file-requirements">
                <small>Supported: CSV, Excel, JSON | Max size: 10MB</small>
              </div>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="upload-form">
            <div className="form-group">
              <label htmlFor="description">Data Description (Optional)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the data source, collection method, time period, geographic coverage, etc..."
                rows={4}
              />
            </div>
            
            <button 
              className="upload-button"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="spinner"></span>
                  Uploading & Validating...
                </>
              ) : (
                <>
                  🚀 Submit for Review
                </>
              )}
            </button>
          </div>
        )}

        {uploadResult && (
          <div className="upload-result">
            <div className="result-header">
              <h3>✅ Upload Successful!</h3>
            </div>
            <div className="result-content">
              <div className="upload-details">
                <p><strong>File:</strong> {uploadResult.upload_details.filename}</p>
                <p><strong>Size:</strong> {uploadResult.upload_details.size_mb} MB</p>
                <p><strong>Upload ID:</strong> {uploadResult.upload_details.id}</p>
                <p><strong>Status:</strong> {uploadResult.upload_details.status}</p>
              </div>
              
              <div className="next-steps">
                <h4>📋 Next Steps:</h4>
                <ul>
                  {uploadResult.next_steps?.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="upload-guidelines">
        <h3>📖 Data Upload Guidelines</h3>
        <div className="guidelines-grid">
          <div className="guideline-item">
            <h4>🎯 Data Requirements</h4>
            <ul>
              <li>Include geographic coordinates</li>
              <li>Specify measurement dates</li>
              <li>Provide data source information</li>
              <li>Include quality indicators</li>
            </ul>
          </div>
          
          <div className="guideline-item">
            <h4>🔍 Quality Standards</h4>
            <ul>
              <li>Government certified sources preferred</li>
              <li>Measurement accuracy: ±1.0m or better</li>
              <li>Regular monitoring intervals</li>
              <li>Proper calibration documentation</li>
            </ul>
          </div>
          
          <div className="guideline-item">
            <h4>⚖️ Usage Terms</h4>
            <ul>
              <li>Data used for research purposes</li>
              <li>Attribution to original source</li>
              <li>Compliance with data policies</li>
              <li>Expert validation required</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

