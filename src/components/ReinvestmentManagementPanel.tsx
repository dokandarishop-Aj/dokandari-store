/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  Edit3,
  Trash2,
  DollarSign,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  Search,
  Filter,
  Wallet,
  PieChart,
  Layers,
  Package,
  Calendar,
  FileText,
  Save,
  X,
  UserCheck,
  BarChart3,
} from 'lucide-react';
import {
  Product,
  Order,
  PurchaseRecord,
  CourierReturn,
  InventoryMovement,
  ReinvestmentRecord,
  ReinvestmentSourceType,
  ReinvestmentCategoryType,
  ReinvestmentStatus,
  PurchasePaymentMethod,
} from '../types';
import {
  saveReinvestmentPersisted,
  deleteReinvestmentPersisted,
  saveProductPersisted,
  recordStockMovementPersisted,
  savePurchasePersisted,
  calculateOrderFinancialBreakdown,
} from '../lib/storeSync';
import { DualHorizontalScrollWrapper } from './DualHorizontalScrollWrapper';

interface ReinvestmentManagementPanelProps {
  products: Product[];
  orders: Order[];
  purchases: PurchaseRecord[];
  courierReturns: CourierReturn[];
  reinvestments: ReinvestmentRecord[];
  onReinvestmentsChange: React.Dispatch<React.SetStateAction<ReinvestmentRecord[]>>;
  onPurchasesChange?: React.Dispatch<React.SetStateAction<PurchaseRecord[]>>;
  onUpdateProduct?: (product: Product) => void;
  onRecordMovement?: (movement: InventoryMovement) => void;
  onNavigateTool?: (toolId: string) => void;
  onFeedback?: (msg: string) => void;
}

const SOURCE_LABELS: Record<
  ReinvestmentSourceType,
  { bn: string; en: string; badge: string }
> = {
  sales_reinvestment: {
    bn: 'বিক্রয় থেকে পুনঃবিনিয়োগ',
    en: 'Sales Reinvestment',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  owner_investment: {
    bn: 'মালিকের নিজস্ব বিনিয়োগ',
    en: 'Owner Investment',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  },
  profit_reinvestment: {
    bn: 'লভ্যাংশ পুনঃবিনিয়োগ',
    en: 'Profit Reinvestment',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
  },
};

const CATEGORY_LABELS: Record<ReinvestmentCategoryType, string> = {
  product_purchase: 'নতুন পণ্য ক্রয় (Product Purchase)',
  stock_restock: 'স্টক রিস্টক (Inventory Restock)',
  marketing_ads: 'মার্কেটিং ও বিজ্ঞাপন (Marketing & Ads)',
  packaging_logistics: 'প্যাকেজিং ও লজিস্টিকস (Packaging & Logistics)',
  equipment_operations: 'অফিস ও অপারেশনস (Equipment & Operations)',
  other_growth: 'অন্যান্য ব্যবসা সম্প্রসারণ (Other Growth)',
};

const PAYMENT_METHODS: PurchasePaymentMethod[] = [
  'Cash',
  'bKash',
  'Nagad',
  'Bank Transfer',
  'Alipay / RMB',
  'LC / TT',
  'Due / Credit',
];

type SubTabId =
  | 'all_reinvestments'
  | 'sales_reinvestment'
  | 'owner_investment'
  | 'purchase_history'
  | 'profit_loss_analysis';

export const ReinvestmentManagementPanel: React.FC<ReinvestmentManagementPanelProps> = ({
  products,
  orders,
  purchases,
  courierReturns,
  reinvestments,
  onReinvestmentsChange,
  onPurchasesChange,
  onUpdateProduct,
  onRecordMovement,
  onNavigateTool,
  onFeedback,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('all_reinvestments');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | ReinvestmentSourceType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ReinvestmentCategoryType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReinvestmentStatus>('all');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReinvestmentRecord | null>(null);
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSourceType, setFormSourceType] =
    useState<ReinvestmentSourceType>('sales_reinvestment');
  const [formCategory, setFormCategory] =
    useState<ReinvestmentCategoryType>('product_purchase');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formInvestorName, setFormInvestorName] = useState<string>('মোহাম্মদ শহিদুল আলম');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PurchasePaymentMethod>('Cash');
  const [formLinkedProductId, setFormLinkedProductId] = useState<string>('');
  const [formQuantityAdded, setFormQuantityAdded] = useState<number>(0);
  const [formUnitCost, setFormUnitCost] = useState<number>(0);
  const [formExpectedRoi, setFormExpectedRoi] = useState<number>(35);
  const [formStatus, setFormStatus] = useState<ReinvestmentStatus>('completed');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formSyncToPurchaseHistory, setFormSyncToPurchaseHistory] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const notify = (msg: string) => {
    if (onFeedback) onFeedback(msg);
  };

  // Financial & P&L Live Aggregations
  const financialAnalytics = useMemo(() => {
    const activeReinvestments = reinvestments.filter((r) => r.status !== 'cancelled');
    const completedReinvestments = reinvestments.filter((r) => r.status === 'completed');

    const totalReinvestment = activeReinvestments.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0
    );
    const salesReinvestmentTotal = activeReinvestments
      .filter((r) => r.sourceType === 'sales_reinvestment' || r.sourceType === 'profit_reinvestment')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const ownerInvestmentTotal = activeReinvestments
      .filter((r) => r.sourceType === 'owner_investment')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const activePurchases = purchases.filter((p) => p.status !== 'cancelled');
    const totalPurchaseHistoryCost = activePurchases.reduce(
      (sum, p) => sum + (Number(p.grandTotalPurchaseCost) || 0),
      0
    );
    const totalPurchaseUnits = activePurchases.reduce(
      (sum, p) => sum + (Number(p.purchaseQuantity) || 0),
      0
    );
    const totalPurchasePaid = activePurchases.reduce(
      (sum, p) => sum + (Number(p.paidAmount) || 0),
      0
    );
    const totalPurchaseDue = activePurchases.reduce(
      (sum, p) => sum + (Number(p.dueAmount) || 0),
      0
    );

    const reinvestmentProductSpend = activeReinvestments
      .filter((r) => r.category === 'product_purchase' || r.category === 'stock_restock')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // Avoid double counting if a reinvestment record is linked to a purchase record
    const unlinkedPurchasesCost = activePurchases
      .filter((p) => !activeReinvestments.some((r) => r.linkedPurchaseId === p.id))
      .reduce((sum, p) => sum + (Number(p.grandTotalPurchaseCost) || 0), 0);

    const combinedInventoryInvestment = reinvestmentProductSpend + unlinkedPurchasesCost;

    // Orders & Realized Sales P&L
    let deliveredRevenue = 0;
    let pipelineOrderValue = 0;
    let totalDeliveredCogs = 0;
    let totalCourierAndPackaging = 0;
    let totalReturnLoss = 0;
    let realizedNetOrderProfit = 0;
    let expectedPipelineProfit = 0;
    let deliveredCount = 0;
    let returnedCount = 0;

    for (const ord of orders) {
      const fin = calculateOrderFinancialBreakdown(ord, products);
      if (ord.status === 'delivered') {
        deliveredCount += 1;
        deliveredRevenue += Number(ord.total) || 0;
        totalDeliveredCogs += fin.cogsTotal;
        totalCourierAndPackaging +=
          fin.courierExpense + fin.packagingCost + fin.otherOrderExpense;
        realizedNetOrderProfit += fin.netOrderProfit;
      } else if (ord.status === 'returned') {
        returnedCount += 1;
        totalReturnLoss += Math.abs(fin.netOrderProfit);
        realizedNetOrderProfit += fin.netOrderProfit;
      } else if (ord.status !== 'cancelled') {
        pipelineOrderValue += Number(ord.total) || 0;
        expectedPipelineProfit += fin.expectedProfit;
      }
    }

    // Current Inventory Asset Valuation
    const currentInventoryCostValue = products.reduce((sum, p) => {
      const stk = Math.max(0, Number(p.stock) ?? 25);
      const unitCost =
        typeof p.costPrice === 'number' && p.costPrice > 0
          ? p.costPrice
          : Math.round((Number(p.price) || 0) * 0.55);
      return sum + stk * unitCost;
    }, 0);

    const currentInventoryRetailValue = products.reduce((sum, p) => {
      const stk = Math.max(0, Number(p.stock) ?? 25);
      return sum + stk * (Number(p.price) || 0);
    }, 0);

    const totalCapitalDeployed = totalReinvestment + unlinkedPurchasesCost;
    const roiPercent =
      totalCapitalDeployed > 0
        ? Math.round((realizedNetOrderProfit / totalCapitalDeployed) * 1000) / 10
        : 0;

    const availableSalesPoolForReinvestment = Math.max(
      0,
      deliveredRevenue - salesReinvestmentTotal
    );

    return {
      totalReinvestment,
      salesReinvestmentTotal,
      ownerInvestmentTotal,
      totalPurchaseHistoryCost,
      totalPurchaseUnits,
      totalPurchasePaid,
      totalPurchaseDue,
      combinedInventoryInvestment,
      deliveredRevenue,
      pipelineOrderValue,
      totalDeliveredCogs,
      totalCourierAndPackaging,
      totalReturnLoss,
      realizedNetOrderProfit,
      expectedPipelineProfit,
      deliveredCount,
      returnedCount,
      currentInventoryCostValue,
      currentInventoryRetailValue,
      totalCapitalDeployed,
      roiPercent,
      availableSalesPoolForReinvestment,
      completedCount: completedReinvestments.length,
    };
  }, [reinvestments, purchases, orders, products]);

  // Filtered Reinvestment List
  const filteredReinvestments = useMemo(() => {
    return reinvestments.filter((rec) => {
      if (sourceFilter !== 'all' && rec.sourceType !== sourceFilter) return false;
      if (categoryFilter !== 'all' && rec.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (rec.title || '').toLowerCase().includes(q);
        const matchInvestor = (rec.investorName || '').toLowerCase().includes(q);
        const matchProd = (rec.linkedProductName || '').toLowerCase().includes(q);
        const matchNotes = (rec.notes || '').toLowerCase().includes(q);
        const matchId = (rec.id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchInvestor && !matchProd && !matchNotes && !matchId) {
          return false;
        }
      }
      return true;
    });
  }, [reinvestments, sourceFilter, categoryFilter, statusFilter, searchTerm]);

  const openAddModal = (presetSource?: ReinvestmentSourceType, presetCat?: ReinvestmentCategoryType) => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTitle('');
    setFormSourceType(presetSource || 'sales_reinvestment');
    setFormCategory(presetCat || 'product_purchase');
    setFormAmount(0);
    setFormInvestorName(
      presetSource === 'owner_investment' ? 'মোহাম্মদ শহিদুল আলম (Owner)' : 'Dokandari Sales Fund'
    );
    setFormPaymentMethod('Cash');
    setFormLinkedProductId('');
    setFormQuantityAdded(0);
    setFormUnitCost(0);
    setFormExpectedRoi(35);
    setFormStatus('completed');
    setFormNotes('');
    setFormSyncToPurchaseHistory(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rec: ReinvestmentRecord) => {
    setEditingRecord(rec);
    setFormDate(rec.date || new Date().toISOString().slice(0, 10));
    setFormTitle(rec.title || '');
    setFormSourceType(rec.sourceType || 'sales_reinvestment');
    setFormCategory(rec.category || 'product_purchase');
    setFormAmount(Number(rec.amount) || 0);
    setFormInvestorName(rec.investorName || 'মোহাম্মদ শহিদুল আলম');
    setFormPaymentMethod(rec.paymentMethod || 'Cash');
    setFormLinkedProductId(rec.linkedProductId || '');
    setFormQuantityAdded(Number(rec.quantityAdded) || 0);
    setFormUnitCost(Number(rec.unitCost) || 0);
    setFormExpectedRoi(Number(rec.expectedRoiPercent) || 30);
    setFormStatus(rec.status || 'completed');
    setFormNotes(rec.notes || '');
    setFormSyncToPurchaseHistory(Boolean(rec.linkedPurchaseId));
    setIsModalOpen(true);
  };

  const handleProductSelectionChange = (prodId: string) => {
    setFormLinkedProductId(prodId);
    if (!prodId) return;
    const found = products.find((p) => p.id === prodId);
    if (found) {
      const defaultUnitCost =
        typeof found.costPrice === 'number' && found.costPrice > 0
          ? found.costPrice
          : Math.round((Number(found.price) || 0) * 0.55);
      setFormUnitCost(defaultUnitCost);
      const qty = formQuantityAdded > 0 ? formQuantityAdded : 10;
      setFormQuantityAdded(qty);
      setFormAmount(qty * defaultUnitCost);
      if (!formTitle.trim()) {
        setFormTitle(`${found.name} — রিস্টক ও পুনঃবিনিয়োগ (${qty} পিস)`);
      }
    }
  };

  const handleQtyOrCostChange = (nextQty: number, nextUnitCost: number) => {
    setFormQuantityAdded(nextQty);
    setFormUnitCost(nextUnitCost);
    if (nextQty > 0 && nextUnitCost > 0) {
      setFormAmount(nextQty * nextUnitCost);
    }
  };

  const handleSaveReinvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = Math.max(0, Number(formAmount) || 0);
    if (!formTitle.trim() || cleanAmount <= 0) {
      notify('⚠️ অনুগ্রহ করে পুনঃবিনিয়োগের শিরোনাম এবং সঠিক টাকার পরিমাণ (৳) লিখুন।');
      return;
    }

    setIsSaving(true);
    try {
      const now = Date.now();
      const recordId = editingRecord?.id || `reinv-${now}`;
      const matchedProduct = formLinkedProductId
        ? products.find((p) => p.id === formLinkedProductId)
        : undefined;

      let shouldApplyStock = Boolean(editingRecord?.stockApplied);
      let linkedPurchaseId = editingRecord?.linkedPurchaseId;

      // Apply automatic product stock increment if completed, linked to a product, and not yet applied
      const isInventoryCategory =
        formCategory === 'product_purchase' || formCategory === 'stock_restock';

      if (
        matchedProduct &&
        isInventoryCategory &&
        formQuantityAdded > 0 &&
        formStatus === 'completed' &&
        !shouldApplyStock
      ) {
        const prevStock = typeof matchedProduct.stock === 'number' ? matchedProduct.stock : 25;
        const newStock = prevStock + Number(formQuantityAdded);
        const updatedProd: Product = {
          ...matchedProduct,
          stock: newStock,
          inStock: newStock > 0,
          costPrice:
            formUnitCost > 0
              ? Number(formUnitCost)
              : matchedProduct.costPrice || Math.round((matchedProduct.price || 0) * 0.55),
          updatedAt: now,
        };
        await saveProductPersisted(updatedProd);
        if (onUpdateProduct) onUpdateProduct(updatedProd);

        const movement: InventoryMovement = {
          id: `mov-reinv-${recordId}`,
          productId: matchedProduct.id,
          productName: matchedProduct.name,
          sku: matchedProduct.sku || matchedProduct.id,
          type: 'purchase_stock_in',
          quantity: Number(formQuantityAdded),
          previousStock: prevStock,
          newStock,
          referenceId: recordId,
          notes: `#১৯ পুনঃবিনিয়োগ স্টক ইন: ${formTitle.trim()} (+${formQuantityAdded} পিস)`,
          createdAt: now,
        };
        await recordStockMovementPersisted(movement);
        if (onRecordMovement) onRecordMovement(movement);
        shouldApplyStock = true;
      }

      // Optionally sync to Purchase History (#17) so Purchase History shows this restock automatically
      if (
        matchedProduct &&
        isInventoryCategory &&
        formQuantityAdded > 0 &&
        formSyncToPurchaseHistory &&
        formStatus !== 'cancelled'
      ) {
        const purId = linkedPurchaseId || `pur-reinv-${now}`;
        linkedPurchaseId = purId;
        const unitCostVal =
          formUnitCost > 0
            ? Number(formUnitCost)
            : Math.round(cleanAmount / Math.max(1, Number(formQuantityAdded)));
        const purchaseRec: PurchaseRecord = {
          id: purId,
          purchaseDate: formDate,
          supplierName: `${SOURCE_LABELS[formSourceType].bn} (${formInvestorName || 'Admin'})`,
          supplierPhone: '',
          invoiceNumber: `REINV-${recordId.slice(-6).toUpperCase()}`,
          productId: matchedProduct.id,
          productName: matchedProduct.name,
          productSku: matchedProduct.sku || matchedProduct.id,
          purchaseQuantity: Number(formQuantityAdded),
          unitPurchasePrice: unitCostVal,
          totalPurchaseAmount: cleanAmount,
          transportCost: 0,
          otherExpenses: 0,
          grandTotalPurchaseCost: cleanAmount,
          paidAmount: formPaymentMethod === 'Due / Credit' ? 0 : cleanAmount,
          dueAmount: formPaymentMethod === 'Due / Credit' ? cleanAmount : 0,
          paymentMethod: formPaymentMethod,
          notes: `[#১৯ পুনঃবিনিয়োগ] ${formTitle.trim()} ${formNotes ? `— ${formNotes}` : ''}`,
          status: formStatus === 'completed' ? 'confirmed' : 'pending',
          stockApplied: shouldApplyStock,
          createdAt: editingRecord?.createdAt || now,
          updatedAt: now,
        };
        const savedPur = await savePurchasePersisted(purchaseRec);
        if (onPurchasesChange) {
          onPurchasesChange((prev) => [
            savedPur,
            ...prev.filter((p) => p.id !== savedPur.id),
          ]);
        }
      }

      const newRecord: ReinvestmentRecord = {
        id: recordId,
        date: formDate,
        title: formTitle.trim(),
        sourceType: formSourceType,
        category: formCategory,
        amount: cleanAmount,
        investorName: formInvestorName.trim() || 'মোহাম্মদ শহিদুল আলম',
        paymentMethod: formPaymentMethod,
        linkedProductId: matchedProduct?.id || undefined,
        linkedProductName: matchedProduct?.name || undefined,
        linkedPurchaseId: linkedPurchaseId || undefined,
        quantityAdded: formQuantityAdded > 0 ? Number(formQuantityAdded) : undefined,
        unitCost: formUnitCost > 0 ? Number(formUnitCost) : undefined,
        expectedRoiPercent: Number(formExpectedRoi) || 0,
        status: formStatus,
        stockApplied: shouldApplyStock,
        notes: formNotes.trim(),
        createdAt: editingRecord?.createdAt || now,
        updatedAt: now,
      };

      const saved = await saveReinvestmentPersisted(newRecord);
      onReinvestmentsChange((prev) =>
        [saved, ...prev.filter((r) => r.id !== saved.id)].sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        )
      );

      setIsModalOpen(false);
      setEditingRecord(null);
      notify(
        editingRecord
          ? `✅ পুনঃবিনিয়োগ এন্ট্রি "${saved.title}" (৳${saved.amount.toLocaleString()}) সফলভাবে ডাটাবেজে আপডেট হয়েছে!`
          : `✅ নতুন পুনঃবিনিয়োগ "${saved.title}" (৳${saved.amount.toLocaleString()}) সফলভাবে ডাটাবেজে সেভ হয়েছে!`
      );
    } catch (err) {
      console.error('Reinvestment save error:', err);
      notify('⚠️ পুনঃবিনিয়োগ সেভ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReinvestment = async (rec: ReinvestmentRecord) => {
    setDeletingId(rec.id);
    try {
      await deleteReinvestmentPersisted(rec.id);
      onReinvestmentsChange((prev) => prev.filter((r) => r.id !== rec.id));
      notify(`🗑️ পুনঃবিনিয়োগ রেকর্ড "${rec.title}" (৳${rec.amount.toLocaleString()}) ডিলিট করা হয়েছে।`);
    } catch (err) {
      console.error('Delete reinvestment error:', err);
      notify('⚠️ ডিলিট করতে সমস্যা হয়েছে।');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6" id="reinvestment-management-hub">
      {/* Top Executive Header Banner for Category #19 */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-stone-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg border-2 border-teal-500/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-teal-400/20 border border-teal-300/40 text-teal-200 text-xs font-extrabold flex items-center gap-1.5">
                <span>১৯ নম্বর ঘর • Category #19</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>লাইভ ফায়ারবেস ডাটাবেজ সংযুক্ত (reinvestments)</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              ১৯ • Reinvestment Management (পুনরায় বিনিয়োগ ব্যবস্থাপনা)
            </h2>
            <p className="text-xs sm:text-sm text-teal-100/90 max-w-3xl leading-relaxed">
              বিক্রয় লভ্যাংশ থেকে পুনঃবিনিয়োগ (Sales Reinvestment), মালিকের নিজস্ব মূলধন (Owner Investment), পণ্য ক্রয় হিস্ট্রি (Purchase History) এবং সম্পূর্ণ লাভ-ক্ষতি ও ROI বিশ্লেষণ (Profit & Loss Analysis) — সবকিছু এক জায়গায় রিয়েল-টাইম ডাটাবেজে নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openAddModal('sales_reinvestment', 'product_purchase')}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ নতুন পুনঃবিনিয়োগ যুক্ত করুন</span>
            </button>

            <button
              type="button"
              onClick={() => openAddModal('owner_investment', 'stock_restock')}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-teal-300" />
              <span>+ মালিকের মূলধন জমা</span>
            </button>
          </div>
        </div>

        {/* 6 Live Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-teal-200 text-[11px] font-bold mb-1">
              <span>মোট পুনঃবিনিয়োগ</span>
              <RefreshCw className="w-3.5 h-3.5 text-teal-300" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-white">
              ৳{financialAnalytics.totalReinvestment.toLocaleString()}
            </div>
            <div className="text-[10px] text-teal-200/80 mt-0.5">
              মোট {reinvestments.length}টি রেকর্ড
            </div>
          </div>

          <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-emerald-200 text-[11px] font-bold mb-1">
              <span>বিক্রয় পুনঃবিনিয়োগ</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-300">
              ৳{financialAnalytics.salesReinvestmentTotal.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-200/80 mt-0.5">
              Sales & Profit Rollover
            </div>
          </div>

          <div className="bg-indigo-500/15 border border-indigo-400/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-indigo-200 text-[11px] font-bold mb-1">
              <span>মালিকের নিজস্ব বিনিয়োগ</span>
              <UserCheck className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-indigo-200">
              ৳{financialAnalytics.ownerInvestmentTotal.toLocaleString()}
            </div>
            <div className="text-[10px] text-indigo-200/80 mt-0.5">
              Owner Capital Injection
            </div>
          </div>

          <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-amber-200 text-[11px] font-bold mb-1">
              <span>মোট পণ্য ক্রয় ও স্টক ইন</span>
              <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-300">
              ৳{financialAnalytics.combinedInventoryInvestment.toLocaleString()}
            </div>
            <div className="text-[10px] text-amber-200/80 mt-0.5">
              ক্রয় হিস্ট্রি: {purchases.length}টি চালান
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-teal-200 text-[11px] font-bold mb-1">
              <span>ডেলিভার্ড সেলস রেভিনিউ</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-white">
              ৳{financialAnalytics.deliveredRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-teal-200/80 mt-0.5">
              ডেলিভার্ড অর্ডার: {financialAnalytics.deliveredCount}টি
            </div>
          </div>

          <div
            className={`rounded-2xl p-3.5 border ${
              financialAnalytics.realizedNetOrderProfit >= 0
                ? 'bg-emerald-600/25 border-emerald-400/50'
                : 'bg-rose-600/25 border-rose-400/50'
            }`}
          >
            <div className="flex items-center justify-between text-white text-[11px] font-bold mb-1">
              <span>নিট লাভ-ক্ষতি ও ROI</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <div
              className={`text-lg sm:text-xl font-black font-mono ${
                financialAnalytics.realizedNetOrderProfit >= 0
                  ? 'text-emerald-300'
                  : 'text-rose-300'
              }`}
            >
              {financialAnalytics.realizedNetOrderProfit >= 0
                ? `+৳${financialAnalytics.realizedNetOrderProfit.toLocaleString()}`
                : `-৳${Math.abs(financialAnalytics.realizedNetOrderProfit).toLocaleString()}`}
            </div>
            <div className="text-[10px] text-teal-100 mt-0.5 font-bold">
              ROI: {financialAnalytics.roiPercent}% • স্টক মূল্য: ৳
              {financialAnalytics.currentInventoryCostValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs for Category #19 */}
      <div className="bg-white rounded-3xl border-2 border-rose-200 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: 'all_reinvestments',
              label: `📋 সকল বিনিয়োগ ও CRUD (${reinvestments.length})`,
            },
            {
              id: 'sales_reinvestment',
              label: '🔄 Sales Reinvestment (বিক্রয় পুনঃবিনিয়োগ)',
            },
            {
              id: 'owner_investment',
              label: '👤 Owner Investment (মালিকের মূলধন)',
            },
            {
              id: 'purchase_history',
              label: `🛒 Purchase History (ক্রয় হিস্ট্রি: ${purchases.length})`,
            },
            {
              id: 'profit_loss_analysis',
              label: '📊 Profit & Loss Analysis (লাভ-ক্ষতি বিশ্লেষণ)',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as SubTabId)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-sm'
                  : 'bg-stone-100 hover:bg-teal-50 text-stone-800 border border-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: ALL REINVESTMENTS (ADD / EDIT / DELETE CRUD TABLE)
         ===================================================================== */}
      {activeSubTab === 'all_reinvestments' && (
        <div className="bg-white rounded-3xl border-2 border-rose-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-rose-100">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                সকল পুনঃবিনিয়োগ ও মূলধন এন্ট্রি তালিকা (Add / Edit / Delete)
              </h3>
              <p className="text-xs text-stone-600">
                যেকোনো বিনিয়োগ এন্ট্রি যোগ করুন, এডিট করে পরিবর্তন করুন অথবা ডিলিট করুন — সব তথ্য সরাসরি ফায়ারবেস ডাটাবেজে আপডেট হবে।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openAddModal('sales_reinvestment', 'product_purchase')}
                className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ নতুন পুনঃবিনিয়োগ অ্যাড করুন</span>
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="শিরোনাম, প্রোডাক্ট বা বিনিয়োগকারীর নাম খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:outline-none focus:border-teal-600"
              />
            </div>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-stone-50"
            >
              <option value="all">সকল উৎস (All Sources)</option>
              <option value="sales_reinvestment">বিক্রয় থেকে পুনঃবিনিয়োগ (Sales Reinvestment)</option>
              <option value="owner_investment">মালিকের নিজস্ব বিনিয়োগ (Owner Investment)</option>
              <option value="profit_reinvestment">লভ্যাংশ পুনঃবিনিয়োগ (Profit Reinvestment)</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-stone-50"
            >
              <option value="all">সকল খাত (All Categories)</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-stone-50"
            >
              <option value="all">সকল স্ট্যাটাস (All Status)</option>
              <option value="completed">✅ সম্পন্ন (Completed)</option>
              <option value="pending">⏳ অপেক্ষমাণ (Pending)</option>
              <option value="cancelled">❌ বাতিল (Cancelled)</option>
            </select>
          </div>

          {filteredReinvestments.length === 0 ? (
            <div className="text-center py-12 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-stone-800">
                  এখনো কোনো পুনঃবিনিয়োগ রেকর্ড পাওয়া যায়নি
                </h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  বিক্রয় লভ্যাংশ থেকে পুনঃবিনিয়োগ বা মালিকের নিজস্ব মূলধন এন্ট্রি করতে নিচের বাটনে ক্লিক করুন।
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => openAddModal('sales_reinvestment', 'product_purchase')}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold cursor-pointer"
                >
                  + বিক্রয় থেকে পুনঃবিনিয়োগ যুক্ত করুন
                </button>
                <button
                  type="button"
                  onClick={() => openAddModal('owner_investment', 'stock_restock')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  + মালিকের মূলধন যুক্ত করুন
                </button>
              </div>
            </div>
          ) : (
            <DualHorizontalScrollWrapper
              dependencyKey={`${filteredReinvestments.length}-${activeSubTab}`}
            >
              <table className="w-full min-w-[980px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 border-b border-stone-200 font-extrabold">
                    <th className="py-3 px-3">তারিখ ও আইডি</th>
                    <th className="py-3 px-3">বিনিয়োগের শিরোনাম ও নোট</th>
                    <th className="py-3 px-3">উৎস (Source)</th>
                    <th className="py-3 px-3">খাত ও প্রোডাক্ট রিস্টক</th>
                    <th className="py-3 px-3">বিনিয়োগকারী ও পেমেন্ট</th>
                    <th className="py-3 px-3 text-right">পরিমাণ (৳)</th>
                    <th className="py-3 px-3 text-center">স্ট্যাটাস</th>
                    <th className="py-3 px-3 text-right">অ্যাকশন (Edit / Delete)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/80">
                  {filteredReinvestments.map((rec) => {
                    const srcMeta =
                      SOURCE_LABELS[rec.sourceType] || SOURCE_LABELS.sales_reinvestment;
                    return (
                      <tr key={rec.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="font-mono font-extrabold text-stone-900">
                            {rec.date}
                          </div>
                          <div className="text-[10px] font-mono text-stone-500">
                            #{rec.id.slice(-8)}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top max-w-[260px]">
                          <div className="font-extrabold text-stone-900 break-words">
                            {rec.title}
                          </div>
                          {rec.notes && (
                            <div className="text-[11px] text-stone-500 mt-0.5 break-words">
                              {rec.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${srcMeta.badge}`}
                          >
                            {srcMeta.bn}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="font-bold text-stone-800">
                            {CATEGORY_LABELS[rec.category] || rec.category}
                          </div>
                          {rec.linkedProductName && (
                            <div className="text-[11px] text-teal-800 font-bold mt-0.5">
                              📦 {rec.linkedProductName}
                              {rec.quantityAdded ? ` (+${rec.quantityAdded} পিস)` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="font-bold text-stone-900">{rec.investorName}</div>
                          <div className="text-[11px] text-stone-500">{rec.paymentMethod}</div>
                        </td>
                        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                          <div className="text-sm font-black font-mono text-teal-800">
                            ৳{Number(rec.amount || 0).toLocaleString()}
                          </div>
                          {rec.expectedRoiPercent ? (
                            <div className="text-[10px] text-emerald-700 font-bold">
                              প্রত্যাশিত ROI: {rec.expectedRoiPercent}%
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                              rec.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rec.status === 'completed'
                              ? '✅ সম্পন্ন'
                              : rec.status === 'pending'
                              ? '⏳ পেন্ডিং'
                              : '❌ বাতিল'}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="এডিট করুন"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === rec.id}
                              onClick={() => handleDeleteReinvestment(rec)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DualHorizontalScrollWrapper>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: SALES REINVESTMENT (বিক্রয় থেকে পুনঃবিনিয়োগ)
         ===================================================================== */}
      {activeSubTab === 'sales_reinvestment' && (
        <div className="bg-white rounded-3xl border-2 border-emerald-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                🔄 Sales Reinvestment (বিক্রয় ও লভ্যাংশ থেকে পুনঃবিনিয়োগ)
              </h3>
              <p className="text-xs text-stone-600">
                ডেলিভার্ড অর্ডারের বিক্রয়লব্ধ অর্থ এবং নিট মুনাফা থেকে কত টাকা পুনরায় প্রোডাক্ট রিস্টক ও মার্কেটিংয়ে বিনিয়োগ করা হয়েছে তার লাইভ হিসাব।
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModal('sales_reinvestment', 'product_purchase')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ বিক্রয় থেকে পুনঃবিনিয়োগ যুক্ত করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800">
                মোট ডেলিভার্ড সেলস কালেকশন
              </div>
              <div className="text-xl font-black font-mono text-emerald-950 mt-1">
                ৳{financialAnalytics.deliveredRevenue.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                {financialAnalytics.deliveredCount}টি সফল ডেলিভার্ড অর্ডার থেকে প্রাপ্ত
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200">
              <div className="text-xs font-bold text-teal-800">
                বিক্রয় থেকে মোট পুনঃবিনিয়োগকৃত অর্থ
              </div>
              <div className="text-xl font-black font-mono text-teal-950 mt-1">
                ৳{financialAnalytics.salesReinvestmentTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-teal-700 mt-1">
                পুনঃবিনিয়োগ হার:{' '}
                {financialAnalytics.deliveredRevenue > 0
                  ? Math.round(
                      (financialAnalytics.salesReinvestmentTotal /
                        financialAnalytics.deliveredRevenue) *
                        100
                    )
                  : 0}
                %
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-xs font-bold text-amber-900">
                পুনঃবিনিয়োগযোগ্য অবশিষ্ট সেলস ফান্ড
              </div>
              <div className="text-xl font-black font-mono text-amber-950 mt-1">
                ৳{financialAnalytics.availableSalesPoolForReinvestment.toLocaleString()}
              </div>
              <div className="text-[11px] text-amber-800 mt-1">
                নতুন প্রোডাক্ট সোর্সিং ও ক্যাম্পেইনের জন্য প্রস্তুত
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs sm:text-sm font-extrabold text-stone-800">
              বিক্রয় ও লভ্যাংশ পুনঃবিনিয়োগ হিস্ট্রি:
            </h4>
            {reinvestments.filter(
              (r) =>
                r.sourceType === 'sales_reinvestment' ||
                r.sourceType === 'profit_reinvestment'
            ).length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-500">
                এখনো বিক্রয় থেকে কোনো পুনঃবিনিয়োগ রেকর্ড যুক্ত করা হয়নি। উপরের বাটনে ক্লিক করে যুক্ত করুন।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reinvestments
                  .filter(
                    (r) =>
                      r.sourceType === 'sales_reinvestment' ||
                      r.sourceType === 'profit_reinvestment'
                  )
                  .map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900">
                            {rec.date}
                          </span>
                          <span className="text-[10px] font-extrabold text-emerald-800">
                            {CATEGORY_LABELS[rec.category]}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-stone-900 break-words">
                          {rec.title}
                        </div>
                        {rec.linkedProductName && (
                          <div className="text-[11px] font-bold text-teal-800">
                            📦 প্রোডাক্ট: {rec.linkedProductName}{' '}
                            {rec.quantityAdded ? `(+${rec.quantityAdded} পিস)` : ''}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1.5">
                        <div className="text-sm font-black font-mono text-emerald-800">
                          ৳{rec.amount.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReinvestment(rec)}
                            className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: OWNER INVESTMENT (মালিকের নিজস্ব মূলধন)
         ===================================================================== */}
      {activeSubTab === 'owner_investment' && (
        <div className="bg-white rounded-3xl border-2 border-indigo-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                👤 Owner Investment (মালিকের নিজস্ব মূলধন ও ক্যাপিটাল লেজার)
              </h3>
              <p className="text-xs text-stone-600">
                প্রতিষ্ঠাতা ও মালিকের নিজস্ব তহবিল থেকে ব্যবসায় যে মূলধন যোগ করা হয়েছে তার সম্পূর্ণ হিসাব ও এডিট/ডিলিট কন্ট্রোল।
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModal('owner_investment', 'product_purchase')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ মালিকের নতুন মূলধন জমা করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
              <div className="text-xs font-bold text-indigo-800">
                মালিকের মোট মূলধন বিনিয়োগ
              </div>
              <div className="text-xl font-black font-mono text-indigo-950 mt-1">
                ৳{financialAnalytics.ownerInvestmentTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-indigo-700 mt-1">
                Owner Capital Injection
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="text-xs font-bold text-stone-700">
                মোট ব্যবসায়িক মূলধন (মালিক + পুনঃবিনিয়োগ + ক্রয়)
              </div>
              <div className="text-xl font-black font-mono text-stone-900 mt-1">
                ৳{financialAnalytics.totalCapitalDeployed.toLocaleString()}
              </div>
              <div className="text-[11px] text-stone-600 mt-1">
                বর্তমান স্টক সম্পদ: ৳
                {financialAnalytics.currentInventoryCostValue.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800">
                মালিকের মূলধনের বিপরীতে অর্জিত নিট মুনাফা
              </div>
              <div className="text-xl font-black font-mono text-emerald-950 mt-1">
                {financialAnalytics.realizedNetOrderProfit >= 0
                  ? `+৳${financialAnalytics.realizedNetOrderProfit.toLocaleString()}`
                  : `-৳${Math.abs(financialAnalytics.realizedNetOrderProfit).toLocaleString()}`}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                সামগ্রিক ROI: {financialAnalytics.roiPercent}%
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs sm:text-sm font-extrabold text-stone-800">
              মালিকের মূলধন জমার তালিকা:
            </h4>
            {reinvestments.filter((r) => r.sourceType === 'owner_investment').length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-500">
                এখনো মালিকের নিজস্ব মূলধনের কোনো এন্ট্রি যুক্ত করা হয়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reinvestments
                  .filter((r) => r.sourceType === 'owner_investment')
                  .map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900">
                            {rec.date}
                          </span>
                          <span className="text-[10px] font-extrabold text-indigo-800">
                            👤 {rec.investorName}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-stone-900 break-words">
                          {rec.title}
                        </div>
                        <div className="text-[11px] text-stone-600">
                          খাত: {CATEGORY_LABELS[rec.category]} • মাধ্যম: {rec.paymentMethod}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1.5">
                        <div className="text-sm font-black font-mono text-indigo-900">
                          ৳{rec.amount.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReinvestment(rec)}
                            className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PURCHASE HISTORY (পণ্য ক্রয় ও রিস্টক হিস্ট্রি)
         ===================================================================== */}
      {activeSubTab === 'purchase_history' && (
        <div className="bg-white rounded-3xl border-2 border-amber-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                🛒 Purchase History (পণ্য ক্রয় ও স্টক রিস্টক হিস্ট্রি)
              </h3>
              <p className="text-xs text-stone-600">
                পুনঃবিনিয়োগ এবং ক্রয় ব্যবস্থাপনা (#১৭) থেকে যত পণ্য কেনা ও রিস্টক করা হয়েছে তার সমন্বিত লাইভ ডাটাবেজ রেকর্ড।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openAddModal('sales_reinvestment', 'product_purchase')}
                className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold cursor-pointer"
              >
                + পুনঃবিনিয়োগ থেকে নতুন পণ্য ক্রয়
              </button>
              {onNavigateTool && (
                <button
                  type="button"
                  onClick={() => onNavigateTool('purchase_management')}
                  className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-extrabold cursor-pointer"
                >
                  #১৭ পূর্ণাঙ্গ পণ্য ক্রয় প্যানেলে যান →
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-[11px] font-bold text-amber-900">মোট ক্রয় চালান</div>
              <div className="text-lg font-black font-mono text-stone-900 mt-0.5">
                {purchases.length}টি
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200">
              <div className="text-[11px] font-bold text-teal-900">মোট ক্রয়কৃত ইউনিট</div>
              <div className="text-lg font-black font-mono text-teal-950 mt-0.5">
                {financialAnalytics.totalPurchaseUnits.toLocaleString()} পিস
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-900">মোট পরিশোধিত (Paid)</div>
              <div className="text-lg font-black font-mono text-emerald-950 mt-0.5">
                ৳{financialAnalytics.totalPurchasePaid.toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
              <div className="text-[11px] font-bold text-rose-900">সাপ্লাইয়ার বকেয়া (Due)</div>
              <div className="text-lg font-black font-mono text-rose-900 mt-0.5">
                ৳{financialAnalytics.totalPurchaseDue.toLocaleString()}
              </div>
            </div>
          </div>

          {purchases.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-500">
              এখনো কোনো পণ্য ক্রয় হিস্ট্রি নেই। &quot;+ পুনঃবিনিয়োগ থেকে নতুন পণ্য ক্রয়&quot; বাটনে ক্লিক করে পণ্য স্টক ইন করুন।
            </div>
          ) : (
            <DualHorizontalScrollWrapper
              dependencyKey={`${purchases.length}-${activeSubTab}`}
            >
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 border-b border-stone-200 font-extrabold">
                    <th className="py-2.5 px-3">তারিখ ও ইনভয়েস</th>
                    <th className="py-2.5 px-3">পণ্যের নাম ও SKU</th>
                    <th className="py-2.5 px-3">সাপ্লাইয়ার / উৎস</th>
                    <th className="py-2.5 px-3 text-right">পরিমাণ (Qty)</th>
                    <th className="py-2.5 px-3 text-right">একক ক্রয়মূল্য</th>
                    <th className="py-2.5 px-3 text-right">মোট ক্রয় খরচ</th>
                    <th className="py-2.5 px-3 text-right">পরিশোধ / বকেয়া</th>
                    <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/80">
                  {purchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-amber-50/30">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-stone-900">
                          {pur.purchaseDate}
                        </div>
                        <div className="text-[10px] font-mono text-stone-500">
                          {pur.invoiceNumber || pur.id.slice(-8)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-stone-900">{pur.productName}</div>
                        <div className="text-[10px] font-mono text-stone-500">
                          SKU: {pur.productSku}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-stone-800">{pur.supplierName}</div>
                        {pur.notes && (
                          <div className="text-[10px] text-stone-500 truncate max-w-[220px]">
                            {pur.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-teal-800">
                        +{pur.purchaseQuantity} পিস
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                        ৳{Number(pur.unitPurchasePrice || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-stone-900">
                        ৳{Number(pur.grandTotalPurchaseCost || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="text-emerald-700 font-bold">
                          Paid: ৳{Number(pur.paidAmount || 0).toLocaleString()}
                        </div>
                        {pur.dueAmount > 0 && (
                          <div className="text-rose-600 font-bold text-[10px]">
                            Due: ৳{Number(pur.dueAmount || 0).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            pur.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pur.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {pur.status === 'confirmed'
                            ? '✅ স্টকে যুক্ত'
                            : pur.status === 'pending'
                            ? '⏳ পেন্ডিং'
                            : '❌ বাতিল'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DualHorizontalScrollWrapper>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: PROFIT & LOSS ANALYSIS (বিনিয়োগ বনাম লাভ-ক্ষতি ও ROI বিশ্লেষণ)
         ===================================================================== */}
      {activeSubTab === 'profit_loss_analysis' && (
        <div className="bg-white rounded-3xl border-2 border-teal-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-100">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                📊 Profit & Loss Analysis (বিনিয়োগ বনাম লাভ-ক্ষতি ও ROI বিশ্লেষণ)
              </h3>
              <p className="text-xs text-stone-600">
                মোট বিনিয়োগ, বর্তমান ইনভেন্টরি স্টক ভ্যালু, ডেলিভার্ড অর্ডারের বিক্রয়, কুরিয়ার ও রিটার্ন ক্ষতি এবং নিট লাভ-ক্ষতির পূর্ণাঙ্গ আর্থিক বিবরণী।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column: Capital & Reinvestment Breakdown */}
            <div className="rounded-2xl border-2 border-stone-200 p-4 sm:p-5 space-y-3 bg-stone-50/60">
              <h4 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-teal-700" />
                <span>১. মূলধন ও পুনঃবিনিয়োগ সারসংক্ষেপ (Capital & Reinvestment)</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    বিক্রয় ও লভ্যাংশ থেকে পুনঃবিনিয়োগ (Sales Reinvestment):
                  </span>
                  <span className="font-mono font-extrabold text-emerald-800">
                    ৳{financialAnalytics.salesReinvestmentTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    মালিকের নিজস্ব মূলধন (Owner Investment):
                  </span>
                  <span className="font-mono font-extrabold text-indigo-800">
                    ৳{financialAnalytics.ownerInvestmentTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    পণ্য ক্রয় ও ইনভেন্টরি বিনিয়োগ (Purchase & Stock Investment):
                  </span>
                  <span className="font-mono font-extrabold text-amber-800">
                    ৳{financialAnalytics.combinedInventoryInvestment.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    বর্তমান গুদামজাত স্টকের ক্রয়মূল্য (Current Stock Asset Cost):
                  </span>
                  <span className="font-mono font-extrabold text-teal-800">
                    ৳{financialAnalytics.currentInventoryCostValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    বর্তমান স্টকের সম্ভাব্য বিক্রয়মূল্য (Retail Valuation):
                  </span>
                  <span className="font-mono font-extrabold text-stone-900">
                    ৳{financialAnalytics.currentInventoryRetailValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 text-sm font-black text-stone-950">
                  <span>সর্বমোট নিয়োজিত মূলধন (Total Capital Deployed):</span>
                  <span className="font-mono text-teal-800">
                    ৳{financialAnalytics.totalCapitalDeployed.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Revenue, Costs & Net Profit/Loss */}
            <div className="rounded-2xl border-2 border-stone-200 p-4 sm:p-5 space-y-3 bg-stone-50/60">
              <h4 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#E11D48]" />
                <span>২. আয়-ব্যয় ও লাভ-ক্ষতি বিবরণী (Income & P&L Statement)</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    ডেলিভার্ড অর্ডার থেকে মোট আয় ({financialAnalytics.deliveredCount}টি অর্ডার):
                  </span>
                  <span className="font-mono font-extrabold text-emerald-700">
                    +৳{financialAnalytics.deliveredRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    বিক্রিত পণ্যের ক্রয়মূল্য (Delivered COGS):
                  </span>
                  <span className="font-mono font-extrabold text-rose-700">
                    -৳{financialAnalytics.totalDeliveredCogs.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    কুরিয়ার, ডেলিভারি ও প্যাকেজিং খরচ:
                  </span>
                  <span className="font-mono font-extrabold text-rose-700">
                    -৳{financialAnalytics.totalCourierAndPackaging.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    কুরিয়ার রিটার্ন ও ড্যামেজ লস ({financialAnalytics.returnedCount}টি রিটার্ন):
                  </span>
                  <span className="font-mono font-extrabold text-rose-700">
                    -৳{financialAnalytics.totalReturnLoss.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-stone-200">
                  <span className="text-stone-700 font-bold">
                    পাইপলাইনে থাকা অর্ডারের সম্ভাব্য লাভ (Pipeline Expected Profit):
                  </span>
                  <span className="font-mono font-extrabold text-amber-700">
                    +৳{financialAnalytics.expectedPipelineProfit.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 text-sm font-black">
                  <span className="text-stone-950">
                    প্রকৃত অর্জিত নিট লাভ / ক্ষতি (Realized Net Profit / Loss):
                  </span>
                  <span
                    className={`font-mono ${
                      financialAnalytics.realizedNetOrderProfit >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {financialAnalytics.realizedNetOrderProfit >= 0
                      ? `+৳${financialAnalytics.realizedNetOrderProfit.toLocaleString()}`
                      : `-৳${Math.abs(financialAnalytics.realizedNetOrderProfit).toLocaleString()}`}{' '}
                    ({financialAnalytics.roiPercent}% ROI)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT REINVESTMENT MODAL
         ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border-2 border-teal-300 text-xs my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-extrabold">
                  १९
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                    {editingRecord
                      ? 'পুনঃবিনিয়োগ এন্ট্রি এডিট করুন (Edit Reinvestment)'
                      : 'নতুন পুনঃবিনিয়োগ বা মূলধন যুক্ত করুন (Add Reinvestment)'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Save বাটনে ক্লিক করার সাথে সাথে মূল ফায়ারবেস ডাটাবেজে স্থায়ীভাবে সংরক্ষিত হবে।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingRecord(null);
                }}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReinvestment} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    তারিখ (Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    বিনিয়োগের উৎস (Source Type) *
                  </label>
                  <select
                    value={formSourceType}
                    onChange={(e) =>
                      setFormSourceType(e.target.value as ReinvestmentSourceType)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-extrabold text-stone-900"
                  >
                    <option value="sales_reinvestment">
                      🔄 বিক্রয় থেকে পুনঃবিনিয়োগ (Sales Reinvestment)
                    </option>
                    <option value="owner_investment">
                      👤 মালিকের নিজস্ব বিনিয়োগ (Owner Investment)
                    </option>
                    <option value="profit_reinvestment">
                      💰 লভ্যাংশ পুনঃবিনিয়োগ (Profit Reinvestment)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    বিনিয়োগের খাত (Category) *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as ReinvestmentCategoryType)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-bold"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    বিনিয়োগকারী / ফান্ডের নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={formInvestorName}
                    onChange={(e) => setFormInvestorName(e.target.value)}
                    placeholder="যেমন: মোহাম্মদ শহিদুল আলম"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-bold"
                  />
                </div>
              </div>

              {/* Optional Product Link for Automatic Stock & Purchase Sync */}
              {(formCategory === 'product_purchase' ||
                formCategory === 'stock_restock') && (
                <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-3">
                  <div className="text-[11px] font-extrabold text-teal-900 flex items-center justify-between">
                    <span>📦 প্রোডাক্ট রিস্টক ও ক্রয় হিস্ট্রি অটো-সিঙ্ক (ঐচ্ছিক):</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSyncToPurchaseHistory}
                        onChange={(e) => setFormSyncToPurchaseHistory(e.target.checked)}
                        className="rounded border-teal-400"
                      />
                      <span className="text-[10.5px] text-teal-800">
                        Purchase History-তেও যুক্ত করুন
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">
                        প্রোডাক্ট সিলেক্ট করুন
                      </label>
                      <select
                        value={formLinkedProductId}
                        onChange={(e) => handleProductSelectionChange(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      >
                        <option value="">-- নির্দিষ্ট প্রোডাক্ট ছাড়া সাধারণ ক্রয় --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (স্টক: {p.stock ?? 25})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">
                        নতুন স্টক পরিমাণ (পিস)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formQuantityAdded}
                        onChange={(e) =>
                          handleQtyOrCostChange(
                            Math.max(0, Number(e.target.value) || 0),
                            formUnitCost
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">
                        একক ক্রয়মূল্য (Unit Cost ৳)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formUnitCost}
                        onChange={(e) =>
                          handleQtyOrCostChange(
                            formQuantityAdded,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                  পুনঃবিনিয়োগের শিরোনাম / বিবরণ (Title) *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="যেমন: ৫০ পিস অরিজিনাল মধু ও প্রোডাক্ট রিস্টক পুনঃবিনিয়োগ"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    মোট টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formAmount || ''}
                    onChange={(e) => setFormAmount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="5000"
                    className="w-full px-3 py-2 rounded-xl border-2 border-teal-400 bg-white font-mono font-black text-sm text-teal-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) =>
                      setFormPaymentMethod(e.target.value as PurchasePaymentMethod)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-bold"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    প্রত্যাশিত ROI (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={formExpectedRoi}
                    onChange={(e) => setFormExpectedRoi(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                    স্ট্যাটাস
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ReinvestmentStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-bold"
                  >
                    <option value="completed">✅ সম্পন্ন (Completed)</option>
                    <option value="pending">⏳ অপেক্ষমাণ (Pending)</option>
                    <option value="cancelled">❌ বাতিল (Cancelled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
                  অতিরিক্ত নোট / চালান রেফারেন্স (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="যেমন: চকবাজার পাইকারি চালান / বিকাশ পেমেন্ট ট্রানজেকশন নোট"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'ডাটাবেজে সেভ হচ্ছে...'
                      : editingRecord
                      ? '✅ পরিবর্তন ডাটাবেজে আপডেট করুন'
                      : '✅ পুনঃবিনিয়োগ ডাটাবেজে সেভ করুন'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
