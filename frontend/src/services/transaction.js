import { Transaction } from '@mysten/sui/transactions';
import { CLOCK_OBJECT_ID, MEDICAL_VAULT_PACKAGE_ID, WHITELIST_REGISTRY } from '../utils/constants';

/**
 * Transaction signing utilities for Sui wallet integration
 */

/**
 * Sign and execute a transaction with user's wallet
 * @param {Object} signAndExecuteTransaction - From useSignAndExecuteTransaction hook
 * @param {Transaction} tx - Transaction object to sign
 * @returns {Promise<Object>} Transaction result
 */
export async function signAndExecute(signAndExecuteTransaction, tx) {
  try {
    const result = await signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    return {
      success: true,
      digest: result.digest,
      effects: result.effects,
      objectChanges: result.objectChanges,
    };
  } catch (error) {
    console.error('Transaction signing failed:', error);
    throw new Error(error.message || 'Failed to sign transaction');
  }
}

/**
 * Create whitelist with wallet signing - calls contract directly
 * @param {Object} params
 * @param {Function} params.signAndExecuteTransaction - Sui wallet sign function
 * @param {string} params.label - Whitelist label/name
 * @returns {Promise<Object>} Created whitelist info
 */
export async function createWhitelistWithWallet({
  signAndExecuteTransaction,
  label,
  patientAddress,
}) {
  try {
    // Create transaction to call contract directly
    const transaction = new Transaction();
    // Call create_whitelist function on contract
    transaction.moveCall({
      target: `${MEDICAL_VAULT_PACKAGE_ID}::seal_whitelist::create_whitelist`,
      arguments: [
        transaction.object(WHITELIST_REGISTRY), // registry: &mut WhitelistRegistry
        transaction.pure.string(label), // name: vector<u8>
        transaction.pure.address(patientAddress), // patient: address
        transaction.object(CLOCK_OBJECT_ID), // clock: &Clock
        // ctx: &mut TxContext is automatically provided
      ],
    });

    // Sign and execute with wallet
    const result = await signAndExecute(signAndExecuteTransaction, transaction);

    return {
      success: true,
      // whitelistId,
      // adminCapId,
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  } catch (error) {
    console.error('Create whitelist failed:', error);
    throw error;
  }
}

/**
 * Extract object ID from transaction object changes
 */
function extractObjectId(objectChanges, objectType) {
  const created = objectChanges?.find(
    (change) => change.type === 'created' && change.objectType?.includes(objectType),
  );
  return created?.objectId;
}

/**
 * Add doctor with wallet signing - calls contract directly
 */
export async function addDoctorWithWallet({
  signAndExecuteTransaction,
  whitelistId,
  doctor,
  whitelistCapId,
}) {
  try {
    // Create transaction to call contract directly
    const tx = new Transaction();
    // Call add_doctor function on contract
    tx.moveCall({
      target: `${MEDICAL_VAULT_PACKAGE_ID}::seal_whitelist::add_doctor`,
      arguments: [
        tx.object(WHITELIST_REGISTRY), // registry: &mut WhitelistRegistry
        tx.object(whitelistId), // whitelist: &mut SealWhitelist
        tx.object(whitelistCapId), // cap: &WhitelistAdminCap
        tx.pure.address(doctor), // doctor: address
        tx.object(CLOCK_OBJECT_ID), // clock: &Clock
      ],
    });

    // Sign and execute with wallet
    const result = await signAndExecute(signAndExecuteTransaction, tx);

    return {
      success: true,
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  } catch (error) {
    console.error('Add doctor failed:', error);
    throw new Error(error.message || 'Failed to add doctor');
  }
}

/**
 * Add member with wallet signing - calls contract directly
 */
export async function addMemberWithWallet({
  signAndExecuteTransaction,
  whitelistId,
  member,
  whitelistCapId,
}) {
  try {
    // Create transaction to call contract directly
    const tx = new Transaction();

    // Call add_member function on contract
    tx.moveCall({
      target: `${MEDICAL_VAULT_PACKAGE_ID}::seal_whitelist::add_member`,
      arguments: [
        tx.object(WHITELIST_REGISTRY), // registry: &mut WhitelistRegistry
        tx.object(whitelistId), // whitelist: &mut SealWhitelist
        tx.object(whitelistCapId), // cap: &WhitelistAdminCap
        tx.pure.address(member), // member: address
        tx.object(CLOCK_OBJECT_ID), // clock: &Clock
      ],
    });

    // Sign and execute with wallet
    const result = await signAndExecute(signAndExecuteTransaction, tx);

    return {
      success: true,
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  } catch (error) {
    console.error('Add member failed:', error);
    throw new Error(error.message || 'Failed to add member');
  }
}

/**
 * Remove doctor with wallet signing - calls contract directly
 */
export async function removeDoctorWithWallet({
  signAndExecuteTransaction,
  whitelistId,
  doctor,
  whitelistCapId,
}) {
  try {
    // Create transaction to call contract directly
    const tx = new Transaction();
    // Call remove_doctor function on contract
    tx.moveCall({
      target: `${MEDICAL_VAULT_PACKAGE_ID}::seal_whitelist::remove_doctor`,
      arguments: [
        tx.object(WHITELIST_REGISTRY), // registry: &mut WhitelistRegistry
        tx.object(whitelistId), // whitelist: &mut SealWhitelist
        tx.object(whitelistCapId), // cap: &WhitelistAdminCap
        tx.pure.address(doctor), // doctor: address
        tx.object(CLOCK_OBJECT_ID), // clock: &Clock
      ],
    });

    // Sign and execute with wallet
    const result = await signAndExecute(signAndExecuteTransaction, tx);

    return {
      success: true,
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  } catch (error) {
    console.error('Remove doctor failed:', error);
    throw new Error(error.message || 'Failed to remove doctor');
  }
}

/**
 * Remove member with wallet signing - calls contract directly
 */
export async function removeMemberWithWallet({
  signAndExecuteTransaction,
  whitelistId,
  member,
  whitelistCapId,
}) {
  try {
    // Create transaction to call contract directly
    const tx = new Transaction();

    // Call remove_member function on contract
    tx.moveCall({
      target: `${MEDICAL_VAULT_PACKAGE_ID}::seal_whitelist::remove_member`,
      arguments: [
        tx.object(WHITELIST_REGISTRY), // registry: &mut WhitelistRegistry
        tx.object(whitelistId), // whitelist: &mut SealWhitelist
        tx.object(whitelistCapId), // cap: &WhitelistAdminCap
        tx.pure.address(member), // member: address
        tx.object(CLOCK_OBJECT_ID), // clock: &Clock
      ],
    });

    // Sign and execute with wallet
    const result = await signAndExecute(signAndExecuteTransaction, tx);

    return {
      success: true,
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  } catch (error) {
    console.error('Remove member failed:', error);
    throw new Error(error.message || 'Failed to remove member');
  }
}

/**
 * Create timeline entry (insurance claim) with wallet signing
 * Directly calls create_entry function in timeline.move contract
 * 
 * Contract function signature:
 * public fun create_entry(
 *   whitelist: &mut SealWhitelist,
 *   patient_ref: vector<u8>,
 *   entry_type: u8,
 *   visit_date: vector<u8>,
 *   provider_specialty: vector<u8>,
 *   visit_type: vector<u8>,
 *   status: vector<u8>,
 *   content_hash: vector<u8>,
 *   walrus_blob_id: vector<u8>,
 *   timestamp_ms: u64,
 *   _clock: &Clock,
 *   ctx: &mut TxContext,
 * )
 */
export async function createTimelineEntryWithWallet({
  signAndExecuteTransaction,
  whitelistId,
  patientRef,
  entryType,
  visitDate,
  providerSpecialty,
  visitType,
  status,
  contentHash,
  walrusBlobId,
  timestampMs,
}) {
  try {
    console.log('Creating timeline entry - calling create_entry directly:', {
      whitelistId,
      entryType,
      visitDate,
      timestampMs,
    });

    const tx = new Transaction();

    // Convert strings to bytes (as required by contract)
    const visitDateBytes = new TextEncoder().encode(visitDate);
    const providerSpecialtyBytes = new TextEncoder().encode(providerSpecialty || '');
    const visitTypeBytes = new TextEncoder().encode(visitType || '');
    const statusBytes = new TextEncoder().encode(status || 'submitted');
    const contentHashBytes = new TextEncoder().encode(contentHash);

    // Direct call to timeline::create_entry function
    // Target: {PACKAGE_ID}::timeline::create_entry
    tx.moveCall({
      target: `${MEDICAL_VAULT_PACKAGE_ID}::timeline::create_entry`,
      arguments: [
        tx.object(whitelistId), // whitelist: &mut SealWhitelist
        tx.pure.vector('u8', patientRef), // patient_ref: vector<u8>
        tx.pure.u8(entryType), // entry_type: u8
        tx.pure.vector('u8', Array.from(visitDateBytes)), // visit_date: vector<u8>
        tx.pure.vector('u8', Array.from(providerSpecialtyBytes)), // provider_specialty: vector<u8>
        tx.pure.vector('u8', Array.from(visitTypeBytes)), // visit_type: vector<u8>
        tx.pure.vector('u8', Array.from(statusBytes)), // status: vector<u8>
        tx.pure.vector('u8', Array.from(contentHashBytes)), // content_hash: vector<u8>
        tx.pure.vector('u8', walrusBlobId), // walrus_blob_id: vector<u8>
        tx.pure.u64(timestampMs), // timestamp_ms: u64
        tx.object(CLOCK_OBJECT_ID), // clock: &Clock
        // ctx: &mut TxContext is automatically provided by Sui
      ],
    });

    console.log('Transaction prepared, signing with wallet...');

    // Sign and execute with wallet
    const result = await signAndExecute(signAndExecuteTransaction, tx);

    console.log('Timeline entry created successfully:', {
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    });

    return {
      success: true,
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  } catch (error) {
    console.error('Create timeline entry failed:', error);
    throw new Error(error.message || 'Failed to create timeline entry');
  }
}

export default {
  signAndExecute,
  createWhitelistWithWallet,
  addDoctorWithWallet,
  addMemberWithWallet,
  removeDoctorWithWallet,
  removeMemberWithWallet,
  createTimelineEntryWithWallet,
};
