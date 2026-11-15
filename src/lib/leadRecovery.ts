/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { sanitizeForFirestore } from './storeSync';
import { AbandonedLead, AbandonedLeadStatus, Order } from '../types';

let leadDebounceTimer: any = null;
const recentlyConvertedPhones = new Map<string, number>();

/**
 * Normalizes phone numbers to standard 11-digit Bangladesh format (e.g. 01XXXXXXXXX)
 */
export function normalizePhone(raw: string): string {
  const ascii = String(raw || '').replace(/[০-৯]/g, (d) =>
    String('০১২৩৪৫৬৭৮৯'.indexOf(d))
  );
  let digits = ascii.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length >= 13) {
    digits = digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('1')) {
    digits = `0${digits}`;
  }
  if (digits.length > 11 && digits.startsWith('01')) {
    digits = digits.slice(0, 11);
  }
  return digits;
}

/**
 * Captures or updates an abandoned checkout lead in real-time.
 * ONLY persists when the phone number is a complete 11-digit BD number (01XXXXXXXXX)
 * so partial typing (6, 7, 8, 9, 10 digits) NEVER creates duplicate rows in Firestore!
 */
export function captureAbandonedLeadDebounced(
  leadData: {
    customerPhone: string;
    customerName?: string;
    customerAddress?: string;
    deliveryArea?: 'dhaka' | 'outside_dhaka';
    source: 'pdp_direct' | 'cart_checkout';
    productId?: string;
    productName?: string;
    productPrice?: number;
    productImage?: string;
    productVariant?: string;
    cartItems?: any[];
    quantity?: number;
    estimatedTotal: number;
  },
  delayMs = 800
): void {
  const cleanPhone = normalizePhone(leadData.customerPhone || '');
  // CRITICAL FIX: Never create Firestore documents for partial (< 11 digit) phone numbers!
  if (cleanPhone.length !== 11 || !/^01\d{9}$/.test(cleanPhone)) return;

  // Do not overwrite a recently converted order back to 'pending'
  const lastConv = recentlyConvertedPhones.get(cleanPhone);
  if (lastConv && Date.now() - lastConv < 120000) return;

  if (leadDebounceTimer) {
    clearTimeout(leadDebounceTimer);
  }

  leadDebounceTimer = setTimeout(async () => {
    try {
      const recheckConv = recentlyConvertedPhones.get(cleanPhone);
      if (recheckConv && Date.now() - recheckConv < 120000) return;

      const itemsList =
        leadData.cartItems && leadData.cartItems.length > 0
          ? leadData.cartItems.map((ci: any) => ({
              productId: ci.product?.id || ci.id || '',
              productName: ci.product?.name || ci.name || 'পণ্য',
              productImage: ci.product?.images?.[0] || ci.image || '',
              quantity: ci.quantity || 1,
              price: ci.product?.price || ci.price || 0,
              selectedColor: ci.selectedColor || '',
              selectedSize: ci.selectedSize || '',
            }))
          : leadData.productName
          ? [
              {
                productId: leadData.productId || '',
                productName: leadData.productName,
                productImage: leadData.productImage || '',
                quantity: leadData.quantity || 1,
                price: leadData.productPrice || leadData.estimatedTotal || 0,
                selectedColor: leadData.productVariant || '',
              },
            ]
          : [];

      const docId = `lead_${cleanPhone}`;
      const record: AbandonedLead = sanitizeForFirestore({
        id: docId,
        customerName: leadData.customerName?.trim() || 'সম্মানিত ক্রেতা',
        customerPhone: cleanPhone,
        customerAddress: leadData.customerAddress?.trim() || '',
        deliveryArea: leadData.deliveryArea || 'dhaka',
        source: leadData.source,
        productId: leadData.productId,
        productName: leadData.productName,
        productPrice: leadData.productPrice,
        productImage: leadData.productImage,
        productVariant: leadData.productVariant,
        cartItems: leadData.cartItems,
        items: itemsList,
        quantity: leadData.quantity || 1,
        estimatedTotal: leadData.estimatedTotal || 0,
        totalAmount: leadData.estimatedTotal || 0,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await setDoc(doc(db, 'abandoned_leads', docId), record, { merge: true });
    } catch (err) {
      console.warn('Realtime lead capture note:', err);
    }
  }, delayMs);
}

/**
 * Marks an abandoned lead as converted when the customer actually confirms the order,
 * cancels any pending debounce timer, and removes any legacy partial-phone prefix documents.
 */
export async function markLeadConverted(phone: string, orderId: string): Promise<void> {
  if (leadDebounceTimer) {
    clearTimeout(leadDebounceTimer);
    leadDebounceTimer = null;
  }
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return;

  recentlyConvertedPhones.set(cleanPhone, Date.now());

  try {
    const docId = `lead_${cleanPhone}`;
    await updateDoc(doc(db, 'abandoned_leads', docId), {
      status: 'converted',
      convertedOrderId: orderId,
      updatedAt: Date.now(),
    });
  } catch {
    // Lead might not exist or already cleaned
  }

  // Also delete any legacy partial prefix documents (6..10 digits) for this phone number
  if (cleanPhone.length === 11) {
    for (let len = 6; len <= 10; len++) {
      const partialId = `lead_${cleanPhone.slice(0, len)}`;
      deleteDoc(doc(db, 'abandoned_leads', partialId)).catch(() => null);
    }
  }
}

/**
 * Automatically cleans up partial-phone duplicate leads (< 11 digits or prefixes of another lead)
 * and deduplicates leads by 11-digit phone number. Also deletes the partial records from Firestore.
 */
export function cleanupDuplicateAndPartialLeads(
  rawLeads: AbandonedLead[],
  existingOrders: Order[] = []
): AbandonedLead[] {
  const orderByPhone = new Map<string, Order>();
  for (const ord of existingOrders) {
    const p = normalizePhone(ord.customer?.phone || '');
    if (p.length === 11 && ord.status !== 'cancelled') {
      if (!orderByPhone.has(p)) {
        orderByPhone.set(p, ord);
      }
    }
  }

  const partialLeadIdsToDelete: string[] = [];
  const byFullPhone = new Map<string, AbandonedLead>();

  // Sort newest first so we keep the richest/latest record for each 11-digit phone
  const sorted = [...rawLeads].sort(
    (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
  );

  for (const lead of sorted) {
    const cleanPhone = normalizePhone(lead.customerPhone || '');
    // Any partial phone number (< 11 digits, e.g. 0171708, 017170844, 017118, 01711830, 0171183087)
    // is a typing artifact and should be removed from UI and deleted from Firestore
    if (cleanPhone.length < 11 || !/^01\d{9}$/.test(cleanPhone)) {
      if (lead.id) partialLeadIdsToDelete.push(lead.id);
      continue;
    }

    const matchingOrder = orderByPhone.get(cleanPhone);
    const updatedLead: AbandonedLead = matchingOrder && lead.status === 'pending'
      ? { ...lead, customerPhone: cleanPhone, status: 'converted', convertedOrderId: matchingOrder.id }
      : { ...lead, customerPhone: cleanPhone };

    if (matchingOrder && lead.status === 'pending' && lead.id) {
      updateDoc(doc(db, 'abandoned_leads', lead.id), {
        status: 'converted',
        convertedOrderId: matchingOrder.id,
        updatedAt: Date.now(),
      }).catch(() => null);
    }

    const existing = byFullPhone.get(cleanPhone);
    if (!existing) {
      byFullPhone.set(cleanPhone, updatedLead);
    } else {
      // Merge richer customerName / customerAddress if the newer one was empty
      const merged: AbandonedLead = {
        ...existing,
        customerName:
          existing.customerName && existing.customerName !== 'সম্মানিত ক্রেতা'
            ? existing.customerName
            : updatedLead.customerName,
        customerAddress: existing.customerAddress || updatedLead.customerAddress,
        status:
          existing.status === 'converted' || updatedLead.status === 'converted'
            ? 'converted'
            : existing.status,
      };
      byFullPhone.set(cleanPhone, merged);
      if (lead.id && lead.id !== existing.id) {
        partialLeadIdsToDelete.push(lead.id);
      }
    }
  }

  // Delete partial/duplicate documents from Firestore in the background
  if (partialLeadIdsToDelete.length > 0) {
    for (const delId of partialLeadIdsToDelete) {
      deleteDoc(doc(db, 'abandoned_leads', delId)).catch(() => null);
    }
  }

  return Array.from(byFullPhone.values()).sort(
    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
  );
}

/**
 * Updates lead status in admin panel
 */
export async function updateLeadStatus(
  leadId: string,
  status: AbandonedLeadStatus,
  notes?: string
): Promise<void> {
  try {
    const payload: any = { status, updatedAt: Date.now() };
    if (notes !== undefined) payload.notes = notes;
    await updateDoc(doc(db, 'abandoned_leads', leadId), payload);
  } catch (err) {
    console.warn('Update lead status note:', err);
  }
}

/**
 * Deletes an abandoned lead record
 */
export async function deleteAbandonedLead(leadId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'abandoned_leads', leadId));
  } catch (err) {
    console.warn('Delete lead note:', err);
  }
}
