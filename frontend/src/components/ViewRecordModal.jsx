import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit'
import { AlertCircle, Download, Eye, File, FileText, Loader2, Shield, X } from 'lucide-react'
import { useState } from 'react'
import api from '../services/api'
import { base64ToUint8Array } from '../utils/helpers'
import { docTypeToMimeType } from '../utils/files'

/**
 * Modal for viewing medical records without downloading
 * Displays content inline based on file type
 * Uses wallet signature for authentication
 */
export default function ViewRecordModal({ 
  record, 
  fileIndex = 0,
  requesterAddress,
  onClose 
}) {
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileType, setFileType] = useState(null)

  const handleView = async () => {
  try {
    setLoading(true)
    setError(null)

    // Step 1: prepare download
    const prepareResponse = await api.prepareDownload(
      record.objectId,
      requesterAddress || currentAccount?.address,
      fileIndex,
    )

    const { sessionId, messageBase64 } = prepareResponse.data

    // Step 2: sign message
    const messageBytes = base64ToUint8Array(messageBase64)
    const { signature } = await signPersonalMessage({
      message: messageBytes,
    })

    if (!signature || typeof signature !== 'string' || !signature.trim()) {
      throw new Error('Wallet signature is required')
    }

    // Step 3: view inline
    const blob = await api.viewRecord(
      record.objectId,
      sessionId,
      signature,
    )
    const recordType = record.content.fields.doc_type[0] || 4;
    const mimeType = docTypeToMimeType(recordType);
    const url = URL.createObjectURL(blob)

    setFileType(mimeType)

    // Render based on file type
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const text = await blob.text()
      setFileContent({
        type: 'text',
        content: text,
      })
    } else if (mimeType.startsWith('image/')) {
      setFileContent({
        type: 'image',
        url,
      })
    } else if (mimeType === 'application/pdf') {
      setFileContent({
        type: 'pdf',
        url,
      })
    } else {
      setFileContent({
        type: 'binary',
        url,
      })
    }
  } catch (err) {
    console.error('View failed:', err)
    setError(err.message || 'Failed to view record')
  } finally {
    setLoading(false)
  }
}



  const handleDownload = () => {
    if (fileContent && fileContent.url) {
      const a = document.createElement('a')
      a.href = fileContent.url
      a.download = `medical_record_${record.objectId.slice(0, 8)}_${fileIndex}.${getFileExtension(fileType)}`
      a.click()
    }
  }

  const getFileExtension = (mimeType) => {
    const extensions = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'text/plain': 'txt',
      'application/json': 'json',
      'text/csv': 'csv',
    }
    return extensions[mimeType] || 'bin'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                View Medical Record
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Record ID: {record?.objectId ? `${record.objectId.slice(0, 8)}...${record.objectId.slice(-8)}` : 'N/A'} (File {fileIndex + 1})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-auto">
          {!fileContent ? (
            <div className="max-w-md mx-auto text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Sign to View Record
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You need to sign a message with your wallet to authenticate and view this medical record.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 text-left">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
                </div>
              )}

              <button
                onClick={handleView}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Sign and View Record
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {/* Download button when viewing */}
              {/* <div className="mb-4 flex justify-end">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div> */}

              {/* Display content based on type */}
              {fileContent.type === 'text' && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-[60vh]">
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                    {fileContent.content}
                  </pre>
                </div>
              )}

              {fileContent.type === 'image' && (
                <div className="flex justify-center">
                  <img 
                    src={fileContent.url} 
                    alt="Medical record" 
                    className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                  />
                </div>
              )}

              {fileContent.type === 'pdf' && (
                <div className="w-full h-[60vh] border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <iframe
                    src={fileContent.url}
                    className="w-full h-full"
                    title="PDF Viewer"
                  />
                </div>
              )}

              {fileContent.type === 'binary' && (
                <div className="text-center py-12">
                  <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This file type ({fileType}) cannot be previewed in the browser.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Download File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
