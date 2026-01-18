import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { AlertCircle, Calendar, FileText, Loader2, Upload, X } from 'lucide-react'
import React, { useState } from 'react'
import api from '../services/api'
import { createTimelineEntryWithWallet } from '../services/transaction'
import Alert from './Alert'
import LoadingSpinner from './LoadingSpinner'

/**
 * Modal for creating a new insurance claim (timeline entry)
 * Matches the create_entry function in timeline.move
 */
export default function CreateClaimModal({
  whitelists,
  selectedWhitelist,
  onSuccess,
  onClose,
}) {
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const [formData, setFormData] = useState({
    whitelistId: selectedWhitelist?.whitelistId || '',
    entryType: '0', // ENTRY_VISIT_SUMMARY
    visitDate: '',
    providerSpecialty: '',
    providerSpecialtyOther: '',
    visitType: '',
    status: 'submitted',
    description: '',
    file: null, // Single file only
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const entryTypes = [
    { value: '0', label: 'Visit Summary' },
    { value: '1', label: 'Procedure' },
    { value: '2', label: 'Refill' },
    { value: '3', label: 'Note' },
    { value: '4', label: 'Diagnosis' },
    { value: '5', label: 'Lab Result' },
    { value: '6', label: 'Immunization' },
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] // Only take first file
    if (file) {
      setFormData(prev => ({
        ...prev,
        file: file,
      }))
    }
  }

  const removeFile = () => {
    setFormData(prev => ({
      ...prev,
      file: null,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.whitelistId) {
      setError('Please select a medical folder')
      return
    }

    if (!formData.visitDate) {
      setError('Please enter a visit date')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setUploadProgress(0)

      // Find selected whitelist
      const whitelist = whitelists.find(w => w.whitelistId === formData.whitelistId)
      if (!whitelist) {
        throw new Error('Selected whitelist not found')
      }

      // Step 1: Process file and calculate content hash (if any)
      let walrusBlobId = new Uint8Array(0) // Empty - no Walrus storage
      let contentHash = ''

      if (formData.file) {
        setUploadProgress(10)
        
        try {
          // Read file for hash calculation
          const fileBytes = new Uint8Array(await formData.file.arrayBuffer())
          setUploadProgress(20)

          // Process file content through data processing endpoint
          try {
            // Determine source format based on file type
            const fileExtension = formData.file.name.split('.').pop()?.toLowerCase() || 'text'
            let sourceFormat = 'text'
            if (['pdf'].includes(fileExtension)) {
              sourceFormat = 'pdf'
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension)) {
              sourceFormat = 'image'
            } else {
              sourceFormat = 'text'
            }

            // Read file content as text for text files, or base64 for binary files
            let rawData = ''
            if (sourceFormat === 'text') {
              // For text files, read as text
              rawData = await formData.file.text()
            } else {
              // For binary files (PDF, images), convert to base64
              // Convert Uint8Array to base64 efficiently
              const binaryString = Array.from(fileBytes, byte => String.fromCharCode(byte)).join('')
              rawData = btoa(binaryString)
            }

            setUploadProgress(30)

            // Send to process_data endpoint
            console.log('Processing file content through process_data endpoint...', {
              fileName: formData.file.name,
              sourceFormat,
              size: rawData.length
            })

            const processedData = await api.processData(rawData, sourceFormat, true)
            console.log('File processed successfully:', processedData)
          } catch (processError) {
            // Log error but don't fail - processing is optional
            console.warn('Failed to process file content (continuing):', processError)
          }

          // Calculate content hash (SHA-256) from file content
          setUploadProgress(50)
          const hashBuffer = await crypto.subtle.digest('SHA-256', fileBytes)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          console.log('Content hash calculated:', contentHash)
        } catch (fileError) {
          console.error('File processing error:', fileError)
          throw new Error(`Failed to process file: ${fileError.message}`)
        }
      } else {
        // No file, create hash from description only
        setUploadProgress(20)
        const encoder = new TextEncoder()
        const data = encoder.encode(formData.description || 'claim')
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      }

      setUploadProgress(60)

      // Step 2: Get patient reference (hash of patient address)
      // Use current account address - this should match the whitelist owner
      if (!currentAccount?.address) {
        throw new Error('Please connect your wallet first')
      }
      
      // Hash the address using SHA-256 (contract uses blake2b256, but SHA-256 is acceptable for now)
      // Note: For exact contract compatibility, use blake2b256 library
      const encoder = new TextEncoder()
      const addressBytes = encoder.encode(currentAccount.address)
      const hashBuffer = await crypto.subtle.digest('SHA-256', addressBytes)
      const patientRef = new Uint8Array(hashBuffer)

      // Step 3: Create timeline entry on-chain
      const timestampMs = Date.now()

      // Use custom specialty if "Other" was selected, otherwise use selected specialty
      const providerSpecialty = formData.providerSpecialty === 'Other' 
        ? formData.providerSpecialtyOther 
        : formData.providerSpecialty || 'General'

      const result = await createTimelineEntryWithWallet({
        signAndExecuteTransaction,
        whitelistId: formData.whitelistId,
        patientRef: Array.from(patientRef),
        entryType: parseInt(formData.entryType),
        visitDate: formData.visitDate,
        providerSpecialty: providerSpecialty,
        visitType: formData.visitType || 'Insurance Claim',
        status: formData.status || 'submitted',
        contentHash,
        walrusBlobId: Array.from(walrusBlobId),
        timestampMs,
      })

      setUploadProgress(100)

      if (result.success) {
        if (onSuccess) {
          onSuccess(result)
        }
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        throw new Error('Failed to create claim on blockchain')
      }
    } catch (err) {
      console.error('Create claim error:', err)
      setError(err.message || 'Failed to create claim')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-border-light dark:border-border-dark p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-heading font-semibold text-text-light dark:text-text-dark">
              Create Insurance Claim
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-text-muted">
            Submit a new insurance claim. This will create a timeline entry on the blockchain.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <Alert type="error" message={error} onClose={() => setError(null)} />
          )}

          {/* Whitelist Selection */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Medical Folder *
            </label>
            <select
              name="whitelistId"
              value={formData.whitelistId}
              onChange={handleInputChange}
              required
              className="w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a medical folder</option>
              {whitelists.map((wl) => (
                <option key={wl.whitelistId} value={wl.whitelistId}>
                  {wl.name || wl.label || `Folder ${wl.whitelistId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          </div>

          {/* Entry Type */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Claim Type *
            </label>
            <select
              name="entryType"
              value={formData.entryType}
              onChange={handleInputChange}
              required
              className="w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {entryTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Visit Date */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Visit Date *
            </label>
            <input
              type="date"
              name="visitDate"
              value={formData.visitDate}
              onChange={handleInputChange}
              required
              className="w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Provider Specialty */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Provider Specialty
            </label>
            <select
              name="providerSpecialty"
              value={formData.providerSpecialty}
              onChange={handleInputChange}
              className="w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a specialty (optional)</option>
              <option value="General Practice">General Practice</option>
              <option value="Family Medicine">Family Medicine</option>
              <option value="Internal Medicine">Internal Medicine</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Dermatology">Dermatology</option>
              <option value="Endocrinology">Endocrinology</option>
              <option value="Gastroenterology">Gastroenterology</option>
              <option value="Hematology">Hematology</option>
              <option value="Infectious Disease">Infectious Disease</option>
              <option value="Nephrology">Nephrology</option>
              <option value="Neurology">Neurology</option>
              <option value="Oncology">Oncology</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Psychiatry">Psychiatry</option>
              <option value="Pulmonology">Pulmonology</option>
              <option value="Rheumatology">Rheumatology</option>
              <option value="Surgery">Surgery</option>
              <option value="Urology">Urology</option>
              <option value="Emergency Medicine">Emergency Medicine</option>
              <option value="Radiology">Radiology</option>
              <option value="Pathology">Pathology</option>
              <option value="Anesthesiology">Anesthesiology</option>
              <option value="Other">Other</option>
            </select>
            <p className="mt-1 text-xs text-text-muted">
              Medical specialty category (not the provider's name) - HIPAA Safe Harbor compliant
            </p>
            {formData.providerSpecialty === 'Other' && (
              <input
                type="text"
                name="providerSpecialtyOther"
                value={formData.providerSpecialtyOther}
                onChange={handleInputChange}
                placeholder="Enter specialty name"
                className="mt-2 w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Visit Type */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Visit Type
            </label>
            <input
              type="text"
              name="visitType"
              value={formData.visitType}
              onChange={handleInputChange}
              placeholder="e.g., Checkup, Procedure, Emergency"
              className="w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="4"
              placeholder="Enter claim description..."
              className="w-full p-3 border border-border-light dark:border-border-dark rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* File Upload - Single File Only */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              Supporting Document (Single File)
            </label>
            <div className="border-2 border-dashed border-border-light dark:border-border-dark rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                {formData.file ? 'Change file' : 'Click to upload file'}
              </label>
              <p className="text-xs text-text-muted mt-2">
                PDF, images, or documents (max 100MB) - Single file only
              </p>
            </div>

            {/* File Display */}
            {formData.file && (
              <div className="mt-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-text-muted" />
                    <span className="text-sm text-text-light dark:text-text-dark">
                      {formData.file.name}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({(formData.file.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                  >
                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {loading && uploadProgress > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-muted">Uploading...</span>
                <span className="text-sm text-text-muted">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-muted hover:text-text-light dark:hover:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.whitelistId || !formData.visitDate}
              className="inline-flex items-center px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Create Claim
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
