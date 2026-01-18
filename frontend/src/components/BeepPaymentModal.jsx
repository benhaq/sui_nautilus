import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AlertCircle, CheckCircle, CreditCard, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';

/**
 * Beep Payment Modal - A402 Protocol
 * Handles agent-to-agent payments via Beep infrastructure
 */
export default function BeepPaymentModal({ 
  isOpen, 
  onClose, 
  paymentData, 
  beepSessionId,
  patientAddress,
  onSuccess 
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('pending'); // pending, processing, success, error
  const [error, setError] = useState(null);
  
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  if (!isOpen) return null;

  const handlePayment = async () => {
    if (!currentAccount) {
      setError('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    setStatus('processing');
    setError(null);

    try {
      // Convert USDC amount from micros to actual coins
      const amountInMicros = paymentData.amount;
      
      // Create Sui transaction for USDC transfer
      const txb = new Transaction();

      // Split coin for exact amount (assuming USDC coin type)
      const usdcCoinType = '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';
      
      const [coin] = txb.splitCoins(txb.gas, [amountInMicros]);
      
      // Transfer to Beep payment recipient
      txb.transferObjects([coin], paymentData.recipient);

      // Execute transaction
      const result = await signAndExecuteTransaction({
        transaction: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });


      // Verify payment through Beep
      const verifyResponse = await api.beepVerifyPayment(
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
            protocol: 'a402',
            verificationData: verifyResponse.data.verificationData,
          });
        }

        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error('A402 payment verification failed');
      }
    } catch (err) {
      console.error('A402 payment error:', err);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  A402 Payment Required
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Powered by Beep
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isProcessing}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Payment Details */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Amount</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {paymentData.amount / 1000000} {paymentData.currency}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Protocol</span>
                <span className="text-gray-900 dark:text-white font-mono">a402</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Facilitator</span>
                <span className="text-gray-900 dark:text-white">Beep Network</span>
              </div>
              {paymentData.referenceId && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Reference</span>
                  <span className="text-gray-900 dark:text-white font-mono text-xs">
                    {paymentData.referenceId.slice(0, 20)}...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {status === 'processing' && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Processing payment...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
              <CheckCircle className="w-5 h-5" />
              <span>Payment verified successfully!</span>
            </div>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>About A402:</strong> Agent-to-agent payment protocol enabling instant,
              verifiable stablecoin transfers for AI-powered resource access.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing || status === 'success'}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handlePayment}
              disabled={isProcessing || status === 'success'}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </>
              ) : (
                'Pay with Sui'
              )}
            </button>
          </div>

          {/* Beep Link */}
          {paymentData.beepPaymentUrl && (
            <a
              href={paymentData.beepPaymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View on Beep Platform
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
