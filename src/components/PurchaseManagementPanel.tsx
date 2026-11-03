/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Edit3,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Package,
  Search,
  X,
  Save,
  TrendingUp,
  RotateCcw,
  Users,
  Layers,
  FileText,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Product,
  PurchaseRecord,
  PurchaseStatus,
  PurchasePaymentMethod,
  InventoryMovement,
} from '../types';
import {
  saveProductPersisted,
  savePurchasePersisted,
  deletePurchasePersisted,
} from '../lib/storeSync';

interface PurchaseManagementPanelProps {
  products: Product[];
  purchases: PurchaseRecord[];
  onPurchasesChange: React.Dispatch<React.SetStateAction<PurchaseRecord[]>>;
  onUpdateProduct: (product: Product) => void;
  onRecordMovement: (movement: InventoryMovement) => void;
  onFeedback: (msg: string) => void;
}

export const PurchaseManagementPanel: React.FC<PurchaseManagementPanelProps> = ({
  products,
  purchases,
  onPurchasesChange,
  onUpdateProduct,
  onRecordMovement,
  onFeedback,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Active Sub-Report Tab
  const [subTab, setSubTab] = useState<'entries' | 'supplier_report' | 'product_report'>('entries');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEntryForm, setShowEntryForm] = useState(true);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [selectedInvoicePurchase, setSelectedInvoicePurchase] = useState<PurchaseRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State (All 16 fields requested by user)
  const [purchaseDate, setPurchaseDate] = useState(todayStr);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`PUR-${Math.floor(10000 + Math.random() * 90000)}`);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [customProductName, setCustomProductName] = useState(products[0]?.name || '');
  const [productSku, setProductSku] = useState(products[0]?.sku || 'DKD-SKU-01');
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(10);
  const [unitPurchasePrice, setUnitPurchasePrice] = useState<number>(
    products[0]?.costPrice || Math.round((products[0]?.price || 1000) * 0.55)
  );
  const [transportCost, setTransportCost] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('Cash');
  const [status, setStatus] = useState<PurchaseStatus>('confirmed');
  const [notes, setNotes] = useState('');

  // Automatic Live Calculations:
  // 1) Total Purchase Amount = Purchase Quantity × Unit Purchase Price
  const totalPurchaseAmount = useMemo(
    () => Math.max(0, (Number(purchaseQuantity) || 0) * (Number(unitPurchasePrice) || 0)),
    [purchaseQuantity, unitPurchasePrice]
  );

  // 2) Grand Total Purchase Cost = Total Purchase Amount + Transport Cost + Other Expenses
  const grandTotalPurchaseCost = useMemo(
    () =>
      Math.max(
        0,
        totalPurchaseAmount + (Number(transportCost) || 0) + (Number(otherExpenses) || 0)
      ),
    [totalPurchaseAmount, transportCost, otherExpenses]
  );

  // 3) Due Amount = Grand Total Purchase Cost − Paid Amount
  const dueAmount = useMemo(
    () => Math.max(0, grandTotalPurchaseCost - (Number(paidAmount) || 0)),
    [grandTotalPurchaseCost, paidAmount]
  );

  const handleSelectCatalogProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (prodId === 'custom') {
      setCustomProductName('');
      setProductSku(`DKD-SKU-${Math.floor(100 + Math.random() * 900)}`);
      return;
    }
    const found = products.find((p) => p.id === prodId);
    if (found) {
      setCustomProductName(found.name);
      setProductSku(found.sku || `DKD-${found.id.slice(-4).toUpperCase()}`);
      const suggestedUnitCost =
        found.costPrice || Math.round((found.price || 1000) * 0.55);
      setUnitPurchasePrice(suggestedUnitCost);
    }
  };

  const resetForm = () => {
    setEditingPurchase(null);
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setSupplierName('');
    setSupplierPhone('');
    setInvoiceNumber(`PUR-${Math.floor(10000 + Math.random() * 90000)}`);
    const firstProd = products[0];
    setSelectedProductId(firstProd?.id || '');
    setCustomProductName(firstProd?.name || '');
    setProductSku(firstProd?.sku || 'DKD-SKU-01');
    setPurchaseQuantity(10);
    setUnitPurchasePrice(firstProd?.costPrice || Math.round((firstProd?.price || 1000) * 0.55));
    setTransportCost(0);
    setOtherExpenses(0);
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setStatus('confirmed');
    setNotes('');
  };

  const handleOpenEdit = (rec: PurchaseRecord) => {
    setEditingPurchase(rec);
    setPurchaseDate(rec.purchaseDate);
    setSupplierName(rec.supplierName);
    setSupplierPhone(rec.supplierPhone);
    setInvoiceNumber(rec.invoiceNumber);
    setSelectedProductId(
      products.some((p) => p.id === rec.productId) ? rec.productId : 'custom'
    );
    setCustomProductName(rec.productName);
    setProductSku(rec.productSku);
    setPurchaseQuantity(rec.purchaseQuantity);
    setUnitPurchasePrice(rec.unitPurchasePrice);
    setTransportCost(rec.transportCost);
    setOtherExpenses(rec.otherExpenses);
    setPaidAmount(rec.paidAmount);
    setPaymentMethod(rec.paymentMethod);
    setStatus(rec.status);
    setNotes(rec.notes);
    setShowEntryForm(true);
  };

  // Stock synchronization engine with strict duplicate protection (`stockApplied`)
  const applyPurchaseStockSync = async (
    record: PurchaseRecord,
    previousRecord?: PurchaseRecord | null
  ): Promise<PurchaseRecord> => {
    const targetProd = products.find(
      (p) =>
        p.id === record.productId ||
        (record.productSku && p.sku === record.productSku) ||
        p.name === record.productName
    );

    if (!targetProd) {
      return record;
    }

    let currentStock = typeof targetProd.stock === 'number' ? targetProd.stock : 15;
    let stockApplied = previousRecord ? previousRecord.stockApplied : record.stockApplied;

    // Effective unit landed cost (including transport & other expenses per unit)
    const landedUnitCost =
      record.purchaseQuantity > 0
        ? Math.round(record.grandTotalPurchaseCost / record.purchaseQuantity)
        : record.unitPurchasePrice;

    // Case 1: Editing an already stock-applied purchase where quantity changed while still confirmed
    if (
      previousRecord &&
      previousRecord.stockApplied &&
      record.status === 'confirmed' &&
      previousRecord.purchaseQuantity !== record.purchaseQuantity
    ) {
      const diff = record.purchaseQuantity - previousRecord.purchaseQuantity;
      const nextStock = Math.max(0, currentStock + diff);
      const updatedProd: Product = {
        ...targetProd,
        stock: nextStock,
        inStock: nextStock > 0,
        costPrice: landedUnitCost,
        updatedAt: Date.now(),
      };
      await saveProductPersisted(updatedProd);
      onUpdateProduct(updatedProd);

      const mov: InventoryMovement = {
        id: `mov-pur-adj-${record.id}-${Date.now().toString().slice(-4)}`,
        productId: targetProd.id,
        productName: targetProd.name,
        sku: targetProd.sku || record.productSku,
        type: 'purchase_stock_in',
        quantity: Math.abs(diff),
        previousStock: currentStock,
        newStock: nextStock,
        referenceId: record.invoiceNumber,
        notes: `পণ্য ক্রয় এডিট (#${record.invoiceNumber}) — স্টক সমন্বয় (${diff >= 0 ? `+${diff}` : diff}টি)`,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'inventory_movements', mov.id), mov).catch(() => null);
      onRecordMovement(mov);
      stockApplied = true;
    }
    // Case 2: Purchase is Confirmed and NOT YET applied to stock -> Increment Stock ONCE
    else if (record.status === 'confirmed' && !stockApplied) {
      const nextStock = currentStock + record.purchaseQuantity;
      const updatedProd: Product = {
        ...targetProd,
        stock: nextStock,
        inStock: true,
        costPrice: landedUnitCost,
        updatedAt: Date.now(),
      };
      await saveProductPersisted(updatedProd);
      onUpdateProduct(updatedProd);

      const mov: InventoryMovement = {
        id: `mov-pur-in-${record.id}-${Date.now().toString().slice(-4)}`,
        productId: targetProd.id,
        productName: targetProd.name,
        sku: targetProd.sku || record.productSku,
        type: 'purchase_stock_in',
        quantity: record.purchaseQuantity,
        previousStock: currentStock,
        newStock: nextStock,
        referenceId: record.invoiceNumber,
        notes: `পণ্য ক্রয় কনফার্ম (#${record.invoiceNumber}, সাপ্লায়ার: ${record.supplierName}) — স্বয়ংক্রিয়ভাবে স্টকে +${record.purchaseQuantity}টি যোগ হয়েছে`,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'inventory_movements', mov.id), mov).catch(() => null);
      onRecordMovement(mov);
      stockApplied = true;
    }
    // Case 3: Purchase was previously applied to stock, and is now Cancelled -> Reverse Stock ONCE
    else if (record.status === 'cancelled' && stockApplied) {
      const qtyToReverse = previousRecord ? previousRecord.purchaseQuantity : record.purchaseQuantity;
      const nextStock = Math.max(0, currentStock - qtyToReverse);
      const updatedProd: Product = {
        ...targetProd,
        stock: nextStock,
        inStock: nextStock > 0,
        updatedAt: Date.now(),
      };
      await saveProductPersisted(updatedProd);
      onUpdateProduct(updatedProd);

      const mov: InventoryMovement = {
        id: `mov-pur-rev-${record.id}-${Date.now().toString().slice(-4)}`,
        productId: targetProd.id,
        productName: targetProd.name,
        sku: targetProd.sku || record.productSku,
        type: 'purchase_cancel_reversal',
        quantity: qtyToReverse,
        previousStock: currentStock,
        newStock: nextStock,
        referenceId: record.invoiceNumber,
        notes: `পণ্য ক্রয় বাতিল (#${record.invoiceNumber}) — স্টক থেকে -${qtyToReverse}টি সমন্বয় (রিভার্স) করা হয়েছে`,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'inventory_movements', mov.id), mov).catch(() => null);
      onRecordMovement(mov);
      stockApplied = false;
    }

    return {
      ...record,
      stockApplied,
    };
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      onFeedback('⚠️ অনুগ্রহ করে সাপ্লায়ারের নাম লিখুন (যেমন: Guangzhou Supplier China বা ঢাকা চকবাজার)।');
      return;
    }
    const matchedProd = products.find((p) => p.id === selectedProductId);
    const finalProdName = customProductName.trim() || matchedProd?.name || '';
    if (!finalProdName) {
      onFeedback('⚠️ অনুগ্রহ করে প্রোডাক্ট নির্বাচন করুন অথবা প্রোডাক্টের নাম লিখুন।');
      return;
    }

    setSubmitting(true);
    try {
      const now = Date.now();
      const rawRecord: PurchaseRecord = {
        id: editingPurchase?.id || `pur-${now}-${Math.floor(100 + Math.random() * 900)}`,
        purchaseDate: purchaseDate || todayStr,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim(),
        invoiceNumber: invoiceNumber.trim() || `PUR-${now.toString().slice(-5)}`,
        productId: selectedProductId === 'custom' ? `prod-${now}` : selectedProductId,
        productName: finalProdName,
        productSku: productSku.trim() || matchedProd?.sku || 'SKU-N/A',
        purchaseQuantity: Math.max(1, Number(purchaseQuantity) || 1),
        unitPurchasePrice: Math.max(0, Number(unitPurchasePrice) || 0),
        totalPurchaseAmount,
        transportCost: Math.max(0, Number(transportCost) || 0),
        otherExpenses: Math.max(0, Number(otherExpenses) || 0),
        grandTotalPurchaseCost,
        paidAmount: Math.max(0, Number(paidAmount) || 0),
        dueAmount,
        paymentMethod,
        notes: notes.trim(),
        status,
        stockApplied: editingPurchase ? editingPurchase.stockApplied : false,
        createdAt: editingPurchase?.createdAt || now,
        updatedAt: now,
      };

      const syncedRecord = await applyPurchaseStockSync(rawRecord, editingPurchase);
      const saved = await savePurchasePersisted(syncedRecord);

      onPurchasesChange((prev) => {
        const filtered = prev.filter((p) => p.id !== saved.id);
        return [saved, ...filtered].sort((a, b) => b.createdAt - a.createdAt);
      });

      onFeedback(
        saved.status === 'confirmed'
          ? `✅ ক্রয় এন্ট্রি #${saved.invoiceNumber} সেভ হয়েছে এবং "${saved.productName}"-এর স্টকে +${saved.purchaseQuantity}টি পণ্য যোগ হয়েছে!`
          : `✅ ক্রয় এন্ট্রি #${saved.invoiceNumber} (${saved.status.toUpperCase()}) সফলভাবে ডাটাবেজে সেভ হয়েছে!`
      );
      resetForm();
    } catch (err: any) {
      console.warn('Purchase save error:', err);
      onFeedback(`❌ ক্রয় এন্ট্রি সেভ করতে সমস্যা: ${err?.message || 'পুনরায় চেষ্টা করুন'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusQuickChange = async (rec: PurchaseRecord, nextStatus: PurchaseStatus) => {
    if (rec.status === nextStatus) return;
    const candidate: PurchaseRecord = {
      ...rec,
      status: nextStatus,
      updatedAt: Date.now(),
    };
    const synced = await applyPurchaseStockSync(candidate, rec);
    const saved = await savePurchasePersisted(synced);
    onPurchasesChange((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    onFeedback(
      nextStatus === 'confirmed'
        ? `✅ ক্রয় #${rec.invoiceNumber} কনফার্ম হয়েছে এবং স্টকে +${rec.purchaseQuantity}টি যোগ হয়েছে!`
        : nextStatus === 'cancelled'
        ? `⚠️ ক্রয় #${rec.invoiceNumber} বাতিল করা হয়েছে এবং স্টক স্বয়ংক্রিয়ভাবে রিভার্স হয়েছে!`
        : `📋 ক্রয় #${rec.invoiceNumber} পেন্ডিং স্ট্যাটাসে নেওয়া হয়েছে।`
    );
  };

  const handleDeletePurchase = async (rec: PurchaseRecord) => {
    // If stock was applied, reverse it cleanly before deleting
    if (rec.stockApplied) {
      await applyPurchaseStockSync({ ...rec, status: 'cancelled' }, rec);
    }
    await deletePurchasePersisted(rec.id);
    onPurchasesChange((prev) => prev.filter((p) => p.id !== rec.id));
    onFeedback(
      `🗑️ ক্রয় এন্ট্রি #${rec.invoiceNumber} (৳${rec.grandTotalPurchaseCost.toLocaleString()}) ডাটাবেজ থেকে ডিলিট ও স্টক সমন্বয় করা হয়েছে।`
    );
  };

  // Active (non-cancelled) purchases for financial & stock summary reports
  const activePurchases = useMemo(
    () => purchases.filter((p) => p.status !== 'cancelled'),
    [purchases]
  );

  // Report Metrics: Today, Monthly, Yearly, Total Qty, Total Paid, Total Due
  const reportStats = useMemo(() => {
    const currentMonthPrefix = todayStr.slice(0, 7); // YYYY-MM
    const currentYearPrefix = todayStr.slice(0, 4); // YYYY

    let todayTotal = 0;
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    let totalQty = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let allTimeTotal = 0;

    activePurchases.forEach((p) => {
      const grand = Number(p.grandTotalPurchaseCost) || 0;
      allTimeTotal += grand;
      totalQty += Number(p.purchaseQuantity) || 0;
      totalPaid += Number(p.paidAmount) || 0;
      totalDue += Number(p.dueAmount) || 0;

      if (p.purchaseDate === todayStr) {
        todayTotal += grand;
      }
      if (p.purchaseDate && p.purchaseDate.startsWith(currentMonthPrefix)) {
        monthlyTotal += grand;
      }
      if (p.purchaseDate && p.purchaseDate.startsWith(currentYearPrefix)) {
        yearlyTotal += grand;
      }
    });

    return {
      todayTotal,
      monthlyTotal,
      yearlyTotal,
      allTimeTotal,
      totalQty,
      totalPaid,
      totalDue,
    };
  }, [activePurchases, todayStr]);

  // Supplier-Wise Aggregated Report
  const supplierWiseReport = useMemo(() => {
    const map = new Map<
      string,
      {
        supplierName: string;
        supplierPhone: string;
        invoiceCount: number;
        totalQuantity: number;
        grandTotalCost: number;
        paidAmount: number;
        dueAmount: number;
      }
    >();

    activePurchases.forEach((p) => {
      const key = p.supplierName.trim().toLowerCase() || 'unknown';
      const existing = map.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalQuantity += p.purchaseQuantity;
        existing.grandTotalCost += p.grandTotalPurchaseCost;
        existing.paidAmount += p.paidAmount;
        existing.dueAmount += p.dueAmount;
      } else {
        map.set(key, {
          supplierName: p.supplierName,
          supplierPhone: p.supplierPhone,
          invoiceCount: 1,
          totalQuantity: p.purchaseQuantity,
          grandTotalCost: p.grandTotalPurchaseCost,
          paidAmount: p.paidAmount,
          dueAmount: p.dueAmount,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.grandTotalCost - a.grandTotalCost);
  }, [activePurchases]);

  // Product-Wise Aggregated Report
  const productWiseReport = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        productSku: string;
        totalQuantityBought: number;
        totalCostSpent: number;
        avgUnitCost: number;
        currentStock: number;
      }
    >();

    activePurchases.forEach((p) => {
      const key = p.productId || p.productName;
      const catalogProd = products.find(
        (cp) => cp.id === p.productId || cp.name === p.productName
      );
      const existing = map.get(key);
      if (existing) {
        existing.totalQuantityBought += p.purchaseQuantity;
        existing.totalCostSpent += p.grandTotalPurchaseCost;
        existing.avgUnitCost = Math.round(
          existing.totalCostSpent / Math.max(1, existing.totalQuantityBought)
        );
      } else {
        map.set(key, {
          productId: p.productId,
          productName: p.productName,
          productSku: p.productSku,
          totalQuantityBought: p.purchaseQuantity,
          totalCostSpent: p.grandTotalPurchaseCost,
          avgUnitCost: Math.round(p.grandTotalPurchaseCost / Math.max(1, p.purchaseQuantity)),
          currentStock: typeof catalogProd?.stock === 'number' ? catalogProd.stock : p.purchaseQuantity,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalCostSpent - a.totalCostSpent);
  }, [activePurchases, products]);

  // Export Purchases to Excel / CSV
  const handleExportPurchasesCSV = () => {
    let csv = '\uFEFF';
    csv += 'Dokandari.com — ক্রয় ব্যবস্থাপনা ও স্টক রিপোর্ট (Purchase Management Report)\n';
    csv += `রিপোর্ট তৈরির তারিখ:,${todayStr}\n\n`;
    csv +=
      'ইনভয়েস নং,ক্রয়ের তারিখ,সাপ্লায়ারের নাম,সাপ্লায়ার ফোন,পণ্যের নাম,SKU,পরিমাণ (Qty),একক ক্রয়মূল্য (৳),মোট ক্রয়মূল্য (৳),পরিবহন খরচ (৳),অন্যান্য খরচ (৳),সর্বমোট খরচ (Grand Total ৳),পরিশোধিত (Paid ৳),বাকি (Due ৳),পেমেন্ট মাধ্যম,স্ট্যাটাস,নোট\n';

    purchases.forEach((p) => {
      csv += `"${p.invoiceNumber}","${p.purchaseDate}","${p.supplierName.replace(
        /,/g,
        ' '
      )}","${p.supplierPhone}","${p.productName.replace(/,/g, ' ')}","${p.productSku}",${
        p.purchaseQuantity
      },${p.unitPurchasePrice},${p.totalPurchaseAmount},${p.transportCost},${p.otherExpenses},${
        p.grandTotalPurchaseCost
      },${p.paidAmount},${p.dueAmount},"${p.paymentMethod}","${p.status}","${(p.notes || '').replace(
        /,/g,
        ' '
      )}"\n`;
    });

    csv += `\nআজকের মোট ক্রয়:,${reportStats.todayTotal}\n`;
    csv += `মাসিক মোট ক্রয়:,${reportStats.monthlyTotal}\n`;
    csv += `বার্ষিক মোট ক্রয়:,${reportStats.yearlyTotal}\n`;
    csv += `মোট ক্রয় পরিমাণ (Qty):,${reportStats.totalQty}\n`;
    csv += `মোট পরিশোধিত টাকা (Paid):,${reportStats.totalPaid}\n`;
    csv += `মোট বাকি টাকা (Due):,${reportStats.totalDue}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dokandari_Purchase_Report_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onFeedback('📥 সম্পূর্ণ ক্রয় ও সাপ্লায়ার রিপোর্ট Excel/CSV ফাইলে ডাউনলোড হয়েছে!');
  };

  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const q = searchQuery.toLowerCase();
    return purchases.filter(
      (p) =>
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        p.supplierPhone.includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        p.productSku.toLowerCase().includes(q)
    );
  }, [purchases, searchQuery]);

  return (
    <div className="bg-white rounded-3xl border border-rose-200 p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rose-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[#E11D48] text-[11px] font-extrabold mb-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>মডিউল #১৭ • ক্রয় ও ইনভেন্টরি স্টক ম্যানেজমেন্ট (Purchase Management)</span>
          </div>
          <h3 className="text-base sm:text-xl font-black text-stone-900">
            পণ্য ক্রয় ও সাপ্লায়ার হিসাব ব্যবস্থাপনা (China / Bangladesh Sourcing & Stock)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            চায়না, আলিবাবা বা বাংলাদেশ থেকে কেনা প্রতিটি পণ্যের ক্রয়মূল্য, পরিবহন খরচ, পরিশোধিত ও বাকি টাকা এবং অটো-স্টক ইনভেন্টরি হিসাব।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (editingPurchase) resetForm();
              setShowEntryForm((prev) => !prev);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{showEntryForm ? 'ক্রয় ফর্ম সংকুচিত করুন' : '+ নতুন পণ্য ক্রয় এন্ট্রি করুন'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPurchasesCSV}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / CSV এক্সপোর্ট</span>
          </button>
        </div>
      </div>

      {/* 6 SUMMARY REPORT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 space-y-1">
          <span className="text-[10.5px] font-extrabold text-rose-800 block">আজকের মোট ক্রয়</span>
          <div className="text-base sm:text-lg font-black font-mono text-[#E11D48]">
            ৳{reportStats.todayTotal.toLocaleString()}
          </div>
          <span className="text-[10px] text-rose-600 block">Today&apos;s Purchase</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-1">
          <span className="text-[10.5px] font-extrabold text-blue-800 block">মাসিক মোট ক্রয়</span>
          <div className="text-base sm:text-lg font-black font-mono text-blue-950">
            ৳{reportStats.monthlyTotal.toLocaleString()}
          </div>
          <span className="text-[10px] text-blue-600 block">Monthly Purchase</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200 space-y-1">
          <span className="text-[10.5px] font-extrabold text-purple-800 block">বার্ষিক মোট ক্রয়</span>
          <div className="text-base sm:text-lg font-black font-mono text-purple-950">
            ৳{reportStats.yearlyTotal.toLocaleString()}
          </div>
          <span className="text-[10px] text-purple-600 block">Yearly Purchase</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 space-y-1">
          <span className="text-[10.5px] font-extrabold text-teal-800 block">মোট ক্রয় পরিমাণ</span>
          <div className="text-base sm:text-lg font-black font-mono text-teal-950">
            {reportStats.totalQty.toLocaleString()} টি
          </div>
          <span className="text-[10px] text-teal-700 block">Total Stock Bought</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-300 space-y-1">
          <span className="text-[10.5px] font-extrabold text-emerald-800 block">মোট পরিশোধিত টাকা</span>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-900">
            ৳{reportStats.totalPaid.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-700 block">Total Paid Amount</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 space-y-1">
          <span className="text-[10.5px] font-extrabold text-amber-900 block">মোট বাকি টাকা (Due)</span>
          <div className="text-base sm:text-lg font-black font-mono text-amber-950">
            ৳{reportStats.totalDue.toLocaleString()}
          </div>
          <span className="text-[10px] text-amber-800 block">Supplier Payable Due</span>
        </div>
      </div>

      {/* NEW PURCHASE ENTRY FORM */}
      {showEntryForm && (
        <form
          onSubmit={handleSavePurchase}
          className="p-5 rounded-3xl bg-[#FFF8F9] border-2 border-rose-200 space-y-4 text-xs"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-rose-200">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#E11D48]" />
              <h4 className="text-sm font-black text-stone-900">
                {editingPurchase
                  ? `✏️ ক্রয় এন্ট্রি এডিট করুন (#${editingPurchase.invoiceNumber})`
                  : '📝 নতুন পণ্য ক্রয় এন্ট্রি ফর্ম (New Purchase Entry)'}
              </h4>
            </div>
            <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
              কনফার্ম করলে অটোমেটিক স্টকে যোগ হবে
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Purchase Date */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ১. ক্রয়ের তারিখ (Purchase Date) *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            {/* 2. Supplier Name */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ২. সাপ্লায়ারের নাম (China / BD Supplier) *
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="যেমন: Alibaba Guangzhou / চকবাজার ট্রেডার্স"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold"
              />
            </div>

            {/* 3. Supplier Phone */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ৩. সাপ্লায়ার মোবাইল / WeChat (Supplier Phone)
              </label>
              <input
                type="text"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="01XXXXXXXXX বা +86..."
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono"
              />
            </div>

            {/* 4. Invoice Number */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ৪. ইনভয়েস নম্বর (Invoice Number) *
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="PUR-10025"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48]"
              />
            </div>

            {/* 5. Product Selection */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-stone-700 mb-1">
                ৫. প্রোডাক্ট নির্বাচন করুন (Product Name) *
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold text-stone-900"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (বর্তমান স্টক: {typeof p.stock === 'number' ? p.stock : 15}টি | বিক্রয়মূল্য: ৳{p.price})
                  </option>
                ))}
                <option value="custom">+ নতুন বা কাস্টম প্রোডাক্টের নাম লিখুন</option>
              </select>
            </div>

            {selectedProductId === 'custom' && (
              <div>
                <label className="block font-bold text-stone-700 mb-1">কাস্টম প্রোডাক্টের নাম *</label>
                <input
                  type="text"
                  required
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                  placeholder="প্রোডাক্টের নাম লিখুন..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold"
                />
              </div>
            )}

            {/* 6. Product SKU */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">৬. প্রোডাক্ট SKU / কোড</label>
              <input
                type="text"
                value={productSku}
                onChange={(e) => setProductSku(e.target.value)}
                placeholder="DKD-SKU-101"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            {/* 7. Purchase Quantity */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ৭. ক্রয়ের পরিমাণ (Purchase Quantity) *
              </label>
              <input
                type="number"
                required
                min={1}
                value={purchaseQuantity}
                onChange={(e) => setPurchaseQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-black text-stone-900"
              />
            </div>

            {/* 8. Unit Purchase Price */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ৮. একক ক্রয়মূল্য (Unit Purchase Price ৳) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={unitPurchasePrice}
                onChange={(e) => setUnitPurchasePrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-black text-[#E11D48]"
              />
            </div>

            {/* 9. Total Purchase Amount (Auto Calculated) */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ৯. পণ্যের মোট ক্রয়মূল্য (Qty × Unit Price)
              </label>
              <div className="w-full px-3 py-2 bg-stone-100 border border-stone-300 rounded-xl font-mono font-black text-stone-900">
                ৳{totalPurchaseAmount.toLocaleString()}
              </div>
            </div>

            {/* 10. Transport Cost */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ১০. পরিবহন ও শিপিং খরচ (Transport Cost ৳)
              </label>
              <input
                type="number"
                min={0}
                value={transportCost}
                onChange={(e) => setTransportCost(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            {/* 11. Other Expenses */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ১১. কাস্টমস / লেবার / অন্যান্য খরচ (Other ৳)
              </label>
              <input
                type="number"
                min={0}
                value={otherExpenses}
                onChange={(e) => setOtherExpenses(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            {/* 12. Grand Total Purchase Cost (Auto Calculated) */}
            <div>
              <label className="block font-extrabold text-[#E11D48] mb-1">
                ১২. সর্বমোট ক্রয় খরচ (Grand Total Cost)
              </label>
              <div className="w-full px-3 py-2 bg-rose-100/80 border-2 border-rose-300 rounded-xl font-mono font-black text-[#E11D48] text-sm">
                ৳{grandTotalPurchaseCost.toLocaleString()}
              </div>
            </div>

            {/* 13. Paid Amount */}
            <div>
              <label className="block font-bold text-emerald-800 mb-1">
                ১৩. পরিশোধিত টাকা (Paid Amount ৳)
              </label>
              <input
                type="number"
                min={0}
                value={paidAmount}
                onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-xl font-mono font-black text-emerald-800"
              />
            </div>

            {/* 14. Due Amount (Auto Calculated) */}
            <div>
              <label className="block font-bold text-amber-900 mb-1">
                ১৪. সাপ্লায়ারের বাকি টাকা (Due Amount ৳)
              </label>
              <div className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl font-mono font-black text-amber-900">
                ৳{dueAmount.toLocaleString()}
              </div>
            </div>

            {/* 15. Payment Method */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ১৫. পেমেন্ট মাধ্যম (Payment Method)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold"
              >
                <option value="Cash">ক্যাশ (Cash)</option>
                <option value="bKash">বিকাশ (bKash)</option>
                <option value="Nagad">নগদ (Nagad)</option>
                <option value="Bank Transfer">ব্যাংক ট্রান্সফার (Bank Transfer)</option>
                <option value="Alipay / RMB">আলিপে / চায়না RMB (Alipay / RMB)</option>
                <option value="LC / TT">এলসি / টিটি (LC / TT)</option>
                <option value="Due / Credit">বাকি / ক্রেডিট (Due / Credit)</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                ক্রয় ও স্টক স্ট্যাটাস (Purchase Status)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PurchaseStatus)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold"
              >
                <option value="confirmed">✅ কনফার্মড (স্টকে অটো যোগ হবে)</option>
                <option value="pending">⏳ পেন্ডিং (পথে আছে / শিপমেন্টে)</option>
                <option value="cancelled">❌ বাতিল (স্টক থেকে বাদ যাবে)</option>
              </select>
            </div>

            {/* 16. Notes */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-stone-700 mb-1">১৬. নোট / বিবরণ (Notes)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: চায়না এয়ার কার্গো লট #৪, প্রতি পিস ল্যান্ডেড কস্ট সহ..."
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-rose-200">
            <div className="text-[11px] text-stone-600 font-medium">
              💡 <strong>স্বয়ংক্রিয় হিসাব:</strong> মোট ক্রয় ৳{totalPurchaseAmount.toLocaleString()} + পরিবহন ও অন্যান্য ৳
              {(Number(transportCost) + Number(otherExpenses)).toLocaleString()} = সর্বমোট{' '}
              <strong className="text-[#E11D48]">৳{grandTotalPurchaseCost.toLocaleString()}</strong> | পরিশোধিত:{' '}
              <strong className="text-emerald-700">৳{Number(paidAmount).toLocaleString()}</strong> | বাকি:{' '}
              <strong className="text-amber-800">৳{dueAmount.toLocaleString()}</strong>
            </div>

            <div className="flex items-center gap-2">
              {editingPurchase && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-stone-700 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-extrabold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'সেভ হচ্ছে...'
                    : editingPurchase
                    ? '✅ ক্রয় আপডেট ও স্টক সমন্বয় করুন'
                    : '✅ ক্রয় সেভ ও স্টকে যোগ করুন'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TABS FOR REPORTS: ALL ENTRIES | SUPPLIER-WISE REPORT | PRODUCT-WISE REPORT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('entries')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
              subTab === 'entries'
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>সকল ক্রয় ইনভয়েস তালিকা ({purchases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('supplier_report')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
              subTab === 'supplier_report'
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>সাপ্লায়ার ভিত্তিক ক্রয় রিপোর্ট ({supplierWiseReport.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('product_report')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
              subTab === 'product_report'
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>পণ্য ভিত্তিক ক্রয় ও স্টক রিপোর্ট ({productWiseReport.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ইনভয়েস, সাপ্লায়ার বা পণ্য খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48]"
          />
        </div>
      </div>

      {/* VIEW 1: ALL PURCHASE ENTRIES TABLE */}
      {subTab === 'entries' && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-rose-50/70 text-[11px] uppercase font-extrabold text-stone-700 border-b border-rose-100">
              <tr>
                <th className="p-3.5">ইনভয়েস ও তারিখ</th>
                <th className="p-3.5">সাপ্লায়ার (China / BD)</th>
                <th className="p-3.5">পণ্য ও SKU</th>
                <th className="p-3.5 text-center">পরিমাণ ও দর</th>
                <th className="p-3.5 text-right">সর্বমোট খরচ</th>
                <th className="p-3.5 text-right">পরিশোধিত ও বাকি</th>
                <th className="p-3.5 text-center">স্টক ও স্ট্যাটাস</th>
                <th className="p-3.5 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-stone-400 text-xs">
                    এখনো কোনো ক্রয় এন্ট্রি যোগ করা হয়নি। উপরে ফর্ম পূরণ করে প্রথম ক্রয় এন্ট্রি সেভ করুন।
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((rec) => (
                  <tr key={rec.id} className="hover:bg-rose-50/30 transition-colors">
                    <td className="p-3.5 font-mono whitespace-nowrap">
                      <div className="font-black text-[#E11D48]">{rec.invoiceNumber}</div>
                      <div className="text-[10.5px] text-stone-500">{rec.purchaseDate}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-extrabold text-stone-900">{rec.supplierName}</div>
                      {rec.supplierPhone && (
                        <div className="text-[11px] font-mono text-stone-500">{rec.supplierPhone}</div>
                      )}
                    </td>

                    <td className="p-3.5 max-w-xs">
                      <div className="font-bold text-stone-900 line-clamp-1">{rec.productName}</div>
                      <div className="text-[10.5px] font-mono text-stone-500">SKU: {rec.productSku}</div>
                    </td>

                    <td className="p-3.5 text-center font-mono whitespace-nowrap">
                      <div className="font-black text-stone-900">{rec.purchaseQuantity} টি</div>
                      <div className="text-[10.5px] text-stone-500">
                        @ ৳{rec.unitPurchasePrice.toLocaleString()}
                      </div>
                    </td>

                    <td className="p-3.5 text-right font-mono whitespace-nowrap">
                      <div className="font-black text-stone-900 text-sm">
                        ৳{rec.grandTotalPurchaseCost.toLocaleString()}
                      </div>
                      {(rec.transportCost > 0 || rec.otherExpenses > 0) && (
                        <div className="text-[10px] text-stone-500">
                          (ভাড়া/অন্যান্য: ৳{(rec.transportCost + rec.otherExpenses).toLocaleString()})
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono whitespace-nowrap">
                      <div className="text-emerald-700 font-bold">
                        জমা: ৳{rec.paidAmount.toLocaleString()} ({rec.paymentMethod})
                      </div>
                      <div
                        className={`text-[11px] font-black ${
                          rec.dueAmount > 0 ? 'text-amber-800' : 'text-stone-400'
                        }`}
                      >
                        বাকি: ৳{rec.dueAmount.toLocaleString()}
                      </div>
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap space-y-1">
                      <select
                        value={rec.status}
                        onChange={(e) =>
                          handleStatusQuickChange(rec, e.target.value as PurchaseStatus)
                        }
                        className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-[11px] font-extrabold cursor-pointer"
                      >
                        <option value="confirmed">কনফার্মড (Confirmed)</option>
                        <option value="pending">পেন্ডিং (Pending)</option>
                        <option value="cancelled">বাতিল (Cancelled)</option>
                      </select>
                      <div>
                        {rec.stockApplied ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            ✓ স্টকে +{rec.purchaseQuantity}টি যুক্ত
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-bold">
                            স্টকে যুক্ত নয়
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(rec)}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>এডিট</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoicePurchase(rec)}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>ইনভয়েস</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(rec)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ডিলিট</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: SUPPLIER-WISE PURCHASE REPORT */}
      {subTab === 'supplier_report' && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-blue-50/70 text-[11px] uppercase font-extrabold text-blue-950 border-b border-blue-100">
              <tr>
                <th className="p-3.5">সাপ্লায়ারের নাম (Supplier Name)</th>
                <th className="p-3.5">ফোন / যোগাযোগ</th>
                <th className="p-3.5 text-center">মোট ইনভয়েস</th>
                <th className="p-3.5 text-center">মোট ক্রয় পরিমাণ (Qty)</th>
                <th className="p-3.5 text-right">সর্বমোট ক্রয় (Grand Total)</th>
                <th className="p-3.5 text-right">পরিশোধিত (Paid)</th>
                <th className="p-3.5 text-right">বাকি টাকা (Due)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {supplierWiseReport.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    কোনো সাপ্লায়ার ডাটা পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                supplierWiseReport.map((sup, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/20">
                    <td className="p-3.5 font-extrabold text-stone-900">{sup.supplierName}</td>
                    <td className="p-3.5 font-mono text-stone-600">{sup.supplierPhone || '—'}</td>
                    <td className="p-3.5 text-center font-mono font-bold">{sup.invoiceCount} টি</td>
                    <td className="p-3.5 text-center font-mono font-bold">
                      {sup.totalQuantity.toLocaleString()} টি
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-stone-900">
                      ৳{sup.grandTotalCost.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      ৳{sup.paidAmount.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-amber-800">
                      ৳{sup.dueAmount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 3: PRODUCT-WISE PURCHASE REPORT */}
      {subTab === 'product_report' && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-emerald-50/70 text-[11px] uppercase font-extrabold text-emerald-950 border-b border-emerald-100">
              <tr>
                <th className="p-3.5">পণ্যের নাম (Product Name)</th>
                <th className="p-3.5">SKU কোড</th>
                <th className="p-3.5 text-center">মোট কেনা পরিমাণ (Bought Qty)</th>
                <th className="p-3.5 text-center">গড় একক ক্রয়মূল্য (Avg Cost)</th>
                <th className="p-3.5 text-right">মোট ক্রয় বিনিয়োগ (Total Cost)</th>
                <th className="p-3.5 text-center">বর্তমান অবিক্রীত স্টক</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {productWiseReport.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    কোনো পণ্য ভিত্তিক ক্রয় রিপোর্ট পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                productWiseReport.map((pr, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/20">
                    <td className="p-3.5 font-extrabold text-stone-900">{pr.productName}</td>
                    <td className="p-3.5 font-mono text-stone-600">{pr.productSku}</td>
                    <td className="p-3.5 text-center font-mono font-bold">
                      {pr.totalQuantityBought.toLocaleString()} টি
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-[#E11D48]">
                      ৳{pr.avgUnitCost.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-stone-900">
                      ৳{pr.totalCostSpent.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center font-mono font-black text-emerald-800">
                      {pr.currentStock} টি
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PURCHASE INVOICE PRINT MODAL */}
      {selectedInvoicePurchase && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-rose-200 text-xs my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-[#E11D48] font-extrabold text-[10px]">
                  PURCHASE VOUCHER / সাপ্লায়ার ক্রয় ভাউচার
                </span>
                <h3 className="text-base font-black text-stone-900 mt-1">
                  দোকানদারি (Dokandari.com) — ক্রয় ইনভয়েস #{selectedInvoicePurchase.invoiceNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoicePurchase(null)}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div>
                <span className="text-stone-500 block text-[10px] font-bold">সাপ্লায়ার তথ্য:</span>
                <div className="font-black text-stone-900 text-sm">
                  {selectedInvoicePurchase.supplierName}
                </div>
                <div className="font-mono text-stone-600">
                  {selectedInvoicePurchase.supplierPhone || 'ফোন নম্বর দেওয়া হয়নি'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-stone-500 block text-[10px] font-bold">ভাউচার ও তারিখ:</span>
                <div className="font-mono font-black text-[#E11D48]">
                  {selectedInvoicePurchase.invoiceNumber}
                </div>
                <div className="font-mono text-stone-600">{selectedInvoicePurchase.purchaseDate}</div>
              </div>
            </div>

            <div className="border border-stone-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 font-bold text-stone-700">
                  <tr>
                    <th className="p-3">পণ্যের বিবরণ ও SKU</th>
                    <th className="p-3 text-center">পরিমাণ</th>
                    <th className="p-3 text-right">একক দর</th>
                    <th className="p-3 text-right">মোট টাকা</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-stone-200">
                    <td className="p-3">
                      <div className="font-bold text-stone-900">
                        {selectedInvoicePurchase.productName}
                      </div>
                      <div className="text-[10px] font-mono text-stone-500">
                        SKU: {selectedInvoicePurchase.productSku}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      {selectedInvoicePurchase.purchaseQuantity} টি
                    </td>
                    <td className="p-3 text-right font-mono">
                      ৳{selectedInvoicePurchase.unitPurchasePrice.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      ৳{selectedInvoicePurchase.totalPurchaseAmount.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF8F9] border border-rose-200 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="font-sans text-stone-600">পণ্যের মোট ক্রয়মূল্য:</span>
                <span className="font-bold">
                  ৳{selectedInvoicePurchase.totalPurchaseAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-stone-600">পরিবহন ও শিপিং খরচ:</span>
                <span>৳{selectedInvoicePurchase.transportCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-stone-600">অন্যান্য খরচ:</span>
                <span>৳{selectedInvoicePurchase.otherExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-rose-200 text-sm font-black text-[#E11D48]">
                <span className="font-sans">সর্বমোট ক্রয় খরচ (Grand Total):</span>
                <span>৳{selectedInvoicePurchase.grandTotalPurchaseCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold">
                <span className="font-sans">
                  পরিশোধিত ({selectedInvoicePurchase.paymentMethod}):
                </span>
                <span>৳{selectedInvoicePurchase.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-900 font-black">
                <span className="font-sans">বাকি টাকা (Supplier Due):</span>
                <span>৳{selectedInvoicePurchase.dueAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট করুন (Print Invoice)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoicePurchase(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 font-bold text-stone-700 cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
