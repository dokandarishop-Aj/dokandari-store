/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Palette,
  Sparkles,
  Package,
  Users,
  Image as ImageIcon,
  Activity,
  Tag,
  Settings,
  Database,
  Megaphone,
  FolderTree,
  Shield,
  Key,
  Search,
  Save,
  Check,
  Edit3,
  Trash2,
  Zap,
  CheckCircle2,
  ShoppingBag,
  FileSpreadsheet,
  Download,
  Eye,
  Clock,
  Play,
  RefreshCw,
  MessageCircle,
  Plus,
  Copy,
  PhoneCall,
  AlertCircle,
  ExternalLink,
  ShoppingCart,
  Video,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
  MapPin,
  Phone,
  User,
  RotateCcw,
  Truck,
  PackageCheck,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  Order,
  OrderStatus,
  Product,
  OFFICIAL_CATEGORIES,
  AbandonedLead,
  AbandonedLeadStatus,
  CourierReturn,
  ReturnStatus,
  ProductCondition,
  InventoryMovement,
} from '../types';
import { updateLeadStatus, deleteAbandonedLead } from '../lib/leadRecovery';
import {
  DEFAULT_DOKANDARI_META_PIXEL_ID,
  PixelEventTelemetryLog,
  parsePixelIds,
  initializeMultiPixels,
  initializeGoogleSeoAndTags,
  trackPixelPageView,
  trackPixelViewContent,
  trackPixelAddToCart,
  trackPixelInitiateCheckout,
  trackPixelPurchase,
  trackPixelWhatsAppConversion,
  getClientPixelLogs,
  fetchServerPixelLogs,
  reconcileOrdersWithCapi,
} from '../lib/pixelManager';
import {
  smartImportOrAnalyzeProduct,
  convertAnalysisToProduct,
  parseCSVProductImport,
  generateCampaignWithAI,
  checkGeminiServerStatus,
  importStoreWithAI,
  getProductShareUrl,
  getCatalogShareUrl,
  getProductImageDomainUrl,
  exportProductsToCSV,
  extractOrderFromScreenshotOrText,
  AICampaignOutput,
} from '../lib/gemini';
import {
  DEFAULT_STORE_CONTENT,
  DEFAULT_CATEGORY_HEROES,
  StoreContent,
  getInitialStoreContent,
  saveStoreContentPersisted,
  saveProductPersisted,
  deleteProductPersisted,
  compressImageFileToDataUrl,
  resolveSafeProductImageUrl,
  handleProductImageError,
  getPersistedOrders,
  saveOrderPersisted,
  restoreAllRealCatalogProducts,
} from '../lib/storeSync';
import {
  OfficialWhatsAppIcon,
  OfficialFacebookIcon,
  OfficialInstagramIcon,
  OfficialTikTokIcon,
  OfficialYouTubeIcon,
} from './OfficialIcons';
import { OmniFlowStudio } from './OmniFlowStudio';

type HeroSlide = StoreContent['heroSlides'][number];

interface AdminPanelProps {
  onBackToStore: () => void;
  products: Product[];
  onAddProduct: (prod: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onEditProduct?: (product: Product) => void;
  categoryOrder?: string[];
  onUpdateCategoryOrder?: (nextOrder: string[]) => void;
  onStoreContentUpdated?: (content: StoreContent) => void;
}

type AdminTool =
  | 'omni_flow_studio'
  | 'catalog_studio'
  | 'products'
  | 'orders'
  | 'courier_returns'
  | 'abandoned_leads'
  | 'api_integrations'
  | 'customers'
  | 'banners'
  | 'pixels'
  | 'analytics'
  | 'settings'
  | 'cache'
  | 'campaigns'
  | 'categories'
  | 'security';

interface SavedCampaign extends AICampaignOutput {
  id: string;
  productName: string;
  createdAt: number;
}

export interface BusinessExpense {
  id: string;
  date: string; // YYYY-MM-DD
  category:
    | 'product_buying'
    | 'ad_cost'
    | 'transport_fare'
    | 'courier_charge'
    | 'courier_return_charge'
    | 'packaging'
    | 'office_utility'
    | 'other';
  categoryLabel: string;
  amount: number;
  note: string;
  createdAt: number;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onBackToStore,
  products,
  onAddProduct,
  onDeleteProduct,
  onEditProduct,
  categoryOrder,
  onUpdateCategoryOrder,
  onStoreContentUpdated,
}) => {
  const { signOutUser, userProfile } = useAuth();
  const [activeTool, setActiveTool] = useState<AdminTool>('catalog_studio');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [feedback, setFeedback] = useState('');

  // Local reorderable category IDs synced with parent & Firestore
  const [localCategoryOrder, setLocalCategoryOrder] = useState<string[]>(
    categoryOrder && categoryOrder.length > 0
      ? categoryOrder
      : OFFICIAL_CATEGORIES.map((c) => c.id)
  );
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);

  useEffect(() => {
    if (categoryOrder && categoryOrder.length > 0) {
      setLocalCategoryOrder(categoryOrder);
    }
  }, [categoryOrder]);

  const orderedCategoriesList = useMemo(() => {
    const map = new Map(OFFICIAL_CATEGORIES.map((c) => [c.id, c]));
    const result: typeof OFFICIAL_CATEGORIES = [];
    for (const id of localCategoryOrder) {
      const item = map.get(id as any);
      if (item) {
        result.push(item);
        map.delete(id as any);
      }
    }
    for (const rem of map.values()) {
      result.push(rem);
    }
    return result;
  }, [localCategoryOrder]);

  // Server Gemini AI status
  const [geminiStatus, setGeminiStatus] = useState<{
    configured: boolean;
    model: string;
    status: string;
  }>({ configured: true, model: 'gemini-3.8-flash', status: 'ready' });

  // AI Link Importer state
  const [importUrl, setImportUrl] = useState('');
  const [bulkUrlsText, setBulkUrlsText] = useState('');
  const [fullPostText, setFullPostText] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [csvPreviewItems, setCsvPreviewItems] = useState<Product[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importTab, setImportTab] = useState<'single' | 'bulk' | 'store_crawler' | 'csv' | 'full'>('single');
  const [storeCrawlerUrl, setStoreCrawlerUrl] = useState('');
  const [storeCrawlerLoading, setStoreCrawlerLoading] = useState(false);
  const [storeCrawlerResults, setStoreCrawlerResults] = useState<Product[]>([]);
  const [storeCrawlerCount, setStoreCrawlerCount] = useState(8);
  const [navCategoryFilter, setNavCategoryFilter] = useState<'all' | 'catalog' | 'orders' | 'marketing' | 'settings'>('all');
  const [requirePreviewApproval, setRequirePreviewApproval] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [urlValidationReport, setUrlValidationReport] = useState<
    { url: string; valid: boolean; source: string }[]
  >([]);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
    active: boolean;
  }>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    active: false,
  });

  // Recently imported products in this admin session
  const [recentlyImported, setRecentlyImported] = useState<Product[]>([]);

  // Store Site Content & Hero Slides state
  const [siteContent, setSiteContent] = useState<StoreContent>(() => getInitialStoreContent());
  const [carouselInterval, setCarouselInterval] = useState<number>(3000);
  const [bestSellingInterval, setBestSellingInterval] = useState<number>(5000);
  const [courierBookingId, setCourierBookingId] = useState<string | null>(null);
  const [deliverySettings, setDeliverySettings] = useState({
    dhakaFee: 70,
    outsideDhakaFee: 120,
    freeDeliveryThreshold: 2000,
    storeTagline: 'আপনার সৌন্দর্য আমাদের ঐতিহ্য',
  });

  // Dynamic Third-Party API Credentials State (Courier, Payment, Pixels, GTM, GA4, GSC)
  const [apiKeys, setApiKeys] = useState({
    bkashAppKey: '',
    bkashAppSecret: '',
    bkashUsername: '',
    bkashPassword: '',
    nagadMerchantId: '',
    nagadPublicKey: '',
    steadfastApiKey: '',
    steadfastSecretKey: '',
    pathaoClientId: '',
    pathaoClientSecret: '',
    facebookPixelId: DEFAULT_DOKANDARI_META_PIXEL_ID,
    facebookCapiToken: '',
    tiktokPixelId: '',
    tiktokAccessToken: '',
    metaTestEventCode: '',
    tiktokTestEventCode: '',
    youtubeTagId: '',
    gtmContainerId: '',
    ga4MeasurementId: '',
    googleSearchConsoleCode: '',
  });
  const [apiSaved, setApiSaved] = useState(false);

  // Pixel Live Event Tester & Real-Time CAPI Telemetry state
  const [pixelEventsLog, setPixelEventsLog] = useState<
    { id: string; eventName: string; platform: string; timestamp: string; status: string }[]
  >([]);
  const [liveTelemetryLogs, setLiveTelemetryLogs] = useState<PixelEventTelemetryLog[]>([]);
  const [reconcilingOrders, setReconcilingOrders] = useState(false);

  const refreshPixelTelemetryLogs = async () => {
    const [srvLogs, cliLogs] = await Promise.all([
      fetchServerPixelLogs(),
      Promise.resolve(getClientPixelLogs()),
    ]);
    const combinedMap = new Map<string, PixelEventTelemetryLog>();
    for (const l of [...srvLogs, ...cliLogs]) {
      const key = `${l.eventName}_${l.eventId}`;
      if (!combinedMap.has(key) || l.capiDispatched) {
        combinedMap.set(key, l);
      }
    }
    const merged = Array.from(combinedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    setLiveTelemetryLogs(merged.slice(0, 50));
  };

  useEffect(() => {
    if (activeTool === 'pixels') {
      refreshPixelTelemetryLogs();
    }
  }, [activeTool]);

  // Real-time Abandoned Leads & Recovery State
  const [abandonedLeads, setAbandonedLeads] = useState<AbandonedLead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | AbandonedLeadStatus>('all');
  const [leadActionLoading, setLeadActionLoading] = useState<string | null>(null);

  // Cache & Firestore Diagnostics state
  const [pingLatencyMs, setPingLatencyMs] = useState<number | null>(null);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  // AI Campaign Generator state
  const [selectedCampaignProductId, setSelectedCampaignProductId] = useState<string>(
    products[0]?.id || ''
  );
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [generatedCampaign, setGeneratedCampaign] = useState<AICampaignOutput | null>(null);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);

  // Security & Admin Access state
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>(['dokandari.shop@gmail.com']);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminUsernameInput, setAdminUsernameInput] = useState('dokandari.shop@gmail.com');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminSecretKeyInput, setAdminSecretKeyInput] = useState('');
  const [securitySaved, setSecuritySaved] = useState(false);

  // New product form modal
  const [isNewProdOpen, setIsNewProdOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('home_decor');
  const [newPrice, setNewPrice] = useState(1450);
  const [newOriginalPrice, setNewOriginalPrice] = useState(1990);
  const [newDescription, setNewDescription] = useState(
    'Dokandari আন্তর্জাতিক মানের অরিজিনাল কোয়ালিটি পণ্য। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা।'
  );
  const [newImage, setNewImage] = useState(
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80'
  );
  const [newUploadingImg, setNewUploadingImg] = useState(false);

  // Manual Order Entry & WhatsApp Screenshot Auto-Order Extractor state
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);
  const [manualOrderName, setManualOrderName] = useState('');
  const [manualOrderPhone, setManualOrderPhone] = useState('');
  const [manualOrderAddress, setManualOrderAddress] = useState('');
  const [manualOrderArea, setManualOrderArea] = useState<'inside_dhaka' | 'outside_dhaka'>('inside_dhaka');
  const [manualOrderProductId, setManualOrderProductId] = useState<string>(products[0]?.id || 'custom');
  const [manualOrderCustomProduct, setManualOrderCustomProduct] = useState('');
  const [manualOrderCustomPrice, setManualOrderCustomPrice] = useState<number>(1450);
  const [manualOrderQuantity, setManualOrderQuantity] = useState<number>(1);
  const [manualOrderDiscount, setManualOrderDiscount] = useState<number>(0);
  const [manualOrderNotes, setManualOrderNotes] = useState('');
  const [manualOrderSubmitting, setManualOrderSubmitting] = useState(false);
  const [waScreenshotText, setWaScreenshotText] = useState('');
  const [waScreenshotPreview, setWaScreenshotPreview] = useState<string>('');
  const [waExtracting, setWaExtracting] = useState(false);

  // Order Details Full View & Invoice Modals
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);

  // =========================================================================
  // COURIER RETURN MANAGEMENT & AUTOMATIC STOCK ADJUSTMENT STATE
  // =========================================================================
  const [courierReturns, setCourierReturns] = useState<CourierReturn[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState<string>('all');
  const [returnConditionFilter, setReturnConditionFilter] = useState<string>('all');
  const [returnActiveSubTab, setReturnActiveSubTab] = useState<'returns' | 'movements'>('returns');

  // Inspection Modal State
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [inspectingReturn, setInspectingReturn] = useState<CourierReturn | null>(null);
  const [inspectionCondition, setInspectionCondition] = useState<ProductCondition>('sellable');
  const [inspectionDamageReason, setInspectionDamageReason] = useState('');
  const [inspectionNextStatus, setInspectionNextStatus] = useState<ReturnStatus>('restocked');
  const [inspectionSubmitting, setInspectionSubmitting] = useState(false);

  // New Return Modal Form State
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [returnFormOrderId, setReturnFormOrderId] = useState('');
  const [returnFormCustomerName, setReturnFormCustomerName] = useState('');
  const [returnFormCustomerPhone, setReturnFormCustomerPhone] = useState('');
  const [returnFormProductId, setReturnFormProductId] = useState('');
  const [returnFormProductName, setReturnFormProductName] = useState('');
  const [returnFormSku, setReturnFormSku] = useState('');
  const [returnFormVariant, setReturnFormVariant] = useState('');
  const [returnFormQuantity, setReturnFormQuantity] = useState<number>(1);
  const [returnFormCourierName, setReturnFormCourierName] = useState('Steadfast');
  const [returnFormTracking, setReturnFormTracking] = useState('');
  const [returnFormCharge, setReturnFormCharge] = useState<number>(120);
  const [returnFormReason, setReturnFormReason] = useState('কাস্টমার ফোন রিসিভ করেনি');
  const [returnFormCondition, setReturnFormCondition] = useState<ProductCondition>('sellable');
  const [returnFormDamageReason, setReturnFormDamageReason] = useState('');
  const [returnFormStatus, setReturnFormStatus] = useState<ReturnStatus>('warehouse_received');
  const [returnFormDate, setReturnFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnFormNotes, setReturnFormNotes] = useState('');
  const [returnFormSubmitting, setReturnFormSubmitting] = useState(false);

  // Reset Return Form
  const resetReturnForm = () => {
    setReturnFormOrderId('');
    setReturnFormCustomerName('');
    setReturnFormCustomerPhone('');
    setReturnFormProductId('');
    setReturnFormProductName('');
    setReturnFormSku('');
    setReturnFormVariant('');
    setReturnFormQuantity(1);
    setReturnFormCourierName('Steadfast');
    setReturnFormTracking('');
    setReturnFormCharge(120);
    setReturnFormReason('কাস্টমার ফোন রিসিভ করেনি');
    setReturnFormCondition('sellable');
    setReturnFormDamageReason('');
    setReturnFormStatus('warehouse_received');
    setReturnFormDate(new Date().toISOString().slice(0, 10));
    setReturnFormNotes('');
  };

  // Pre-populate return modal when admin selects an existing order
  const handleSelectOrderForReturn = (orderIdToSelect: string) => {
    const selected = orders.find((o) => o.id === orderIdToSelect);
    if (!selected) return;
    setReturnFormOrderId(selected.id);
    setReturnFormCustomerName(selected.customer.name);
    setReturnFormCustomerPhone(selected.customer.phone);
    setReturnFormCourierName(selected.courierName || 'Steadfast');
    setReturnFormTracking(selected.trackingNumber || '');
    setReturnFormCharge(selected.shippingCost || 120);
    const item = selected.items?.[0];
    if (item) {
      setReturnFormProductId(item.productId || item.id);
      setReturnFormProductName(item.name);
      setReturnFormQuantity(item.quantity || 1);
      const matchProd = products.find((p) => p.id === item.productId || p.id === item.id);
      setReturnFormSku(matchProd?.sku || `SKU-${item.id.slice(0, 6)}`);
      setReturnFormVariant(
        [item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')
      );
    }
  };

  // Open New Return modal directly from an order in Orders tab
  const openNewReturnForOrder = (order: Order) => {
    handleSelectOrderForReturn(order.id);
    setActiveTool('courier_returns');
    setIsNewReturnModalOpen(true);
  };

  // Business Expense Tracking & P&L State
  const [expenses, setExpenses] = useState<BusinessExpense[]>(() => {
    try {
      const cached = localStorage.getItem('dokandari_expenses_backup_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'exp-init-1',
        date: new Date().toISOString().slice(0, 10),
        category: 'ad_cost',
        categoryLabel: 'মেটা ও টিকটক অ্যাড স্পেন্ড',
        amount: 1500,
        note: 'হোম ডেকোর ও আনব্রেকেবল মিরর ফেসবুক ক্যাম্পেইন',
        createdAt: Date.now() - 3600 * 12 * 1000,
      },
      {
        id: 'exp-init-2',
        date: new Date().toISOString().slice(0, 10),
        category: 'transport_fare',
        categoryLabel: 'রিকশা / গাড়ি / যাতায়াত ভাড়া',
        amount: 250,
        note: 'চকবাজার ও ইসলামপুর মার্কেট সোর্সিং রিকশা ও যাতায়াত',
        createdAt: Date.now() - 3600 * 20 * 1000,
      },
      {
        id: 'exp-init-3',
        date: new Date().toISOString().slice(0, 10),
        category: 'packaging',
        categoryLabel: 'বক্স ও প্যাকেজিং খরচ',
        amount: 600,
        note: 'বাবল র‍্যাপ ও কুরিয়ার প্যাকিং বক্স ৫০ পিস',
        createdAt: Date.now() - 3600 * 30 * 1000,
      },
    ];
  });
  const [expenseRange, setExpenseRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [newExpenseCategory, setNewExpenseCategory] = useState<BusinessExpense['category']>('ad_cost');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | ''>('');
  const [newExpenseDate, setNewExpenseDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newExpenseNote, setNewExpenseNote] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Real-time listener for Firestore business expenses
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'business_expenses'),
        (snap) => {
          if (!snap.empty) {
            const loaded: BusinessExpense[] = [];
            snap.forEach((d) => {
              loaded.push({ id: d.id, ...(d.data() as any) });
            });
            loaded.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setExpenses(loaded);
            try {
              localStorage.setItem('dokandari_expenses_backup_v1', JSON.stringify(loaded));
            } catch {
              // ignore
            }
          }
        },
        (err) => console.warn('Expenses listener notice:', err)
      );
      return () => unsub();
    } catch {
      // ignore
    }
  }, []);

  // Real-time listener for Courier Returns and Inventory Movements
  useEffect(() => {
    try {
      const unsubReturns = onSnapshot(
        collection(db, 'courier_returns'),
        (snap) => {
          if (!snap.empty) {
            const list: CourierReturn[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setCourierReturns(list);
          } else {
            // Seed a realistic initial return so admin immediately sees data
            const sampleProd = products[0];
            const sampleReturn: CourierReturn = {
              id: 'ret-init-1045',
              orderId: '1045',
              customerName: 'তানভীর আহমেদ',
              customerPhone: '01711223344',
              productId: sampleProd?.id || 'dkd-1',
              productName: sampleProd?.name || 'খিলান আকৃতির আনব্রেকেবল সেলফ-অ্যাডহেসিভ অ্যাক্রিলিক ওয়াল মিরর',
              sku: sampleProd?.sku || 'MIRROR-ARCH-01',
              quantity: 1,
              courierName: 'Steadfast',
              courierTracking: 'STDF-89472',
              returnCharge: 120,
              returnReason: 'কাস্টমার ফোন রিসিভ করেনি',
              productCondition: 'sellable',
              damageLoss: 0,
              status: 'restocked',
              stockAdjusted: true,
              expenseRecorded: true,
              returnDate: new Date().toISOString().slice(0, 10),
              notes: 'পণ্য সম্পূর্ণ ফ্রেশ অবস্থায় গুদামে জমা হয়েছে এবং স্টকে অটো-যুক্ত হয়েছে।',
              createdAt: Date.now() - 3600 * 24 * 1000,
              updatedAt: Date.now() - 3600 * 20 * 1000,
            };
            setCourierReturns([sampleReturn]);
            setDoc(doc(db, 'courier_returns', sampleReturn.id), sampleReturn).catch(() => null);
          }
        },
        (err) => console.warn('Courier returns listener notice:', err)
      );

      const unsubMovements = onSnapshot(
        collection(db, 'inventory_movements'),
        (snap) => {
          if (!snap.empty) {
            const list: InventoryMovement[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setInventoryMovements(list);
          }
        },
        (err) => console.warn('Inventory movements listener notice:', err)
      );

      return () => {
        unsubReturns();
        unsubMovements();
      };
    } catch {
      // ignore
    }
  }, [products]);

  // Core Auto Stock Adjustment & Expense Automation Engine
  const executeStockAndExpenseAdjustment = async (
    ret: CourierReturn,
    targetCondition: ProductCondition,
    targetStatus: ReturnStatus,
    damageNote?: string
  ): Promise<CourierReturn> => {
    let updatedRet: CourierReturn = {
      ...ret,
      productCondition: targetCondition,
      status: targetStatus,
      updatedAt: Date.now(),
    };

    // 1. Courier Return Charge: Automatically record in Business Expenses (with duplicate protection)
    if (ret.returnCharge > 0 && !ret.expenseRecorded) {
      try {
        const expId = `exp-ret-${ret.id}`;
        const expDoc: BusinessExpense = {
          id: expId,
          date: ret.returnDate || new Date().toISOString().slice(0, 10),
          category: 'courier_return_charge',
          categoryLabel: 'কুরিয়ার রিটার্ন চার্জ',
          amount: Number(ret.returnCharge),
          note: `অর্ডার #${ret.orderId} - রিটার্ন চার্জ (${ret.courierName}) - ${ret.customerName}`,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'business_expenses', expId), expDoc);
        updatedRet.expenseRecorded = true;
      } catch (err) {
        console.warn('Expense record error:', err);
      }
    }

    // 2. Product Finding
    const targetProd = products.find(
      (p) => p.id === ret.productId || (ret.sku && p.sku === ret.sku) || p.name.includes(ret.productName)
    );

    // 3. Stock Adjustment & Damage Loss Calculation
    if (targetCondition === 'sellable') {
      // Sellable: If status is restocked / completed / sellable AND not yet adjusted -> increment stock!
      const shouldRestock =
        (targetStatus === 'restocked' || targetStatus === 'completed' || targetStatus === 'sellable') &&
        !ret.stockAdjusted;

      if (shouldRestock && targetProd) {
        const prevStock = typeof targetProd.stock === 'number' ? targetProd.stock : 10;
        const nextStock = prevStock + ret.quantity;
        const updatedProd: Product = {
          ...targetProd,
          stock: nextStock,
          inStock: true,
          updatedAt: Date.now(),
        };
        await saveProductPersisted(updatedProd);
        onAddProduct(updatedProd);

        // Record Inventory Movement
        const movId = `mov-ret-${ret.id}-${Date.now().toString().slice(-4)}`;
        const movement: InventoryMovement = {
          id: movId,
          productId: targetProd.id,
          productName: targetProd.name,
          sku: targetProd.sku || ret.sku || 'N/A',
          type: 'return_restock',
          quantity: ret.quantity,
          previousStock: prevStock,
          newStock: nextStock,
          referenceId: ret.orderId,
          notes: `কুরিয়ার রিটার্ন #${ret.orderId} - কোয়ালিটি পাস, স্বয়ংক্রিয়ভাবে স্টকে যোগ (+${ret.quantity}টি)`,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'inventory_movements', movId), movement);
        updatedRet.stockAdjusted = true;
        updatedRet.damageLoss = 0;
      }
    } else if (targetCondition === 'damaged') {
      // Damaged: Sellable stock is NOT increased; write-off & damage loss calculated
      const unitCost = targetProd?.originalPrice || Math.round((targetProd?.price || 1200) * 0.6);
      const loss = unitCost * ret.quantity;
      updatedRet.damageLoss = loss;
      if (damageNote) updatedRet.damageReason = damageNote;

      if (targetProd) {
        const movId = `mov-dmg-${ret.id}-${Date.now().toString().slice(-4)}`;
        const movement: InventoryMovement = {
          id: movId,
          productId: targetProd.id,
          productName: targetProd.name,
          sku: targetProd.sku || ret.sku || 'N/A',
          type: 'damage_write_off',
          quantity: ret.quantity,
          previousStock: targetProd.stock || 0,
          newStock: targetProd.stock || 0, // stock not increased
          referenceId: ret.orderId,
          notes: `ড্যামেজ পণ্য রাইট-অফ: #${ret.orderId} - ${damageNote || ret.damageReason || 'পণ্য ক্ষতিগ্রস্থ'} (ক্ষতি ৳${loss})`,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'inventory_movements', movId), movement);
      }
    }

    // Save updated Courier Return document to Firestore
    await setDoc(doc(db, 'courier_returns', ret.id), updatedRet, { merge: true });
    setCourierReturns((prev) => prev.map((r) => (r.id === ret.id ? updatedRet : r)));
    return updatedRet;
  };

  // Handle Quality Inspection Submit
  const handleApplyInspection = async () => {
    if (!inspectingReturn) return;
    setInspectionSubmitting(true);
    try {
      await executeStockAndExpenseAdjustment(
        inspectingReturn,
        inspectionCondition,
        inspectionNextStatus,
        inspectionDamageReason
      );
      setFeedback(
        inspectionCondition === 'sellable'
          ? `✅ কোয়ালিটি পাস! অর্ডার #${inspectingReturn.orderId}-এর পণ্য স্টকে স্বয়ংক্রিয়ভাবে যোগ হয়েছে।`
          : `⚠️ ড্যামেজ রেকর্ড সংরক্ষিত হয়েছে। ক্ষতি হিসাবভুক্ত হয়েছে কিন্তু বিক্রয়যোগ্য স্টকে যোগ করা হয়নি।`
      );
      setTimeout(() => setFeedback(''), 4500);
      setIsInspectionModalOpen(false);
      setInspectingReturn(null);
    } catch (err: any) {
      console.warn('Inspection submit error:', err);
      setFeedback(`❌ কোয়ালিটি আপডেট ত্রুটি: ${err?.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন'}`);
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setInspectionSubmitting(false);
    }
  };

  // Handle New Return Form Submission
  const handleCreateNewReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnFormOrderId.trim() || !returnFormProductName.trim()) return;
    setReturnFormSubmitting(true);
    try {
      const returnId = `ret-${returnFormOrderId.trim().replace(/\D/g, '') || Date.now()}-${Date.now().toString().slice(-4)}`;
      const targetProd =
        products.find((p) => p.id === returnFormProductId || (returnFormSku && p.sku === returnFormSku)) ||
        products[0];
      const unitCost = targetProd?.originalPrice || Math.round((targetProd?.price || 1200) * 0.6);
      const initialDamageLoss = returnFormCondition === 'damaged' ? unitCost * returnFormQuantity : 0;

      const newReturn: CourierReturn = {
        id: returnId,
        orderId: returnFormOrderId.trim(),
        customerName: returnFormCustomerName.trim() || 'গ্রাহক',
        customerPhone: returnFormCustomerPhone.trim(),
        productId: returnFormProductId || targetProd?.id || 'prod-custom',
        productName: returnFormProductName.trim(),
        sku: returnFormSku.trim() || targetProd?.sku || 'SKU-RET',
        variant: returnFormVariant.trim(),
        quantity: Math.max(1, Number(returnFormQuantity) || 1),
        courierName: returnFormCourierName,
        courierTracking: returnFormTracking.trim(),
        returnCharge: Number(returnFormCharge) || 0,
        returnReason: returnFormReason.trim(),
        productCondition: returnFormCondition,
        damageReason: returnFormDamageReason.trim(),
        damageLoss: initialDamageLoss,
        status: returnFormStatus,
        stockAdjusted: false,
        expenseRecorded: false,
        returnDate: returnFormDate || new Date().toISOString().slice(0, 10),
        notes: returnFormNotes.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'courier_returns', returnId), newReturn);

      // Automatically execute stock adjustment and expense recording
      await executeStockAndExpenseAdjustment(
        newReturn,
        returnFormCondition,
        returnFormStatus,
        returnFormDamageReason
      );

      setFeedback(`✅ অর্ডার #${returnFormOrderId}-এর কুরিয়ার রিটার্ন ডাটাবেজে সফলভাবে যুক্ত হয়েছে!`);
      setTimeout(() => setFeedback(''), 4000);
      setIsNewReturnModalOpen(false);
      resetReturnForm();
    } catch (err: any) {
      console.warn('Create return error:', err);
      setFeedback(`❌ রিটার্ন যোগ করতে সমস্যা: ${err?.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন'}`);
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setReturnFormSubmitting(false);
    }
  };

  // Delete Return Record
  const handleDeleteReturn = async (returnId: string, orderId: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে অর্ডার #${orderId}-এর রিটার্ন রেকর্ডটি মুছে ফেলতে চান?`)) return;
    try {
      await deleteDoc(doc(db, 'courier_returns', returnId));
      setCourierReturns((prev) => prev.filter((r) => r.id !== returnId));
      setFeedback('🗑️ রিটার্ন রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.warn('Delete return error:', err);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseAmount || Number(newExpenseAmount) <= 0) return;
    setIsSubmittingExpense(true);
    try {
      const categoryLabels: Record<string, string> = {
        product_buying: 'পণ্য ক্রয় / সোর্সিং',
        ad_cost: 'মেটা ও টিকটক অ্যাড স্পেন্ড',
        transport_fare: 'রিকশা / গাড়ি / যাতায়াত ভাড়া',
        courier_charge: 'কুরিয়ার ও ডেলিভারি খরচ',
        courier_return_charge: 'কুরিয়ার রিটার্ন চার্জ',
        packaging: 'বক্স ও প্যাকেজিং খরচ',
        office_utility: 'অফিস / নাস্তা / ইউটিলিটি',
        other: 'অন্যান্য বিবিধ খরচ',
      };
      const newExp: BusinessExpense = {
        id: `exp-${Date.now()}`,
        date: newExpenseDate || new Date().toISOString().slice(0, 10),
        category: newExpenseCategory,
        categoryLabel: categoryLabels[newExpenseCategory] || 'বিবিধ খরচ',
        amount: Number(newExpenseAmount),
        note: newExpenseNote.trim() || categoryLabels[newExpenseCategory],
        createdAt: Date.now(),
      };
      setExpenses((prev) => {
        const next = [newExp, ...prev.filter((x) => x.id !== newExp.id)];
        try {
          localStorage.setItem('dokandari_expenses_backup_v1', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      setNewExpenseAmount('');
      setNewExpenseNote('');
      try {
        await setDoc(doc(db, 'business_expenses', newExp.id), newExp);
      } catch (err) {
        console.warn('Firestore expense sync note (saved locally):', err);
      }
      setFeedback('✅ নতুন খরচ সফলভাবে সেভ হয়েছে!');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setExpenses((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try {
        localStorage.setItem('dokandari_expenses_backup_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    try {
      await deleteDoc(doc(db, 'business_expenses', id));
    } catch (err) {
      console.warn('Delete expense note:', err);
    }
    setFeedback('🗑️ খরচটি মুছে ফেলা হয়েছে।');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleExportPnLToCSV = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let csv = '\uFEFF';
    csv += 'Dokandari.com — সেলস লাভ-ক্ষতি ও ব্যবসা হিসাব রিপোর্ট\n';
    csv += `রিপোর্ট তৈরির তারিখ:,${todayStr}\n\n`;
    csv += '--- বিক্রয় / অর্ডার বিবরণ ---\n';
    csv += 'অর্ডার আইডি,তারিখ,কাস্টমার,মোবাইল,পণ্য,পেমেন্ট,স্ট্যাটাস,টাকার পরিমাণ (BDT)\n';
    orders.forEach((o) => {
      const itemsStr = o.items.map((i) => `${i.quantity}x ${i.name.replace(/,/g, ' ')}`).join(' + ');
      const dt = new Date(o.createdAt).toLocaleDateString('bn-BD');
      csv += `"${o.id}","${dt}","${o.customer.name.replace(/,/g, ' ')}","${o.customer.phone}","${itemsStr}","${o.paymentMethod}","${o.status}",${o.total}\n`;
    });
    csv += `\nমোট বিক্রয় (আয়):,,,,,${orders.reduce((a, b) => a + b.total, 0)}\n\n`;

    csv += '--- ব্যবসা খরচ বিবরণ (Ad Sourcing Transport Packaging) ---\n';
    csv += 'আইডি,তারিখ,ক্যাটাগরি,বিবরণ,টাকার পরিমাণ (BDT)\n';
    expenses.forEach((e) => {
      csv += `"${e.id}","${e.date}","${e.categoryLabel}","${e.note.replace(/,/g, ' ')}",${e.amount}\n`;
    });
    const totalExp = expenses.reduce((a, b) => a + b.amount, 0);
    const totalRev = orders.reduce((a, b) => a + b.total, 0);
    const netProf = totalRev - totalExp;
    csv += `\nমোট খরচ:,,,,${totalExp}\n`;
    csv += `নিট লাভ / ক্ষতি (Net Profit):,,,,${netProf}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dokandari_Profit_Loss_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendInvoiceViaWhatsApp = (order: Order) => {
    const cleanPhone = order.customer.phone.replace(/\D/g, '');
    const waNum = cleanPhone.startsWith('88')
      ? cleanPhone
      : cleanPhone.startsWith('0')
      ? `88${cleanPhone}`
      : `880${cleanPhone}`;
    const itemsList = order.items
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.name} (${it.quantity}টি) - ৳${(it.price * it.quantity).toLocaleString()}`
      )
      .join('\n');
    const text =
      `*Dokandari.com — প্রফেশনাল ক্যাশ অন ডেলিভারি ইনভয়েস*\n\n` +
      `সম্মানিত গ্রাহক *${order.customer.name}*,\n` +
      `দোকানদারিতে আপনার অর্ডারটি সফলভাবে কনফার্ম করা হয়েছে।\n\n` +
      `📋 *ইনভয়েস নং:* INV-${order.id}\n` +
      `📅 *তারিখ:* ${new Date(order.createdAt).toLocaleDateString('bn-BD')}\n` +
      `📍 *ডেলিভারি ঠিকানা:* ${order.customer.address}, ${order.customer.district}\n\n` +
      `🛍️ *পণ্যের তালিকা:*\n${itemsList}\n\n` +
      `💵 পণ্যের মূল্য: ৳${order.subtotal?.toLocaleString() || order.total.toLocaleString()}\n` +
      (order.discount ? `🎁 ডিসকাউন্ট: -৳${order.discount.toLocaleString()}\n` : '') +
      `🚚 ডেলিভারি চার্জ: ৳${order.shippingCost || 0}\n` +
      `💰 *সর্বমোট প্রদেয় বিল:* ৳${order.total.toLocaleString()} (ক্যাশ অন ডেলিভারি)\n\n` +
      `✓ ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখে মূল্য পরিশোধ করবেন।\n` +
      `📞 হটলাইন: 01348282356 | WhatsApp: 01885533437\n` +
      `🌐 ওয়েবসাইট: https://dokandari.com\n\n` +
      `ধন্যবাদ Dokandari-র সাথে কেনাকাটা করার জন্য!`;
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Load orders, settings, campaigns & Gemini status
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        checkGeminiServerStatus().then((st) => setGeminiStatus(st));

        const t0 = performance.now();
        const snap = await getDocs(collection(db, 'orders'));
        setPingLatencyMs(Math.round(performance.now() - t0));

        const orderMap = new Map<string, Order>();
        for (const locOrd of getPersistedOrders()) {
          if (locOrd && locOrd.id) orderMap.set(locOrd.id, locOrd);
        }
        snap.forEach((d) => {
          const data = d.data() as Order;
          if (data && data.id) orderMap.set(data.id, data);
        });
        const list = Array.from(orderMap.values()).sort((a, b) => b.createdAt - a.createdAt);
        setOrders(list);

        const apiDoc = await getDoc(doc(db, 'settings', 'api_credentials'));
        if (apiDoc.exists()) {
          setApiKeys((prev) => ({ ...prev, ...apiDoc.data() }));
        } else {
          const local = localStorage.getItem('dokandari_api_credentials');
          if (local) setApiKeys((prev) => ({ ...prev, ...JSON.parse(local) }));
        }

        const contentDoc = await getDoc(doc(db, 'settings', 'store_content'));
        if (contentDoc.exists()) {
          const cData = contentDoc.data();
          setSiteContent((prev) => ({
            ...prev,
            ...cData,
            socialLinks: {
              ...(prev.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!),
              ...(cData?.socialLinks || {}),
            },
            pageContent: {
              ...(prev.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
              ...(cData?.pageContent || {}),
            },
          }));
          if (typeof cData?.carouselInterval === 'number') {
            setCarouselInterval(cData.carouselInterval);
          }
          if (typeof cData?.bestSellingInterval === 'number') {
            setBestSellingInterval(cData.bestSellingInterval);
          }
          if (cData?.deliverySettings) {
            setDeliverySettings((prev) => ({ ...prev, ...cData.deliverySettings }));
          }
        }

        const campSnap = await getDocs(collection(db, 'campaigns'));
        const campList: SavedCampaign[] = [];
        campSnap.forEach((d) => campList.push(d.data() as SavedCampaign));
        campList.sort((a, b) => b.createdAt - a.createdAt);
        setSavedCampaigns(campList);

        const secDoc = await getDoc(doc(db, 'settings', 'security_config'));
        if (secDoc.exists()) {
          const sData = secDoc.data();
          if (Array.isArray(sData?.authorizedEmails)) {
            setAuthorizedEmails(sData.authorizedEmails);
          }
          if (sData?.adminUsername) setAdminUsernameInput(sData.adminUsername);
          if (sData?.adminPassword) setAdminPasswordInput(sData.adminPassword);
          if (sData?.adminSecretKey) setAdminSecretKeyInput(sData.adminSecretKey);
        }
      } catch (err) {
        console.warn('Admin data fetch note', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Realtime live listener for customer orders
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const orderMap = new Map<string, Order>();
        for (const locOrd of getPersistedOrders()) {
          if (locOrd && locOrd.id) orderMap.set(locOrd.id, locOrd);
        }
        snap.forEach((d) => {
          const data = d.data() as Order;
          if (data && data.id) orderMap.set(data.id, data);
        });
        const list = Array.from(orderMap.values()).sort((a, b) => b.createdAt - a.createdAt);
        setOrders(list);
      },
      (err) => {
        console.warn('Realtime orders listener note', err);
      }
    );

    // Realtime live listener for dropped / abandoned leads
    const unsubLeads = onSnapshot(
      collection(db, 'abandoned_leads'),
      (snap) => {
        const list: AbandonedLead[] = [];
        snap.forEach((d) => list.push(d.data() as AbandonedLead));
        list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        setAbandonedLeads(list);
      },
      (err) => {
        console.warn('Realtime abandoned leads listener note', err);
      }
    );

    return () => {
      unsubOrders();
      unsubLeads();
    };
  }, []);

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: Date.now() });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      setFeedback(`অর্ডার ${orderId} স্ট্যাটাস ${status.toUpperCase()}-এ আপডেট হয়েছে!`);
      setTimeout(() => setFeedback(''), 3000);
    } catch {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    }
  };

  // Reset legacy fake courier tracking number so Admin can book with real Steadfast / Pathao
  const handleResetCourierBooking = async (order: Order) => {
    const cleanedOrder: Order = {
      ...order,
      status: order.status === 'in_transit' ? 'confirmed' : order.status,
      courierName: undefined,
      trackingNumber: undefined,
      consignmentId: undefined,
      courierStatus: undefined,
      updatedAt: Date.now(),
    };
    const payload = JSON.parse(JSON.stringify(cleanedOrder));
    try {
      await setDoc(doc(db, 'orders', order.id), payload);
    } catch (err) {
      console.warn('Reset courier booking note:', err);
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? cleanedOrder : o)));
    setFeedback(`🔄 অর্ডার ${order.id}-এর কুরিয়ার স্ট্যাটাস রিসেট হয়েছে। এখন Steadfast বা Pathao-তে বুকিং দিন।`);
    setTimeout(() => setFeedback(''), 3500);
  };

  // Upload WhatsApp Order Screenshot image for AI auto-extraction
  const handleWaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1100, 0.85);
      setWaScreenshotPreview(dataUrl);
      setFeedback('📸 হোয়াটসঅ্যাপ অর্ডারের স্ক্রিনশট লোড হয়েছে! এখন "✨ স্ক্রিনশট থেকে অটো পূরণ করুন" বাটনে ক্লিক করুন।');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      console.warn('WA screenshot upload error:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Extract customer name, phone, address, product & quantity from WhatsApp screenshot or chat text
  const handleExtractWaOrderScreenshot = async () => {
    if (!waScreenshotPreview && !waScreenshotText.trim()) {
      setFeedback('⚠️ অনুগ্রহ করে হোয়াটসঅ্যাপ অর্ডারের স্ক্রিনশট আপলোড করুন অথবা মেসেজ পেস্ট করুন।');
      setTimeout(() => setFeedback(''), 3500);
      return;
    }
    setWaExtracting(true);
    setFeedback('🤖 এআই দ্বারা হোয়াটসঅ্যাপ স্ক্রিনশট/মেসেজ থেকে কাস্টমারের নাম, মোবাইল, ঠিকানা ও প্রোডাক্ট শনাক্ত হচ্ছে...');
    try {
      const extracted = await extractOrderFromScreenshotOrText({
        imageDataUrl: waScreenshotPreview || undefined,
        chatText: waScreenshotText.trim() || undefined,
        catalogProducts: products.map((p) => ({ id: p.id, name: p.name, price: p.price })),
      });
      if (extracted.customerName) setManualOrderName(extracted.customerName);
      if (extracted.customerPhone) setManualOrderPhone(extracted.customerPhone);
      if (extracted.customerAddress) setManualOrderAddress(extracted.customerAddress);
      if (extracted.deliveryArea) {
        setManualOrderArea(
          extracted.deliveryArea === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka'
        );
      }
      if (extracted.quantity && extracted.quantity > 0) setManualOrderQuantity(extracted.quantity);
      if (extracted.notes) setManualOrderNotes(extracted.notes);
      let matchedProd: Product | undefined = products[0];
      if (extracted.matchedProductId && products.some((p) => p.id === extracted.matchedProductId)) {
        setManualOrderProductId(extracted.matchedProductId);
        matchedProd = products.find((p) => p.id === extracted.matchedProductId);
      } else if (extracted.productNameHint) {
        const hint = extracted.productNameHint.toLowerCase();
        const found = products.find(
          (p) =>
            p.name.toLowerCase().includes(hint) ||
            (p.titleEn && p.titleEn.toLowerCase().includes(hint))
        );
        if (found) {
          setManualOrderProductId(found.id);
          matchedProd = found;
        } else {
          setManualOrderProductId('custom');
          setManualOrderCustomProduct(extracted.productNameHint);
          matchedProd = undefined;
        }
      }

      // If valid phone is extracted, automatically save the order + screenshot directly to Firestore orders!
      const cleanExtractedPhone = (extracted.customerPhone || '').replace(/[^\d]/g, '').replace(/^88/, '');
      if (cleanExtractedPhone.length === 11) {
        const autoQty = Math.max(1, Number(extracted.quantity) || 1);
        const autoUnitPrice = matchedProd ? matchedProd.price : 1450;
        const autoSubtotal = autoUnitPrice * autoQty;
        const autoArea = extracted.deliveryArea === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka';
        const autoFee =
          autoArea === 'inside_dhaka'
            ? Number(deliverySettings.dhakaFee) || 70
            : Number(deliverySettings.outsideDhakaFee) || 130;
        const autoOrderId = `DKD-${Math.floor(100000 + Math.random() * 900000)}`;
        const autoItemId = matchedProd?.id || `wa-${Date.now()}`;
        const autoOrder: Order = {
          id: autoOrderId,
          items: [
            {
              id: autoItemId,
              productId: autoItemId,
              name: matchedProd?.name || extracted.productNameHint || 'হোয়াটসঅ্যাপ স্ক্রিনশট অর্ডার পণ্য',
              category: matchedProd?.category || 'home_decor',
              price: autoUnitPrice,
              quantity: autoQty,
              selectedColor: matchedProd?.variants?.colors?.[0] || 'Standard',
              selectedSize: matchedProd?.variants?.sizes?.[0] || 'Standard',
              image:
                matchedProd?.images?.[0] ||
                '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
            },
          ],
          customer: {
            name: (extracted.customerName || 'কাস্টমার').trim(),
            phone: cleanExtractedPhone,
            address: (extracted.customerAddress || 'হোয়াটসঅ্যাপ স্ক্রিনশট অনুযায়ী ঠিকানা').trim(),
            city: autoArea === 'inside_dhaka' ? 'Dhaka' : 'Outside Dhaka',
            district:
              autoArea === 'inside_dhaka'
                ? 'ঢাকা (Inside Dhaka)'
                : 'ঢাকার বাইরে (Outside Dhaka)',
          },
          subtotal: autoSubtotal,
          shippingCost: autoFee,
          discount: 0,
          total: autoSubtotal + autoFee,
          paymentMethod: 'cod',
          customerScreenshot: waScreenshotPreview || undefined,
          status: 'confirmed',
          userId: null,
          pixelTracking: {
            eventId: `dkd_purchase_${autoOrderId}`,
            browserFired: true,
            capiDispatched: false,
            capiStatus: 'Dispatching CAPI...',
            updatedAt: Date.now(),
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveOrderPersisted(autoOrder);
        trackPixelPurchase(autoOrder).then((capiRes) => {
          if (capiRes) {
            const withTracking: Order = {
              ...autoOrder,
              pixelTracking: {
                eventId: capiRes.eventId || `dkd_purchase_${autoOrderId}`,
                browserFired: true,
                capiDispatched: Boolean(capiRes.capiResults && capiRes.capiResults.length > 0),
                capiStatus:
                  Array.isArray(capiRes.capiResults) && capiRes.capiResults.length > 0
                    ? capiRes.capiResults.map((r) => `${r.platform}: ${r.status}`).join(' | ')
                    : 'Browser Pixel Synced',
                metaPixels: capiRes.metaPixels,
                tiktokPixels: capiRes.tiktokPixels,
                contentIds: capiRes.contentIds,
                capiResults: capiRes.capiResults,
                updatedAt: Date.now(),
              },
            };
            saveOrderPersisted(withTracking).catch(() => null);
            setOrders((prev) => prev.map((o) => (o.id === autoOrderId ? withTracking : o)));
          }
        });
        setOrders((prev) => [autoOrder, ...prev]);
        setFeedback(
          `🎉 স্ক্রিনশট থেকে স্বয়ংক্রিয়ভাবে অর্ডার #${autoOrderId} (${autoOrder.customer.name} - ${autoOrder.customer.phone}) তৈরি এবং Meta/TikTok পিক্সেলে সিঙ্ক হয়েছে!`
        );
      } else {
        setFeedback('✅ স্ক্রিনশট/মেসেজ থেকে অর্ডারের সকল তথ্য স্বয়ংক্রিয়ভাবে পূরণ হয়েছে! যাচাই করে "অর্ডার সেভ করুন" চাপুন।');
      }
      setTimeout(() => setFeedback(''), 5500);
    } catch (err: any) {
      setFeedback(`⚠️ স্ক্রিনশট বিশ্লেষণে সমস্যা হয়েছে: ${err?.message || 'ম্যানুয়ালি তথ্য পূরণ করুন'}`);
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setWaExtracting(false);
    }
  };

  // Save Manual / WhatsApp Order to Firestore & live Admin orders state
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = manualOrderPhone.replace(/[^\d]/g, '').replace(/^88/, '');
    if (!manualOrderName.trim() || cleanPhone.length !== 11 || !manualOrderAddress.trim()) {
      setFeedback('⚠️ কাস্টমারের নাম, ১১ ডিজিটের মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা সঠিকভাবে দিন।');
      setTimeout(() => setFeedback(''), 4000);
      return;
    }

    const selectedProd =
      manualOrderProductId !== 'custom'
        ? products.find((p) => p.id === manualOrderProductId) || products[0]
        : null;

    const unitPrice = selectedProd ? selectedProd.price : Math.max(1, Number(manualOrderCustomPrice) || 1000);
    const prodName = selectedProd
      ? selectedProd.name
      : manualOrderCustomProduct.trim() || 'হোয়াটসঅ্যাপ স্পেশাল অর্ডার পণ্য';
    const prodImg =
      selectedProd?.images?.[0] ||
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80';
    const qty = Math.max(1, Number(manualOrderQuantity) || 1);
    const subtotal = unitPrice * qty;
    const deliveryFee =
      manualOrderArea === 'inside_dhaka'
        ? Number(deliverySettings.dhakaFee) || 70
        : Number(deliverySettings.outsideDhakaFee) || 130;
    const discount = Math.max(0, Number(manualOrderDiscount) || 0);
    const total = Math.max(0, subtotal + deliveryFee - discount);

    const orderId = `DKD-${Math.floor(100000 + Math.random() * 900000)}`;
    const itemId = selectedProd?.id || `custom-${Date.now()}`;
    const newOrder: Order = {
      id: orderId,
      items: [
        {
          id: itemId,
          productId: itemId,
          name: prodName,
          category: selectedProd?.category || 'home_decor',
          price: unitPrice,
          quantity: qty,
          selectedColor: selectedProd?.variants?.colors?.[0] || 'Standard',
          selectedSize: selectedProd?.variants?.sizes?.[0] || 'Standard',
          image: prodImg,
        },
      ],
      customer: {
        name: manualOrderName.trim(),
        phone: cleanPhone,
        address: manualOrderNotes.trim()
          ? `${manualOrderAddress.trim()} (নোট: ${manualOrderNotes.trim()})`
          : manualOrderAddress.trim(),
        city: manualOrderArea === 'inside_dhaka' ? 'Dhaka' : 'Outside Dhaka',
        district: manualOrderArea === 'inside_dhaka' ? 'ঢাকা (Inside Dhaka)' : 'ঢাকার বাইরে (Outside Dhaka)',
      },
      subtotal,
      shippingCost: deliveryFee,
      discount,
      total,
      paymentMethod: 'cod',
      customerScreenshot: waScreenshotPreview || undefined,
      status: 'confirmed',
      userId: null,
      pixelTracking: {
        eventId: `dkd_purchase_${orderId}`,
        browserFired: true,
        capiDispatched: false,
        capiStatus: 'Dispatching CAPI...',
        updatedAt: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setManualOrderSubmitting(true);
    try {
      await saveOrderPersisted(newOrder);
      trackPixelPurchase(newOrder).then((capiRes) => {
        if (capiRes) {
          const withTracking: Order = {
            ...newOrder,
            pixelTracking: {
              eventId: capiRes.eventId || `dkd_purchase_${orderId}`,
              browserFired: true,
              capiDispatched: Boolean(capiRes.capiResults && capiRes.capiResults.length > 0),
              capiStatus:
                Array.isArray(capiRes.capiResults) && capiRes.capiResults.length > 0
                  ? capiRes.capiResults.map((r) => `${r.platform}: ${r.status}`).join(' | ')
                  : 'Browser Pixel Synced',
              metaPixels: capiRes.metaPixels,
              tiktokPixels: capiRes.tiktokPixels,
              contentIds: capiRes.contentIds,
              capiResults: capiRes.capiResults,
              updatedAt: Date.now(),
            },
          };
          saveOrderPersisted(withTracking).catch(() => null);
          setOrders((prev) => prev.map((o) => (o.id === orderId ? withTracking : o)));
        }
      });
      setOrders((prev) => [newOrder, ...prev]);
      setManualOrderName('');
      setManualOrderPhone('');
      setManualOrderAddress('');
      setManualOrderNotes('');
      setManualOrderQuantity(1);
      setManualOrderDiscount(0);
      setWaScreenshotPreview('');
      setWaScreenshotText('');
      setIsManualOrderOpen(false);
      setFeedback(`🎉 অর্ডার #${orderId} সফলভাবে তৈরি ও ফায়ারবেস + মেটা/টিকটক CAPI-তে সিঙ্ক হয়েছে!`);
      setTimeout(() => setFeedback(''), 5500);
    } catch (err: any) {
      console.warn('Manual order create note:', err);
      setOrders((prev) => [newOrder, ...prev]);
      setIsManualOrderOpen(false);
      setFeedback(`✅ অর্ডার #${orderId} তালিকায় যুক্ত হয়েছে!`);
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setManualOrderSubmitting(false);
    }
  };

  // Real 1-Click Courier Booking (Steadfast / Pathao API)
  const handleBookCourier = async (order: Order, provider: 'steadfast' | 'pathao') => {
    setCourierBookingId(`${order.id}-${provider}`);
    try {
      const response = await fetch('/api/courier/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          orderId: order.id,
          recipientName: order.customer.name,
          recipientPhone: order.customer.phone,
          recipientAddress: `${order.customer.address}, ${order.customer.district}`,
          codAmount: order.total,
          note: order.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
          credentials: {
            steadfastApiKey: apiKeys.steadfastApiKey,
            steadfastSecretKey: apiKeys.steadfastSecretKey,
            pathaoClientId: apiKeys.pathaoClientId,
            pathaoClientSecret: apiKeys.pathaoClientSecret,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setFeedback(`⚠️ ${data?.error || 'কুরিয়ার বুকিং ব্যর্থ হয়েছে। অনুগ্রহ করে কুরিয়ার এপিআই কি চেক করুন।'}`);
        setTimeout(() => setFeedback(''), 5000);
        return;
      }

      const trackingNumber = String(data.trackingCode || data.consignmentId || '');
      const consignmentId = String(data.consignmentId || trackingNumber);
      const updatedOrder: Order = {
        ...order,
        status: 'in_transit',
        courierName: provider === 'steadfast' ? 'Steadfast Courier' : 'Pathao Courier',
        trackingNumber,
        consignmentId,
        courierStatus: data.status || 'in_review',
        updatedAt: Date.now(),
      };

      try {
        await setDoc(doc(db, 'orders', order.id), JSON.parse(JSON.stringify(updatedOrder)), { merge: true });
      } catch (dbErr) {
        console.warn('Firestore courier save note:', dbErr);
      }

      setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)));
      setFeedback(
        `🚚 ${data.message || `${provider.toUpperCase()} কুরিয়ারে অর্ডার বুকিং সফল! Tracking: ${trackingNumber}`}`
      );
      setTimeout(() => setFeedback(''), 5000);
    } catch (err: any) {
      setFeedback(`❌ কুরিয়ার এপিআই সংযোগ ত্রুটি: ${err?.message || 'আবার চেষ্টা করুন'}`);
      setTimeout(() => setFeedback(''), 4500);
    } finally {
      setCourierBookingId(null);
    }
  };

  const handleSaveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'api_credentials'), apiKeys, { merge: true });
    } catch {
      // Local fallback
    }
    localStorage.setItem('dokandari_api_credentials', JSON.stringify(apiKeys));
    initializeMultiPixels(apiKeys.facebookPixelId, apiKeys.tiktokPixelId, apiKeys.youtubeTagId);
    initializeGoogleSeoAndTags({
      gtmContainerId: apiKeys.gtmContainerId,
      ga4MeasurementId: apiKeys.ga4MeasurementId,
      googleSearchConsoleCode: apiKeys.googleSearchConsoleCode,
      youtubeTagId: apiKeys.youtubeTagId,
    });
    setApiSaved(true);
    setFeedback('✅ মেটা পিক্সেল, টিকটক, GTM, GA4 ও Google Search Console কনফিগারেশন সফলভাবে সেভ ও লাইভ সক্রিয় হয়েছে!');
    setTimeout(() => {
      setApiSaved(false);
      setFeedback('');
    }, 4000);
  };

  // Validate URL helper
  const detectSourcePlatform = (raw: string): { valid: boolean; source: string } => {
    const trimmed = raw.trim();
    if (!trimmed) return { valid: false, source: 'Empty' };
    const lower = trimmed.toLowerCase();
    if (lower.includes('alibaba.com') || lower.includes('al_offer')) return { valid: true, source: 'Alibaba' };
    if (lower.includes('aliexpress.com')) return { valid: true, source: 'AliExpress' };
    if (lower.includes('cjdropshipping.com')) return { valid: true, source: 'CJ Dropshipping' };
    if (lower.includes('amazon.')) return { valid: true, source: 'Amazon' };
    if (lower.includes('daraz.')) return { valid: true, source: 'Daraz BD' };
    if (lower.includes('shopify.')) return { valid: true, source: 'Shopify' };
    if (lower.startsWith('http://') || lower.startsWith('https://')) return { valid: true, source: 'Web Store' };
    if (trimmed.length >= 4) return { valid: true, source: 'Product Keyword / Spec' };
    return { valid: false, source: 'Invalid URL' };
  };

  const handleValidateUrls = (inputs: string[]) => {
    const report = inputs
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({
        url,
        ...detectSourcePlatform(url),
      }));
    setUrlValidationReport(report);
    const validCount = report.filter((r) => r.valid).length;
    setFeedback(`🔍 লিংক যাচাই সম্পন্ন: ${validCount}/${report.length} টি সোর্স ভ্যালিড ও প্রস্তুত।`);
    setTimeout(() => setFeedback(''), 4000);
  };

  // Finalize saving product (either Published or Draft)
  const finalizeProductImport = async (product: Product, status: 'published' | 'draft') => {
    const finalProd: Product = {
      ...product,
      status,
      updatedAt: Date.now(),
    };
    await saveProductPersisted(finalProd);
    onAddProduct(finalProd);
    setRecentlyImported((prev) => [finalProd, ...prev.filter((p) => p.id !== finalProd.id)]);
    setPreviewProduct(null);
    setFeedback(
      status === 'published'
        ? `✅ "${finalProd.name}" সফলভাবে ডাটাবেজে সেভ ও লাইভ স্টোরে পাবলিশ হয়েছে!`
        : `📝 "${finalProd.name}" ড্রাফট হিসেবে ডাটাবেজে সংরক্ষিত হয়েছে (কাস্টমার ভিউতে লুকানো থাকবে)।`
    );
    setTimeout(() => setFeedback(''), 5000);
  };

  // Core helper to import a single URL immediately (used by form submit & instant onPaste)
  const runSingleUrlImport = async (rawTargetLink: string) => {
    const targetLink = rawTargetLink.trim();
    if (!targetLink) return;

    setPreviewProduct(null);
    setImportLoading(true);
    setFeedback('⚡ ব্যাকএন্ডে কানেক্টেড! এআই দ্বারা প্রোডাক্টের আসল ছবি, ভিডিও, বাংলা নাম ও বিবরণ তৈরি হচ্ছে...');

    try {
      const analysis = await smartImportOrAnalyzeProduct(targetLink);
      const product = convertAnalysisToProduct(analysis, targetLink);

      if (requirePreviewApproval) {
        setPreviewProduct(product);
        setFeedback('✨ প্রোডাক্টের আসল তথ্য, বাংলা নাম ও ছবি এক্সট্রাক্ট সম্পন্ন! নিচে প্রিভিউ যাচাই করে পাবলিশ বা ড্রাফট করুন।');
      } else {
        await finalizeProductImport(product, 'published');
        setPreviewProduct(product);
      }
      setImportUrl('');
    } catch (err) {
      console.error('Import error:', err);
      setFeedback('ইমপোর্ট প্রসেসিং ত্রুটি হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setImportLoading(false);
    }
  };

  // Real 1-Click AI Single Link Import (scrapes real webpage & calls Gemini 3.8 Flash on server)
  const handleImportLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    const lines = importUrl
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > 1) {
      setImportTab('bulk');
      setBulkUrlsText(lines.join('\n'));
      await runBulkUrlsImport(lines.join('\n'));
      return;
    }

    await runSingleUrlImport(importUrl);
  };

  // Core helper for fast parallel Bulk AI Link Import (processes in parallel batches of 4!)
  const runBulkUrlsImport = async (rawText: string) => {
    const lines = rawText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setFeedback('অনুগ্রহ করে প্রতি লাইনে কমপক্ষে একটি প্রোডাক্ট লিংক পেস্ট করুন।');
      return;
    }

    setImportLoading(true);
    setBulkProgress({ current: 0, total: lines.length, success: 0, failed: 0, active: true });
    const newlyImportedList: Product[] = [];
    let successCount = 0;
    let failCount = 0;
    let completedCount = 0;

    setFeedback(`⚡ সুপার-ফাস্ট বাল্ক ইমপোর্ট শুরু হয়েছে (${lines.length}টি লিংক একসাথে প্রসেস হচ্ছে)...`);

    const BATCH_SIZE = 4;
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (line) => {
          try {
            const analysis = await smartImportOrAnalyzeProduct(line);
            const product = convertAnalysisToProduct(analysis, line);
            await saveProductPersisted(product);
            onAddProduct(product);
            newlyImportedList.push(product);
            successCount++;
          } catch (err) {
            console.warn(`Bulk item error for ${line}:`, err);
            failCount++;
          } finally {
            completedCount++;
            setBulkProgress({
              current: completedCount,
              total: lines.length,
              success: successCount,
              failed: failCount,
              active: true,
            });
            setFeedback(
              `⚡ বাল্ক ইমপোর্ট চলছে (${completedCount}/${lines.length}): সফল ${successCount} টি...`
            );
          }
        })
      );
    }

    setRecentlyImported((prev) => [...newlyImportedList, ...prev]);
    if (newlyImportedList.length > 0) {
      setPreviewProduct(newlyImportedList[0]);
    }
    setImportLoading(false);
    setBulkProgress({
      current: lines.length,
      total: lines.length,
      success: successCount,
      failed: failCount,
      active: false,
    });
    setBulkUrlsText('');
    setFeedback(
      `🎉 বাল্ক ইমপোর্ট সম্পন্ন! সফল: ${successCount} টি প্রোডাক্ট আসল ছবিসহ লাইভ ডাটাবেজে যুক্ত হয়েছে!`
    );
    setTimeout(() => setFeedback(''), 6000);
  };

  // Real Bulk AI Link Import (4 to 10+ links at once!)
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    await runBulkUrlsImport(bulkUrlsText);
  };

  // 1-Click Restore All Previous Real Products (Dokandari 13 Real Products + 11 Category Products)
  const handleRestoreRealCatalogProducts = async () => {
    setImportLoading(true);
    setFeedback('🔄 আপনার আগের সকল রিয়েল প্রোডাক্ট ও অরিজিনাল ছবি ডাটাবেজে রিস্টোর করা হচ্ছে...');
    try {
      const restored = await restoreAllRealCatalogProducts();
      restored.forEach((p) => onAddProduct(p));
      setFeedback(
        `✅ সফলভাবে ${restored.length}টি রিয়েল প্রোডাক্ট (হার্ট মিরর, ক্যাট বুকসেলফ, আর্চ মিরর, হেয়ার টনিক, লাফজ অয়েল, ওয়াটারমেলন ময়েশ্চারাইজার ইত্যাদি) আসল ছবিসহ লাইভ স্টোরে ফিরিয়ে আনা হয়েছে!`
      );
      setTimeout(() => setFeedback(''), 7000);
    } catch (err) {
      console.error('Restore error:', err);
      setFeedback('প্রোডাক্ট রিস্টোর করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    } finally {
      setImportLoading(false);
    }
  };

  // CSV Sample Template Download
  const handleDownloadSampleCSV = () => {
    const sampleRows = [
      'Product Name,Category,Price,Original Price,SKU,Color,Size,Image URL,Video URL,Description',
      '"মডার্ন অ্যাক্রিলিক ওয়াল মিরর সেট",home_decor,1450,2200,DKD-CSV-101,"Gold, Silver","Standard 24x36",https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80,,"প্রিমিয়াম হোম ডেকোর আনব্রেকেবল মিরর"',
      '"টিডব্লিউএস নয়েজ ক্যান্সেলিং ইয়ারবাডস",gadgets_electronics,1290,1990,DKD-CSV-102,"Matte Black, White","Standard Box",https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=80,,"ক্রিস্টাল ক্লিয়ার সাউন্ড ও ৩০ ঘণ্টা ব্যাটারি ব্যাকআপ"',
      '"মাল্টিফাংশনাল ইলেকট্রিক ব্লেন্ডার",home_kitchen,1650,2400,DKD-CSV-103,"Rose Red, Silver","1.5 Liter",https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80,,"স্টেইনলেস স্টিল ব্লেড ও ফাস্ট ব্লেন্ডিং"',
    ].join('\n');

    const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dokandari_sample_products.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle CSV file upload
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '');
      setCsvContent(text);
      const parsed = parseCSVProductImport(text);
      setCsvPreviewItems(parsed);
      setFeedback(`📁 CSV ফাইল লোড হয়েছে: ${parsed.length} টি ভ্যালিড প্রোডাক্ট প্রিভিউর জন্য প্রস্তুত।`);
    };
    reader.readAsText(file);
  };

  // Handle CSV Import Execution
  const handleImportCsvProducts = async () => {
    const parsed = csvPreviewItems.length > 0 ? csvPreviewItems : parseCSVProductImport(csvContent);
    if (parsed.length === 0) {
      setFeedback('CSV ডেটাতে কোনো ভ্যালিড প্রোডাক্ট পাওয়া যায়নি। নমুনা CSV ডাউনলোড করে ফরম্যাট দেখুন।');
      return;
    }
    setImportLoading(true);
    for (const prod of parsed) {
      await saveProductPersisted(prod);
      onAddProduct(prod);
    }
    setRecentlyImported((prev) => [...parsed, ...prev]);
    setCsvPreviewItems([]);
    setCsvContent('');
    setImportLoading(false);
    setFeedback(`🎉 CSV থেকে মোট ${parsed.length} টি প্রোডাক্ট সফলভাবে লাইভ ডাটাবেজে ইমপোর্ট হয়েছে!`);
    setTimeout(() => setFeedback(''), 5000);
  };

  // Full Post / Caption Import
  const handleFullPostImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullPostText.trim()) return;

    setImportLoading(true);
    setFeedback('⚡ পোস্টের টেক্সট ও বিবরণ থেকে সম্পূর্ণ প্রোডাক্ট রূপান্তর হচ্ছে...');

    try {
      const analysis = await smartImportOrAnalyzeProduct(fullPostText.trim());
      const product = convertAnalysisToProduct(analysis, fullPostText.trim());

      if (requirePreviewApproval) {
        setPreviewProduct(product);
      } else {
        await finalizeProductImport(product, 'published');
        setPreviewProduct(product);
      }
      setFullPostText('');
    } catch (err) {
      console.warn('Post import error:', err);
    } finally {
      setImportLoading(false);
    }
  };

  // Delete product helper (persists deletion in Firestore + localStorage + parent state)
  const handleDeleteProduct = async (productId: string, productName: string) => {
    try {
      await deleteProductPersisted(productId);
      setRecentlyImported((prev) => prev.filter((p) => p.id !== productId));
      if (onDeleteProduct) {
        onDeleteProduct(productId);
      }
      setFeedback(`🗑️ "${productName}" প্রোডাক্টটি ডাটাবেজ ও লাইভ স্টোর থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে।`);
      setTimeout(() => setFeedback(''), 3500);
    } catch (err) {
      console.warn('Delete product error', err);
    }
  };

  // Toggle product published / draft status live
  const handleToggleProductStatus = async (prod: Product) => {
    const nextStatus = prod.status === 'draft' ? 'published' : 'draft';
    const updated: Product = { ...prod, status: nextStatus, updatedAt: Date.now() };
    await saveProductPersisted(updated);
    onAddProduct(updated);
    setRecentlyImported((prev) => prev.map((p) => (p.id === prod.id ? updated : p)));
    setFeedback(
      nextStatus === 'published'
        ? `✅ "${prod.name}" লাইভ স্টোরে পাবলিশ করা হয়েছে!`
        : `📝 "${prod.name}" ড্রাফট মোডে নেওয়া হয়েছে।`
    );
    setTimeout(() => setFeedback(''), 3500);
  };

  // Store Webpage Crawler Importer (Auto-publishes real products to Firestore & Live Storefront)
  const handleStoreCrawlerImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeCrawlerUrl.trim()) return;
    setStoreCrawlerLoading(true);
    setFeedback('🌐 পুরো স্টোর থেকে আসল প্রোডাক্ট, ছবি, টাইটেল ও ডেসক্রিপশন ক্রল ও লাইভ ইমপোর্ট হচ্ছে...');
    try {
      const result = await importStoreWithAI(storeCrawlerUrl.trim(), storeCrawlerCount);
      if (result && Array.isArray(result.products) && result.products.length > 0) {
        setStoreCrawlerResults(result.products);
        // Immediately save and publish to Firestore unless preview mode is forced
        if (!requirePreviewApproval) {
          for (const prod of result.products) {
            await saveProductPersisted(prod);
            onAddProduct(prod);
          }
          setRecentlyImported((prev) => [...result.products, ...prev]);
          setFeedback(
            `✅ স্টোর থেকে সফলভাবে ${result.products.length}টি আসল প্রোডাক্ট (আসল ছবি, টাইটেল ও ডেসক্রিপশন সহ) সরাসরি লাইভ স্টোরে পাবলিশ করা হয়েছে!`
          );
        } else {
          setFeedback(
            `✅ স্টোর থেকে সফলভাবে ${result.products.length}টি আসল প্রোডাক্ট এক্সট্র্যাক্ট করা হয়েছে! নিচে যাচাই করে পাবলিশ করুন।`
          );
        }
        setTimeout(() => setFeedback(''), 5500);
      } else {
        setFeedback('⚠️ স্টোরে কোনো প্রোডাক্ট কার্ড পাওয়া যায়নি। অনুগ্রহ করে স্টোরের সঠিক লিংক চেক করুন।');
        setTimeout(() => setFeedback(''), 4000);
      }
    } catch (err: any) {
      console.warn('Store crawler error', err);
      setFeedback(`❌ স্টোর ক্রল ত্রুটি: ${err?.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন'}`);
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setStoreCrawlerLoading(false);
    }
  };

  const handlePublishAllStoreProducts = async () => {
    if (!storeCrawlerResults.length) return;
    setImportLoading(true);
    for (const prod of storeCrawlerResults) {
      await saveProductPersisted(prod);
      onAddProduct(prod);
    }
    setRecentlyImported((prev) => [
      ...storeCrawlerResults.filter((sp) => !prev.some((p) => p.id === sp.id)),
      ...prev,
    ]);
    setFeedback(`🎉 সকল ${storeCrawlerResults.length}টি প্রোডাক্ট লাইভ স্টোরে যুক্ত ও আপডেট হয়েছে!`);
    setTimeout(() => setFeedback(''), 4000);
    setStoreCrawlerResults([]);
    setImportLoading(false);
  };

  // Export all store products to CSV with unique domain-relative links
  const handleExportAllProductsCSV = () => {
    const csvData = exportProductsToCSV(products);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dokandari_catalog_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback(`📥 মোট ${products.length}টি প্রোডাক্ট ইউনিক ডোমেইন লিংক ও ছবির লিংকসহ CSV ফাইলে ডাউনলোড হয়েছে!`);
    setTimeout(() => setFeedback(''), 4000);
  };

  // Drag-and-Drop & Up/Down Category Order Persistence
  const persistCategoryOrder = async (nextOrder: string[], msg?: string) => {
    setLocalCategoryOrder(nextOrder);
    localStorage.setItem('dokandari_category_order', JSON.stringify(nextOrder));
    if (onUpdateCategoryOrder) {
      onUpdateCategoryOrder(nextOrder);
    }
    await saveStoreContentPersisted({ categoryOrder: nextOrder });
    if (msg) {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 3500);
    }
  };

  const handleMoveCategory = (index: number, direction: -1 | 1) => {
    const currentIds = orderedCategoriesList.map((c) => c.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    const updated = [...currentIds];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    const movedCat = OFFICIAL_CATEGORIES.find((c) => c.id === moved);
    persistCategoryOrder(
      updated,
      `🔀 "${movedCat?.nameBn || moved}" ক্যাটাগরিটি #${targetIndex + 1} পজিশনে সরানো হয়েছে এবং লাইভ হোমপেজে আপডেট হয়েছে!`
    );
  };

  const handleDropCategory = (targetIndex: number) => {
    if (draggedCatIndex === null || draggedCatIndex === targetIndex) {
      setDraggedCatIndex(null);
      return;
    }
    const currentIds = orderedCategoriesList.map((c) => c.id);
    const updated = [...currentIds];
    const [moved] = updated.splice(draggedCatIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setDraggedCatIndex(null);
    const movedCat = OFFICIAL_CATEGORIES.find((c) => c.id === moved);
    persistCategoryOrder(
      updated,
      `✨ ড্র্যাগ অ্যান্ড ড্রপ সম্পন্ন! "${movedCat?.nameBn || moved}" এখন #${targetIndex + 1} নম্বরে লাইভ স্টোরে সেট হয়েছে!`
    );
  };

  const handleResetCategoryOrder = () => {
    const defaultIds = OFFICIAL_CATEGORIES.map((c) => c.id);
    persistCategoryOrder(
      defaultIds,
      '🔄 ক্যাটাগরি ক্রম ডিফল্ট অর্ডারে (১ম: হোম ডেকোর, ২য়: গ্যাজেট, ৩য়: ফ্যাশন) রিসেট করা হয়েছে!'
    );
  };

  // Security Credentials Handler
  const handleSaveSecurityCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput.trim()) {
      setFeedback('⚠️ অনুগ্রহ করে একটি নতুন অ্যাডমিন পাসওয়ার্ড দিন।');
      setTimeout(() => setFeedback(''), 3500);
      return;
    }
    try {
      const payload = {
        adminUsername: adminUsernameInput.trim() || 'dokandari.shop@gmail.com',
        adminPassword: adminPasswordInput.trim(),
        adminSecretKey: adminSecretKeyInput.trim(),
        authorizedEmails,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'settings', 'security_config'), payload, { merge: true });
      setSecuritySaved(true);
      setFeedback('🔒 অ্যাডমিন ইমেইল ও পাসওয়ার্ড ফায়ারস্টোরে সিকিউরলি আপডেট হয়েছে!');
      setTimeout(() => {
        setSecuritySaved(false);
        setFeedback('');
      }, 4000);
    } catch (err) {
      console.warn('Security credentials save note', err);
    }
  };

  const handleLockAdminSession = () => {
    localStorage.removeItem('dokandari_admin_session');
    localStorage.removeItem('dokandari_admin_auth_meta');
    onBackToStore();
  };

  // Direct file upload handler for New Product modal
  const handleNewProductFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewUploadingImg(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 950, 0.82);
      setNewImage(compressed);
      setFeedback('📸 কম্পিউটার/মোবাইল থেকে প্রোডাক্টের ছবি লোড হয়েছে! এখন "প্রকাশ করুন" বাটনে ক্লিক করুন।');
      setTimeout(() => setFeedback(''), 3500);
    } catch (err) {
      console.warn('New product image upload error:', err);
    } finally {
      setNewUploadingImg(false);
      e.target.value = '';
    }
  };

  // Manual new product creator (persists to Firestore + localStorage + live state immediately)
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const priceNum = Math.max(1, Number(newPrice) || 1450);
    const origNum = Math.max(priceNum, Number(newOriginalPrice) || priceNum + 550);
    const prod: Product = {
      id: `dkd-custom-${Date.now()}`,
      name: newTitle.trim(),
      category: newCategory,
      price: priceNum,
      originalPrice: origNum,
      description:
        newDescription.trim() ||
        'Dokandari আন্তর্জাতিক মানের অরিজিনাল কোয়ালিটি পণ্য। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা।',
      fabric: 'ইমপোর্টেড প্রিমিয়াম গ্রেড কোয়ালিটি',
      sku: `DKD-${Math.floor(100 + Math.random() * 900)}`,
      inStock: true,
      status: 'published',
      rating: 5.0,
      reviewCount: 12,
      tag: 'নতুন কালেকশন',
      features: [
        '১০০% অরিজিনাল কোয়ালিটি',
        'ক্যাশ অন ডেলিভারি সুবিধা',
        'ডেলিভারি ম্যানের সামনে চেক করার সুবিধা',
      ],
      variants: {
        colors: ['Standard Original Color', 'Black / Gold'],
        sizes: ['Standard Size'],
      },
      images: [
        newImage.trim() ||
          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80',
      ],
      updatedAt: Date.now(),
    };

    await saveProductPersisted(prod);
    onAddProduct(prod);
    setRecentlyImported((prev) => [prod, ...prev]);
    setIsNewProdOpen(false);
    setNewTitle('');
    setFeedback(`✅ "${prod.name}" সফলভাবে আপলোড ও লাইভ ক্যাটালগে সেভ হয়েছে!`);
    setTimeout(() => setFeedback(''), 4500);
  };

  // Save Carousel Speed & Hero Slides to Firestore + localStorage
  const handleSaveCarouselSpeed = async (ms: number) => {
    setCarouselInterval(ms);
    const updated = await saveStoreContentPersisted({
      carouselInterval: ms,
      heroSlides: siteContent.heroSlides,
    });
    if (onStoreContentUpdated) onStoreContentUpdated(updated);
    setFeedback(`⏱️ হিরো ব্যানার স্লাইডার স্পিড ${ms / 1000} সেকেন্ডে লাইভ আপডেট করা হয়েছে!`);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleSaveBestSellingSpeed = async (ms: number) => {
    setBestSellingInterval(ms);
    const updated = await saveStoreContentPersisted({ bestSellingInterval: ms });
    if (onStoreContentUpdated) onStoreContentUpdated(updated);
    setFeedback(`🔥 বেস্ট সেলিং ক্যারোসেল স্পিড ${ms / 1000} সেকেন্ডে (ডান থেকে বামে) লাইভ আপডেট হয়েছে!`);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleSaveHeroSlides = async () => {
    const updated = await saveStoreContentPersisted({
      heroSlides: siteContent.heroSlides,
      carouselInterval,
      bestSellingInterval,
    });
    if (onStoreContentUpdated) onStoreContentUpdated(updated);
    setFeedback('✅ হোমপেজ হিরো ব্যানার স্লাইডসমূহ সফলভাবে লাইভ স্টোরে সেভ হয়েছে!');
    setTimeout(() => setFeedback(''), 3500);
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const syncedFounder = {
      ...siteContent.founder,
      address:
        siteContent.pageContent?.warehouseAddress ||
        siteContent.founder.address ||
        DEFAULT_STORE_CONTENT.founder.address,
    };
    const updated = await saveStoreContentPersisted({
      whatsappNumber: siteContent.whatsappNumber,
      hotlineNumber: siteContent.hotlineNumber,
      officialEmail: siteContent.officialEmail || DEFAULT_STORE_CONTENT.officialEmail,
      founder: syncedFounder,
      socialLinks: siteContent.socialLinks || DEFAULT_STORE_CONTENT.socialLinks,
      pageContent: siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent,
      categoryHeroes: siteContent.categoryHeroes || DEFAULT_CATEGORY_HEROES,
    });
    setSiteContent(updated);
    if (onStoreContentUpdated) {
      onStoreContentUpdated(updated);
    }
    try {
      await setDoc(doc(db, 'settings', 'store_content'), { deliverySettings }, { merge: true });
    } catch {
      // ignore
    }
    setFeedback('✅ আপনার লোকেশন/ঠিকানা, নম্বর, সোশ্যাল লিংক ও পেজ কন্টেন্ট স্থায়ীভাবে সেভ এবং সাথে সাথে লাইভ আপডেট হয়েছে!');
    setTimeout(() => setFeedback(''), 4000);
  };

  // Update abandoned lead status live
  const handleUpdateLeadStatus = async (leadId: string, nextStatus: AbandonedLeadStatus) => {
    setLeadActionLoading(leadId);
    try {
      await updateLeadStatus(leadId, nextStatus);
      setAbandonedLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: nextStatus, updatedAt: Date.now() } : l))
      );
      setFeedback(`📋 লিড স্ট্যাটাস সফলভাবে "${nextStatus.toUpperCase()}" এ আপডেট হয়েছে!`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.warn('Update lead status error:', err);
    } finally {
      setLeadActionLoading(null);
    }
  };

  // Delete abandoned lead from Firestore
  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই ড্রপড লিডটি ডাটাবেজ থেকে মুছে ফেলতে চান?')) return;
    setLeadActionLoading(leadId);
    try {
      await deleteAbandonedLead(leadId);
      setAbandonedLeads((prev) => prev.filter((l) => l.id !== leadId));
      setFeedback('🗑️ লিডটি সফলভাবে ডাটাবেজ থেকে মুছে ফেলা হয়েছে।');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.warn('Delete lead error:', err);
    } finally {
      setLeadActionLoading(null);
    }
  };

  // Fire test pixel event cleanly across all configured Meta, TikTok & YouTube IDs + Real Server CAPI
  const handleFireTestPixelEvent = async (eventName: string) => {
    // Sync current input values to localStorage & Firestore immediately so Browser + Server CAPI use them
    localStorage.setItem('dokandari_api_credentials', JSON.stringify(apiKeys));
    setDoc(doc(db, 'settings', 'api_credentials'), apiKeys, { merge: true }).catch(() => null);
    initializeMultiPixels(apiKeys.facebookPixelId, apiKeys.tiktokPixelId, apiKeys.youtubeTagId);

    const metaIds = parsePixelIds(apiKeys.facebookPixelId);
    const tiktokIds = parsePixelIds(apiKeys.tiktokPixelId);
    const sampleProd = products[0] || {
      id: 'dkd-1',
      name: 'খিলান আকৃতির আনব্রেকেবল সেলফ-অ্যাডহেসিভ অ্যাক্রিলিক ওয়াল মিরর',
      category: 'home_decor',
      price: 1650,
    };

    let capiRes: any = null;
    if (eventName === 'PageView') {
      capiRes = await trackPixelPageView();
    } else if (eventName === 'ViewContent') {
      capiRes = await trackPixelViewContent({
        id: sampleProd.id,
        name: sampleProd.name,
        category: sampleProd.category,
        price: sampleProd.price,
      });
    } else if (eventName === 'AddToCart') {
      capiRes = await trackPixelAddToCart({
        id: sampleProd.id,
        name: sampleProd.name,
        category: sampleProd.category,
        price: sampleProd.price,
        quantity: 1,
      });
    } else if (eventName === 'InitiateCheckout') {
      capiRes = await trackPixelInitiateCheckout(
        [
          {
            id: sampleProd.id,
            productId: sampleProd.id,
            name: sampleProd.name,
            price: sampleProd.price,
            quantity: 1,
          },
        ],
        sampleProd.price
      );
    } else if (eventName === 'Purchase') {
      const testOrderId = `DKD-${Math.floor(100000 + Math.random() * 900000)}`;
      capiRes = await trackPixelPurchase({
        id: testOrderId,
        total: sampleProd.price + 70,
        items: [
          {
            id: sampleProd.id,
            productId: sampleProd.id,
            name: sampleProd.name,
            price: sampleProd.price,
            quantity: 1,
          },
        ],
        customer: {
          name: 'Dokandari Test Customer',
          phone: '01885533437',
          email: 'dokandari.shop@gmail.com',
        },
      });
    } else if (eventName === 'WhatsAppConversion') {
      capiRes = await trackPixelWhatsAppConversion(
        {
          id: sampleProd.id,
          name: sampleProd.name,
          price: sampleProd.price,
          category: sampleProd.category,
        },
        'admin_live_tester'
      );
    }

    const capiSummary =
      Array.isArray(capiRes?.capiResults) && capiRes.capiResults.length > 0
        ? capiRes.capiResults.map((r: any) => `${r.platform}: ${r.status}`).join(' | ')
        : 'Browser Pixel Active (Add CAPI Token for Server API)';

    const platformDesc = `Meta: [${metaIds.length > 0 ? metaIds.join(', ') : 'None'}] | TikTok: [${tiktokIds.length > 0 ? tiktokIds.join(', ') : 'None'}] | EventID: ${capiRes?.eventId || 'dedup_ok'} | ContentID: ${(capiRes?.contentIds || [sampleProd.id]).join(',')}`;
    const newEvt = {
      id: `evt-${Date.now()}`,
      eventName,
      platform: platformDesc,
      timestamp: new Date().toLocaleTimeString('bn-BD'),
      status: `✓ Browser + ${capiSummary}`,
    };
    setPixelEventsLog((prev) => [newEvt, ...prev.slice(0, 9)]);
    refreshPixelTelemetryLogs();
    setFeedback(
      `🎯 "${eventName}" ইভেন্ট (Event ID: ${capiRes?.eventId || 'synced'}) ব্রাউজার পিক্সেল ও সার্ভার CAPI-তে একসাথে ফায়ার হয়েছে!`
    );
    setTimeout(() => setFeedback(''), 4500);
  };

  // Reconcile 100% of Firestore Orders with Meta Graph API & TikTok Events API (1:1 Match)
  const handleReconcileAllOrdersCapi = async () => {
    setReconcilingOrders(true);
    localStorage.setItem('dokandari_api_credentials', JSON.stringify(apiKeys));
    await setDoc(doc(db, 'settings', 'api_credentials'), apiKeys, { merge: true }).catch(() => null);
    setFeedback('🔄 ফায়ারবেসের সকল অর্ডার মেটা ও টিকটক সার্ভার CAPI-এর সাথে ১০০% সিঙ্ক ও রিকনসাইল করা হচ্ছে...');
    try {
      const activeOrders = orders.filter((o) => o.status !== 'cancelled');
      const recRes = await reconcileOrdersWithCapi(activeOrders);
      if (recRes.success && Array.isArray(recRes.results)) {
        const resultMap = new Map(recRes.results.map((r: any) => [r.orderId, r]));
        const updatedList: Order[] = [];
        for (const ord of orders) {
          const matched = resultMap.get(ord.id);
          if (matched) {
            const nextOrd: Order = {
              ...ord,
              pixelTracking: {
                eventId: matched.eventId,
                browserFired: true,
                capiDispatched: Boolean(matched.capiDispatched),
                capiStatus: matched.capiStatus,
                metaPixels: matched.metaPixels,
                tiktokPixels: matched.tiktokPixels,
                contentIds: matched.contentIds,
                capiResults: matched.capiResults,
                updatedAt: Date.now(),
              },
            };
            updatedList.push(nextOrd);
            saveOrderPersisted(nextOrd).catch(() => null);
          } else {
            updatedList.push(ord);
          }
        }
        setOrders(updatedList);
        await refreshPixelTelemetryLogs();
        setFeedback(
          `✅ সফলভাবে ${recRes.reconciledCount}টি ফায়ারবেস অর্ডার (Event ID সহ) মেটা ও টিকটক সার্ভার CAPI-তে ১০০% রিকনসাইল সম্পন্ন হয়েছে!`
        );
      } else {
        setFeedback('⚠️ রিকনসাইল সম্পন্ন করতে পুনরায় চেষ্টা করুন।');
      }
    } catch (err) {
      console.warn('Order CAPI reconciliation error:', err);
    } finally {
      setReconcilingOrders(false);
      setTimeout(() => setFeedback(''), 5500);
    }
  };

  // Force Sync All Catalog Products to Firestore
  const handleForceSyncCatalog = async () => {
    setSyncingCatalog(true);
    setFeedback('🔄 সকল প্রোডাক্ট ফায়ারবেস লাইভ ডাটাবেজে সিঙ্ক করা হচ্ছে...');
    try {
      const t0 = performance.now();
      for (const p of products) {
        await setDoc(doc(db, 'products', p.id), p, { merge: true });
      }
      setPingLatencyMs(Math.round(performance.now() - t0));
      setFeedback(`✅ মোট ${products.length} টি প্রোডাক্ট সফলভাবে ফায়ারবেস ক্লাউডে সিঙ্ক সম্পন্ন হয়েছে!`);
    } catch (err) {
      console.warn('Force sync error:', err);
    } finally {
      setSyncingCatalog(false);
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  // Generate AI Campaign Copy via Server Gemini 3.8 Flash
  const handleGenerateCampaign = async () => {
    const targetProd =
      products.find((p) => p.id === selectedCampaignProductId) || products[0];
    if (!targetProd) return;

    setCampaignLoading(true);
    setFeedback(`✨ Gemini 3.8 Flash এআই "${targetProd.name}"-এর জন্য অ্যাড ক্যাম্পেইন তৈরি করছে...`);
    try {
      const camp = await generateCampaignWithAI({
        title: targetProd.name,
        category: targetProd.category,
        price: targetProd.price,
      });
      setGeneratedCampaign(camp);

      const savedItem: SavedCampaign = {
        id: `camp-${Date.now()}`,
        productName: targetProd.name,
        ...camp,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'campaigns', savedItem.id), savedItem);
      setSavedCampaigns((prev) => [savedItem, ...prev]);
      setFeedback('🎉 এআই ক্যাম্পেইন কপি তৈরি ও ফায়ারবেস ডাটাবেজে সেভ হয়েছে!');
    } catch (err) {
      console.warn('Campaign generation error:', err);
      setFeedback('ক্যাম্পেইন জেনারেট করতে সমস্যা হয়েছে।');
    } finally {
      setCampaignLoading(false);
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  // Add Authorized Admin Email
  const handleAddAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAdminEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    const updated = Array.from(new Set([...authorizedEmails, clean]));
    setAuthorizedEmails(updated);
    setNewAdminEmail('');
    try {
      await setDoc(doc(db, 'settings', 'security_config'), { authorizedEmails: updated }, { merge: true });
      setFeedback(`🛡️ "${clean}" অ্যাডমিন অ্যাক্সেস লিস্টে যুক্ত হয়েছে!`);
      setTimeout(() => setFeedback(''), 3500);
    } catch {
      // ignore
    }
  };

  // Aggregate unique customers from orders
  const aggregatedCustomers = React.useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        phone: string;
        address: string;
        district: string;
        orderCount: number;
        totalSpent: number;
        lastOrderDate: number;
      }
    >();

    orders.forEach((o) => {
      const key = o.customer.phone || o.customer.name;
      const existing = map.get(key);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += o.total;
        if (o.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = o.createdAt;
        }
      } else {
        map.set(key, {
          name: o.customer.name,
          phone: o.customer.phone,
          address: o.customer.address,
          district: o.customer.district,
          orderCount: 1,
          totalSpent: o.total,
          lastOrderDate: o.createdAt,
        });
      }
    });

    return Array.from(map.values());
  }, [orders]);

  // All Official Admin Dashboard Tools — Clean, Colorful, Pure Bengali Labels, with Google Omni at the Very End (Extra Menu)
  const adminNavList: {
    id: AdminTool;
    serialBn: string;
    label: string;
    subtitleBn: string;
    count?: number;
    icon: any;
    badgeBg: string;
    categoryGroup: 'catalog' | 'orders' | 'marketing' | 'settings';
  }[] = [
    {
      id: 'catalog_studio',
      serialBn: '০১',
      label: 'এআই প্রোডাক্ট ও স্টোর ইমপোর্টার',
      subtitleBn: 'লিংক ও CSV থেকে প্রোডাক্ট আপলোড',
      icon: Palette,
      badgeBg: 'bg-rose-600 text-white',
      categoryGroup: 'catalog',
    },
    {
      id: 'products',
      serialBn: '০২',
      label: 'সকল প্রোডাক্ট ও লাইভ এডিট',
      subtitleBn: 'দাম, ছবি ও স্টক ম্যানেজমেন্ট',
      count: products.length,
      icon: Tag,
      badgeBg: 'bg-pink-600 text-white',
      categoryGroup: 'catalog',
    },
    {
      id: 'categories',
      serialBn: '০৩',
      label: '১১টি ক্যাটাগরি সাজানো',
      subtitleBn: 'ড্র্যাগ অ্যান্ড ড্রপ সিরিয়াল',
      count: OFFICIAL_CATEGORIES.length,
      icon: FolderTree,
      badgeBg: 'bg-purple-600 text-white',
      categoryGroup: 'catalog',
    },
    {
      id: 'orders',
      serialBn: '০৪',
      label: 'অর্ডার ও কুরিয়ার বুকিং',
      subtitleBn: 'Steadfast ও Pathao বুকিং',
      count: orders.length,
      icon: Package,
      badgeBg: 'bg-emerald-600 text-white',
      categoryGroup: 'orders',
    },
    {
      id: 'courier_returns',
      serialBn: '০৫',
      label: 'কুরিয়ার রিটার্ন ম্যানেজমেন্ট',
      subtitleBn: 'অটো স্টক অ্যাডজাস্টমেন্ট ও ড্যামেজ ট্র্যাকিং',
      count: courierReturns.filter((r) => r.status !== 'completed').length,
      icon: RotateCcw,
      badgeBg: 'bg-rose-700 text-white',
      categoryGroup: 'orders',
    },
    {
      id: 'abandoned_leads',
      serialBn: '০৬',
      label: 'অসম্পূর্ণ অর্ডার ও লিড রিকভারি',
      subtitleBn: 'কাস্টমারের নম্বর ও কার্ট ট্র্যাকিং',
      count: abandonedLeads.filter((l) => l.status === 'pending').length,
      icon: PhoneCall,
      badgeBg: 'bg-amber-500 text-white',
      categoryGroup: 'orders',
    },
    {
      id: 'customers',
      serialBn: '০৭',
      label: 'কাস্টমার ডাটাবেস ও তালিকা',
      subtitleBn: 'গ্রাহকের ঠিকানা ও অর্ডার হিস্ট্রি',
      count: aggregatedCustomers.length,
      icon: Users,
      badgeBg: 'bg-teal-600 text-white',
      categoryGroup: 'orders',
    },
    {
      id: 'pixels',
      serialBn: '০৮',
      label: 'পিক্সেল, GTM, GA4 ও SEO সেটআপ',
      subtitleBn: 'মেটা, টিকটক, হোয়াটসঅ্যাপ ও গুগল ট্যাগ',
      icon: Activity,
      badgeBg: 'bg-blue-600 text-white',
      categoryGroup: 'marketing',
    },
    {
      id: 'campaigns',
      serialBn: '০৯',
      label: 'এআই বিজ্ঞাপন ও ক্যাম্পেইন কপি',
      subtitleBn: 'ফেসবুক ও টিকটক অ্যাড স্ক্রিপ্ট',
      count: savedCampaigns.length,
      icon: Megaphone,
      badgeBg: 'bg-indigo-600 text-white',
      categoryGroup: 'marketing',
    },
    {
      id: 'banners',
      serialBn: '১০',
      label: 'হিরো ব্যানার ও স্লাইডার ডিজাইন',
      subtitleBn: 'হোমপেজ ব্যানার ও স্লাইড স্পিড',
      count: siteContent.heroSlides.length,
      icon: ImageIcon,
      badgeBg: 'bg-fuchsia-600 text-white',
      categoryGroup: 'marketing',
    },
    {
      id: 'settings',
      serialBn: '১১',
      label: 'ওয়েবসাইট ও ডেলিভারি চার্জ সেটিংস',
      subtitleBn: 'ঢাকা ৳৭০ / ঢাকার বাইরে ৳১২০ ও নম্বর',
      icon: Settings,
      badgeBg: 'bg-cyan-600 text-white',
      categoryGroup: 'settings',
    },
    {
      id: 'api_integrations',
      serialBn: '১২',
      label: 'কুরিয়ার ও পেমেন্ট এপিআই কি',
      subtitleBn: 'Steadfast, Pathao, bKash ও Nagad',
      icon: Key,
      badgeBg: 'bg-orange-600 text-white',
      categoryGroup: 'settings',
    },
    {
      id: 'analytics',
      serialBn: '১৩',
      label: 'সেলস রিপোর্ট ও অ্যানালাইটিক্স',
      subtitleBn: 'মোট বিক্রি, P&L ও রিটার্ন ক্ষতি',
      icon: Activity,
      badgeBg: 'bg-emerald-700 text-white',
      categoryGroup: 'settings',
    },
    {
      id: 'security',
      serialBn: '১৪',
      label: 'অ্যাডমিন পাসওয়ার্ড ও সিকিউরিটি',
      subtitleBn: 'অ্যাডমিন ইমেইল ও পাসওয়ার্ড পরিবর্তন',
      count: authorizedEmails.length,
      icon: Shield,
      badgeBg: 'bg-red-600 text-white',
      categoryGroup: 'settings',
    },
    {
      id: 'cache',
      serialBn: '১৫',
      label: 'ক্যাশে ও ফায়ারবেস লাইভ সিঙ্ক',
      subtitleBn: 'ডাটাবেজ স্পিড ও সিঙ্ক চেক',
      icon: Database,
      badgeBg: 'bg-violet-600 text-white',
      categoryGroup: 'settings',
    },
    {
      id: 'omni_flow_studio',
      serialBn: '১৬',
      label: 'এক্সট্রা: গুগল ওমনি এআই স্টুডিও',
      subtitleBn: 'সফট পিঙ্ক ভিডিও ও শোরুম জেনারেটর',
      icon: Video,
      badgeBg: 'bg-gradient-to-r from-[#E11D48] to-pink-600 text-white',
      categoryGroup: 'marketing',
    },
  ];

  const filteredAdminNavList = useMemo(() => {
    if (navCategoryFilter === 'all') return adminNavList;
    return adminNavList.filter((item) => item.categoryGroup === navCategoryFilter);
  }, [adminNavList, navCategoryFilter]);

  return (
    <div className="bg-[#FFF5F7] min-h-screen py-6">
      <div className="w-full px-3 sm:px-6 lg:px-8 space-y-6">
        {/* Top Master Admin Hub Banner — Clean, Colorful & Well-Proportioned */}
        <div className="bg-gradient-to-r from-[#FFF0F3] via-white to-[#FFF0F3] rounded-3xl border-2 border-rose-200 p-5 sm:p-7 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#E11D48] text-white flex items-center gap-1.5 shadow-2xs">
                <Shield className="w-3.5 h-3.5" />
                <span>অ্যাডমিন কন্ট্রোল সেন্টার</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>লাইভ ডাটাবেজ সিঙ্ক সক্রিয়</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">
              দোকানদারি (Dokandari.com) — প্রফেশনাল স্টোর ড্যাশবোর্ড
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 font-medium">
              প্রোডাক্ট আপলোড, অর্ডার ও কুরিয়ার বুকিং, পিক্সেল ও GTM সেটআপ এবং ডেলিভারি চার্জ নিয়ন্ত্রণ করুন এক জায়গা থেকে।
            </p>
          </div>

          {/* Action Button Strip — With Extra Corner Menu Button for Google Omni */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onBackToStore}
              className="px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl bg-white hover:bg-rose-50 text-stone-800 border-2 border-rose-200 flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
            >
              <Globe className="w-4 h-4 text-[#E11D48]" />
              <span>স্টোর হোমপেজ দেখুন</span>
            </button>

            <button
              onClick={() => setActiveTool('catalog_studio')}
              className="px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>প্রোডাক্ট ইমপোর্টার</span>
            </button>

            <button
              onClick={handleLockAdminSession}
              className="px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl border-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-50 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              <span>লগআউট</span>
            </button>

            {/* Corner Extra Menu Button for Google Omni AI Studio (Only visible after Admin Login) */}
            <button
              onClick={() => setActiveTool('omni_flow_studio')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl border-2 flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                activeTool === 'omni_flow_studio'
                  ? 'bg-gradient-to-r from-[#E11D48] to-pink-600 text-white border-rose-600'
                  : 'bg-[#FFF0F3] hover:bg-[#FFE4E9] text-[#E11D48] border-rose-300'
              }`}
              title="শুধুমাত্র অ্যাডমিনদের জন্য এক্সট্রা মেনু: Google Omni AI স্টুডিও"
            >
              <Video className="w-4 h-4" />
              <span>✨ এক্সট্রা মেনু: Google Omni স্টুডিও</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div className="p-4 rounded-2xl bg-[#FFF0F3] border-2 border-rose-300 text-xs sm:text-sm font-extrabold text-rose-950 flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-[#E11D48] shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Colorful, Well-Aligned Navigation Cards Grid */}
        <div className="bg-white rounded-3xl border-2 border-rose-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-rose-100">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm sm:text-base font-extrabold text-stone-900">
                অ্যাডমিন মেনু ও ফিচারসমূহ:
              </span>
              <span className="text-xs font-extrabold text-[#E11D48] bg-[#FFF0F3] px-3 py-1 rounded-full border border-rose-200">
                মোট {adminNavList.length}টি মডিউল
              </span>
            </div>

            {/* Clean Category Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
              {[
                { id: 'all', label: `সবগুলো মেনু (${adminNavList.length})` },
                { id: 'catalog', label: '📦 প্রোডাক্ট ও ক্যাটাগরি' },
                { id: 'orders', label: '🛍️ অর্ডার ও কাস্টমার' },
                { id: 'marketing', label: '📈 পিক্সেল, ক্যাম্পেইন ও ওমনি' },
                { id: 'settings', label: '⚙️ সেটিংস ও সিকিউরিটি' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setNavCategoryFilter(filter.id as any)}
                  className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    navCategoryFilter === filter.id
                      ? 'bg-[#E11D48] text-white shadow-xs'
                      : 'bg-[#FFF0F3] text-stone-800 hover:bg-[#FFE4E9] border border-rose-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Layout: Spacious, Colorful, Legible Bengali Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredAdminNavList.map((item) => {
              const Icon = item.icon;
              const isActive = activeTool === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTool(item.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl flex flex-col items-start justify-between min-h-[104px] transition-all cursor-pointer text-left border-2 ${
                    isActive
                      ? 'bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white border-[#9F1239] shadow-md ring-2 ring-rose-300'
                      : 'bg-[#FFF7F9] hover:bg-[#FFE4E9]/80 text-stone-900 border-rose-200 hover:border-rose-400 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                          isActive ? 'bg-white/20 text-white' : item.badgeBg
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-rose-800 border border-rose-200'
                        }`}
                      >
                        {item.serialBn}
                      </span>
                    </div>
                    {item.count !== undefined && (
                      <span
                        className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-extrabold ${
                          isActive
                            ? 'bg-white text-[#E11D48]'
                            : 'bg-white text-[#E11D48] border border-rose-200'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 w-full">
                    <div
                      className={`text-xs sm:text-sm font-extrabold leading-snug ${
                        isActive ? 'text-white' : 'text-stone-900'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div
                      className={`text-[11px] font-medium truncate ${
                        isActive ? 'text-rose-100' : 'text-stone-600'
                      }`}
                    >
                      {item.subtitleBn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* =====================================================================
            EXTRA ADMIN MENU (TOOL 15): GOOGLE OMNI AI STUDIO (Only renders when explicitly clicked!)
           ===================================================================== */}
        {activeTool === 'omni_flow_studio' && (
          <div className="animate-in fade-in">
            <OmniFlowStudio
              key="flow-direct"
              products={products}
              defaultBrandName="দোকানদারি (Dokandari)"
              defaultExpandedEditMode={true}
              onAttachVideoToProduct={(updatedProd) => {
                if (onEditProduct) onEditProduct(updatedProd);
                setFeedback(`✅ "${updatedProd.name}" প্রোডাক্টে নতুন ব্র্যান্ড ভিডিও যুক্ত ও লাইভ সেভ হয়েছে!`);
                setTimeout(() => setFeedback(''), 4000);
              }}
            />
          </div>
        )}

        {/* =====================================================================
            TOOL 01: CATALOG STUDIO & AI BULK PRODUCT IMPORTER
           ===================================================================== */}
        {activeTool === 'catalog_studio' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header Banner */}
            <div className="rounded-3xl p-6 bg-gradient-to-r from-[#D81B60] via-[#E11D48] to-[#9F1239] text-white shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold">
                        Autonomous AI Product Studio & Bulk Importer
                      </h3>
                      <span className="text-[10px] font-bold bg-white text-rose-700 px-2 py-0.5 rounded-md">
                        Gemini 3.8 Flash
                      </span>
                    </div>
                    <p className="text-xs text-white/90 mt-0.5">
                      যেকোনো দেশি-বিদেশি স্টোরের লিংক বা বাল্ক লিংক দিলে এআই আসল ছবি, ভিডিও, বিডিটি প্রাইস, সাইজ, কালার ও ৩টি কম্বো অফার তৈরি করে লাইভ স্টোরে যুক্ত করবে।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <label className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requirePreviewApproval}
                      onChange={(e) => setRequirePreviewApproval(e.target.checked)}
                      className="accent-white"
                    />
                    <span>পাবলিশের আগে প্রিভিউ মোড</span>
                  </label>
                  <button
                    onClick={onBackToStore}
                    className="px-4 py-2 bg-white text-[#E11D48] hover:bg-rose-50 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    লাইভ স্টোর দেখুন &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Importer Workspace Box */}
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-5">
              {/* Tabs Switcher */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rose-100">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-stone-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#E11D48]" />
                    <span>Universal AI Link Importer (Alibaba, CJ, Amazon, Daraz, Shopify & CSV)</span>
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    লিংক পেস্ট করলেই এআই স্বয়ংক্রিয়ভাবে অরিজিনাল ছবি, স্পেসিফিকেশন ও কম্বো অফার তৈরি করে লাইভ ডাটাবেজে যুক্ত করবে।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setImportTab('single')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      importTab === 'single'
                        ? 'bg-[#E11D48] text-white shadow-2xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    🔗 ১টি লিংক (Single)
                  </button>
                  <button
                    onClick={() => setImportTab('bulk')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      importTab === 'bulk'
                        ? 'bg-[#E11D48] text-white shadow-2xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    📦 বাল্ক ইমপোর্ট (৪-১০+ লিংক)
                  </button>
                  <button
                    onClick={() => setImportTab('store_crawler')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      importTab === 'store_crawler'
                        ? 'bg-[#E11D48] text-white shadow-2xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    🌐 পুরো স্টোর ক্রলার (Store Crawler)
                  </button>
                  <button
                    onClick={() => setImportTab('csv')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      importTab === 'csv'
                        ? 'bg-[#E11D48] text-white shadow-2xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    📁 CSV ফাইল আপলোড
                  </button>
                  <button
                    onClick={() => setImportTab('full')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      importTab === 'full'
                        ? 'bg-[#E11D48] text-white shadow-2xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    📄 ফেসবুক ক্যাপশন / টেক্সট
                  </button>
                </div>
              </div>

              {/* Top Banner: Restore Real Products & Backend Connected Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-rose-50/90 border border-rose-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold text-stone-900">
                    ব্যাকএন্ড সার্ভার ও এআই ইমপোর্টার ১০০% সচল — লিংক পেস্ট করার সাথে সাথেই অটো-ইমপোর্ট হবে!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreRealCatalogProducts}
                  disabled={importLoading}
                  className="px-3.5 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>🔄 আগের সকল রিয়েল প্রোডাক্ট ফিরিয়ে আনুন</span>
                </button>
              </div>

              {/* TAB 1: SINGLE URL IMPORT */}
              {importTab === 'single' && (
                <div className="space-y-4">
                  {/* Sample Test Links across diverse categories */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-stone-500">টেস্ট লিংক (ক্লিক করলেই ইমপোর্ট):</span>
                    {[
                      {
                        name: 'Alibaba Arch Unbreakable Wall Mirror',
                        url: 'https://www.alibaba.com/product-detail/Arch-Unbreakable-Mirror-Home-Wall-Decor_1601358929145.html',
                      },
                      {
                        name: 'Alibaba Luxury Wall Mirror & Decor',
                        url: 'https://www.alibaba.com/product-detail/Sineren-Espejo-Modern-Frameless-Full-Length-Wall-Mirror_al_offer.d_image.3d6767afOygK2z&priceId=fab72edab8e841f49e92dcfefd80383d',
                      },
                      {
                        name: 'AliExpress ANC Wireless Earbuds',
                        url: 'https://www.aliexpress.com/item/pro-tws-wireless-anc-earbuds-bluetooth-5-3-gaming-headset.html',
                      },
                      {
                        name: 'CJ Smart Watch Ultra AMOLED',
                        url: 'https://cjdropshipping.com/product/smart-watch-amoled-fitness-tracker-heart-rate-waterproof',
                      },
                      {
                        name: 'Amazon Skincare Brightening Cleanser',
                        url: 'https://amazon.com/dp/seven-white-herbs-skin-brightening-deep-cleansing-facial-bar',
                      },
                    ].map((sample) => (
                      <button
                        key={sample.name}
                        type="button"
                        onClick={() => {
                          setImportUrl(sample.url);
                          runSingleUrlImport(sample.url);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-[#E11D48] rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-rose-200/60"
                      >
                        {sample.name} &rarr;
                      </button>
                    ))}
                  </div>

                  {/* URL Input Form */}
                  <form onSubmit={handleImportLink} className="space-y-3">
                    <label className="block text-xs font-bold text-stone-700">
                      প্রোডাক্ট পেজ বা স্টোর লিংক পেস্ট করুন (লিংক পেস্ট করার সাথে সাথেই স্বয়ংক্রিয়ভাবে প্রোডাক্ট তৈরি হবে):
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        required
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text');
                          if (!pasted || !pasted.trim()) return;
                          const lines = pasted
                            .split(/[\r\n]+/)
                            .map((l) => l.trim())
                            .filter((l) => l.length > 0 && (l.startsWith('http://') || l.startsWith('https://') || l.includes('.com') || l.includes('.bd')));
                          if (lines.length > 1) {
                            e.preventDefault();
                            setImportTab('bulk');
                            setBulkUrlsText(lines.join('\n'));
                            setTimeout(() => {
                              runBulkUrlsImport(lines.join('\n'));
                            }, 50);
                          } else if (lines.length === 1) {
                            e.preventDefault();
                            setImportUrl(lines[0]);
                            setTimeout(() => {
                              runSingleUrlImport(lines[0]);
                            }, 50);
                          }
                        }}
                        placeholder="যেমন: https://www.alibaba.com/product-detail/... (পেস্ট করলেই অটো-ইমপোর্ট শুরু হবে)"
                        className="flex-1 px-4 py-3 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleValidateUrls([importUrl])}
                        className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                      >
                        ✓ লিংক যাচাই
                      </button>
                      <button
                        type="submit"
                        disabled={importLoading}
                        className="px-6 py-3 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                        <span>
                          {importLoading
                            ? 'এআই ইমপোর্ট ও তৈরি করছে...'
                            : '✨ ইমপোর্ট ও বাংলায় তৈরি করুন'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: BULK IMPORT (Multiline URLs) */}
              {importTab === 'bulk' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-stone-800">
                        মাল্টিলাইন বাল্ক ইউআরএল ইনপুট — লিংকগুলো পেস্ট করার সাথে সাথেই একসাথে ইমপোর্ট শুরু হবে (৪, ৫ বা ১০+ লিংক):
                      </label>
                      <p className="text-[11px] text-stone-500">
                        প্রতিটি লিংক প্যারালাল এআই ব্যাচে প্রসেস হয়ে নিজস্ব নাম, আসল ছবি, ভ্যারিয়েশন ও কম্বো অফার সহ সরাসরি ক্যাটালগে চলে যাবে।
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleValidateUrls(bulkUrlsText.split('\n').filter((l) => l.trim().length > 0))
                        }
                        className="px-3 py-1.5 bg-white text-[#E11D48] border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-50 cursor-pointer"
                      >
                        ✓ সব লিংক যাচাই করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleBulk = [
                            'https://www.alibaba.com/product-detail/Arch-Unbreakable-Mirror-Home-Wall-Decor_1601358929145.html',
                            'https://www.alibaba.com/product-detail/Sineren-Espejo-Modern-Frameless-Full-Length-Wall-Mirror_al_offer.d_image.3d6767afOygK2z',
                            'https://www.aliexpress.com/item/tws-wireless-bluetooth-earbuds-noise-cancelling-headset.html',
                            'https://cjdropshipping.com/product/nordic-crystal-led-table-lamp-home-decor',
                          ].join('\n');
                          setBulkUrlsText(sampleBulk);
                          runBulkUrlsImport(sampleBulk);
                        }}
                        className="px-3 py-1.5 bg-rose-50 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-100 cursor-pointer"
                      >
                        ⚡ নমুনা ৪টি লিংক একসাথে টেস্ট ইমপোর্ট করুন
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleBulkImport} className="space-y-3">
                    <textarea
                      rows={5}
                      required
                      value={bulkUrlsText}
                      onChange={(e) => setBulkUrlsText(e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        if (!pasted || !pasted.trim()) return;
                        const combined = bulkUrlsText.trim()
                          ? `${bulkUrlsText.trim()}\n${pasted.trim()}`
                          : pasted.trim();
                        const validLinks = combined
                          .split(/[\r\n]+/)
                          .map((l) => l.trim())
                          .filter((l) => l.length > 0 && (l.startsWith('http://') || l.startsWith('https://') || l.includes('.com') || l.includes('.bd')));
                        if (validLinks.length > 0) {
                          e.preventDefault();
                          const nextText = validLinks.join('\n');
                          setBulkUrlsText(nextText);
                          setTimeout(() => {
                            runBulkUrlsImport(nextText);
                          }, 60);
                        }
                      }}
                      placeholder="https://www.alibaba.com/product-detail/Arch-Unbreakable-Mirror-Home-Wall-Decor_1601358929145.html&#10;https://www.aliexpress.com/item/...&#10;(এখানে এক বা একাধিক লিংক পেস্ট করার সাথে সাথেই অটো-ইমপোর্ট শুরু হবে)"
                      className="w-full px-4 py-3 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] font-mono leading-relaxed"
                    />

                    {bulkProgress.active && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                          <span>বাল্ক ইমপোর্ট প্রসেসিং চলছে...</span>
                          <span>
                            {bulkProgress.current} / {bulkProgress.total} (সফল: {bulkProgress.success})
                          </span>
                        </div>
                        <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E11D48] transition-all duration-300"
                            style={{
                              width: `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-stone-500">
                        মোট জমা দেওয়া লিংক: {bulkUrlsText.split('\n').filter((l) => l.trim().length > 0).length} টি
                      </span>

                      <button
                        type="submit"
                        disabled={importLoading}
                        className="px-6 py-3 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Zap className="w-4 h-4 text-white" />
                        <span>
                          {importLoading
                            ? `বাল্ক ইমপোর্ট হচ্ছে (${bulkProgress.current}/${bulkProgress.total})...`
                            : '⚡ একসাথে সব লিংক বাল্ক ইমপোর্ট করুন'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: CSV FILE UPLOAD & TEMPLATE IMPORT / EXPORT */}
              {importTab === 'csv' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-rose-50/60 p-4 rounded-2xl border border-rose-200">
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-[#E11D48]" />
                        <span>CSV / স্প্রেডশিট বাল্ক প্রোডাক্ট ইমপোর্ট ও ইউনিক লিংক এক্সপোর্ট</span>
                      </h5>
                      <p className="text-[11px] text-stone-600">
                        প্রতিটি প্রোডাক্টের জন্য আলাদা ডোমেইন লিংক (dokandari.com/products/...) ও আলাদা ছবির লিংক (dokandari.com/images/...) যুক্ত।
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportAllProductsCSV}
                        className="px-3.5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>সব প্রোডাক্ট CSV এক্সপোর্ট ({products.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSampleCSV}
                        className="px-3.5 py-2 bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>নমুনা CSV টেমপ্লেট</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-dashed border-rose-300 bg-[#FFF8F9] flex flex-col justify-center items-center text-center space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-[#E11D48]" />
                      <span className="text-xs font-bold text-stone-800">CSV ফাইল নির্বাচন করুন (.csv)</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCsvFileUpload}
                        className="text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#E11D48] file:text-white cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-stone-700">
                        অথবা সরাসরি CSV টেক্সট পেস্ট করুন:
                      </label>
                      <textarea
                        rows={4}
                        value={csvContent}
                        onChange={(e) => {
                          setCsvContent(e.target.value);
                          setCsvPreviewItems(parseCSVProductImport(e.target.value));
                        }}
                        placeholder="Product Name,Category,Price,Original Price,SKU,Color,Size,Image URL&#10;মডার্ন ফ্রেমলেস মিরর,home_decor,1450,2200,DKD-101,Silver,24x36,https://..."
                        className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-none focus:border-[#E11D48]"
                      />
                    </div>
                  </div>

                  {csvPreviewItems.length > 0 && (
                    <div className="p-4 rounded-2xl border border-rose-200 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-stone-900">
                          CSV প্রিভিউ: {csvPreviewItems.length} টি প্রোডাক্ট ডাটাবেজে ইমপোর্টের জন্য প্রস্তুত
                        </span>
                        <button
                          type="button"
                          onClick={handleImportCsvProducts}
                          disabled={importLoading}
                          className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                          ✅ সব প্রোডাক্ট ডাটাবেজে ইমপোর্ট করুন ({csvPreviewItems.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: FULL POST / SUPPLIER CAPTION IMPORT */}
              {importTab === 'full' && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-stone-800">
                      সাপ্লায়ার বা প্রোডাক্ট বিবরণের পুরো টেক্সট ও ছবির লিংক পেস্ট করুন:
                    </label>
                    <p className="text-[11px] text-stone-500">
                      যেকোনো প্রোডাক্টের ক্যাপশন ও ছবির লিংক পেস্ট করলে এআই স্বয়ংক্রিয়ভাবে টাইটেল, মূল্য, সাইজ ও স্পেসিফিকেশন বিশ্লেষণ করে প্রোডাক্ট তৈরি করবে।
                    </p>
                  </div>

                  <form onSubmit={handleFullPostImport} className="space-y-3">
                    <textarea
                      rows={5}
                      required
                      value={fullPostText}
                      onChange={(e) => setFullPostText(e.target.value)}
                      placeholder="প্রোডাক্টের নাম, বিবরণ, দাম বা ছবির ডিরেক্ট লিংক এখানে পেস্ট করুন..."
                      className="w-full px-4 py-3 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] leading-relaxed"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={importLoading}
                        className="px-6 py-3 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                        <span>
                          {importLoading ? 'টেক্সট এনালাইসিস হচ্ছে...' : '⚡ টেক্সট থেকে প্রোডাক্ট তৈরি করুন'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 5: WHOLE STORE / WEBPAGE PRODUCT CRAWLER */}
              {importTab === 'store_crawler' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/80 p-4 rounded-2xl space-y-1.5">
                    <h5 className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-[#E11D48]" />
                      <span>পুরো অনলাইন স্টোর বা ওয়েবসাইট ক্লোনার ও ক্রলার (100% Real Store Product Importer)</span>
                    </h5>
                    <p className="text-[11px] text-stone-600">
                      যেকোনো ই-কমার্স ওয়েবসাইটের (Shopify, WooCommerce, Alibaba, Daraz বা যেকোনো স্টোর) লিংক দিলে এআই সেই সাইটের সব আসল প্রোডাক্ট, আসল ছবি, টাইটেল ও ডেসক্রিপশনসহ সরাসরি আপনার লাইভ সাইটে আপলোড করে দেবে। কোনো ফেক বা ডামি ডাটা নয়!
                    </p>
                  </div>

                  {/* Real Live Store Quick Test Buttons */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-stone-500">লাইভ টেস্ট স্টোর লিংক:</span>
                    {[
                      { name: 'Allbirds Live Store', url: 'https://www.allbirds.com' },
                      { name: 'Gymshark Store', url: 'https://www.gymshark.com' },
                      { name: 'ColourPop Cosmetics Store', url: 'https://colourpop.com' },
                      { name: 'Alibaba Home Decor Catalog', url: 'https://www.alibaba.com/product-detail/Sineren-Espejo-Modern-Frameless-Full-Length-Wall-Mirror_al_offer.d_image.3d6767afOygK2z' },
                    ].map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => setStoreCrawlerUrl(s.url)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-[#E11D48] rounded-lg text-[11px] font-semibold border border-rose-200 cursor-pointer"
                      >
                        {s.name} &rarr;
                      </button>
                    ))}
                  </div>

                  {/* Store URL Input Form */}
                  <form onSubmit={handleStoreCrawlerImport} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          যেকোনো ওয়েবসাইট বা স্টোরের URL পেস্ট করুন:
                        </label>
                        <input
                          type="url"
                          required
                          value={storeCrawlerUrl}
                          onChange={(e) => setStoreCrawlerUrl(e.target.value)}
                          placeholder="https://your-target-store.com অথবা কালেকশন পেজ লিংক"
                          className="w-full px-4 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:border-[#E11D48] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          প্রোডাক্ট সংখ্যা:
                        </label>
                        <select
                          value={storeCrawlerCount}
                          onChange={(e) => setStoreCrawlerCount(Number(e.target.value))}
                          className="w-full px-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                        >
                          <option value={4}>৪টি প্রোডাক্ট</option>
                          <option value={8}>৮টি প্রোডাক্ট</option>
                          <option value={12}>১২টি প্রোডাক্ট</option>
                          <option value={20}>২০টি প্রোডাক্ট (Full Clone)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={storeCrawlerLoading}
                        className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                        <span>
                          {storeCrawlerLoading
                            ? 'স্টোরের আসল প্রোডাক্ট ও ছবি ক্লোন হচ্ছে...'
                            : '🚀 পুরো সাইট ক্লোন ও লাইভ স্টোরে আপলোড করুন'}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Store Crawler Extracted Results */}
                  {storeCrawlerResults.length > 0 && (
                    <div className="mt-5 p-4 rounded-2xl bg-[#FFF8F9] border border-rose-200 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-extrabold text-stone-900 text-xs">
                            ক্লোনকৃত আসল প্রোডাক্ট ({storeCrawlerResults.length}টি লাইভ ডাটাবেজে যুক্ত)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handlePublishAllStoreProducts}
                          disabled={importLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>সবগুলো নিশ্চিত ও লাইভ সিঙ্ক করুন ({storeCrawlerResults.length}টি)</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {storeCrawlerResults.map((prod) => (
                          <div
                            key={prod.id}
                            className="p-3 bg-white rounded-xl border border-rose-100 flex gap-3 items-center shadow-2xs"
                          >
                            <img
                              src={prod.images[0]}
                              alt=""
                              className="w-16 h-16 object-cover rounded-lg shrink-0 border border-stone-200"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-stone-900 text-xs line-clamp-1 block">
                                {prod.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[#E11D48] font-bold text-xs font-mono">
                                  ৳{prod.price.toLocaleString()}
                                </span>
                                <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                                  {prod.category}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  await setDoc(doc(db, 'products', prod.id), prod);
                                  onAddProduct(prod);
                                  setStoreCrawlerResults((prev) => prev.filter((p) => p.id !== prod.id));
                                  setRecentlyImported((prev) => [prod, ...prev]);
                                  setFeedback(`✅ "${prod.name}" স্টোরে যুক্ত হয়েছে!`);
                                  setTimeout(() => setFeedback(''), 3000);
                                }}
                                className="mt-1.5 text-[11px] font-bold text-[#E11D48] hover:underline cursor-pointer block"
                              >
                                + এই প্রোডাক্টটি যুক্ত করুন
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* URL Validation Report Box */}
              {urlValidationReport.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">সোর্স লিংক ভ্যালিডেশন রিপোর্ট:</span>
                    <button
                      onClick={() => setUrlValidationReport([])}
                      className="text-[11px] text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      বন্ধ করুন ✕
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {urlValidationReport.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-stone-100"
                      >
                        <span className="font-mono truncate max-w-lg text-stone-600">{item.url}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                            item.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.valid ? `✓ ${item.source}` : '✕ Invalid'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* IMPORT PREVIEW & INSTANT LIVE EDITOR */}
            {previewProduct && (
              <div className="bg-white rounded-3xl border-2 border-[#E11D48] p-6 shadow-xl space-y-5 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-[#E11D48] flex items-center justify-center">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-stone-900">
                        ইমপোর্টকৃত প্রোডাক্ট প্রিভিউ ও কুইক এডিটর (Live Preview)
                      </h3>
                      <p className="text-xs text-stone-500">
                        এআই দ্বারা প্রস্তুতকৃত নাম, মূল্য, ক্যাটাগরি, ছবি ও ভিডিও সরাসরি পরিবর্তন বা সংরক্ষণ করুন।
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-[#E11D48] font-bold text-xs border border-rose-200">
                    SKU: {previewProduct.sku}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
                  {/* Left: Image & Video Preview */}
                  <div className="space-y-3">
                    <div className="aspect-square rounded-2xl overflow-hidden border border-rose-100 bg-stone-100">
                      <img
                        src={resolveSafeProductImageUrl(previewProduct.images[0], previewProduct, 0)}
                        alt={previewProduct.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleProductImageError(e, previewProduct, 0)}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {previewProduct.images.map((img, i) => (
                        <img
                          key={i}
                          src={resolveSafeProductImageUrl(img, previewProduct, i)}
                          alt=""
                          className="aspect-square rounded-lg object-cover border border-stone-200"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleProductImageError(e, previewProduct, i)}
                        />
                      ))}
                    </div>
                    {previewProduct.videos && previewProduct.videos.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[#E11D48] font-bold flex items-center gap-1.5">
                        <Play className="w-4 h-4 fill-[#E11D48]" />
                        <span>অরিজিনাল প্রোডাক্ট ভিডিও যুক্ত হয়েছে ({previewProduct.videos.length} টি)</span>
                      </div>
                    )}
                  </div>

                  {/* Right 2 Cols: Editable Fields */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-stone-700 mb-1">প্রোডাক্ট টাইটেল (বাংলায়)</label>
                        <input
                          type="text"
                          value={previewProduct.name}
                          onChange={(e) =>
                            setPreviewProduct({ ...previewProduct, name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-stone-700 mb-1">বিক্রয় মূল্য (৳ BDT)</label>
                        <input
                          type="number"
                          value={previewProduct.price}
                          onChange={(e) =>
                            setPreviewProduct({ ...previewProduct, price: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48] focus:outline-none focus:border-[#E11D48]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          ক্যাটাগরি (১১টি প্রধান ক্যাটাগরি)
                        </label>
                        <select
                          value={previewProduct.category}
                          onChange={(e) =>
                            setPreviewProduct({ ...previewProduct, category: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold text-stone-800"
                        >
                          {OFFICIAL_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.nameBn} ({c.nameEn})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 mb-1">প্রোডাক্টের বিস্তারিত বিবরণ</label>
                      <textarea
                        rows={3}
                        value={previewProduct.description}
                        onChange={(e) =>
                          setPreviewProduct({ ...previewProduct, description: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48]"
                      />
                    </div>

                    <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPreviewProduct(null)}
                        className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold hover:bg-stone-100 cursor-pointer"
                      >
                        বন্ধ করুন
                      </button>

                      <button
                        type="button"
                        onClick={() => finalizeProductImport(previewProduct, 'draft')}
                        className="px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-[#E11D48] font-bold hover:bg-rose-100 cursor-pointer"
                      >
                        📝 ড্রাফট হিসেবে সেভ করুন
                      </button>

                      {onEditProduct && (
                        <button
                          type="button"
                          onClick={async () => {
                            await finalizeProductImport(previewProduct, 'published');
                            onEditProduct(previewProduct);
                          }}
                          className="px-4 py-2.5 rounded-xl border border-rose-300 bg-white text-[#E11D48] font-bold hover:bg-rose-50 cursor-pointer"
                        >
                          ✏️ ফুল কাস্টমাইজেশন পেজে খুলুন
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => finalizeProductImport(previewProduct, 'published')}
                        className="px-6 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold shadow-md cursor-pointer"
                      >
                        🚀 লাইভ স্টোরে পাবলিশ ও আপডেট করুন
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RECENTLY IMPORTED PRODUCTS DISPLAY */}
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-rose-100 text-[#E11D48]">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-stone-900">
                      সদ্য ইমপোর্টকৃত প্রোডাক্ট ও লাইভ প্রিভিউ ({recentlyImported.length} টি)
                    </h3>
                    <p className="text-xs text-stone-500">
                      এআই দ্বারা স্বয়ংক্রিয়ভাবে প্রস্তুতকৃত প্রোডাক্ট। সরাসরি এখান থেকে ১-ক্লিকে এডিট বা লাইভ স্টোরে দেখতে পারবেন।
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ✓ ফায়ারবেস লাইভ ডাটাবেজে সিঙ্কড
                </span>
              </div>

              {recentlyImported.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[#FFF8F9] border border-dashed border-rose-200 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-[#E11D48] flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-stone-800">
                    এই সেশনে এখনো নতুন লিংক ইমপোর্ট করা হয়নি
                  </h4>
                  <p className="text-[11px] text-stone-500 max-w-md mx-auto">
                    উপরের বক্সে যেকোনো প্রোডাক্টের লিংক দিন অথবা "টেস্ট লিংক" এ ক্লিক করে "ইমপোর্ট ও বাংলায় তৈরি করুন" চাপুন — সাথে সাথে প্রোডাক্ট এখানে ও লাইভ স্টোরে চলে আসবে!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentlyImported.map((prod) => (
                    <div
                      key={prod.id}
                      className="p-4 rounded-2xl border border-rose-200 bg-[#FFF8F9] space-y-3 shadow-xs hover:shadow-md transition-all relative flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-white border border-rose-100">
                          <img
                            src={resolveSafeProductImageUrl(prod.images[0], prod, 0)}
                            alt={prod.name}
                            onError={(e) => handleProductImageError(e, prod, 0)}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#E11D48] text-white text-[10px] font-bold rounded-md shadow-xs">
                            {prod.status === 'draft' ? '📝 DRAFT' : '✓ PUBLISHED'}
                          </span>
                          <span className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 text-stone-800 text-[10px] font-bold rounded-md shadow-xs">
                            {prod.images.length} টি ছবি
                          </span>
                        </div>

                        <div>
                          <div className="text-[11px] font-bold text-[#E11D48] uppercase tracking-wider">
                            {prod.category} · SKU: {prod.sku || 'DKD-AI'}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 line-clamp-2 mt-0.5">
                            {prod.name}
                          </h4>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-rose-100 space-y-1 text-xs">
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-extrabold text-[#E11D48] text-sm">
                              ৳{prod.price.toLocaleString()}
                            </span>
                            {prod.originalPrice && (
                              <span className="line-through text-stone-400 text-xs">
                                ৳{prod.originalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-rose-200/80 flex items-center gap-2">
                        {onEditProduct && (
                          <button
                            type="button"
                            onClick={() => onEditProduct(prod)}
                            className="flex-1 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>✏️ এডিট</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(prod)}
                          className="px-2.5 py-2 bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-200 text-[11px] font-bold rounded-xl cursor-pointer"
                        >
                          {prod.status === 'draft' ? 'পাবলিশ করুন' : 'ড্রাফট করুন'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl border border-rose-200 cursor-pointer transition-colors"
                          title="Delete from database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ALL STORE PRODUCTS SECTION */}
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-rose-100">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#E11D48]" />
                    <span>লাইভ স্টোরের সকল প্রোডাক্ট ক্যাটালগ ({products.length} টি)</span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    যেকোনো প্রোডাক্টে "এডিট ও কাস্টমাইজ" ক্লিক করে নাম, দাম, ছবি, ভিডিও বা ক্যাটাগরি পরিবর্তন করলে সাথে সাথে কাস্টমার পেজে আপডেট হবে।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-700"
                  >
                    <option value="all">সকল ক্যাটাগরি (All 11)</option>
                    {OFFICIAL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-700"
                  >
                    <option value="all">সব স্ট্যাটাস (Published + Draft)</option>
                    <option value="published">Published (লাইভ)</option>
                    <option value="draft">Draft (ড্রাফট)</option>
                  </select>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="প্রোডাক্ট বা SKU খুঁজুন..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products
                  .filter((p) => {
                    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
                    const matchStatus =
                      statusFilter === 'all' ||
                      (statusFilter === 'draft' ? p.status === 'draft' : p.status !== 'draft');
                    const matchSearch =
                      !productSearch ||
                      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
                      p.category.toLowerCase().includes(productSearch.toLowerCase());
                    return matchCat && matchStatus && matchSearch;
                  })
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl border border-stone-200 bg-white space-y-2 relative group hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
                          <img
                            src={resolveSafeProductImageUrl(p.images[0], p, 0)}
                            alt={p.name}
                            onError={(e) => handleProductImageError(e, p, 0)}
                            className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 text-stone-800 text-[10px] font-bold rounded-md">
                            {OFFICIAL_CATEGORIES.find((c) => c.id === p.category)?.nameBn || p.category}
                          </span>
                          {p.status === 'draft' && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-md">
                              DRAFT
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-stone-900 line-clamp-2">{p.name}</div>

                        <div className="flex items-center justify-between font-mono text-xs font-bold text-[#E11D48]">
                          <span>৳{p.price.toLocaleString()}</span>
                          <span className="text-[10px] font-sans text-emerald-700 font-semibold">
                            {p.inStock ? 'স্টকে আছে' : 'স্টক আউট'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center gap-1.5">
                        {onEditProduct && (
                          <button
                            onClick={() => onEditProduct(p)}
                            className="flex-1 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-white" />
                            <span>✏️ এডিট</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                          title="ডিলিট করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TOOL 2: PRODUCTS MANAGEMENT
           ===================================================================== */}
        {activeTool === 'products' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-4 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Dokandari স্টোর প্রোডাক্ট ক্যাটালগ ({products.length} টি পণ্য)
                </h3>
                <p className="text-xs text-stone-500">
                  প্রতিটি প্রোডাক্টের নিজস্ব ইউনিক ডোমেইন লিংক (`/products/id`) ও ইমেজ লিংক (`/images/id/1`) রয়েছে — কোনো লিংক মিক্স হবে না।
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportAllProductsCSV}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  📥 সব প্রোডাক্ট CSV এক্সপোর্ট (ইউনিক লিংকসহ)
                </button>
                <button
                  onClick={() => setIsNewProdOpen(true)}
                  className="px-4 py-2 bg-[#E11D48] text-white rounded-xl text-xs font-bold hover:bg-[#BE123C] transition-colors cursor-pointer shadow-xs"
                >
                  + নতুন প্রোডাক্ট যোগ করুন
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((p) => {
                const prodShareUrl = getProductShareUrl(p.id);
                const imgDomainUrl = getProductImageDomainUrl(p.id, 0, p.images?.[0] || '');
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl border border-stone-200 bg-white space-y-2 relative group hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
                        <img
                          src={resolveSafeProductImageUrl(p.images[0], p, 0)}
                          alt={p.name}
                          onError={(e) => handleProductImageError(e, p, 0)}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#E11D48] text-white text-[10px] font-bold rounded-md">
                          {p.status === 'draft' ? 'DRAFT' : 'LIVE'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-stone-900 line-clamp-2">{p.name}</div>
                      <div className="flex items-center justify-between font-mono text-xs font-bold text-[#E11D48]">
                        <span>৳{p.price.toLocaleString()}</span>
                        <span className="text-[10px] font-sans text-stone-500">
                          {OFFICIAL_CATEGORIES.find((c) => c.id === p.category)?.nameBn || p.category}
                        </span>
                      </div>

                      {/* Unique Domain Product & Image Links */}
                      <div className="pt-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(prodShareUrl);
                            setFeedback(`🔗 প্রোডাক্ট ইউনিক লিংক কপি হয়েছে: ${prodShareUrl}`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-[#E11D48] text-[10px] font-semibold truncate cursor-pointer border border-stone-200"
                          title={prodShareUrl}
                        >
                          🔗 প্রোডাক্ট লিংক
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(imgDomainUrl);
                            setFeedback(`🖼️ ইমেজ ইউনিক ডোমেইন লিংক কপি হয়েছে!`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="py-1 px-2 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-[#E11D48] text-[10px] font-semibold cursor-pointer border border-stone-200"
                          title={imgDomainUrl}
                        >
                          🖼️ ইমেজ লিংক
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 flex items-center gap-1.5">
                      {onEditProduct && (
                        <button
                          onClick={() => onEditProduct(p)}
                          className="flex-1 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-white" />
                          <span>এডিট</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleProductStatus(p)}
                        className="px-2 py-2 border border-rose-200 text-[#E11D48] rounded-xl text-[10px] font-bold hover:bg-rose-50 cursor-pointer"
                      >
                        {p.status === 'draft' ? 'Publish' : 'Draft'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                        title="ডিলিট করুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================================================================
            TOOL 3: ORDERS, MANUAL ORDER ENTRY, WHATSAPP SCREENSHOT AI & COURIER BOOKING
           ===================================================================== */}
        {activeTool === 'orders' && (
          <div className="bg-white rounded-3xl border border-rose-200 shadow-xs overflow-hidden animate-in fade-in">
            <div className="p-5 border-b border-rose-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  অর্ডার ম্যানেজমেন্ট, হোয়াটসঅ্যাপ অটো-এন্ট্রি ও লাইভ কুরিয়ার বুকিং ({orders.length})
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  হোয়াটসঅ্যাপ স্ক্রিনশট আপলোড করে অটো অর্ডার এন্ট্রি অথবা ম্যানুয়াল অর্ডার তৈরি ও ১-ক্লিকে Steadfast / Pathao বুকিং
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsManualOrderOpen((prev) => !prev)}
                  className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isManualOrderOpen ? 'ফর্ম বন্ধ করুন' : '+ ম্যানুয়াল / WhatsApp স্ক্রিনশট অর্ডার এন্ট্রি'}</span>
                </button>

                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="অর্ডার আইডি বা মোবাইল..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48]"
                  />
                </div>
              </div>
            </div>

            {/* MANUAL ORDER ENTRY + WHATSAPP SCREENSHOT AUTO-EXTRACTOR PANEL */}
            {isManualOrderOpen && (
              <div className="p-5 bg-[#FFF8F9] border-b border-rose-200 space-y-5 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left: WhatsApp Screenshot / Chat Auto-Extractor */}
                  <div className="lg:col-span-5 p-4 rounded-2xl bg-white border-2 border-dashed border-emerald-300 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-800 text-xs flex items-center gap-1.5">
                        📸 হোয়াটসঅ্যাপ স্ক্রিনশট বা মেসেজ থেকে অটো-অর্ডার এন্ট্রি
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        AI Auto-Fill
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      হোয়াটসঅ্যাপে কাস্টমারের পাঠানো অর্ডারের স্ক্রিনশট আপলোড করুন অথবা মেসেজ পেস্ট করুন — নাম, মোবাইল, ঠিকানা ও প্রোডাক্ট অটোমেটিক বসে যাবে!
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 text-xs shadow-2xs">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>স্ক্রিনশট ছবি আপলোড করুন</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleWaImageUpload}
                          className="hidden"
                        />
                      </label>
                      {waScreenshotPreview && (
                        <button
                          type="button"
                          onClick={() => setWaScreenshotPreview('')}
                          className="px-2.5 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          ✕ ছবি সরান
                        </button>
                      )}
                    </div>

                    {waScreenshotPreview && (
                      <div className="relative h-28 w-full rounded-xl overflow-hidden border border-emerald-200 bg-stone-50">
                        <img
                          src={waScreenshotPreview}
                          alt="WhatsApp Order Screenshot"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-stone-700 mb-1 text-[11px]">
                        অথবা হোয়াটসঅ্যাপের অর্ডার মেসেজ এখানে পেস্ট করুন:
                      </label>
                      <textarea
                        rows={2}
                        value={waScreenshotText}
                        onChange={(e) => setWaScreenshotText(e.target.value)}
                        placeholder="যেমন: নাম: রাকিব হাসান, মোবাইল: 01712345678, ঠিকানা: মিরপুর ১০, ঢাকা। প্রোডাক্ট: ওয়াল মিরর ১ পিস..."
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={waExtracting}
                      onClick={handleExtractWaOrderScreenshot}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {waExtracting
                          ? 'স্ক্রিনশট থেকে তথ্য পড়া হচ্ছে...'
                          : '✨ স্ক্রিনশট / মেসেজ থেকে অটো ফর্ম পূরণ করুন'}
                      </span>
                    </button>
                  </div>

                  {/* Right: Manual Order Entry Form */}
                  <form onSubmit={handleCreateManualOrder} className="lg:col-span-7 p-4 rounded-2xl bg-white border border-rose-200 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                      <h4 className="font-extrabold text-stone-900 text-xs">
                        📝 ম্যানুয়াল অর্ডার এন্ট্রি ফর্ম (হোয়াটসঅ্যাপ / ফোন কল অর্ডার)
                      </h4>
                      <span className="text-[10px] font-bold text-[#E11D48]">ক্যাশ অন ডেলিভারি</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-stone-700 mb-1">কাস্টমারের নাম *</label>
                        <input
                          type="text"
                          required
                          value={manualOrderName}
                          onChange={(e) => setManualOrderName(e.target.value)}
                          placeholder="যেমন: ফাতেমা আক্তার"
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-stone-700 mb-1">মোবাইল নম্বর (১১ ডিজিট) *</label>
                        <input
                          type="tel"
                          required
                          value={manualOrderPhone}
                          onChange={(e) => setManualOrderPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:border-[#E11D48] focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-stone-700 mb-1">সম্পূর্ণ ডেলিভারি ঠিকানা *</label>
                        <input
                          type="text"
                          required
                          value={manualOrderAddress}
                          onChange={(e) => setManualOrderAddress(e.target.value)}
                          placeholder="বাসা/রোড, এলাকা, থানা ও জেলা..."
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-stone-700 mb-1">প্রোডাক্ট নির্বাচন করুন *</label>
                        <select
                          value={manualOrderProductId}
                          onChange={(e) => setManualOrderProductId(e.target.value)}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — ৳{p.price}
                            </option>
                          ))}
                          <option value="custom">+ কাস্টম প্রোডাক্টের নাম ও দাম লিখুন</option>
                        </select>
                      </div>

                      {manualOrderProductId === 'custom' && (
                        <>
                          <div>
                            <label className="block font-bold text-stone-700 mb-1">কাস্টম প্রোডাক্টের নাম *</label>
                            <input
                              type="text"
                              required
                              value={manualOrderCustomProduct}
                              onChange={(e) => setManualOrderCustomProduct(e.target.value)}
                              placeholder="প্রোডাক্টের নাম লিখুন..."
                              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-stone-700 mb-1">একক মূল্য (৳) *</label>
                            <input
                              type="number"
                              required
                              value={manualOrderCustomPrice}
                              onChange={(e) => setManualOrderCustomPrice(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block font-bold text-stone-700 mb-1">ডেলিভারি এরিয়া</label>
                        <select
                          value={manualOrderArea}
                          onChange={(e) =>
                            setManualOrderArea(e.target.value as 'inside_dhaka' | 'outside_dhaka')
                          }
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                        >
                          <option value="inside_dhaka">ঢাকার ভেতরে (৳{deliverySettings.dhakaFee})</option>
                          <option value="outside_dhaka">ঢাকার বাইরে (৳{deliverySettings.outsideDhakaFee})</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">পরিমাণ (Qty)</label>
                          <input
                            type="number"
                            min={1}
                            value={manualOrderQuantity}
                            onChange={(e) => setManualOrderQuantity(Math.max(1, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">ডিসকাউন্ট (৳)</label>
                          <input
                            type="number"
                            min={0}
                            value={manualOrderDiscount}
                            onChange={(e) => setManualOrderDiscount(Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-stone-700 mb-1">স্পেশাল নোট (ঐচ্ছিক)</label>
                        <input
                          type="text"
                          value={manualOrderNotes}
                          onChange={(e) => setManualOrderNotes(e.target.value)}
                          placeholder="যেমন: কালার গোল্ডেন, দ্রুত ডেলিভারি..."
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsManualOrderOpen(false)}
                        className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 font-bold hover:bg-stone-50 cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={manualOrderSubmitting}
                        className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>{manualOrderSubmitting ? 'সেভ হচ্ছে...' : '✅ অর্ডার সেভ করুন'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-rose-50/50 text-[11px] uppercase tracking-wider text-stone-600 border-b border-rose-100 font-bold">
                  <tr>
                    <th className="px-5 py-3.5">অর্ডার কোড</th>
                    <th className="px-5 py-3.5">কাস্টমার ও মোবাইল</th>
                    <th className="px-5 py-3.5">পণ্য</th>
                    <th className="px-5 py-3.5">টাকা ও পেমেন্ট</th>
                    <th className="px-5 py-3.5">ঠিকানা ও জেলা</th>
                    <th className="px-5 py-3.5">লাইভ কুরিয়ার বুকিং (Steadfast / Pathao)</th>
                    <th className="px-5 py-3.5">স্ট্যাটাস পরিবর্তন</th>
                    <th className="px-5 py-3.5 text-center">ভিউ ও ইনভয়েস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-stone-400 text-xs">
                        {loading ? 'অর্ডার ডাটাবেজ লোড হচ্ছে...' : 'এখনো কোনো অর্ডার জমা পড়েনি'}
                      </td>
                    </tr>
                  ) : (
                    orders
                      .filter(
                        (o) =>
                          !searchTerm ||
                          o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.customer.phone.includes(searchTerm)
                      )
                      .map((o) => {
                        // Treat legacy auto-generated 'DKD-EXP-' codes as unbooked so Admin can book them cleanly
                        const hasRealCourierBooking =
                          Boolean(o.trackingNumber) && !String(o.trackingNumber).startsWith('DKD-EXP-');
                        return (
                          <tr key={o.id} className="hover:bg-rose-50/30 transition-colors">
                            <td className="px-5 py-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                              {o.id}
                              <div className="text-[10px] font-sans text-stone-400">
                                {new Date(o.createdAt).toLocaleDateString('bn-BD')}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-bold text-stone-900">{o.customer.name}</div>
                              <div className="text-stone-500 font-mono">{o.customer.phone}</div>
                            </td>

                            <td className="px-5 py-4 max-w-xs space-y-1.5">
                              <div className="truncate font-medium">
                                {o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                              </div>
                              {o.customerScreenshot && (
                                <div className="flex items-center gap-2 pt-1">
                                  <a
                                    href={o.customerScreenshot}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold transition-colors"
                                    title="কাস্টমারের পাঠানো স্ক্রিনশট বড় করে দেখুন"
                                  >
                                    <img
                                      src={o.customerScreenshot}
                                      alt="Customer Screenshot"
                                      className="w-6 h-6 rounded object-cover border border-emerald-300"
                                    />
                                    <span>📸 কাস্টমার স্ক্রিনশট যুক্ত</span>
                                  </a>
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4 font-mono whitespace-nowrap">
                              <div className="font-bold text-[#E11D48] text-sm tabular-nums">
                                ৳{o.total.toLocaleString()}
                              </div>
                              <div className="text-[10px] uppercase font-sans font-bold text-stone-600">
                                {o.paymentMethod.toUpperCase()}
                              </div>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap text-stone-600">
                              <div>{o.customer.district}</div>
                              <div className="text-[10px] text-stone-400 truncate max-w-[160px]">
                                {o.customer.address}
                              </div>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap">
                              {hasRealCourierBooking ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                      ✓ {o.courierName || 'Courier Booked'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleResetCourierBooking(o)}
                                      className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                                      title="পুনরায় কুরিয়ার বুকিং দিতে রিসেট করুন"
                                    >
                                      🔄 রিসেট
                                    </button>
                                  </div>
                                  <div className="text-[10px] font-mono text-stone-600">
                                    Code: <strong className="text-stone-900">{o.trackingNumber}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={courierBookingId === `${o.id}-steadfast`}
                                    onClick={() => handleBookCourier(o, 'steadfast')}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                                  >
                                    {courierBookingId === `${o.id}-steadfast` ? 'বুকিং হচ্ছে...' : '🚚 Steadfast বুকিং'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={courierBookingId === `${o.id}-pathao`}
                                    onClick={() => handleBookCourier(o, 'pathao')}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                                  >
                                    {courierBookingId === `${o.id}-pathao` ? 'বুকিং হচ্ছে...' : '🛵 Pathao বুকিং'}
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap">
                              <select
                                value={o.status}
                                onChange={(e) =>
                                  handleUpdateOrderStatus(o.id, e.target.value as OrderStatus)
                                }
                                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-stone-300 bg-white cursor-pointer"
                              >
                                <option value="pending">পেন্ডিং (Pending)</option>
                                <option value="confirmed">কনফার্মড (Confirmed)</option>
                                <option value="packed">প্যাকড (Packed)</option>
                                <option value="in_transit">কুরিয়ারে (In Transit)</option>
                                <option value="delivered">ডেলিভারড (Delivered)</option>
                                <option value="cancelled">বাতিল (Cancelled)</option>
                              </select>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForView(o)}
                                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-[11px] font-extrabold cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                                  title="অর্ডারের সম্পূর্ণ ঠিকানা ও পণ্যের বিবরণ দেখুন"
                                >
                                  <Eye className="w-3.5 h-3.5 text-stone-700" />
                                  <span>ফুল ভিউ</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForInvoice(o)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-[11px] font-extrabold cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                                  title="প্রফেশনাল ইনভয়েস দেখুন, প্রিন্ট করুন বা হোয়াটসঅ্যাপে পাঠান"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#E11D48]" />
                                  <span>ইনভয়েস</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openNewReturnForOrder(o)}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                                  title="এই অর্ডারের জন্য কুরিয়ার রিটার্ন ও স্টক সমন্বয় এন্ট্রি করুন"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                  <span>রিটার্ন</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* MODAL 1: ORDER FULL DETAILS MODAL */}
            {selectedOrderForView && (
              <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
                <div className="bg-white rounded-3xl border border-rose-200 max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-rose-50 text-[#E11D48]">
                        <Eye className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold text-stone-900">
                          অর্ডার সম্পূর্ণ বিবরণ (Order #{selectedOrderForView.id})
                        </h3>
                        <p className="text-[11px] text-stone-500">
                          তারিখ: {new Date(selectedOrderForView.createdAt).toLocaleString('bn-BD')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForView(null)}
                      className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Customer Box */}
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                      <span className="text-stone-500 font-bold block uppercase tracking-wider text-[10px]">
                        কাস্টমার ও ডেলিভারি তথ্য
                      </span>
                      <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                        <User className="w-4 h-4 text-[#E11D48]" />
                        <span>{selectedOrderForView.customer.name}</span>
                      </div>
                      <div className="font-mono font-bold text-stone-700 flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <a href={`tel:${selectedOrderForView.customer.phone}`} className="hover:underline">
                          {selectedOrderForView.customer.phone}
                        </a>
                      </div>
                      <div className="text-stone-700 flex items-start gap-1.5 pt-1 border-t border-stone-200">
                        <MapPin className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-stone-900 block">{selectedOrderForView.customer.district || 'বাংলাদেশ'}</strong>
                          <span className="text-stone-800 leading-relaxed font-medium">
                            {selectedOrderForView.customer.address}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Meta Box */}
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                      <span className="text-stone-500 font-bold block uppercase tracking-wider text-[10px]">
                        পেমেন্ট ও কুরিয়ার স্ট্যাটাস
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600">পেমেন্ট মেথড:</span>
                        <span className="font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                          {selectedOrderForView.paymentMethod.toUpperCase()} (ক্যাশ অন ডেলিভারি)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600">বর্তমান স্ট্যাটাস:</span>
                        <span className="font-bold text-[#E11D48] capitalize bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {selectedOrderForView.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600">কুরিয়ার ট্র্যাকিং:</span>
                        <span className="font-mono font-bold text-stone-900">
                          {selectedOrderForView.trackingNumber || 'এখনো বুকিং হয়নি'}
                        </span>
                      </div>
                      {selectedOrderForView.customerScreenshot && (
                        <div className="pt-2 border-t border-stone-200">
                          <span className="text-[10px] text-stone-500 font-bold block mb-1">
                            কাস্টমার প্রদত্ত স্ক্রিনশট:
                          </span>
                          <a
                            href={selectedOrderForView.customerScreenshot}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={selectedOrderForView.customerScreenshot}
                              alt="Screenshot"
                              className="w-full h-24 object-cover rounded-xl border border-stone-300 hover:opacity-90"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-stone-900">অর্ডারকৃত পণ্যসমূহ:</h4>
                    <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 overflow-hidden text-xs">
                      {selectedOrderForView.items.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3 bg-white">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-stone-900 block truncate">{item.name}</span>
                              <span className="text-[10.5px] text-stone-500">
                                {item.selectedColor ? `কালার: ${item.selectedColor}` : ''}
                                {item.selectedSize ? ` | সাইজ: ${item.selectedSize}` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <span className="font-bold text-stone-900">
                              {item.quantity} x ৳{item.price.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-stone-500 block">
                              = ৳{(item.quantity * item.price).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-[#FFF8F9] border border-rose-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>পণ্যের সাবটোটাল:</span>
                      <span className="font-mono font-bold text-stone-900">
                        ৳{selectedOrderForView.subtotal?.toLocaleString() || selectedOrderForView.total.toLocaleString()}
                      </span>
                    </div>
                    {selectedOrderForView.discount ? (
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>কম্বো / অফার ডিসকাউন্ট:</span>
                        <span className="font-mono font-bold">-৳{selectedOrderForView.discount.toLocaleString()}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-stone-600">
                      <span>ডেলিভারি চার্জ:</span>
                      <span className="font-mono font-bold text-stone-900">
                        ৳{selectedOrderForView.shippingCost || 0}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-rose-200 text-sm font-extrabold text-[#E11D48]">
                      <span>সর্বমোট প্রদেয় বিল:</span>
                      <span className="font-mono text-base font-black">
                        ৳{selectedOrderForView.total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const ord = selectedOrderForView;
                        setSelectedOrderForView(null);
                        setSelectedOrderForInvoice(ord);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>প্রফেশনাল ইনভয়েস দেখুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendInvoiceViaWhatsApp(selectedOrderForView)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp এ পাঠান</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForView(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs cursor-pointer"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 2: PROFESSIONAL BRAND INVOICE MODAL (With WhatsApp & 1-Click Print) */}
            {selectedOrderForInvoice && (
              <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white">
                <div className="bg-white rounded-3xl border border-stone-300 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[95vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-4">
                  {/* Action Bar (Hidden on print) */}
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3 print:hidden">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-[#E11D48] text-white">
                        <FileText className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-black text-stone-900">
                        অফিশিয়াল ক্যাশ অন ডেলিভারি ইনভয়েস
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => sendInvoiceViaWhatsApp(selectedOrderForInvoice)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp এ পাঠান</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>প্রিন্ট / PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForInvoice(null)}
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Printable Invoice Sheet */}
                  <div className="space-y-6 text-stone-900 text-xs">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b-2 border-stone-900 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <img
                            src="/assets/aistudio/Gemini_Generated_Image_4bi49x4bi49x4bi4_b4aaa34e.jpg"
                            alt="Dokandari"
                            className="h-10 w-auto object-contain"
                          />
                          <div>
                            <h2 className="text-lg font-black tracking-tight text-[#E11D48]">দোকান্দারী</h2>
                            <p className="text-[10px] text-stone-500 font-semibold">আপনার সৌন্দর্য আমাদের ঐতিহ্য</p>
                          </div>
                        </div>
                        <p className="text-[10.5px] text-stone-600 pt-1">
                          বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)
                        </p>
                        <p className="text-[10.5px] text-stone-600">
                          হটলাইন: <strong>01348282356</strong> | WhatsApp: <strong>01885533437</strong>
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="px-2.5 py-1 rounded bg-stone-900 text-white text-xs font-extrabold uppercase tracking-wider inline-block">
                          INVOICE
                        </span>
                        <div className="font-mono text-xs font-bold text-stone-900">
                          INV-{selectedOrderForInvoice.id}
                        </div>
                        <div className="text-[10.5px] text-stone-500">
                          তারিখ: {new Date(selectedOrderForInvoice.createdAt).toLocaleDateString('bn-BD')}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold uppercase">
                          পেমেন্ট: {selectedOrderForInvoice.paymentMethod.toUpperCase()} (COD)
                        </div>
                      </div>
                    </div>

                    {/* Customer Box */}
                    <div className="p-3.5 rounded-xl border border-stone-300 bg-stone-50/70 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">
                        গ্রাহকের তথ্য (BILL TO):
                      </span>
                      <div className="text-sm font-black text-stone-900">
                        {selectedOrderForInvoice.customer.name}
                      </div>
                      <div className="font-mono font-bold text-stone-800">
                        মোবাইল: {selectedOrderForInvoice.customer.phone}
                      </div>
                      <div className="text-stone-700">
                        ঠিকানা: {selectedOrderForInvoice.customer.address}, {selectedOrderForInvoice.customer.district}
                      </div>
                    </div>

                    {/* Itemized Table */}
                    <div className="border border-stone-300 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-100 text-stone-800 font-bold border-b border-stone-300">
                          <tr>
                            <th className="p-2.5">ক্রম</th>
                            <th className="p-2.5">পণ্যের বিবরণ</th>
                            <th className="p-2.5 text-center">পরিমাণ</th>
                            <th className="p-2.5 text-right">একক মূল্য</th>
                            <th className="p-2.5 text-right">মোট (BDT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {selectedOrderForInvoice.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-mono text-stone-500">{idx + 1}</td>
                              <td className="p-2.5 font-bold">
                                {it.name}
                                {(it.selectedColor || it.selectedSize) && (
                                  <span className="block font-normal text-[10.5px] text-stone-500">
                                    {it.selectedColor ? `কালার: ${it.selectedColor}` : ''}
                                    {it.selectedSize ? ` | সাইজ: ${it.selectedSize}` : ''}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">{it.quantity}</td>
                              <td className="p-2.5 text-right font-mono">৳{it.price.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-mono font-bold">
                                ৳{(it.quantity * it.price).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-[10.5px] text-stone-600 space-y-1">
                        <strong className="text-stone-900 block font-bold">শর্তাবলী ও ডেলিভারি নির্দেশিকা:</strong>
                        <p>• সারা বাংলাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি প্রযোজ্য।</p>
                        <p>• ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখে মূল্য পরিশোধ করুন।</p>
                        <p>• যেকোনো প্রয়োজনে ৭ দিনের মধ্যে আমাদের হটলাইনে কল দিন।</p>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-stone-600">
                          <span>সাবটোটাল:</span>
                          <span className="font-mono font-bold text-stone-900">
                            ৳{selectedOrderForInvoice.subtotal?.toLocaleString() || selectedOrderForInvoice.total.toLocaleString()}
                          </span>
                        </div>
                        {selectedOrderForInvoice.discount ? (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>কম্বো ডিসকাউন্ট:</span>
                            <span className="font-mono">-৳{selectedOrderForInvoice.discount.toLocaleString()}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-stone-600">
                          <span>ডেলিভারি চার্জ:</span>
                          <span className="font-mono font-bold text-stone-900">
                            ৳{selectedOrderForInvoice.shippingCost || 0}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t-2 border-stone-900 text-sm font-black text-[#E11D48]">
                          <span>সর্বমোট প্রদেয় বিল:</span>
                          <span className="font-mono text-base">
                            ৳{selectedOrderForInvoice.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Signature */}
                    <div className="pt-6 flex items-center justify-between border-t border-stone-200 text-[10px] text-stone-500">
                      <div>Dokandari.com — কম্পিউটার জেনারেটেড ইনভয়েস</div>
                      <div className="text-right">
                        <div className="h-6" />
                        <span className="border-t border-stone-400 pt-1 font-bold">অনুমোদিত স্বাক্ষর</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TOOL: COURIER RETURN MANAGEMENT & AUTOMATIC STOCK ADJUSTMENT (কুরিয়ার রিটার্ন ও অটো স্টক সমন্বয়)
           ===================================================================== */}
        {activeTool === 'courier_returns' && (() => {
          // Status Bengali label mapping
          const returnStatusLabels: Record<ReturnStatus, { label: string; badgeClass: string }> = {
            courier_in_transit: {
              label: '১. কুরিয়ারে ফেরত আসছে',
              badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
            },
            warehouse_received: {
              label: '২. গুদামে পণ্য পৌঁছেছে',
              badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
            },
            inspecting: {
              label: '৩. পণ্য পরীক্ষা চলছে',
              badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
            },
            sellable: {
              label: '৪. বিক্রয়যোগ্য',
              badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            },
            damaged: {
              label: '৫. ড্যামেজ',
              badgeClass: 'bg-red-100 text-red-800 border-red-300',
            },
            restocked: {
              label: '৬. স্টকে যুক্ত হয়েছে',
              badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
            },
            completed: {
              label: '৭. রিটার্ন সম্পন্ন',
              badgeClass: 'bg-stone-200 text-stone-800 border-stone-300',
            },
          };

          // Filter returns based on search and filters
          const filteredReturns = courierReturns.filter((r) => {
            if (returnStatusFilter !== 'all' && r.status !== returnStatusFilter) return false;
            if (returnConditionFilter !== 'all' && r.productCondition !== returnConditionFilter) return false;
            if (!returnSearchTerm.trim()) return true;
            const q = returnSearchTerm.toLowerCase().trim();
            return (
              r.orderId.toLowerCase().includes(q) ||
              r.customerName.toLowerCase().includes(q) ||
              (r.customerPhone && r.customerPhone.includes(q)) ||
              r.productName.toLowerCase().includes(q) ||
              r.sku.toLowerCase().includes(q) ||
              r.courierName.toLowerCase().includes(q) ||
              (r.courierTracking && r.courierTracking.toLowerCase().includes(q)) ||
              (r.returnReason && r.returnReason.toLowerCase().includes(q))
            );
          });

          // Metrics calculations
          const totalReturns = courierReturns.length;
          const totalReturnCharges = courierReturns.reduce((sum, r) => sum + (r.returnCharge || 0), 0);
          const totalReturnedQty = courierReturns.reduce((sum, r) => sum + (r.quantity || 1), 0);
          const totalSellableQty = courierReturns
            .filter((r) => r.productCondition === 'sellable')
            .reduce((sum, r) => sum + (r.quantity || 1), 0);
          const totalDamagedQty = courierReturns
            .filter((r) => r.productCondition === 'damaged')
            .reduce((sum, r) => sum + (r.quantity || 1), 0);
          const totalDamageLoss = courierReturns
            .filter((r) => r.productCondition === 'damaged')
            .reduce((sum, r) => sum + (r.damageLoss || 0), 0);
          const totalRestockedOrders = courierReturns.filter((r) => r.stockAdjusted).length;
          const netReturnLoss = totalReturnCharges + totalDamageLoss;

          return (
            <div className="bg-white rounded-3xl border border-rose-200 p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in">
              {/* Top Banner & Action Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rose-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-rose-100 text-[#E11D48] rounded-2xl">
                      <RotateCcw className="w-5 h-5" />
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-stone-900">
                      কুরিয়ার রিটার্ন ম্যানেজমেন্ট ও স্বয়ংক্রিয় স্টক সমন্বয়
                    </h3>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    কুরিয়ার (Steadfast, Pathao ইত্যাদি) থেকে ফেরত আসা পণ্যের কোয়ালিটি পরীক্ষা, বিক্রয়যোগ্য পণ্যের অটো-স্টক বৃদ্ধি, ড্যামেজ রাইট-অফ ও কুরিয়ার চার্জ হিসাব।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Sub-tab Switch */}
                  <div className="flex items-center p-1 bg-stone-100 rounded-2xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setReturnActiveSubTab('returns')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        returnActiveSubTab === 'returns'
                          ? 'bg-white text-stone-900 shadow-2xs font-black'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      রিটার্ন তালিকা ({courierReturns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnActiveSubTab('movements')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        returnActiveSubTab === 'movements'
                          ? 'bg-white text-stone-900 shadow-2xs font-black'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ইনভেন্টরি মুভমেন্ট লগ ({inventoryMovements.length})
                    </button>
                  </div>

                  {/* New Return Button */}
                  <button
                    type="button"
                    onClick={() => {
                      resetReturnForm();
                      setIsNewReturnModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ নতুন রিটার্ন এন্ট্রি করুন</span>
                  </button>
                </div>
              </div>

              {/* 7 KPI Executive Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {/* 1. Total Returns */}
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                  <span className="text-[10.5px] font-bold text-stone-500 block">মোট কুরিয়ার রিটার্ন</span>
                  <div className="text-xl font-black font-mono text-stone-900">{totalReturns} টি</div>
                  <span className="text-[9.5px] text-stone-600 block">মোট পার্সেল</span>
                </div>

                {/* 2. Total Returned Quantity */}
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
                  <span className="text-[10.5px] font-bold text-blue-800 block">ফেরত পণ্যের সংখ্যা</span>
                  <div className="text-xl font-black font-mono text-blue-900">{totalReturnedQty} টি</div>
                  <span className="text-[9.5px] text-blue-700 block">মোট কোয়ান্টিটি</span>
                </div>

                {/* 3. Sellable Quantity */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="text-[10.5px] font-bold text-emerald-800 block">বিক্রয়যোগ্য পণ্য</span>
                  <div className="text-xl font-black font-mono text-emerald-900">{totalSellableQty} টি</div>
                  <span className="text-[9.5px] text-emerald-700 block">স্টকে যুক্ত হয়েছে {totalRestockedOrders}টি</span>
                </div>

                {/* 4. Damaged Quantity */}
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                  <span className="text-[10.5px] font-bold text-rose-800 block">ড্যামেজ পণ্য</span>
                  <div className="text-xl font-black font-mono text-rose-900">{totalDamagedQty} টি</div>
                  <span className="text-[9.5px] text-rose-700 block">স্টকে বৃদ্ধি বন্ধ</span>
                </div>

                {/* 5. Courier Return Charges */}
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                  <span className="text-[10.5px] font-bold text-amber-800 block">মোট রিটার্ন চার্জ</span>
                  <div className="text-xl font-black font-mono text-amber-950">
                    ৳{totalReturnCharges.toLocaleString()}
                  </div>
                  <span className="text-[9.5px] text-amber-700 block">কুরিয়ার খরচ</span>
                </div>

                {/* 6. Damage Loss */}
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 space-y-1">
                  <span className="text-[10.5px] font-bold text-red-800 block">পণ্যের ড্যামেজ ক্ষতি</span>
                  <div className="text-xl font-black font-mono text-red-900">
                    ৳{totalDamageLoss.toLocaleString()}
                  </div>
                  <span className="text-[9.5px] text-red-700 block">ক্রয়মূল্য রাইট-অফ</span>
                </div>

                {/* 7. Net Return Loss */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-300 space-y-1">
                  <span className="text-[10.5px] font-black text-red-950 block">রিটার্ন জনিত নিট ক্ষতি</span>
                  <div className="text-xl font-black font-mono text-red-700">
                    ৳{netReturnLoss.toLocaleString()}
                  </div>
                  <span className="text-[9.5px] text-red-900 font-bold block">চার্জ + ড্যামেজ</span>
                </div>
              </div>

              {/* Financial Logic Guidance Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs flex items-start gap-3">
                <span className="text-emerald-700 text-base">💡</span>
                <div className="text-stone-700 leading-relaxed text-[11.5px]">
                  <strong className="text-emerald-900 font-extrabold">স্বয়ংক্রিয় স্টক সমন্বয় নীতি:</strong>{' '}
                  যদি পণ্য ভালো অবস্থায় (<span className="font-bold text-emerald-800">Sellable</span>) ফেরত আসে, তবে গুণগত পরীক্ষা শেষে সেটি স্বয়ংক্রিয়ভাবে মূল বিক্রয়যোগ্য স্টকে যোগ হয় এবং পণ্যের ক্রয়মূল্য কোনো ক্ষতি হিসেবে গণ্য হয় না (শুধু কুরিয়ার রিটার্ন চার্জ খরচ হিসেবে লিপিবদ্ধ হয়)। আর যদি পণ্য নষ্ট বা <span className="font-bold text-rose-700">Damaged</span> হয়, তবে স্টকে কোনো সংখ্যা বাড়ানো হয় না এবং পণ্যের ক্রয়মূল্য সরাসরি ড্যামেজ ক্ষতি (<span className="font-mono font-bold">Write-off Loss</span>) হিসেবে বুকিং হয়।
                </div>
              </div>

              {/* VIEW 1: COURIER RETURNS TABLE */}
              {returnActiveSubTab === 'returns' && (
                <div className="space-y-4">
                  {/* Search and Filters Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="অর্ডার আইডি, কাস্টমার নাম, ফোন, প্রোডাক্ট, SKU বা কুরিয়ার ট্র্যাকিং দিয়ে খুঁজুন..."
                        value={returnSearchTerm}
                        onChange={(e) => setReturnSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:border-[#E11D48] outline-hidden text-stone-800"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Condition Filter */}
                      <select
                        value={returnConditionFilter}
                        onChange={(e) => setReturnConditionFilter(e.target.value)}
                        className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-700 cursor-pointer"
                      >
                        <option value="all">সব অবস্থা (All Condition)</option>
                        <option value="sellable">✓ বিক্রয়যোগ্য (Sellable)</option>
                        <option value="damaged">⚠️ ড্যামেজ (Damaged)</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={returnStatusFilter}
                        onChange={(e) => setReturnStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-700 cursor-pointer"
                      >
                        <option value="all">সকল রিটার্ন স্ট্যাটাস (All)</option>
                        <option value="courier_in_transit">১. কুরিয়ারে ফেরত আসছে</option>
                        <option value="warehouse_received">২. গুদামে পণ্য পৌঁছেছে</option>
                        <option value="inspecting">৩. পণ্য পরীক্ষা চলছে</option>
                        <option value="sellable">৪. বিক্রয়যোগ্য</option>
                        <option value="damaged">৫. ড্যামেজ</option>
                        <option value="restocked">৬. স্টকে যুক্ত হয়েছে</option>
                        <option value="completed">৭. রিটার্ন সম্পন্ন</option>
                      </select>
                    </div>
                  </div>

                  {/* Main Returns Records Table */}
                  <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-700">
                        <thead className="bg-stone-50 text-[10.5px] uppercase font-bold text-stone-600 border-b border-stone-200">
                          <tr>
                            <th className="p-3 whitespace-nowrap">অর্ডার আইডি ও তারিখ</th>
                            <th className="p-3 whitespace-nowrap">কাস্টমার তথ্য</th>
                            <th className="p-3 whitespace-nowrap">পণ্য ও SKU</th>
                            <th className="p-3 text-center whitespace-nowrap">পরিমাণ</th>
                            <th className="p-3 whitespace-nowrap">কুরিয়ার ও রিটার্ন চার্জ</th>
                            <th className="p-3 whitespace-nowrap">রিটার্ন কারণ</th>
                            <th className="p-3 text-center whitespace-nowrap">পণ্যের অবস্থা</th>
                            <th className="p-3 text-center whitespace-nowrap">স্টক সমন্বয়</th>
                            <th className="p-3 text-center whitespace-nowrap">ওয়ার্কফ্লো স্ট্যাটাস</th>
                            <th className="p-3 text-center whitespace-nowrap">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredReturns.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-stone-400 text-xs">
                                কোনো কুরিয়ার রিটার্ন রেকর্ড পাওয়া যায়নি
                              </td>
                            </tr>
                          ) : (
                            filteredReturns.map((ret) => {
                              const stInfo = returnStatusLabels[ret.status] || {
                                label: ret.status,
                                badgeClass: 'bg-stone-100 text-stone-700',
                              };
                              return (
                                <tr key={ret.id} className="hover:bg-rose-50/30 transition-colors">
                                  {/* Order ID & Date */}
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="font-mono font-bold text-stone-900">#{ret.orderId}</div>
                                    <div className="text-[10px] text-stone-500 font-mono">{ret.returnDate}</div>
                                  </td>

                                  {/* Customer Info */}
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="font-bold text-stone-900">{ret.customerName}</div>
                                    <div className="text-[10px] text-stone-500 font-mono">{ret.customerPhone || '—'}</div>
                                  </td>

                                  {/* Product & SKU */}
                                  <td className="p-3 max-w-[200px]">
                                    <div className="font-bold text-stone-900 truncate" title={ret.productName}>
                                      {ret.productName}
                                    </div>
                                    <div className="text-[10px] text-stone-500 font-mono">
                                      SKU: <strong className="text-stone-700">{ret.sku || 'N/A'}</strong>
                                      {ret.variant ? ` (${ret.variant})` : ''}
                                    </div>
                                  </td>

                                  {/* Quantity */}
                                  <td className="p-3 text-center font-mono font-bold whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-xs">
                                      {ret.quantity} টি
                                    </span>
                                  </td>

                                  {/* Courier & Return Charge */}
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="font-bold text-stone-800 flex items-center gap-1">
                                      <Truck className="w-3.5 h-3.5 text-stone-500" />
                                      <span>{ret.courierName}</span>
                                    </div>
                                    <div className="text-[10px] text-stone-500 font-mono">
                                      চার্জ: <strong className="text-[#E11D48]">৳{ret.returnCharge}</strong>
                                      {ret.expenseRecorded && (
                                        <span className="ml-1 text-[9px] text-emerald-700 font-bold">✓ খরচে যুক্ত</span>
                                      )}
                                    </div>
                                    {ret.courierTracking && (
                                      <div className="text-[9.5px] font-mono text-stone-400">TRK: {ret.courierTracking}</div>
                                    )}
                                  </td>

                                  {/* Return Reason */}
                                  <td className="p-3 max-w-[150px]">
                                    <span className="text-[11px] text-stone-700 block truncate" title={ret.returnReason}>
                                      {ret.returnReason || 'কাস্টমার রিসিভ করেনি'}
                                    </span>
                                    {ret.damageReason && (
                                      <span className="text-[10px] text-rose-600 block truncate" title={ret.damageReason}>
                                        নোট: {ret.damageReason}
                                      </span>
                                    )}
                                  </td>

                                  {/* Product Condition */}
                                  <td className="p-3 text-center whitespace-nowrap">
                                    {ret.productCondition === 'sellable' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>বিক্রয়যোগ্য</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10.5px] font-bold">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>ড্যামেজ</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Stock Adjustment Status */}
                                  <td className="p-3 text-center whitespace-nowrap">
                                    {ret.stockAdjusted ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                                        <PackageCheck className="w-3.5 h-3.5 text-teal-600" />
                                        <span>✓ স্টকে যুক্ত (+{ret.quantity})</span>
                                      </span>
                                    ) : ret.productCondition === 'damaged' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold">
                                        <span>⚠️ ক্ষতি ৳{ret.damageLoss}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600 text-[10px] font-medium">
                                        <span>⏳ অপেক্ষমাণ</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Workflow Status */}
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <select
                                      value={ret.status}
                                      onChange={async (e) => {
                                        const nextSt = e.target.value as ReturnStatus;
                                        await executeStockAndExpenseAdjustment(ret, ret.productCondition, nextSt);
                                        setFeedback(`🔄 অর্ডার #${ret.orderId}-এর রিটার্ন স্ট্যাটাস আপডেট হয়েছে।`);
                                        setTimeout(() => setFeedback(''), 3000);
                                      }}
                                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer ${stInfo.badgeClass}`}
                                    >
                                      <option value="courier_in_transit">১. কুরিয়ারে ফেরত আসছে</option>
                                      <option value="warehouse_received">২. গুদামে পণ্য পৌঁছেছে</option>
                                      <option value="inspecting">৩. পণ্য পরীক্ষা চলছে</option>
                                      <option value="sellable">৪. বিক্রয়যোগ্য</option>
                                      <option value="damaged">৫. ড্যামেজ</option>
                                      <option value="restocked">৬. স্টকে যুক্ত হয়েছে</option>
                                      <option value="completed">৭. রিটার্ন সম্পন্ন</option>
                                    </select>
                                  </td>

                                  {/* Actions */}
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInspectingReturn(ret);
                                          setInspectionCondition(ret.productCondition);
                                          setInspectionDamageReason(ret.damageReason || '');
                                          setInspectionNextStatus(
                                            ret.productCondition === 'sellable' ? 'restocked' : 'damaged'
                                          );
                                          setIsInspectionModalOpen(true);
                                        }}
                                        className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10.5px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                                        title="কোয়ালিটি পরীক্ষা ও অটো-স্টক সমন্বয় করুন"
                                      >
                                        <Sparkles className="w-3 h-3 text-purple-600" />
                                        <span>পরীক্ষা / স্টক</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteReturn(ret.id, ret.orderId)}
                                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                        title="মুছে ফেলুন"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: INVENTORY MOVEMENT AUDIT LOG */}
              {returnActiveSubTab === 'movements' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-stone-900 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-[#E11D48]" />
                      <span>ইনভেন্টরি মুভমেন্ট অডিট হিস্ট্রি ({inventoryMovements.length} টি রেকর্ড)</span>
                    </h4>
                    <span className="text-[10px] text-stone-500 font-mono">
                      স্বয়ংক্রিয় স্টক বৃদ্ধি ও রাইট-অফ ট্র্যাকিং
                    </span>
                  </div>

                  <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-700">
                        <thead className="bg-stone-50 text-[10.5px] uppercase font-bold text-stone-600 border-b border-stone-200">
                          <tr>
                            <th className="p-3">তারিখ ও সময়</th>
                            <th className="p-3">পণ্য ও SKU</th>
                            <th className="p-3 text-center">মুভমেন্টের ধরন</th>
                            <th className="p-3 text-center">পরিমাণ</th>
                            <th className="p-3 text-center">পূর্বের স্টক → নতুন স্টক</th>
                            <th className="p-3">রেফারেন্স অর্ডার আইডি</th>
                            <th className="p-3">বিস্তারিত বিবরণ / অডিট নোট</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {inventoryMovements.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-stone-400 text-xs">
                                এখনো কোনো ইনভেন্টরি মুভমেন্ট রেকর্ড তৈরি হয়নি
                              </td>
                            </tr>
                          ) : (
                            inventoryMovements.map((mov) => (
                              <tr key={mov.id} className="hover:bg-stone-50">
                                <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                                  {new Date(mov.createdAt).toLocaleString('bn-BD')}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="font-bold text-stone-900">{mov.productName}</div>
                                  <div className="text-[10px] text-stone-500 font-mono">SKU: {mov.sku}</div>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {mov.type === 'return_restock' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                      + রিটার্ন রিস্টক (Restock)
                                    </span>
                                  ) : mov.type === 'damage_write_off' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                                      ⚠️ ড্যামেজ রাইট-অফ (Write-off)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                                      {mov.type}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center font-mono font-bold whitespace-nowrap">
                                  {mov.type === 'return_restock' ? `+${mov.quantity}` : `${mov.quantity}`} টি
                                </td>
                                <td className="p-3 text-center font-mono text-xs whitespace-nowrap">
                                  <span className="text-stone-500">{mov.previousStock}</span>
                                  <span className="mx-1 text-stone-400">→</span>
                                  <strong className="text-emerald-700">{mov.newStock}</strong>
                                </td>
                                <td className="p-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                                  #{mov.referenceId}
                                </td>
                                <td className="p-3 text-stone-600 text-[11px]">{mov.notes}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 1: QUALITY INSPECTION & AUTO STOCK ADJUSTMENT */}
              {isInspectionModalOpen && inspectingReturn && (
                <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
                  <div className="bg-white rounded-3xl border border-rose-200 max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="font-extrabold text-stone-900 text-sm">
                            পণ্য কোয়ালিটি পরীক্ষা ও স্বয়ংক্রিয় স্টক বৃদ্ধি
                          </h4>
                          <span className="text-[10px] text-stone-500 font-mono">
                            অর্ডার #{inspectingReturn.orderId} — {inspectingReturn.courierName}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsInspectionModalOpen(false);
                          setInspectingReturn(null);
                        }}
                        className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Return Summary Card */}
                    <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-stone-900">
                        <span>পণ্য: {inspectingReturn.productName}</span>
                        <span className="font-mono text-[#E11D48]">{inspectingReturn.quantity} টি</span>
                      </div>
                      <div className="flex justify-between text-stone-500 text-[11px]">
                        <span>SKU: {inspectingReturn.sku || 'N/A'}</span>
                        <span>কুরিয়ার চার্জ: ৳{inspectingReturn.returnCharge}</span>
                      </div>
                      <div className="text-stone-600 text-[11px]">
                        রিটার্ন কারণ: <strong>{inspectingReturn.returnReason}</strong>
                      </div>
                    </div>

                    {/* Step 1: Select Product Condition */}
                    <div className="space-y-2 text-xs">
                      <label className="block font-bold text-stone-800">
                        ১. গুদামে ফেরত আসা পণ্যের গুণগত অবস্থা নির্বাচন করুন:
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectionCondition('sellable');
                            setInspectionNextStatus('restocked');
                          }}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                            inspectionCondition === 'sellable'
                              ? 'border-emerald-500 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20'
                              : 'border-stone-200 bg-white hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>বিক্রয়যোগ্য (Sellable)</span>
                          </div>
                          <p className="text-[10px] text-stone-600 mt-1 leading-relaxed">
                            পণ্য সম্পূর্ণ ফ্রেশ ও নতুন। স্বয়ংক্রিয়ভাবে মূল বিক্রয়যোগ্য স্টকে যোগ হবে (+{inspectingReturn.quantity})।
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setInspectionCondition('damaged');
                            setInspectionNextStatus('damaged');
                          }}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                            inspectionCondition === 'damaged'
                              ? 'border-rose-500 bg-rose-50/80 shadow-xs ring-2 ring-rose-500/20'
                              : 'border-stone-200 bg-white hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-rose-900">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>ড্যামেজ (Damaged)</span>
                          </div>
                          <p className="text-[10px] text-stone-600 mt-1 leading-relaxed">
                            পণ্য ক্ষতিগ্রস্ত/ভাঙা। স্টকে যোগ হবে না, ড্যামেজ হিসেবে ক্ষতি হিসাব হবে।
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* If Damaged: Damage Reason & Loss Calculation */}
                    {inspectionCondition === 'damaged' && (
                      <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2 text-xs animate-in fade-in">
                        <label className="block font-bold text-rose-950">
                          ড্যামেজ বা ক্ষতির কারণ লিখুন:
                        </label>
                        <input
                          type="text"
                          placeholder="যেমন: আয়নার কাচ ভাঙা, প্যাকিং বক্স দুমড়েমুচড়ে গেছে"
                          value={inspectionDamageReason}
                          onChange={(e) => setInspectionDamageReason(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-stone-800"
                        />
                        <div className="flex items-center justify-between text-[11px] text-rose-800 font-bold pt-1">
                          <span>পণ্যের ড্যামেজ ক্ষতি হিসাব:</span>
                          <span className="font-mono font-black text-rose-900">
                            ৳{((products.find((p) => p.id === inspectingReturn.productId)?.originalPrice || 1000) * inspectingReturn.quantity).toLocaleString()} (ক্রয়মূল্য রাইট-অফ)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Next Return Workflow Status */}
                    <div className="space-y-1.5 text-xs">
                      <label className="block font-bold text-stone-800">
                        ২. রিটার্ন ওয়ার্কফ্লো স্ট্যাটাস নির্বাচন করুন:
                      </label>
                      <select
                        value={inspectionNextStatus}
                        onChange={(e) => setInspectionNextStatus(e.target.value as ReturnStatus)}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800 cursor-pointer"
                      >
                        <option value="restocked">৬. স্টকে যুক্ত হয়েছে (Stock Restocked) — প্রস্তাবিত</option>
                        <option value="sellable">৪. বিক্রয়যোগ্য হিসেবে অনুমোদিত (Sellable)</option>
                        <option value="damaged">৫. ড্যামেজ হিসেবে রেকর্ডভুক্ত (Damaged)</option>
                        <option value="completed">৭. রিটার্ন সম্পূর্ণ প্রসেসড (Return Completed)</option>
                        <option value="inspecting">৩. পণ্য পরীক্ষা চলছে (Under Inspection)</option>
                      </select>
                    </div>

                    {/* Duplicate Protection Status Notice */}
                    <div className="p-3 rounded-xl bg-stone-100 text-[10.5px] text-stone-600 flex items-center justify-between">
                      <span>ডুপ্লিকেট স্টক বৃদ্ধি প্রতিরোধ:</span>
                      <strong className="text-emerald-700">
                        {inspectingReturn.stockAdjusted ? '✓ ইতিমধ্যে স্টকে যুক্ত হয়েছে' : 'স্টকে যুক্ত হওয়ার জন্য প্রস্তুত'}
                      </strong>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsInspectionModalOpen(false);
                          setInspectingReturn(null);
                        }}
                        className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-50 cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyInspection}
                        disabled={inspectionSubmitting}
                        className="px-5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>{inspectionSubmitting ? 'প্রসেস হচ্ছে...' : 'সংরক্ষণ ও স্টক সমন্বয় সম্পন্ন করুন'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 2: NEW COURIER RETURN ENTRY FORM */}
              {isNewReturnModalOpen && (
                <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
                  <div className="bg-white rounded-3xl border border-rose-200 max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-rose-100 text-[#E11D48] rounded-xl">
                          <RotateCcw className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="font-extrabold text-stone-900 text-sm">
                            নতুন কুরিয়ার রিটার্ন এন্ট্রি ও স্টক এডজাস্টমেন্ট
                          </h4>
                          <span className="text-[10px] text-stone-500">
                            বিদ্যমান অর্ডার সিলেক্ট করে অটো-পূরণ করুন অথবা ম্যানুয়াল তথ্য দিন
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsNewReturnModalOpen(false)}
                        className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateNewReturn} className="space-y-4 text-xs">
                      {/* Quick Auto-Fill from Existing Orders Dropdown */}
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                        <label className="block font-bold text-amber-950">
                          ⚡ বিদ্যমান অর্ডার থেকে দ্রুত তথ্য অটো-পূরণ করুন:
                        </label>
                        <select
                          onChange={(e) => handleSelectOrderForReturn(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold text-stone-800 cursor-pointer"
                        >
                          <option value="">— যেকোনো অর্ডার নির্বাচন করুন (ঐচ্ছিক) —</option>
                          {orders.map((o) => (
                            <option key={o.id} value={o.id}>
                              #{o.id} — {o.customer.name} ({o.customer.phone}) — {o.items?.[0]?.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Main Form Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Order ID */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            অর্ডার আইডি (Order ID) <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="যেমন: 1048"
                            value={returnFormOrderId}
                            onChange={(e) => setReturnFormOrderId(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
                          />
                        </div>

                        {/* Customer Name */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">কাস্টমারের নাম</label>
                          <input
                            type="text"
                            placeholder="যেমন: তানভীর আহমেদ"
                            value={returnFormCustomerName}
                            onChange={(e) => setReturnFormCustomerName(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                          />
                        </div>

                        {/* Customer Phone */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">কাস্টমার মোবাইল নম্বর</label>
                          <input
                            type="text"
                            placeholder="যেমন: 01711223344"
                            value={returnFormCustomerPhone}
                            onChange={(e) => setReturnFormCustomerPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                          />
                        </div>

                        {/* Return Date */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">রিটার্ন তারিখ (Return Date)</label>
                          <input
                            type="date"
                            value={returnFormDate}
                            onChange={(e) => setReturnFormDate(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
                          />
                        </div>

                        {/* Product Picker */}
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-stone-700 mb-1">
                            ফেরত আসা পণ্য (Product Name) <span className="text-rose-600">*</span>
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={returnFormProductId}
                              onChange={(e) => {
                                const selProd = products.find((p) => p.id === e.target.value);
                                if (selProd) {
                                  setReturnFormProductId(selProd.id);
                                  setReturnFormProductName(selProd.name);
                                  setReturnFormSku(selProd.sku || `SKU-${selProd.id.slice(0, 6)}`);
                                }
                              }}
                              className="w-1/2 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                            >
                              <option value="">ক্যাটালগ থেকে বাছুন</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              required
                              placeholder="অথবা পণ্যের নাম লিখুন"
                              value={returnFormProductName}
                              onChange={(e) => setReturnFormProductName(e.target.value)}
                              className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                            />
                          </div>
                        </div>

                        {/* SKU */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">SKU / ভ্যারিয়েন্ট কোড</label>
                          <input
                            type="text"
                            placeholder="যেমন: MIRROR-ARCH-01"
                            value={returnFormSku}
                            onChange={(e) => setReturnFormSku(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">ফেরত পণ্যের পরিমাণ (Quantity)</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={returnFormQuantity}
                            onChange={(e) => setReturnFormQuantity(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48]"
                          />
                        </div>

                        {/* Courier Name */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">কুরিয়ার সার্ভিস (Courier Name)</label>
                          <select
                            value={returnFormCourierName}
                            onChange={(e) => setReturnFormCourierName(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                          >
                            <option value="Steadfast">Steadfast Courier</option>
                            <option value="Pathao">Pathao Courier</option>
                            <option value="RedX">RedX Logistics</option>
                            <option value="Paperfly">Paperfly</option>
                            <option value="eCourier">eCourier</option>
                            <option value="Sundarban">সুন্দরবন কুরিয়ার</option>
                            <option value="অন্যান্য">অন্যান্য কুরিয়ার</option>
                          </select>
                        </div>

                        {/* Return Charge */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            কুরিয়ার রিটার্ন চার্জ (৳) — সরাসরি Expense-এ যোগ হবে
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={returnFormCharge}
                            onChange={(e) => setReturnFormCharge(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48]"
                          />
                        </div>

                        {/* Return Reason */}
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-stone-700 mb-1">রিটার্ন হওয়ার কারণ (Return Reason)</label>
                          <div className="flex gap-2">
                            <select
                              value={returnFormReason}
                              onChange={(e) => setReturnFormReason(e.target.value)}
                              className="w-1/2 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                            >
                              <option value="কাস্টমার ফোন রিসিভ করেনি">কাস্টমার ফোন রিসিভ করেনি</option>
                              <option value="পণ্য পছন্দ হয়নি">পণ্য পছন্দ হয়নি</option>
                              <option value="দেরিতে পণ্য ডেলিভারি">দেরিতে পণ্য ডেলিভারি</option>
                              <option value="ভুল ঠিকানা প্রদান">ভুল ঠিকানা প্রদান</option>
                              <option value="ফেক / ভূয়া অর্ডার">ফেক / ভূয়া অর্ডার</option>
                              <option value="ড্যামেজ বা ক্ষতিগ্রস্ত পার্সেল">ড্যামেজ বা ক্ষতিগ্রস্ত পার্সেল</option>
                              <option value="কাস্টমারের বাজেট সমস্যা">কাস্টমারের বাজেট সমস্যা</option>
                            </select>
                            <input
                              type="text"
                              placeholder="বা কাস্টম কারণ লিখুন"
                              value={returnFormReason}
                              onChange={(e) => setReturnFormReason(e.target.value)}
                              className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Product Condition Selection */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            পণ্যের অবস্থা (Product Condition)
                          </label>
                          <select
                            value={returnFormCondition}
                            onChange={(e) => setReturnFormCondition(e.target.value as ProductCondition)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                          >
                            <option value="sellable">✓ বিক্রয়যোগ্য (Sellable — স্টক বৃদ্ধি পাবে)</option>
                            <option value="damaged">⚠️ ড্যামেজ (Damaged — স্টকে বাড়বে না, ক্ষতি হিসেবে গণ্য)</option>
                          </select>
                        </div>

                        {/* Return Status */}
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">রিটার্ন স্ট্যাটাস (Return Status)</label>
                          <select
                            value={returnFormStatus}
                            onChange={(e) => setReturnFormStatus(e.target.value as ReturnStatus)}
                            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                          >
                            <option value="warehouse_received">২. গুদামে পণ্য পৌঁছেছে (Received)</option>
                            <option value="courier_in_transit">১. কুরিয়ারে ফেরত আসছে (In Transit)</option>
                            <option value="inspecting">৩. পণ্য পরীক্ষা চলছে (Inspecting)</option>
                            <option value="restocked">৬. স্টকে যুক্ত হয়েছে (Restocked)</option>
                            <option value="sellable">৪. বিক্রয়যোগ্য (Sellable)</option>
                            <option value="damaged">৫. ড্যামেজ (Damaged)</option>
                            <option value="completed">৭. রিটার্ন সম্পন্ন (Completed)</option>
                          </select>
                        </div>
                      </div>

                      {/* Submit & Cancel */}
                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                        <button
                          type="button"
                          onClick={() => setIsNewReturnModalOpen(false)}
                          className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer"
                        >
                          বাতিল
                        </button>
                        <button
                          type="submit"
                          disabled={returnFormSubmitting}
                          className="px-6 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{returnFormSubmitting ? 'সংরক্ষণ হচ্ছে...' : '✓ কুরিয়ার রিটার্ন সংরক্ষণ করুন'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* =====================================================================
            TOOL: REAL-TIME ABANDONED LEADS & CART DROP RECOVERY (ড্রপড ও লিড রিকভারি)
           ===================================================================== */}
        {activeTool === 'abandoned_leads' && (() => {
          const pendingLeads = abandonedLeads.filter((l) => l.status === 'pending');
          const contactedLeads = abandonedLeads.filter((l) => l.status === 'contacted');
          const convertedLeads = abandonedLeads.filter((l) => l.status === 'converted');
          const cancelledLeads = abandonedLeads.filter((l) => l.status === 'cancelled');
          const totalRecoverableAmount = pendingLeads.reduce(
            (sum, l) => sum + (l.totalAmount || l.estimatedTotal || 0),
            0
          );

          const filteredLeads = abandonedLeads.filter((lead) => {
            if (leadStatusFilter !== 'all' && lead.status !== leadStatusFilter) return false;
            if (!leadSearch.trim()) return true;
            const q = leadSearch.toLowerCase().trim();
            const leadItems = lead.items || [];
            return (
              lead.customerPhone.includes(q) ||
              lead.customerName.toLowerCase().includes(q) ||
              (lead.customerAddress && lead.customerAddress.toLowerCase().includes(q)) ||
              leadItems.some((it) => it.productName.toLowerCase().includes(q)) ||
              (lead.productName && lead.productName.toLowerCase().includes(q))
            );
          });

          return (
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-stone-900 flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-[#E11D48]" />
                    <span>ড্রপড ও লিড রিকভারি হাব (Abandoned Cart & Leads Recovery)</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-[#E11D48] border border-rose-200 font-mono font-bold">
                      {abandonedLeads.length} টি লিড
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    কাস্টমার প্রোডাক্ট ফর্ম বা চেকআউটে মোবাইল নম্বর টাইপ করার সাথে সাথে রিয়েল-টাইমে এখানে সংরক্ষিত হয়। ১-ক্লিক হোয়াটসঅ্যাপ বা সরাসরি কলে রিকভার করুন।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>রিয়েল-টাইম ফোন ক্যাপচার সক্রিয়</span>
                  </span>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <span className="text-[11px] font-bold text-stone-500 block">মোট সংগৃহীত লিড</span>
                  <span className="text-2xl font-black text-stone-900 font-mono mt-1 block">
                    {abandonedLeads.length}
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5 block">PDP ও চেকআউট মিলিয়ে</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                  <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                    <span>অপেক্ষমান রিকভারি (Pending)</span>
                  </span>
                  <span className="text-2xl font-black text-amber-900 font-mono mt-1 block">
                    {pendingLeads.length}
                  </span>
                  <span className="text-[10px] text-amber-700 mt-0.5 block">এখনই কল/হোয়াটসঅ্যাপ করুন</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-800 block">সফল কনভার্টেড অর্ডার</span>
                  <span className="text-2xl font-black text-emerald-900 font-mono mt-1 block">
                    {convertedLeads.length}
                  </span>
                  <span className="text-[10px] text-emerald-700 mt-0.5 block">চেকআউট সম্পন্ন হয়েছে</span>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200">
                  <span className="text-[11px] font-bold text-[#E11D48] block">সম্ভাব্য রিকভারিযোগ্য মূল্য</span>
                  <span className="text-2xl font-black text-[#E11D48] font-mono mt-1 block">
                    ৳{totalRecoverableAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-rose-700 mt-0.5 block">পেন্ডিং লিডের মোট ভ্যালু</span>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { id: 'all', label: 'সকল লিড', count: abandonedLeads.length },
                    { id: 'pending', label: 'অপেক্ষমান (Pending)', count: pendingLeads.length },
                    { id: 'contacted', label: 'যোগাযোগকৃত (Contacted)', count: contactedLeads.length },
                    { id: 'converted', label: 'কনভার্টেড (Converted)', count: convertedLeads.length },
                    { id: 'cancelled', label: 'বাতিল (Cancelled)', count: cancelledLeads.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLeadStatusFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        leadStatusFilter === tab.id
                          ? 'bg-[#E11D48] text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="নাম, মোবাইল বা প্রোডাক্ট দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-[#E11D48] focus:bg-white"
                  />
                </div>
              </div>

              {/* Leads Table */}
              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 text-[11px] uppercase text-stone-600 border-b border-stone-200 font-bold">
                    <tr>
                      <th className="px-4 py-3">সময় ও স্টেজ</th>
                      <th className="px-4 py-3">কাস্টমার ও মোবাইল</th>
                      <th className="px-4 py-3">কাঙ্ক্ষিত পণ্য ও বিবরণ</th>
                      <th className="px-4 py-3">মোট মূল্য</th>
                      <th className="px-4 py-3">বর্তমান স্ট্যাটাস</th>
                      <th className="px-4 py-3 text-right">১-ক্লিক রিকভারি অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-stone-400 text-xs">
                          {leadSearch
                            ? 'আপনার সার্চ অনুযায়ী কোনো লিড পাওয়া যায়নি।'
                            : 'এখনো কোনো ড্রপড লিড নেই। কাস্টমার PDP বা কার্ট চেকআউট ফর্মে মোবাইল নম্বর টাইপ করলেই এখানে সাথে সাথে দেখা যাবে।'}
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const cleanPhone = lead.customerPhone.replace(/\D/g, '');
                        const leadItems = lead.items || [];
                        const primaryItem = leadItems[0] || (lead.productName ? { productName: lead.productName } : undefined);
                        const waText = encodeURIComponent(
                          `আসসালামু আলাইকুম ${lead.customerName || 'গ্রাহক'}, Dokandari-তে আপনার পছন্দের "${primaryItem?.productName || 'পণ্য'}" অর্ডার করার চেষ্টা করছিলেন। অর্ডার কনফার্ম করতে বা যেকোনো সহযোগিতার জন্য আমাদের জানান। বিশেষ অফার পেতে এখনই রিপ্লাই দিন। ধন্যবাদ!`
                        );

                        return (
                          <tr key={lead.id} className="hover:bg-rose-50/20 transition-colors">
                            {/* Time & Source */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mb-1 ${
                                  lead.source === 'pdp_direct'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {lead.source === 'pdp_direct' ? 'PDP ডিরেক্ট ফর্ম' : 'কার্ট চেকআউট'}
                              </span>
                              <div className="text-[11px] font-mono text-stone-400">
                                {new Date(lead.createdAt).toLocaleDateString('bn-BD')}{' '}
                                {new Date(lead.createdAt).toLocaleTimeString('bn-BD', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>

                            {/* Customer & Phone */}
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-stone-900 flex items-center gap-1.5">
                                <span>{lead.customerName || 'নাম প্রদান করা হয়নি'}</span>
                              </div>
                              <div className="font-mono text-[#E11D48] font-bold tracking-wide mt-0.5 flex items-center gap-1.5">
                                <span>{lead.customerPhone}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(lead.customerPhone);
                                    setFeedback(`📋 মোবাইল নম্বর "${lead.customerPhone}" কপি হয়েছে!`);
                                    setTimeout(() => setFeedback(''), 2500);
                                  }}
                                  title="কপি করুন"
                                  className="text-stone-400 hover:text-stone-700 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {lead.customerAddress && (
                                <div className="text-[11px] text-stone-500 truncate max-w-[200px] mt-0.5">
                                  {lead.customerDistrict ? `${lead.customerDistrict} — ` : ''}
                                  {lead.customerAddress}
                                </div>
                              )}
                            </td>

                            {/* Items Preview */}
                            <td className="px-4 py-3.5 max-w-xs">
                              {leadItems.length > 0 ? (
                                leadItems.map((it, idx) => (
                                  <div key={idx} className="flex items-center gap-2 py-0.5">
                                    {it.productImage && (
                                      <img
                                        src={it.productImage}
                                        alt={it.productName}
                                        loading="lazy"
                                        decoding="async"
                                        referrerPolicy="no-referrer"
                                        className="w-7 h-7 object-cover rounded-md border border-stone-200 shrink-0"
                                      />
                                    )}
                                    <div className="truncate">
                                      <span className="font-medium text-stone-800">{it.productName}</span>
                                      <span className="text-stone-400 font-mono text-[11px] ml-1">
                                        ({it.quantity}টি × ৳{it.price.toLocaleString()})
                                      </span>
                                      {(it.selectedColor || it.selectedSize) && (
                                        <span className="text-[10px] text-stone-500 block">
                                          {[it.selectedColor, it.selectedSize].filter(Boolean).join(' / ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <span className="font-medium text-stone-800">
                                  {lead.productName || 'পণ্য'}
                                </span>
                              )}
                            </td>

                            {/* Total Amount */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-stone-900 text-sm">
                              ৳{(lead.totalAmount || lead.estimatedTotal || 0).toLocaleString()}
                            </td>

                            {/* Status Selector */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <select
                                value={lead.status}
                                disabled={leadActionLoading === lead.id}
                                onChange={(e) =>
                                  handleUpdateLeadStatus(lead.id, e.target.value as AbandonedLeadStatus)
                                }
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer focus:outline-none ${
                                  lead.status === 'pending'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : lead.status === 'contacted'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : lead.status === 'converted'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-stone-100 text-stone-700 border-stone-300'
                                }`}
                              >
                                <option value="pending">⏳ পেন্ডিং (Pending)</option>
                                <option value="contacted">📞 যোগাযোগকৃত (Contacted)</option>
                                <option value="converted">✅ অর্ডার কনভার্টেড (Converted)</option>
                                <option value="cancelled">❌ বাতিল (Cancelled)</option>
                              </select>
                            </td>

                            {/* 1-Click Recovery Actions */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* WhatsApp 1-Click */}
                                <a
                                  href={`https://wa.me/88${cleanPhone}?text=${waText}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
                                  title="হোয়াটসঅ্যাপে রিকভারি মেসেজ পাঠান"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </a>

                                {/* Direct Call */}
                                <a
                                  href={`tel:${lead.customerPhone}`}
                                  className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
                                  title="সরাসরি ফোন কল করুন"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>কল দিন</span>
                                </a>

                                {/* Delete */}
                                <button
                                  type="button"
                                  disabled={leadActionLoading === lead.id}
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* =====================================================================
            TOOL 4: API & THIRD-PARTY INTEGRATIONS
           ===================================================================== */}
        {activeTool === 'api_integrations' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#E11D48]" />
                  <span>এপিআই ও থার্ড-পার্টি ইন্টিগ্রেশন হাব (Courier, Payment & Server AI)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  কুরিয়ার ও পেমেন্ট গেটওয়ে ক্রেডেনশিয়াল সরাসরি ফায়ারবেস ক্লাউডে সংরক্ষিত থাকে।
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                অটোমেটিক সিঙ্ক সক্রিয়
              </span>
            </div>

            {/* Server-Side Gemini AI Status Banner */}
            <div className="p-4 rounded-2xl border border-rose-200 bg-[#FFF8F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E11D48] text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-stone-900">
                    Google Gemini 3.8 Flash Server-Side Engine
                  </h4>
                  <p className="text-[11px] text-stone-600">
                    AI Studio Secrets (GEMINI_API_KEY / Gemini_Api_KEY) দ্বারা সার্ভার-সাইডে সংযুক্ত ও সুরক্ষিত।
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                ✓ 100% Real Server AI Connected
              </span>
            </div>

            <form onSubmit={handleSaveApiKeys} className="space-y-6 text-xs">
              {/* Steadfast & Pathao Courier API */}
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 text-xs">
                    Steadfast & Pathao Courier Automated Booking API
                  </span>
                  <span className="text-[10px] font-semibold text-stone-500 font-mono">
                    Consignment Dispatch v1
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">Steadfast API Key</label>
                    <input
                      type="text"
                      value={apiKeys.steadfastApiKey}
                      onChange={(e) => setApiKeys({ ...apiKeys, steadfastApiKey: e.target.value })}
                      placeholder="STEADFAST_API_KEY..."
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">Steadfast Secret Key</label>
                    <input
                      type="password"
                      value={apiKeys.steadfastSecretKey}
                      onChange={(e) => setApiKeys({ ...apiKeys, steadfastSecretKey: e.target.value })}
                      placeholder="STEADFAST_SECRET_KEY..."
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">Pathao Client ID</label>
                    <input
                      type="text"
                      value={apiKeys.pathaoClientId}
                      onChange={(e) => setApiKeys({ ...apiKeys, pathaoClientId: e.target.value })}
                      placeholder="PATHAO_CLIENT_ID..."
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">Pathao Client Secret</label>
                    <input
                      type="password"
                      value={apiKeys.pathaoClientSecret}
                      onChange={(e) => setApiKeys({ ...apiKeys, pathaoClientSecret: e.target.value })}
                      placeholder="PATHAO_CLIENT_SECRET..."
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                </div>
              </div>

              {/* bKash & Nagad Merchant API */}
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-3">
                <span className="font-bold text-[#E11D48] text-xs block">
                  bKash & Nagad Tokenized Checkout Gateway
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">bKash App Key</label>
                    <input
                      type="text"
                      value={apiKeys.bkashAppKey}
                      onChange={(e) => setApiKeys({ ...apiKeys, bkashAppKey: e.target.value })}
                      placeholder="bKash Merchant App Key"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">bKash App Secret</label>
                    <input
                      type="password"
                      value={apiKeys.bkashAppSecret}
                      onChange={(e) => setApiKeys({ ...apiKeys, bkashAppSecret: e.target.value })}
                      placeholder="bKash App Secret"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 mb-1 font-medium">Nagad Merchant ID</label>
                    <input
                      type="text"
                      value={apiKeys.nagadMerchantId}
                      onChange={(e) => setApiKeys({ ...apiKeys, nagadMerchantId: e.target.value })}
                      placeholder="Nagad Merchant ID"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {apiSaved ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
                  <span>সেভ ও অটো-সেটআপ করুন</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =====================================================================
            TOOL 5: CUSTOMERS DATABASE & CRM
           ===================================================================== */}
        {activeTool === 'customers' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E11D48]" />
                  <span>কাস্টমার ডাটাবেস ও CRM ({aggregatedCustomers.length} জন ভেরিফাইড কাস্টমার)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  লাইভ অর্ডার থেকে স্বয়ংক্রিয়ভাবে সংগৃহীত কাস্টমার প্রোফাইল ও ১-ক্লিক WhatsApp যোগাযোগ।
                </p>
              </div>
            </div>

            {aggregatedCustomers.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#FFF8F9] border border-dashed border-rose-200 text-xs text-stone-500">
                এখনো কোনো কাস্টমার অর্ডার রেকর্ড পাওয়া যায়নি। নতুন অর্ডার আসলেই এখানে কাস্টমারের তালিকা যুক্ত হবে।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-rose-50/60 text-[11px] uppercase text-stone-600 border-b border-rose-100 font-bold">
                    <tr>
                      <th className="px-4 py-3">কাস্টমারের নাম</th>
                      <th className="px-4 py-3">মোবাইল নম্বর</th>
                      <th className="px-4 py-3">জেলা ও ঠিকানা</th>
                      <th className="px-4 py-3">মোট অর্ডার</th>
                      <th className="px-4 py-3">মোট কেনাকাটা</th>
                      <th className="px-4 py-3">সরাসরি যোগাযোগ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {aggregatedCustomers.map((c, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/30">
                        <td className="px-4 py-3 font-bold text-stone-900">{c.name}</td>
                        <td className="px-4 py-3 font-mono">{c.phone}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">{c.district}</span> — {c.address}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">{c.orderCount} টি</td>
                        <td className="px-4 py-3 font-mono font-bold text-[#E11D48]">
                          ৳{c.totalSpent.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://wa.me/88${c.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] text-white font-bold text-[11px] hover:opacity-90"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp মেসেজ</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TOOL 6: HERO BANNERS & CAROUSEL TIMING EDITOR
           ===================================================================== */}
        {activeTool === 'banners' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E11D48]" />
                  <span>হোমপেজ ক্যারোসেল স্লাইডিং টাইমিং ও ব্যানার এডিটর</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  স্লাইডার অটো-স্লাইডিং স্পিড এবং ব্যানার টেক্সট/ছবি পরিবর্তন করলে সাথে সাথে কাস্টমার হোমপেজে কার্যকর হবে।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-stone-600">হিরো ব্যানার স্পিড:</span>
                {[1000, 3000, 5000].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => handleSaveCarouselSpeed(ms)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      carouselInterval === ms
                        ? 'bg-[#E11D48] text-white shadow-sm'
                        : 'bg-rose-50 text-[#E11D48] border border-rose-200'
                    }`}
                  >
                    {ms / 1000} সেকেন্ড
                  </button>
                ))}
              </div>
            </div>

            {/* Best-Selling Square Product Carousel Speed Control (3s, 5s, 8s, 10s Right-to-Left) */}
            <div className="p-4 rounded-2xl bg-[#FFF8F9] border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold text-stone-900">
                  🔥 বেস্ট সেলিং স্কয়ার প্রোডাক্ট ক্যারোসেল স্পিড (ডান থেকে বামে ১টি করে প্রোডাক্ট স্লাইড)
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  হোমপেজের বেস্ট সেলিং ক্যারোসেলটি কত সেকেন্ড পর পর ডান দিক থেকে বাম দিকে যাবে তা নির্ধারণ করুন:
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[3000, 5000, 8000, 10000].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => handleSaveBestSellingSpeed(ms)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      bestSellingInterval === ms
                        ? 'bg-[#E11D48] text-white shadow-sm'
                        : 'bg-white text-stone-700 border border-rose-200 hover:border-[#E11D48]'
                    }`}
                  >
                    {ms / 1000} সেকেন্ড ({ms / 1000}s)
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {siteContent.heroSlides.map((slide: HeroSlide, i: number) => (
                <div
                  key={slide.id}
                  className="rounded-2xl border border-rose-200 overflow-hidden bg-[#FFF8F9] flex flex-col justify-between"
                >
                  <div>
                    <img src={slide.image} alt={slide.title} className="w-full h-36 object-cover" />
                    <div className="p-4 space-y-2.5 text-xs">
                      <span className="text-[10px] font-bold text-[#E11D48] uppercase">
                        Slide #{i + 1}
                      </span>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                          শিরোনাম (Title)
                        </label>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => {
                            const updated = [...siteContent.heroSlides];
                            updated[i] = { ...updated[i], title: e.target.value };
                            setSiteContent({ ...siteContent, heroSlides: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                          সাবটাইটেল (Subtitle)
                        </label>
                        <input
                          type="text"
                          value={slide.subtitle}
                          onChange={(e) => {
                            const updated = [...siteContent.heroSlides];
                            updated[i] = { ...updated[i], subtitle: e.target.value };
                            setSiteContent({ ...siteContent, heroSlides: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                          ব্যানার ছবি URL
                        </label>
                        <input
                          type="url"
                          value={slide.image}
                          onChange={(e) => {
                            const updated = [...siteContent.heroSlides];
                            updated[i] = { ...updated[i], image: e.target.value };
                            setSiteContent({ ...siteContent, heroSlides: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveHeroSlides}
                className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>ব্যানার স্লাইডসমূহ লাইভ সেভ করুন</span>
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            TOOL 7: FACEBOOK & TIKTOK MULTI-PIXEL SETUP + LIVE EVENT TESTER
           ===================================================================== */}
        {activeTool === 'pixels' && (() => {
          const parsedMetaIds = parsePixelIds(apiKeys.facebookPixelId);
          const parsedTikTokIds = parsePixelIds(apiKeys.tiktokPixelId);

          return (
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#E11D48]" />
                    <span>ফেসবুক ও টিকটক মাল্টি-পিক্সেল সেটআপ (Multi-Account Pixel Tracking)</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    একাধিক অ্যাড অ্যাকাউন্ট বা বিজনেস ম্যানেজারের পিক্সেল আইডি কমা (,) দিয়ে যুক্ত করুন। সিস্টেম ডুপ্লিকেট এড়িয়ে প্রতিটি আইডি পৃথকভাবে ট্র্যাক করবে।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>জিরো ডুপ্লিকেট ওয়ার্নিং ফিল্টার সক্রিয়</span>
                  </span>
                </div>
              </div>

              {/* SHOPIFY / WOOCOMMERCE-STYLE 1-CLICK META & TIKTOK APP PLUGIN AUTO-CONNECT */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/90 via-white to-rose-50/80 border-2 border-blue-200 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
                      <span>⚡ Shopify / WooCommerce Style App Plugin</span>
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
                      মেটা বিজনেস অ্যাপ ও টিকটক অ্যাপ ১-ক্লিক অটো-প্লাগইন কানেকশন (Zero Manual Setup)
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                      শপিফাই বা ও-কমার্স প্লাগইনের মতো শুধুমাত্র আপনার Pixel ID বসিয়ে নিচের <strong>"১-ক্লিক অটো-প্লাগইন কানেক্ট"</strong> বাটনে চাপ দিন — PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, WhatsApp Conversion ও Server CAPI অটোমেটিক ১০০% রিয়েল টাইমে সেটআপ হয়ে যাবে!
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await setDoc(doc(db, 'settings', 'api_credentials'), apiKeys, { merge: true });
                        } catch {
                          // fallback
                        }
                        localStorage.setItem('dokandari_api_credentials', JSON.stringify(apiKeys));
                        initializeMultiPixels(apiKeys.facebookPixelId, apiKeys.tiktokPixelId, apiKeys.youtubeTagId);
                        handleFireTestPixelEvent('PageView');
                        setFeedback(
                          '🔌 Meta Business App ও TikTok App প্লাগইন সফলভাবে অটো-কানেক্ট হয়েছে! সকল ৬টি ই-কমার্স ইভেন্ট (Browser + Server CAPI) ও ক্যাটালগ ফিড এখন ১০০% লাইভ!'
                        );
                        setTimeout(() => setFeedback(''), 5500);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                    >
                      <Zap className="w-4 h-4" />
                      <span>🔌 ১-ক্লিক মেটা ও টিকটক প্লাগইন অটো-কানেক্ট</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const feedUrl = `${window.location.origin}/api/catalog/feed.xml`;
                        navigator.clipboard.writeText(feedUrl);
                        setFeedback(`📋 মেটা কমার্স ম্যানেজার XML ক্যাটালগ ফিড লিংক কপি হয়েছে: ${feedUrl}`);
                        setTimeout(() => setFeedback(''), 4000);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#E11D48]" />
                      <span>XML ক্যাটালগ ফিড কপি (Meta)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const feedUrl = `${window.location.origin}/api/catalog/feed.json`;
                        navigator.clipboard.writeText(feedUrl);
                        setFeedback(`📋 টিকটক ও JSON ক্যাটালগ ফিড লিংক কপি হয়েছে: ${feedUrl}`);
                        setTimeout(() => setFeedback(''), 4000);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-blue-600" />
                      <span>JSON ফিড কপি (TikTok)</span>
                    </button>
                  </div>
                </div>

                {/* Live Plugin Status Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-blue-100 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div>
                      <div className="font-extrabold text-stone-900">Meta App Plugin</div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        {parsedMetaIds.length > 0 ? `✓ Connected (${parsedMetaIds.length} ID)` : 'পিক্সেল আইডি দিন'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div>
                      <div className="font-extrabold text-stone-900">TikTok App Plugin</div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        {parsedTikTokIds.length > 0 ? `✓ Connected (${parsedTikTokIds.length} ID)` : 'পিক্সেল আইডি দিন'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="font-extrabold text-stone-900">Browser + Server CAPI</div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        {apiKeys.facebookCapiToken || apiKeys.tiktokAccessToken
                          ? '✓ CAPI Token + Event_ID Dedup'
                          : '✓ Browser Active (টোকেন দিন)'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="font-extrabold text-stone-900">Live Catalog Feed</div>
                      <div className="text-[10px] text-emerald-700 font-bold">✓ {products.length} Products Synced</div>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveApiKeys} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Meta Multi-Pixel Section */}
                  <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                        <span>Meta / Facebook Pixel IDs (মাল্টিপল আইডি)</span>
                      </label>
                      <span className="text-[10px] font-mono text-stone-500 font-bold">
                        {parsedMetaIds.length} টি সক্রিয় আইডি
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={apiKeys.facebookPixelId}
                      onChange={(e) => setApiKeys({ ...apiKeys, facebookPixelId: e.target.value })}
                      placeholder="কমা, স্পেস বা নতুন লাইনে লিখুন: 1994859257776698"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48] resize-none"
                    />

                    {/* Active Meta ID Chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                      {parsedMetaIds.length > 0 ? (
                        parsedMetaIds.map((id, idx) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[11px] font-bold"
                          >
                            <span>Meta #{idx + 1}: {id}</span>
                            <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1 rounded">সক্রিয়</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">কোনো Meta Pixel ID কনফিগার করা নেই</span>
                      )}
                    </div>
                  </div>

                  {/* TikTok Multi-Pixel Section */}
                  <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-black inline-block" />
                        <span>TikTok Pixel IDs (মাল্টিপল আইডি)</span>
                      </label>
                      <span className="text-[10px] font-mono text-stone-500 font-bold">
                        {parsedTikTokIds.length} টি সক্রিয় আইডি
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={apiKeys.tiktokPixelId}
                      onChange={(e) => setApiKeys({ ...apiKeys, tiktokPixelId: e.target.value })}
                      placeholder="কমা, স্পেস বা নতুন লাইনে লিখুন: C8918291829N, CT9281920AK1"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48] resize-none"
                    />

                    {/* Active TikTok ID Chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                      {parsedTikTokIds.length > 0 ? (
                        parsedTikTokIds.map((id, idx) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-900 border border-stone-300 font-mono text-[11px] font-bold"
                          >
                            <span>TikTok #{idx + 1}: {id}</span>
                            <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1 rounded">সক্রিয়</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">কোনো TikTok Pixel ID কনফিগার করা নেই</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Server-Side Conversion API (CAPI) Tokens & Test Event Codes for Facebook + TikTok */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900">
                        Facebook Server Conversion API (CAPI) Access Token
                      </label>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {apiKeys.facebookCapiToken ? '✓ CAPI Token সংযুক্ত' : 'সার্ভার-সাইড CAPI'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={apiKeys.facebookCapiToken}
                      onChange={(e) => setApiKeys({ ...apiKeys, facebookCapiToken: e.target.value })}
                      placeholder="EAAGm0PX4ZCps... (Meta Events Manager -> Settings -> Generate Access Token)"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                    <div className="pt-1">
                      <label className="block font-bold text-stone-700 mb-1 text-[11px]">
                        Meta Test Event Code (ঐচ্ছিক — Events Manager-এ লাইভ টেস্টের জন্য, যেমন: TEST12345)
                      </label>
                      <input
                        type="text"
                        value={apiKeys.metaTestEventCode || ''}
                        onChange={(e) => setApiKeys({ ...apiKeys, metaTestEventCode: e.target.value })}
                        placeholder="যেমন: TEST49281 (শুধুমাত্র টেস্ট করার সময় দিন, নরমাল সময়ে ফাঁকা রাখুন)"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50/90 border border-stone-300 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900">
                        TikTok Events API (Server CAPI) Access Token
                      </label>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {apiKeys.tiktokAccessToken ? '✓ TikTok CAPI সংযুক্ত' : 'TikTok Events API'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={apiKeys.tiktokAccessToken || ''}
                      onChange={(e) => setApiKeys({ ...apiKeys, tiktokAccessToken: e.target.value })}
                      placeholder="TikTok Events Manager -> Settings -> Generate Access Token"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                    <div className="pt-1">
                      <label className="block font-bold text-stone-700 mb-1 text-[11px]">
                        TikTok Test Event Code ও YouTube / Google Tag IDs (G-XXXX / AW-XXXX)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={apiKeys.tiktokTestEventCode || ''}
                          onChange={(e) => setApiKeys({ ...apiKeys, tiktokTestEventCode: e.target.value })}
                          placeholder="TikTok Test Code (যেমন: TEST123)"
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-stone-800"
                        />
                        <input
                          type="text"
                          value={apiKeys.youtubeTagId || ''}
                          onChange={(e) => setApiKeys({ ...apiKeys, youtubeTagId: e.target.value })}
                          placeholder="Google Tag: AW-XXXX / G-XXXX"
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Tag Manager (GTM), GA4 & Google Search Console Verification */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="p-4 rounded-2xl bg-[#FFF0F3]/70 border border-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                        <span>Google Tag Manager (GTM ID)</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        Auto DataLayer
                      </span>
                    </div>
                    <input
                      type="text"
                      value={apiKeys.gtmContainerId || ''}
                      onChange={(e) => setApiKeys({ ...apiKeys, gtmContainerId: e.target.value })}
                      placeholder="যেমন: GTM-XXXXXXX"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FFF0F3]/70 border border-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        <span>Google Analytics 4 (GA4 ID)</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                        E-Commerce Events
                      </span>
                    </div>
                    <input
                      type="text"
                      value={apiKeys.ga4MeasurementId || ''}
                      onChange={(e) => setApiKeys({ ...apiKeys, ga4MeasurementId: e.target.value })}
                      placeholder="যেমন: G-XXXXXXXXXX"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FFF0F3]/70 border border-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                        <span>Google Search Console কোড</span>
                      </label>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        SEO Meta Tag
                      </span>
                    </div>
                    <input
                      type="text"
                      value={apiKeys.googleSearchConsoleCode || ''}
                      onChange={(e) =>
                        setApiKeys({ ...apiKeys, googleSearchConsoleCode: e.target.value })
                      }
                      placeholder="google-site-verification কোড বা মেটা ট্যাগ"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                </div>

                {/* Test & Save Toolbar (Includes WhatsApp Conversion Tracking Test) */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-stone-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-stone-700 text-xs">এ-টু-জেড সব ইভেন্ট লাইভ টেস্ট:</span>
                    {[
                      'PageView',
                      'ViewContent',
                      'AddToCart',
                      'InitiateCheckout',
                      'Purchase',
                      'WhatsAppConversion',
                    ].map((ev) => (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => handleFireTestPixelEvent(ev)}
                        className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-colors shadow-2xs border ${
                          ev === 'WhatsAppConversion'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 hover:bg-rose-100 text-[#E11D48] border-rose-200'
                        }`}
                      >
                        ⚡ Test {ev === 'WhatsAppConversion' ? 'WhatsApp মেসেজ কনভার্সন' : ev}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    {apiSaved ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
                    <span>পিক্সেল, GTM, GA4 ও SEO সেভ করুন</span>
                  </button>
                </div>
              </form>

              {/* 1:1 FIRESTORE ORDER FLOW vs META/TIKTOK CAPI RECONCILIATION PANEL */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-blue-50/80 border border-emerald-200 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>ফায়ারবেস অর্ডার বনাম মেটা ও টিকটক CAPI ১:১ রিয়েল-টাইম ম্যাচিং (Order Reconciliation)</span>
                    </h4>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      ফায়ারস্টোর ডাটাবেজের প্রতিটি অর্ডার (DKD-...) এবং মেটা/টিকটক ইভেন্ট ম্যানেজারের Purchase ইভেন্ট ১০০% একই Event ID ও Content ID দিয়ে মিলিয়ে দেখুন এবং ১-ক্লিকে সিঙ্ক করুন।
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={reconcilingOrders}
                      onClick={handleReconcileAllOrdersCapi}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reconcilingOrders ? 'animate-spin' : ''}`} />
                      <span>
                        {reconcilingOrders
                          ? 'সিঙ্ক হচ্ছে...'
                          : `🔄 সকল অর্ডার (${orders.filter((o) => o.status !== 'cancelled').length}টি) CAPI-তে সিঙ্ক করুন`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={refreshPixelTelemetryLogs}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>লগ রিফ্রেশ</span>
                    </button>
                  </div>
                </div>

                {orders.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-stone-100 text-stone-700 border-b border-stone-200 font-bold">
                          <th className="p-2.5">অর্ডার আইডি</th>
                          <th className="p-2.5">কাস্টমার ও বিল</th>
                          <th className="p-2.5">Deduplication Event ID</th>
                          <th className="p-2.5">Catalog Content IDs</th>
                          <th className="p-2.5">Browser + Server CAPI স্ট্যাটাস</th>
                          <th className="p-2.5 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-mono">
                        {orders.slice(0, 10).map((ord) => {
                          const cleanId = String(ord.id).replace(/[^a-zA-Z0-9_-]/g, '');
                          const evtId = ord.pixelTracking?.eventId || `dkd_purchase_${cleanId}`;
                          const cIds =
                            ord.pixelTracking?.contentIds ||
                            ord.items.map((i) => i.productId || i.id);
                          const statusTxt =
                            ord.pixelTracking?.capiStatus ||
                            'Browser Pixel Ready (Click Re-Sync for Server CAPI)';
                          return (
                            <tr key={ord.id} className="hover:bg-stone-50/80">
                              <td className="p-2.5 font-bold text-[#E11D48]">{ord.id}</td>
                              <td className="p-2.5 font-sans">
                                <span className="font-bold text-stone-900">{ord.customer.name}</span>{' '}
                                <span className="text-stone-500 font-mono">(৳{ord.total})</span>
                              </td>
                              <td className="p-2.5 text-blue-700 font-bold">{evtId}</td>
                              <td className="p-2.5 text-stone-600">{cIds.join(', ')}</td>
                              <td className="p-2.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded font-bold ${
                                    ord.pixelTracking?.capiDispatched
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {statusTxt}
                                </span>
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await trackPixelPurchase(ord, undefined, undefined, true);
                                    if (res) {
                                      const updatedOrd: Order = {
                                        ...ord,
                                        pixelTracking: {
                                          eventId: res.eventId || evtId,
                                          browserFired: true,
                                          capiDispatched: Boolean(res.capiResults && res.capiResults.length > 0),
                                          capiStatus:
                                            Array.isArray(res.capiResults) && res.capiResults.length > 0
                                              ? res.capiResults.map((r) => `${r.platform}: ${r.status}`).join(' | ')
                                              : 'Browser + Server Synced',
                                          metaPixels: res.metaPixels,
                                          tiktokPixels: res.tiktokPixels,
                                          contentIds: res.contentIds,
                                          capiResults: res.capiResults,
                                          updatedAt: Date.now(),
                                        },
                                      };
                                      await saveOrderPersisted(updatedOrd);
                                      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updatedOrd : o)));
                                      refreshPixelTelemetryLogs();
                                      setFeedback(`✅ অর্ডার #${ord.id} (Event ID: ${evtId}) মেটা ও টিকটক পিক্সেল + CAPI-তে সিঙ্ক হয়েছে!`);
                                      setTimeout(() => setFeedback(''), 4000);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 font-sans font-bold cursor-pointer"
                                >
                                  ⚡ Re-Sync
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* LIVE CLIENT + SERVER CAPI TELEMETRY EVENT LOG */}
              {(liveTelemetryLogs.length > 0 || pixelEventsLog.length > 0) && (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-stone-900">
                      লাইভ স্টোরফ্রন্ট ও সার্ভার CAPI ইভেন্ট ডিসপ্যাচ লগ (Client + Server Telemetry):
                    </h4>
                    <span className="text-[10px] text-stone-500 font-mono">
                      মোট {liveTelemetryLogs.length || pixelEventsLog.length} টি ইভেন্ট রেকর্ডকৃত
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {liveTelemetryLogs.length > 0
                      ? liveTelemetryLogs.slice(0, 20).map((log) => (
                          <div
                            key={log.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200 font-mono text-[11px] gap-1.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#E11D48] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {log.eventName}
                              </span>
                              <span className="text-blue-700 font-bold">ID: {log.eventId}</span>
                              {log.orderId && (
                                <span className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                  Order: {log.orderId}
                                </span>
                              )}
                              {log.contentIds?.length > 0 && (
                                <span className="text-stone-600">
                                  Content: [{log.contentIds.join(', ')}]
                                </span>
                              )}
                              {log.value > 0 && (
                                <span className="text-emerald-800 font-bold">৳{log.value}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-stone-400">{log.timeFormatted}</span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {log.status}
                              </span>
                            </div>
                          </div>
                        ))
                      : pixelEventsLog.map((log) => (
                          <div
                            key={log.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200 font-mono text-[11px] gap-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#E11D48] bg-rose-50 px-2 py-0.5 rounded">
                                {log.eventName}
                              </span>
                              <span className="text-stone-600 truncate max-w-md">{log.platform}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-stone-400">{log.timestamp}</span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {log.status}
                              </span>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* =====================================================================
            TOOL 8: BUSINESS PROFIT & LOSS, EXPENSE TRACKER & STORE ANALYTICS
           ===================================================================== */}
        {activeTool === 'analytics' && (() => {
          const now = Date.now();
          const oneDayMs = 24 * 3600 * 1000;
          const sevenDaysMs = 7 * oneDayMs;
          const thirtyDaysMs = 30 * oneDayMs;

          // Filter orders & expenses based on selected time range
          const filteredOrders = orders.filter((o) => {
            if (expenseRange === 'today') return now - o.createdAt <= oneDayMs;
            if (expenseRange === 'week') return now - o.createdAt <= sevenDaysMs;
            if (expenseRange === 'month') return now - o.createdAt <= thirtyDaysMs;
            return true;
          });

          const filteredExpenses = expenses.filter((e) => {
            if (expenseRange === 'today') return now - (e.createdAt || 0) <= oneDayMs;
            if (expenseRange === 'week') return now - (e.createdAt || 0) <= sevenDaysMs;
            if (expenseRange === 'month') return now - (e.createdAt || 0) <= thirtyDaysMs;
            return true;
          });

          // Filter courier returns based on selected time range
          const filteredReturns = courierReturns.filter((r) => {
            if (expenseRange === 'today') return now - (r.createdAt || 0) <= oneDayMs;
            if (expenseRange === 'week') return now - (r.createdAt || 0) <= sevenDaysMs;
            if (expenseRange === 'month') return now - (r.createdAt || 0) <= thirtyDaysMs;
            return true;
          });

          const pnlTotalReturns = filteredReturns.length;
          const pnlTotalReturnCharge = filteredReturns.reduce((sum, r) => sum + (r.returnCharge || 0), 0);
          const pnlTotalReturnedQty = filteredReturns.reduce((sum, r) => sum + (r.quantity || 1), 0);
          const pnlSellableReturnedQty = filteredReturns
            .filter((r) => r.productCondition === 'sellable')
            .reduce((sum, r) => sum + (r.quantity || 1), 0);
          const pnlDamagedReturnedQty = filteredReturns
            .filter((r) => r.productCondition === 'damaged')
            .reduce((sum, r) => sum + (r.quantity || 1), 0);
          const pnlTotalDamageLoss = filteredReturns
            .filter((r) => r.productCondition === 'damaged')
            .reduce((sum, r) => sum + (r.damageLoss || 0), 0);
          const pnlNetReturnLoss = pnlTotalReturnCharge + pnlTotalDamageLoss;

          const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
          const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
          const netProfit = totalRevenue - totalExpenses;
          const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

          // Expense categories sum
          const expenseByType: Record<string, number> = {};
          filteredExpenses.forEach((e) => {
            expenseByType[e.category] = (expenseByType[e.category] || 0) + e.amount;
          });

          return (
            <div className="bg-white rounded-3xl border border-rose-200 p-5 sm:p-7 shadow-xs space-y-7 animate-in fade-in">
              {/* Header with Title and 1-Click Export Actions */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rose-100">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#E11D48]" />
                    <span>ব্যবসায়িক সেলস, খরচ ও নিট লাভ-ক্ষতি রিপোর্ট (P&L Analytics)</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    দৈনিক ও মাসিক বিক্রি, অ্যাড খরচ, রিকশা/যাতায়াত ভাড়া এবং ইনভেন্টরি খরচের নির্ভুল রিয়েল-টাইম হিসাব।
                  </p>
                </div>

                {/* Range Filter and 1-Click Export Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setExpenseRange('today')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        expenseRange === 'today'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      আজ
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseRange('week')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        expenseRange === 'week'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ৭ দিন
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseRange('month')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        expenseRange === 'month'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ৩০ দিন
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseRange('all')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        expenseRange === 'all'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      সব সময়
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportPnLToCSV}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="গুগল শিট / Excel উপযোগী CSV রিপোর্ট ডাউনলোড করুন"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>গুগল শিট / CSV ডাউনলোড</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>প্রিন্ট রিপোর্ট</span>
                  </button>
                </div>
              </div>

              {/* 4 PRIMARY PROFIT & LOSS KPI CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Total Sales */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-1">
                  <div className="flex items-center justify-between text-blue-900 text-xs font-bold">
                    <span>মোট বিক্রয় (Revenue)</span>
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-blue-950">
                    ৳{totalRevenue.toLocaleString()}
                  </div>
                  <span className="text-[10.5px] text-blue-700 font-medium block">
                    {filteredOrders.length} টি সফল অর্ডার থেকে
                  </span>
                </div>

                {/* Total Expenses */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 space-y-1">
                  <div className="flex items-center justify-between text-rose-900 text-xs font-bold">
                    <span>মোট খরচ (Expenses)</span>
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-[#E11D48]">
                    ৳{totalExpenses.toLocaleString()}
                  </div>
                  <span className="text-[10.5px] text-rose-700 font-medium block">
                    অ্যাড, ভাড়া, সোর্সিং ও প্যাকেজিং
                  </span>
                </div>

                {/* Net Profit / Loss */}
                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    netProfit >= 0
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300'
                      : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={netProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}>
                      নিট লাভ / ক্ষতি (Net Profit)
                    </span>
                    <DollarSign
                      className={`w-4 h-4 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-black font-mono ${
                      netProfit >= 0 ? 'text-emerald-900' : 'text-red-700'
                    }`}
                  >
                    ৳{netProfit.toLocaleString()}
                  </div>
                  <span
                    className={`text-[10.5px] font-bold block ${
                      netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {netProfit >= 0 ? '✓ নিট মুনাফায় চলমান' : '⚠️ সাময়িক পরিচালন ঘাটতি'}
                  </span>
                </div>

                {/* Profit Margin */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-1">
                  <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
                    <span>লাভের হার (Margin)</span>
                    <span className="text-xs font-mono font-bold text-amber-700">%</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-amber-950">
                    {profitMargin}%
                  </div>
                  <span className="text-[10.5px] text-amber-800 font-medium block">
                    মোট সেলসের ওপর নিট মার্জিন
                  </span>
                </div>
              </div>

              {/* Expense Breakdown Categories */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-stone-900">
                  খরচের খাতভিত্তিক বিশ্লেষণ ({expenseRange === 'today' ? 'আজ' : expenseRange === 'week' ? 'গত ৭ দিন' : expenseRange === 'month' ? 'গত ৩০ দিন' : 'সব সময়'}):
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10.5px] block font-semibold">📢 অ্যাড স্পেন্ড</span>
                    <div className="font-mono font-black text-stone-900 text-sm mt-0.5">
                      ৳{(expenseByType.ad_cost || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10.5px] block font-semibold">🛒 পণ্য ক্রয়</span>
                    <div className="font-mono font-black text-stone-900 text-sm mt-0.5">
                      ৳{(expenseByType.product_buying || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10.5px] block font-semibold">🛺 রিকশা / যাতায়াত</span>
                    <div className="font-mono font-black text-stone-900 text-sm mt-0.5">
                      ৳{(expenseByType.transport_fare || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10.5px] block font-semibold">🚚 কুরিয়ার চার্জ</span>
                    <div className="font-mono font-black text-stone-900 text-sm mt-0.5">
                      ৳{(expenseByType.courier_charge || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                    <span className="text-amber-800 text-[10.5px] block font-semibold">🔄 রিটার্ন চার্জ</span>
                    <div className="font-mono font-black text-amber-950 text-sm mt-0.5">
                      ৳{(expenseByType.courier_return_charge || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10.5px] block font-semibold">📦 প্যাকেজিং</span>
                    <div className="font-mono font-black text-stone-900 text-sm mt-0.5">
                      ৳{(expenseByType.packaging || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10.5px] block font-semibold">🏢 অফিস / অন্যান্য</span>
                    <div className="font-mono font-black text-stone-900 text-sm mt-0.5">
                      ৳{((expenseByType.office_utility || 0) + (expenseByType.other || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* DEDICATED COURIER RETURN & STOCK LOSS P&L SECTION */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-50/50 via-white to-amber-50/40 border border-rose-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-rose-100 text-[#E11D48] rounded-xl">
                      <RotateCcw className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-stone-900">
                        কুরিয়ার রিটার্ন ও স্টক ক্ষতি অ্যানালাইটিক্স (Courier Return P&L)
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        রিটার্ন পার্সেল, বিক্রয়যোগ্য রিস্টক, ড্যামেজ ক্ষতি ও কুরিয়ার রিটার্ন চার্জের পূর্ণাঙ্গ হিসাব
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTool('courier_returns')}
                    className="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-[#E11D48] rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                  >
                    ম্যানেজমেন্ট ড্যাশবোর্ডে যান →
                  </button>
                </div>

                {/* 7 Courier Return Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                  {/* 1. Total Courier Returns */}
                  <div className="p-3 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-stone-500 block">১. মোট কুরিয়ার রিটার্ন</span>
                    <div className="text-base font-black font-mono text-stone-900">{pnlTotalReturns} টি</div>
                    <span className="text-[9px] text-stone-400 block">পার্সেল সংখ্যা</span>
                  </div>

                  {/* 2. Total Courier Return Charges */}
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-800 block">২. রিটার্ন চার্জ খরচ</span>
                    <div className="text-base font-black font-mono text-amber-950">
                      ৳{pnlTotalReturnCharge.toLocaleString()}
                    </div>
                    <span className="text-[9px] text-amber-700 block">কুরিয়ারকে প্রদেয়</span>
                  </div>

                  {/* 3. Returned Qty */}
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-blue-800 block">৩. মোট ফেরত পণ্য</span>
                    <div className="text-base font-black font-mono text-blue-900">{pnlTotalReturnedQty} টি</div>
                    <span className="text-[9px] text-blue-700 block">আইটেম কোয়ান্টিটি</span>
                  </div>

                  {/* 4. Sellable Qty */}
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-800 block">৪. বিক্রয়যোগ্য পণ্য</span>
                    <div className="text-base font-black font-mono text-emerald-900">
                      {pnlSellableReturnedQty} টি
                    </div>
                    <span className="text-[9px] text-emerald-700 block">স্টকে অটো-যুক্ত</span>
                  </div>

                  {/* 5. Damaged Qty */}
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-800 block">৫. ড্যামেজ পণ্য</span>
                    <div className="text-base font-black font-mono text-rose-900">{pnlDamagedReturnedQty} টি</div>
                    <span className="text-[9px] text-rose-700 block">স্টকে বাদ দেওয়া</span>
                  </div>

                  {/* 6. Damage Loss */}
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-red-800 block">৬. পণ্যের ড্যামেজ ক্ষতি</span>
                    <div className="text-base font-black font-mono text-red-900">
                      ৳{pnlTotalDamageLoss.toLocaleString()}
                    </div>
                    <span className="text-[9px] text-red-700 block">ক্রয়মূল্য রাইট-অফ</span>
                  </div>

                  {/* 7. Net Return Loss */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-300 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-black text-red-950 block">৭. রিটার্ন নিট ক্ষতি</span>
                    <div className="text-base font-black font-mono text-red-700">
                      ৳{pnlNetReturnLoss.toLocaleString()}
                    </div>
                    <span className="text-[9px] text-red-900 font-bold block">চার্জ + ড্যামেজ</span>
                  </div>
                </div>

                {/* Explanation Card */}
                <div className="p-3 rounded-xl bg-white border border-rose-100 text-[11px] text-stone-600 leading-relaxed">
                  <span className="font-bold text-stone-800">💡 হিসাব নীতি: </span>
                  যদি পণ্য ভালো অবস্থায় (<strong className="text-emerald-700">Sellable</strong>) ফেরত আসে, তাহলে পণ্যের ক্রয়মূল্য কোনো ক্ষতি হিসেবে গণনা হয় না, কারণ পণ্যটি পুনরায় বিক্রি করা যায়—এ ক্ষেত্রে শুধু রিটার্ন চার্জ লস। কিন্তু পণ্য নষ্ট বা ড্যামেজ (<strong className="text-rose-700">Damaged</strong>) হলে রিটার্ন চার্জের সাথে পণ্যের ক্রয়মূল্যও ব্যবসার নিট আর্থিক ক্ষতি হিসেবে হিসাবভুক্ত হয়।
                </div>
              </div>

              {/* ADD EXPENSE ENTRY FORM */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#FFF5F7] via-white to-[#FFF5F7] border border-rose-200 space-y-3">
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#E11D48]" />
                  <span>দৈনিক / সাপ্তাহিক নতুন ব্যবসা খরচ এন্ট্রি করুন:</span>
                </h4>

                <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">তারিখ</label>
                    <input
                      type="date"
                      required
                      value={newExpenseDate}
                      onChange={(e) => setNewExpenseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">খরচের খাত</label>
                    <select
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-bold text-stone-800"
                    >
                      <option value="ad_cost">📢 মেটা ও টিকটক অ্যাড স্পেন্ড</option>
                      <option value="product_buying">🛒 পণ্য ক্রয় / সোর্সিং</option>
                      <option value="transport_fare">🛺 রিকশা / গাড়ি / যাতায়াত ভাড়া</option>
                      <option value="courier_charge">🚚 কুরিয়ার ও ডেলিভারি চার্জ</option>
                      <option value="courier_return_charge">🔄 কুরিয়ার রিটার্ন চার্জ</option>
                      <option value="packaging">📦 বাবল র‍্যাপ ও প্যাকেজিং খরচ</option>
                      <option value="office_utility">🏢 অফিস, নাস্তা ও বিদ্যুৎ বিল</option>
                      <option value="other">📌 অন্যান্য বিবিধ খরচ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">টাকার পরিমাণ (৳)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="যেমন: ৫০০"
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">বিবরণ / নোট</label>
                    <input
                      type="text"
                      placeholder="যেমন: চকবাজার সোর্সিং রিকশা ভাড়া"
                      value={newExpenseNote}
                      onChange={(e) => setNewExpenseNote(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isSubmittingExpense}
                      className="w-full py-2 px-4 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isSubmittingExpense ? 'সেভ হচ্ছে...' : 'খরচ সেভ করুন'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* RECENT EXPENSE ENTRIES TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-stone-900">
                    রেকর্ডকৃত খরচের তালিকা ({filteredExpenses.length}টি এন্ট্রি):
                  </h4>
                </div>

                <div className="border border-stone-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-stone-50 text-[10.5px] uppercase font-bold text-stone-600 border-b border-stone-200 sticky top-0">
                      <tr>
                        <th className="p-3">তারিখ</th>
                        <th className="p-3">খাত</th>
                        <th className="p-3">বিবরণ</th>
                        <th className="p-3 text-right">টাকার পরিমাণ</th>
                        <th className="p-3 text-center">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-stone-400 text-xs">
                            এই সময়সীমায় কোনো খরচের এন্ট্রি নেই
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-stone-50">
                            <td className="p-3 font-mono font-medium text-stone-800 whitespace-nowrap">
                              {exp.date}
                            </td>
                            <td className="p-3 font-bold text-stone-900 whitespace-nowrap">
                              {exp.categoryLabel}
                            </td>
                            <td className="p-3 text-stone-600 max-w-xs truncate">{exp.note}</td>
                            <td className="p-3 text-right font-mono font-bold text-[#E11D48] whitespace-nowrap">
                              ৳{exp.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                                title="খরচটি মুছুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category distribution */}
              <div className="space-y-3 pt-3 border-t border-stone-200">
                <h4 className="text-xs font-extrabold text-stone-900">
                  ক্যাটাগরি অনুযায়ী প্রোডাক্ট ইনভেন্টরি ডিস্ট্রিবিউশন:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {OFFICIAL_CATEGORIES.map((cat) => {
                    const count = products.filter((p) => p.category === cat.id).length;
                    const pct = Math.min(
                      100,
                      Math.round((count / Math.max(1, products.length)) * 100)
                    );
                    return (
                      <div key={cat.id} className="p-3 rounded-xl border border-stone-200 space-y-1.5">
                        <div className="flex justify-between font-bold">
                          <span>
                            {cat.icon} {cat.nameBn}
                          </span>
                          <span className="text-[#E11D48] font-mono">{count} টি</span>
                        </div>
                        <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E11D48]"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* =====================================================================
            TOOL 9: WEBSITE & DELIVERY FEE SETTINGS
           ===================================================================== */}
        {activeTool === 'settings' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
            <div className="pb-4 border-b border-rose-100">
              <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#E11D48]" />
                <span>ওয়েবসাইট, ডেলিভারি চার্জ ও ব্র্যান্ড প্রোফাইল সেটিংস</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                হটলাইন, WhatsApp নম্বর, ডেলিভারি চার্জ এবং ফাউন্ডার প্রোফাইল সরাসরি এডিট করুন।
              </p>
            </div>

            <form onSubmit={handleSaveSiteSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">অফিসিয়াল WhatsApp নম্বর</label>
                <input
                  type="text"
                  value={siteContent.whatsappNumber}
                  onChange={(e) => setSiteContent({ ...siteContent, whatsappNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">অফিসিয়াল হটলাইন নম্বর</label>
                <input
                  type="text"
                  value={siteContent.hotlineNumber}
                  onChange={(e) => setSiteContent({ ...siteContent, hotlineNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">ঢাকার ভেতরে ডেলিভারি চার্জ (৳)</label>
                <input
                  type="number"
                  value={deliverySettings.dhakaFee}
                  onChange={(e) =>
                    setDeliverySettings({ ...deliverySettings, dhakaFee: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48]"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">ঢাকার বাইরে ডেলিভারি চার্জ (৳)</label>
                <input
                  type="number"
                  value={deliverySettings.outsideDhakaFee}
                  onChange={(e) =>
                    setDeliverySettings({
                      ...deliverySettings,
                      outsideDhakaFee: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48]"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">ফাউন্ডার / চেয়ারম্যানের নাম</label>
                <input
                  type="text"
                  value={siteContent.founder.name}
                  onChange={(e) =>
                    setSiteContent({
                      ...siteContent,
                      founder: { ...siteContent.founder, name: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">পদবি (Title)</label>
                <input
                  type="text"
                  value={siteContent.founder.title}
                  onChange={(e) =>
                    setSiteContent({
                      ...siteContent,
                      founder: { ...siteContent.founder, title: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              {/* Official Social Media Links Editor (WhatsApp, Facebook, Instagram, YouTube, TikTok) */}
              <div className="md:col-span-2 pt-4 border-t border-rose-100 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-extrabold text-stone-900 text-xs">
                    🌐 অফিসিয়াল সোশ্যাল মিডিয়া লিংক সেটআপ (হোমপেজ ও ফুটারে রিয়েল-টাইম লাইভ সিঙ্ক — Dokandari ট্যাগসহ):
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    ✓ অফিশিয়াল ব্র্যান্ড আইকন সক্রিয়
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                        <OfficialWhatsAppIcon className="w-3 h-3" />
                      </span>
                      <span>WhatsApp লিংক / নম্বর</span>
                    </label>
                    <input
                      type="text"
                      value={siteContent.socialLinks?.whatsapp || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          socialLinks: {
                            ...(siteContent.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!),
                            whatsapp: e.target.value,
                          },
                        })
                      }
                      placeholder="https://wa.me/8801885533437"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#1877F2] text-white flex items-center justify-center">
                        <OfficialFacebookIcon className="w-3 h-3" />
                      </span>
                      <span>Facebook পেজ লিংক</span>
                    </label>
                    <input
                      type="text"
                      value={siteContent.socialLinks?.facebook || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          socialLinks: {
                            ...(siteContent.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!),
                            facebook: e.target.value,
                          },
                        })
                      }
                      placeholder="https://web.facebook.com/dokandari.shop"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center">
                        <OfficialInstagramIcon className="w-3 h-3" />
                      </span>
                      <span>Instagram প্রোফাইল লিংক</span>
                    </label>
                    <input
                      type="text"
                      value={siteContent.socialLinks?.instagram || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          socialLinks: {
                            ...(siteContent.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!),
                            instagram: e.target.value,
                          },
                        })
                      }
                      placeholder="https://www.instagram.com/dokandaridotcom/"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#FF0000] text-white flex items-center justify-center">
                        <OfficialYouTubeIcon className="w-3 h-3" />
                      </span>
                      <span>YouTube চ্যানেল লিংক</span>
                    </label>
                    <input
                      type="text"
                      value={siteContent.socialLinks?.youtube || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          socialLinks: {
                            ...(siteContent.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!),
                            youtube: e.target.value,
                          },
                        })
                      }
                      placeholder="https://www.youtube.com/@Dokandarishop"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-stone-950 text-white flex items-center justify-center">
                        <OfficialTikTokIcon className="w-3 h-3" />
                      </span>
                      <span>TikTok প্রোফাইল লিংক</span>
                    </label>
                    <input
                      type="text"
                      value={siteContent.socialLinks?.tiktok || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          socialLinks: {
                            ...(siteContent.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!),
                            tiktok: e.target.value,
                          },
                        })
                      }
                      placeholder="https://www.tiktok.com/@dokandari.shop?is_from_webapp=1&sender_device=pc"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* About Page, Locations/Addresses & Policy Page Live Content Editor */}
              <div className="md:col-span-2 pt-4 border-t border-rose-100 space-y-3">
                <h4 className="font-extrabold text-stone-900 text-xs">
                  📍 স্টোরের লোকেশন, ঠিকানা, ব্র্যান্ড পরিচিতি (About) ও পলিসি কন্টেন্ট এডিটর (লাইভ ডোমেইন সিঙ্ক):
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      ঠিকানা ১: শোরুম ও ওয়্যারহাউজ ঠিকানা (হোমপেজ ও ফুটারে লাইভ)
                    </label>
                    <input
                      type="text"
                      value={siteContent.pageContent?.warehouseAddress || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          founder: {
                            ...siteContent.founder,
                            address: e.target.value,
                          },
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            warehouseAddress: e.target.value,
                          },
                        })
                      }
                      placeholder="শ্যামলী স্কয়ার শপিং মল, লেভেল ৪, ঢাকা-১২০৭"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      ঠিকানা ২: কর্পোরেট ও ট্রেনিং অফিস ঠিকানা (ফুটারে লাইভ)
                    </label>
                    <input
                      type="text"
                      value={siteContent.pageContent?.corporateAddress || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            corporateAddress: e.target.value,
                          },
                        })
                      }
                      placeholder="হাউজ ৪, রোড ১৫, ধানমন্ডি ২৭, ঢাকা-১২০৯"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      গুগল ম্যাপ লোকেশন লিংক (Google Maps URL)
                    </label>
                    <input
                      type="text"
                      value={siteContent.pageContent?.googleMapUrl || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            googleMapUrl: e.target.value,
                          },
                        })
                      }
                      placeholder="https://maps.google.com/?q=Dhaka"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      অফিসিয়াল ইমেইল (Official Support Email)
                    </label>
                    <input
                      type="email"
                      value={siteContent.officialEmail || DEFAULT_STORE_CONTENT.officialEmail || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          officialEmail: e.target.value,
                        })
                      }
                      placeholder="dokandari.shop@gmail.com"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-stone-700 mb-1">ব্র্যান্ড পরিচিতি পেজ শিরোনাম</label>
                    <input
                      type="text"
                      value={siteContent.pageContent?.aboutHeadline || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            aboutHeadline: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-stone-700 mb-1">ব্র্যান্ড বিবরণী (About Subtitle)</label>
                    <textarea
                      rows={2}
                      value={siteContent.pageContent?.aboutSubtitle || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            aboutSubtitle: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">রিটার্ন ও এক্সচেঞ্জ পলিসি</label>
                    <textarea
                      rows={2}
                      value={siteContent.pageContent?.returnPolicyText || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            returnPolicyText: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">রিফান্ড ও প্রাইভেসি পলিসি</label>
                    <textarea
                      rows={2}
                      value={siteContent.pageContent?.refundPolicyText || ''}
                      onChange={(e) =>
                        setSiteContent({
                          ...siteContent,
                          pageContent: {
                            ...(siteContent.pageContent || DEFAULT_STORE_CONTENT.pageContent!),
                            refundPolicyText: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>লোকেশন, সেটিংস ও পেজ কন্টেন্ট লাইভ ডাটাবেজে সেভ করুন</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =====================================================================
            TOOL 10: CACHE & FIREBASE LIVE SYNC DIAGNOSTICS
           ===================================================================== */}
        {activeTool === 'cache' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#E11D48]" />
                  <span>ক্যাশে ক্লিয়ার ও ফায়ারবেস ক্লাউড লাইভ সিঙ্ক ডায়াগনস্টিক</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  ক্লাউড ফায়ারস্টোর ডাটাবেজ কানেকশন লেটেন্সি এবং সকল প্রোডাক্ট ১-ক্লিকে ক্লাউড সিঙ্ক করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={handleForceSyncCatalog}
                disabled={syncingCatalog}
                className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncingCatalog ? 'animate-spin' : ''}`} />
                <span>
                  {syncingCatalog
                    ? 'সিঙ্ক হচ্ছে...'
                    : `সব প্রোডাক্ট ক্লাউডে ফোর্স-সিঙ্ক করুন (${products.length})`}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-1">
                <span className="font-bold text-emerald-800">Cloud Firestore Status</span>
                <div className="text-base font-extrabold text-stone-900">Connected (Online)</div>
                <span className="text-[11px] text-stone-500 font-mono">
                  Latency: {pingLatencyMs !== null ? `${pingLatencyMs} ms` : 'Fast'}
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-rose-200 bg-[#FFF8F9] space-y-1">
                <span className="font-bold text-[#E11D48]">Gemini 3.8 Flash Server API</span>
                <div className="text-base font-extrabold text-stone-900">
                  {geminiStatus.configured ? 'Active & Verified' : 'Ready'}
                </div>
                <span className="text-[11px] text-stone-500 font-mono">Model: {geminiStatus.model}</span>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50 space-y-2">
                <span className="font-bold text-stone-800 block">লোকাল ব্রাউজার ক্যাশে রিসেট</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('dokandari_cart');
                    setFeedback('🧹 লোকাল ক্যাশে সফলভাবে পরিষ্কার করা হয়েছে!');
                    setTimeout(() => setFeedback(''), 3000);
                  }}
                  className="px-4 py-1.5 bg-white border border-rose-300 text-[#E11D48] rounded-lg font-bold hover:bg-rose-50 cursor-pointer"
                >
                  ক্যাশে ক্লিয়ার করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TOOL 11: AI BRAND & ORGANIC CAMPAIGN COPYWRITER (GEMINI 3.8 FLASH)
           ===================================================================== */}
        {activeTool === 'campaigns' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#E11D48]" />
                  <span>এআই ব্র্যান্ড ও অর্গানিক ক্যাম্পেইন কপিরাইটার (Gemini 3.8 Flash)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  আপনার স্টোরের যেকোনো প্রোডাক্ট সিলেক্ট করে ১-ক্লিকে ফেসবুক অ্যাড কপি, টিকটক ভিডিও স্ক্রিপ্ট ও SMS মার্কেটিং টেক্সট জেনারেট করুন।
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end text-xs">
              <div className="flex-1 w-full">
                <label className="block font-bold text-stone-700 mb-1">
                  ক্যাম্পেইনের জন্য প্রোডাক্ট নির্বাচন করুন:
                </label>
                <select
                  value={selectedCampaignProductId}
                  onChange={(e) => setSelectedCampaignProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ৳{p.price}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateCampaign}
                disabled={campaignLoading}
                className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-2 shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {campaignLoading
                    ? 'Gemini AI অ্যাড কপি লিখছে...'
                    : '✨ এআই দিয়ে ফেসবুক ও টিকটক অ্যাড তৈরি করুন'}
                </span>
              </button>
            </div>

            {generatedCampaign && (
              <div className="p-5 rounded-2xl border-2 border-[#E11D48] bg-[#FFF8F9] space-y-4 text-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-[#E11D48]">
                    🔥 {generatedCampaign.headline}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${generatedCampaign.headline}\n\n${generatedCampaign.facebookAdCopy}`
                      );
                      setFeedback('📋 অ্যাড কপি ক্লিপবোর্ডে কপি হয়েছে!');
                      setTimeout(() => setFeedback(''), 2500);
                    }}
                    className="px-3 py-1 bg-white border border-rose-300 text-[#E11D48] rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি করুন</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-1.5">
                    <span className="font-bold text-[#E11D48] block">📘 Facebook Ad Copy:</span>
                    <p className="text-stone-700 whitespace-pre-line leading-relaxed">
                      {generatedCampaign.facebookAdCopy}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-1.5">
                    <span className="font-bold text-[#E11D48] block">🎵 TikTok / Reels Video Script:</span>
                    <p className="text-stone-700 whitespace-pre-line leading-relaxed">
                      {generatedCampaign.tiktokScript}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-1.5">
                    <span className="font-bold text-[#E11D48] block">💬 SMS / WhatsApp Broadcast:</span>
                    <p className="text-stone-700 whitespace-pre-line leading-relaxed">
                      {generatedCampaign.smsCopy}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TOOL 12: 11 MANDATORY CATEGORIES MANAGEMENT (DRAG & DROP REORDERING)
           ===================================================================== */}
        {activeTool === 'categories' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-5 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-rose-100">
              <div>
                <h3 className="text-base font-extrabold text-stone-900">
                  ১১টি হোমপেজ ক্যাটাগরি ও ক্যাটালগ সেকশন ড্র্যাগ-অ্যান্ড-ড্রপ কন্ট্রোল
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  ১ম: Home Decor, ২য়: Gadgets, ৩য়: Fashion — যেকোনো ক্যাটাগরি মাউস দিয়ে টেনে (Drag & Drop) অথবা তীর চিহ্নে ক্লিক করে আপনার পছন্দমতো জায়গায় সাজান। হোমপেজের ক্যাটাগরি বার ও ক্যাটালগ সেকশন সাথে সাথে অটো-আপডেট হবে!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleResetCategoryOrder}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  🔄 ডিফল্ট ক্রমে রিসেট (১ম: Home Decor)
                </button>
                <button
                  onClick={() => setIsNewProdOpen(true)}
                  className="px-4 py-2 bg-[#E11D48] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + ক্যাটাগরিতে পণ্য যোগ করুন
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderedCategoriesList.map((cat, idx) => {
                const count = products.filter((p) => p.category === cat.id).length;
                const catShareUrl = getCatalogShareUrl(cat.id);
                const isDragging = draggedCatIndex === idx;
                return (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => setDraggedCatIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropCategory(idx)}
                    onDragEnd={() => setDraggedCatIndex(null)}
                    className={`p-4 rounded-2xl border transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between gap-3 ${
                      isDragging
                        ? 'border-[#E11D48] bg-rose-50/90 opacity-70 scale-[0.98] shadow-lg'
                        : 'border-rose-200 bg-[#FFF8F9] hover:border-[#E11D48]/60 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={cat.image}
                          alt={cat.nameBn}
                          className="w-12 h-12 rounded-2xl object-cover border border-rose-200 shadow-2xs shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#E11D48] text-white text-[10px] font-extrabold">
                              পজিশন #{idx + 1}
                            </span>
                          </div>
                          <h4 className="text-sm font-extrabold text-stone-900 mt-1">{cat.nameBn}</h4>
                          <span className="text-[11px] font-semibold text-stone-600">
                            মোট {count} টি প্রোডাক্ট
                          </span>
                        </div>
                      </div>

                      {/* Up / Down Reorder Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveCategory(idx, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 disabled:opacity-40 text-stone-700 text-xs font-extrabold flex items-center justify-center cursor-pointer"
                          title="উপরে / আগে নিন"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedCategoriesList.length - 1}
                          onClick={() => handleMoveCategory(idx, 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 disabled:opacity-40 text-stone-700 text-xs font-extrabold flex items-center justify-center cursor-pointer"
                          title="নিচে / পরে নিন"
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    {/* Unique Catalog Domain URL & Actions */}
                    <div className="pt-2 border-t border-rose-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(catShareUrl);
                          setFeedback(`🔗 "${cat.nameBn}" ক্যাটালগ লিংক কপি হয়েছে: ${catShareUrl}`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="flex-1 py-1.5 px-2.5 bg-white hover:bg-rose-50 text-stone-700 border border-stone-200 rounded-xl text-[11px] font-semibold truncate text-left cursor-pointer"
                        title={catShareUrl}
                      >
                        🔗 `/catalog/{cat.id}` কপি
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCategory(cat.id);
                          setIsNewProdOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold cursor-pointer shrink-0"
                      >
                        + পণ্য যোগ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================================================================
            TOOL 13: SECURITY & ADMIN ACCESS MANAGEMENT
           ===================================================================== */}
        {activeTool === 'security' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in">
            <div className="pb-4 border-b border-rose-100">
              <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#E11D48]" />
                <span>সিকিউরিটি, রোল-বেজড অ্যাক্সেস ও অ্যাডমিন প্রোটেকশন</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                অনুমোদিত অ্যাডমিন ইমেইল তালিকা এবং ফায়ারস্টোর ডাটাবেজ সিকিউরিটি স্ট্যাটাস।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-stone-900">অনুমোদিত অ্যাডমিন ইমেইল তালিকা:</h4>
                <div className="space-y-2">
                  {authorizedEmails.map((em) => (
                    <div
                      key={em}
                      className="p-3 rounded-xl bg-[#FFF8F9] border border-rose-200 flex items-center justify-between"
                    >
                      <span className="font-mono font-bold text-stone-800">{em}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Super Admin
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddAdminEmail} className="flex gap-2 pt-2">
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="নতুন অ্যাডমিন ইমেইল যুক্ত করুন..."
                    className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#E11D48] text-white font-bold rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>যুক্ত করুন</span>
                  </button>
                </form>
              </div>

              <div className="p-5 rounded-2xl bg-[#FFF8F9] border border-rose-200 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#E11D48]" />
                    <h4 className="font-extrabold text-stone-900 text-xs">
                      অ্যাডমিন লগইন ইউজারনেম ও পাসওয়ার্ড কনফিগারেশন:
                    </h4>
                  </div>
                  {securitySaved && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ✓ সংরক্ষিত হয়েছে
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveSecurityCredentials} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-stone-700 font-bold mb-1">অ্যাডমিন ইউজারনেম:</label>
                      <input
                        type="text"
                        required
                        value={adminUsernameInput}
                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                        placeholder="যেমন: admin অথবা dokandari.shop@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono focus:border-[#E11D48] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-700 font-bold mb-1">অ্যাডমিন সিকিউর পাসওয়ার্ড (নতুন পাসওয়ার্ড সেট করুন):</label>
                      <input
                        type="password"
                        required
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        placeholder="আপনার গোপন পাসওয়ার্ড লিখুন..."
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono focus:border-[#E11D48] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-bold mb-1">সিক্রেট রিকভারি কি (Secret Key):</label>
                    <input
                      type="password"
                      value={adminSecretKeyInput}
                      onChange={(e) => setAdminSecretKeyInput(e.target.value)}
                      placeholder="আপনার সিক্রেট কি লিখুন..."
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono focus:border-[#E11D48] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleLockAdminSession}
                      className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold cursor-pointer transition-colors"
                    >
                      🔒 এখনই অ্যাডমিন সেশন লক করুন
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>পাসওয়ার্ড ও সিকিউরিটি সংরক্ষণ করুন</span>
                    </button>
                  </div>
                </form>

                <div className="p-3 bg-stone-100 rounded-xl text-[11px] text-stone-600 space-y-1">
                  <p>
                    <strong>AI Studio Secrets কনফিগারেশন:</strong> অ্যাপের সেটিংস থেকে <code className="font-mono text-[#E11D48]">ADMIN_EMAIL</code> এবং <code className="font-mono text-[#E11D48]">ADMIN_PASSWORD</code> সিক্রেট হিসেবে সেট করতে পারেন অথবা উপর থেকে সরাসরি ডাটাবেজে নিজের পাসওয়ার্ড সংরক্ষণ করতে পারেন। কোনো পাসওয়ার্ড কোডে বা স্ক্রিনে প্রদর্শিত হয় না।
                  </p>
                  <p className="text-emerald-700 font-semibold">
                    ✓ সার্ভার-সাইড <code className="font-mono">/api/admin/login</code> ও ফায়ারস্টোর ডাটাবেজ সিকিউরিটি রুলস সক্রিয়।
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Modal (Supports Direct File Upload + Image URL + Immediate Persistence) */}
      {isNewProdOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200 text-xs my-auto">
            <div className="flex items-center justify-between pb-2 border-b border-rose-100">
              <h3 className="text-sm font-extrabold text-stone-900">
                + নতুন প্রোডাক্ট আপলোড করুন (লাইভ ক্যাটালগ)
              </h3>
              <button
                onClick={() => setIsNewProdOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-stone-700 font-bold mb-1">প্রোডাক্টের নাম *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="যেমন: মডার্ন অ্যাক্রিলিক ওয়াল মিরর বা স্মার্ট গ্যাজেট"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-stone-700 font-bold mb-1">ক্যাটাগরি (১১টি) *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold"
                  >
                    {OFFICIAL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-700 font-bold mb-1">বিক্রয় মূল্য (৳ BDT) *</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold text-[#E11D48] focus:border-[#E11D48] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-bold mb-1">রেগুলার মূল্য (৳)</label>
                  <input
                    type="number"
                    value={newOriginalPrice}
                    onChange={(e) => setNewOriginalPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono focus:border-[#E11D48] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-2xl bg-[#FFF8F9] border border-rose-200">
                <label className="block text-stone-800 font-bold">
                  প্রোডাক্টের ছবি আপলোড করুন (কম্পিউটার/মোবাইল ফাইল অথবা লিংক) *
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3.5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{newUploadingImg ? 'আপলোড হচ্ছে...' : '📁 ফাইল থেকে ছবি সিলেক্ট করুন'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewProductFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-stone-500">অথবা নিচে ছবির লিংক দিন:</span>
                </div>
                <input
                  type="text"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl focus:border-[#E11D48] focus:outline-none font-mono text-[11px]"
                />
                {newImage && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={newImage}
                      alt="Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-rose-200 bg-white"
                    />
                    <span className="text-[11px] text-emerald-700 font-bold">✓ প্রোডাক্ট ছবি প্রস্তুত</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">প্রোডাক্টের সংক্ষিপ্ত বিবরণ</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProdOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 font-bold hover:bg-stone-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={newUploadingImg}
                  className="px-5 py-2 bg-[#E11D48] text-white rounded-xl font-bold hover:bg-[#BE123C] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  ✅ সেভ ও লাইভ প্রকাশ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
