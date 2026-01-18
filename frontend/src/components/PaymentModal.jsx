import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CheckCircle, CreditCard, XCircle } from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

/**
 * Payment Modal Component - Handle x402 micropayments
 */
export default function PaymentModal({ isOpen, onClose, paymentData, patientAddress, onSuccess }) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending'); // pending, processing, success, error

  if (!isOpen) return null;

  // Validate payment data
  if (!paymentData) {
    console.error('PaymentModal: No payment data provided');
    return null;
  }

  // Log payment data for debugging
  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    setStatus('processing');

    try {
      // Validate payment data
      if (!paymentData || !paymentData.amount) {
        throw new Error('Invalid payment data');
      }

      // Parse amount safely
      const amountStr = String(paymentData.amount).replace(/[^0-9.]/g, '');
      const amountFloat = parseFloat(amountStr);
      
      if (isNaN(amountFloat) || amountFloat <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Create transaction for payment
      const txb = new Transaction();
      
      // Split coins for payment (convert SUI to MIST)
      const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
      const [coin] = txb.splitCoins(txb.gas, [
        txb.pure.u64(amountInMist),
      ]);

      // Transfer to payment recipient
      txb.transferObjects([coin], paymentData.recipient);

      // Execute transaction
      const result = await signAndExecuteTransaction({
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log('Payment transaction result:', result);

      // Verify payment on backend
      const verifyResponse = await api.paymentVerify(
        paymentData.paymentId,
        result.digest
      );

      if (verifyResponse.success) {
        setStatus('success');
        
        // Call success callback with access token
        if (onSuccess) {
          onSuccess({
            accessToken: verifyResponse.data.accessToken,
            transactionDigest: result.digest,
          });
        }

        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Payment Required
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'pending' && (
            <>
              <div className="mb-6">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  To access this data, a micropayment is required:
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700 dark:text-gray-300">Amount:</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-300">
                      {paymentData?.amount || '0'} {paymentData?.currency || 'SUI'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Endpoint:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {paymentData?.endpoint || 'Data Access'}
                    </span>
                  </div>
                  
                  {paymentData?.paymentId && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 dark:text-gray-500">Payment ID:</span>
                      <span className="text-gray-600 dark:text-gray-400 font-mono">
                        {paymentData.paymentId.substring(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />
              )}

              <div className="bg-yellow-50 dark:bg-yellow-900 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  💡 This is a one-time payment. You will receive a temporary access token to query your data.
                </p>
              </div>
            </>
          )}

          {status === 'processing' && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Processing payment...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Please confirm the transaction in your wallet
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Payment Successful!
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Access token issued. You can now query your data.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Payment Failed
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          {status === 'pending' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pay {paymentData?.amount || '0'} {paymentData?.currency || 'SUI'}
                  </>
                )}
              </button>
            </>
          )}

          {(status === 'success' || status === 'error') && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
