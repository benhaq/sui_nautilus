import React from 'react'
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react'

export default function Alert({ type = 'info', title, message, onClose, className = '' }) {
  const styles = {
    success: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
      title: 'text-green-800 dark:text-green-400',
      message: 'text-green-700 dark:text-green-300',
    },
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      title: 'text-red-800 dark:text-red-400',
      message: 'text-red-700 dark:text-red-300',
    },
    warning: {
      container: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
      icon: <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
      title: 'text-orange-800 dark:text-orange-400',
      message: 'text-orange-700 dark:text-orange-300',
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      title: 'text-blue-800 dark:text-blue-400',
      message: 'text-blue-700 dark:text-blue-300',
    },
  }

  const style = styles[type]

  return (
    <div className={`rounded-lg border p-4 ${style.container} ${className}`} role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">{style.icon}</div>
        <div className="ml-3 flex-1">
          {title && <h3 className={`text-sm font-medium ${style.title}`}>{title}</h3>}
          {message && (
            <p className={`text-sm ${title ? 'mt-1' : ''} ${style.message}`}>{message}</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-3 inline-flex rounded-md hover:opacity-70 transition-opacity duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
