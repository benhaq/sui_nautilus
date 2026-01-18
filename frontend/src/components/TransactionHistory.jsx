import { CheckCircle, Clock, DollarSign, ExternalLink, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

/**
 * Transaction History Component - Display payment and access history
 */
export default function TransactionHistory({ patientAddress }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, payment, access
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (patientAddress) {
      loadTransactionHistory();
    }
  }, [patientAddress]);

  const loadTransactionHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      // Load payment history
      const paymentResponse = await fetch(
        `${API_BASE_URL}/api/payment/history?patientAddress=${patientAddress}&limit=100`
      );
      
      if (!paymentResponse.ok) {
        throw new Error('Failed to load payment history');
      }

      const paymentData = await paymentResponse.json();
      
      // Load access logs
      const logsResponse = await fetch(
        `${API_BASE_URL}/api/log/history?patientAddress=${patientAddress}`
      );

      let logsData = { data: [] };
      if (logsResponse.ok) {
        logsData = await logsResponse.json();
      }

      // Combine and sort by timestamp
      const combined = [
        ...paymentData.data.map(p => ({ ...p, type: 'payment' })),
        ...logsData.data.map(l => ({ ...l, type: 'access' })),
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setTransactions(combined);
    } catch (err) {
      console.error('Error loading transaction history:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) {
      return false;
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        tx.action?.toLowerCase().includes(search) ||
        tx.details?.toLowerCase().includes(search) ||
        tx.paymentId?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  const getTransactionIcon = (tx) => {
    if (tx.type === 'payment') {
      return <DollarSign className="w-5 h-5 text-green-600" />;
    }
    return <Clock className="w-5 h-5 text-blue-600" />;
  };

  const getTransactionTitle = (tx) => {
    if (tx.type === 'payment') {
      return tx.action === 'payment_verified' ? 'Payment Completed' : 'Payment Initiated';
    }
    
    const actionMap = {
      search_patient_record: 'Search Medical Records',
      get_clinical_summary: 'Clinical Summary',
      query_fhir_resource: 'FHIR Query',
      upload_record: 'Upload Record',
      download_record: 'Download Record',
      access_granted: 'Access Granted',
      access_revoked: 'Access Revoked',
    };
    
    return actionMap[tx.action] || tx.action;
  };

  const getTransactionStatus = (tx) => {
    if (tx.type === 'payment') {
      return tx.action === 'payment_verified' ? (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="w-4 h-4" />
          Verified
        </span>
      ) : (
        <span className="flex items-center gap-1 text-yellow-600">
          <Clock className="w-4 h-4" />
          Pending
        </span>
      );
    }
    
    return (
      <span className="flex items-center gap-1 text-blue-600">
        <CheckCircle className="w-4 h-4" />
        Completed
      </span>
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getTotalSpent = () => {
    return transactions
      .filter(tx => tx.type === 'payment' && tx.action === 'payment_verified')
      .reduce((sum, tx) => sum + 0.1, 0) // Assuming 0.1 SUI per transaction
      .toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Transaction History
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          View all your payments and data access history
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="text-sm opacity-90">Total Transactions</div>
          <div className="text-2xl font-bold mt-1">{transactions.length}</div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
          <div className="text-sm opacity-90">Total Spent</div>
          <div className="text-2xl font-bold mt-1">{getTotalSpent()} SUI</div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <div className="text-sm opacity-90">Access Requests</div>
          <div className="text-2xl font-bold mt-1">
            {transactions.filter(tx => tx.type === 'access').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('payment')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'payment'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setFilter('access')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'access'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Access
          </button>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />
      )}

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No transactions found
          </div>
        ) : (
          filteredTransactions.map((tx, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center">
                {getTransactionIcon(tx)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {getTransactionTitle(tx)}
                  </h4>
                  {getTransactionStatus(tx)}
                </div>
                
                {tx.details && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {tx.details}
                  </p>
                )}
                
                {tx.transactionDigest && (
                  <a
                    href={`https://suiscan.xyz/testnet/tx/${tx.transactionDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                  >
                    View on Explorer
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              
              <div className="text-right text-sm">
                <div className="text-gray-900 dark:text-white font-medium">
                  {formatTimestamp(tx.timestamp)}
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  {new Date(tx.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredTransactions.length >= 50 && (
        <div className="mt-6 text-center">
          <button
            onClick={loadTransactionHistory}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
