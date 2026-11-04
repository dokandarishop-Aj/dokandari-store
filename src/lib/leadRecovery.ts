/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { sanitizeForFirestore } from './storeSync';
import { AbandonedLead, AbandonedLeadStatus } from '../types';

let leadDebounceTimer: any = null;

/**
 * Normalizes phone numbers to standard 11-digit Bangladesh format (e.g. 01XXXXXXXXX)
 */
export function normalizePhone(raw: string): string {
  const ascii = String(raw || '').replace(/[০-৯]/g, (d) =>
    String('০১২৩৪৫৬৭৮৯'.indexOf(d))
  );
  const digits = ascii.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length >= 13) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Captures or updates an abandoned checkout lead in real-time
 * Debounces calls to prevent rapid Firestore writes while customer is typing
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
  delayMs = 600
): void {
  const cleanPhone = normalizePhone(leadData.customerPhone || '');
  if (cleanPhone.length < 6) return; // Do not record until phone has meaningful digits

  if (leadDebounceTimer) {
    clearTimeout(leadDebounceTimer);
  }

  leadDebounceTimer = setTimeout(async () => {
    try {
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
 * Marks an abandoned lead as converted when the customer actually confirms the order
 */
export async function markLeadConverted(phone: string, orderId: string): Promise<void> {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return;

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
