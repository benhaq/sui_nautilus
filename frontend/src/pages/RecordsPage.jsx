import { useCurrentAccount } from '@mysten/dapp-kit'
import { AlertCircle, Download, Eye, FileText, Filter, Folder, Loader2, Plus, Search, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import DownloadRecordModal from '../components/DownloadRecordModal'
import UploadRecordModal from '../components/UploadRecordModal'
import ViewRecordModal from '../components/ViewRecordModal'
import api from '../services/api'
import { DOC_TYPE_NAMES } from '../utils/constants'
import { formatTimestamp } from '../utils/helpers'

export default function RecordsPage() {
  const currentAccount = useCurrentAccount()
  const [searchQuery, setSearchQuery] = useState('')
  const [whitelists, setWhitelists] = useState([])
  const [allRecords, setAllRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [downloadRecord, setDownloadRecord] = useState(null)
  const [viewRecord, setViewRecord] = useState(null)
  const [downloadFileIndex, setDownloadFileIndex] = useState(0)
  const [viewFileIndex, setViewFileIndex] = useState(0)
  const [selectedWhitelistId, setSelectedWhitelistId] = useState(null)

  useEffect(() => {
    if (currentAccount?.address) {
      loadRecordsData()
    } else {
      setWhitelists([])
      setAllRecords([])
    }
  }, [currentAccount])

  const loadRecordsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load whitelists
      const whitelistsResponse = await api.getUserWhitelists(currentAccount.address)
      const userWhitelists = whitelistsResponse.whitelists || []
      setWhitelists(userWhitelists)

      if (userWhitelists.length === 0) {
        setAllRecords([])
        return
      }

      // Load records for each whitelist
      const recordsPromises = userWhitelists.map(async (whitelist) => {
        try {
          const recordsResponse = await api.getWhitelistRecords(whitelist.whitelistId)
          return {
            whitelist,
            records: recordsResponse.records || []
          }
        } catch (err) {
          console.error(`Failed to load records for whitelist ${whitelist.whitelistId}:`, err)
          return { whitelist, records: [] }
        }
      })

      const allRecordsData = await Promise.all(recordsPromises)
      
      // Flatten records with whitelist metadata
      const flatRecords = allRecordsData.flatMap(item =>
        item.records.map(record => ({
          ...record,
          whitelistLabel: item.whitelist.name,
          userRole: item.whitelist.role,
          canWrite: item.whitelist.role === 0 || item.whitelist.role === 1,
        }))
      )

      setAllRecords(flatRecords)
    } catch (err) {
      console.error('Failed to load records:', err)
      setError(err.message || 'Failed to load records')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadSuccess = () => {
    setShowUploadModal(false)
    loadRecordsData()
  }

  const handleDownloadRecord = (record, fileIndex) => {
    setDownloadRecord(record)
    setDownloadFileIndex(fileIndex)
    setShowDownloadModal(true)
  }

  const handleViewRecord = (record, fileIndex) => {
    setViewRecord(record)
    setViewFileIndex(fileIndex)
    setShowViewModal(true)
  }

  const filteredRecords = allRecords.filter(record => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      record.objectId.toLowerCase().includes(query) ||
      record.whitelistLabel?.toLowerCase().includes(query) ||
      record.docTypes?.some(type => DOC_TYPE_NAMES[type]?.toLowerCase().includes(query))
    )
  })

  const groupedByWhitelist = whitelists.map(whitelist => ({
    whitelist,
    records: filteredRecords.filter(r => r.whitelistLabel === whitelist.name),
    recordCount: filteredRecords.filter(r => r.whitelistLabel === whitelist.name).length
  }))

  if (!currentAccount) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-heading font-semibold text-text-light dark:text-text-dark mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-text-muted">
            Please connect your Sui wallet to access your medical records
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Loading your records...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-2">
            Failed to Load Records
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
          <button
            onClick={loadRecordsData}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark mb-2">
            Medical Records
          </h1>
          <p className="text-text-muted">
            {allRecords.length} records across {whitelists.length} whitelists
          </p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 cursor-pointer shadow-sm"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload Record
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-text-light dark:text-text-dark"
          />
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-border-light dark:border-border-dark rounded-lg transition-colors duration-200 cursor-pointer text-text-light dark:text-text-dark">
          <Filter className="w-5 h-5 mr-2" />
          Filter
        </button>
      </div>

      {groupedByWhitelist.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark p-12 text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
            No Folders Yet
          </h3>
          <p className="text-text-muted">
            Create a whitelist to start managing medical records
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByWhitelist.map(({ whitelist, records, recordCount }) => (
            <div
              key={whitelist.whitelistId}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark overflow-hidden"
            >
              <div className="p-6 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <Folder className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-semibold text-text-light dark:text-text-dark">
                        {whitelist.name || 'Unnamed Folder'}
                      </h3>
                      <p className="text-sm text-text-muted">
                        {recordCount} records · Role: {['Owner', 'Doctor', 'Member', 'Patient'][whitelist.role] || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  {(whitelist.role === 0 || whitelist.role === 1) && (
                    <button
                      onClick={() => {
                        setSelectedWhitelistId(whitelist.whitelistId)
                        setShowUploadModal(true)
                      }}
                      className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 cursor-pointer text-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Record
                    </button>
                  )}
                </div>
              </div>

              {records.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-text-muted">No records in this folder</p>
                </div>
              ) : (
                <div className="divide-y divide-border-light dark:divide-border-dark">
                  {records.map((record) => (
                    <div
                      key={record.objectId}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-text-light dark:text-text-dark mb-1">
                              Record {record.objectId ? `${record.objectId.slice(0, 8)}...` : 'N/A'}
                            </h4>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {record.docTypes?.map((type, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs rounded-md border border-purple-200 dark:border-purple-800"
                                >
                                  {DOC_TYPE_NAMES[type] || 'Unknown'}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-text-muted">
                              {/* <span>{record.filesCount || record.walrusCids?.length || 0} files</span> */}
                              {/* <span>•</span> */}
                              {/* <span>Uploaded {formatRelativeTime(record.content.fields.timestamp)}</span> */}
                              <span>Uploaded {formatTimestamp(record.content.fields.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewRecord(record, 0)}
                            className="inline-flex items-center px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors duration-200 cursor-pointer text-sm"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </button>
                          <button
                            onClick={() => handleDownloadRecord(record, 0)}
                            className="inline-flex items-center px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 cursor-pointer text-sm"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Record Modal */}
      {showUploadModal && (
        <UploadRecordModal
          whitelists={whitelists}
          initialWhitelistId={selectedWhitelistId}
          onSuccess={handleUploadSuccess}
          onClose={() => {
            setShowUploadModal(false)
            setSelectedWhitelistId(null)
          }}
        />
      )}

      {/* View Record Modal */}
      {showViewModal && viewRecord && (
        <ViewRecordModal
          record={viewRecord}
          fileIndex={viewFileIndex}
          requesterAddress={currentAccount.address}
          onClose={() => {
            setShowViewModal(false)
            setViewRecord(null)
          }}
        />
      )}

      {/* Download Record Modal */}
      {showDownloadModal && downloadRecord && (
        <DownloadRecordModal
          record={downloadRecord}
          fileIndex={downloadFileIndex}
          requesterAddress={currentAccount.address}
          onSuccess={() => {
            setShowDownloadModal(false)
            setDownloadRecord(null)
          }}
          onClose={() => {
            setShowDownloadModal(false)
            setDownloadRecord(null)
          }}
        />
      )}
    </div>
  )
}
