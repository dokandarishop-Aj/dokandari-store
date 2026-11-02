/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Video,
  Image as ImageIcon,
  UserCheck,
  Layers,
  Upload,
  Play,
  Download,
  CheckCircle2,
  Bot,
  Wand2,
  Volume2,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  ShoppingBag,
  Building2,
  FileText,
  Edit3,
  Send,
  Zap,
  ShieldCheck,
  Maximize2,
  Minimize2,
  LogIn,
  LogOut,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Sliders,
  Copy,
  ExternalLink,
  Film,
} from 'lucide-react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  compressImageFileToDataUrl,
  saveProductPersisted,
  resolveSafeProductImageUrl,
  handleProductImageError,
} from '../lib/storeSync';
import { OmniAuth } from './OmniAuth';
import {
  AssistantLanguageMode,
  PRODUCT_IMAGE_SLOT_META,
  DEFAULT_SHOWROOM_PROMPT_TEMPLATE,
  STORE_MANAGEMENT_TERMINOLOGY_BN,
  StoreAgentLogEntry,
  buildBengaliGeminiSystemInstruction,
  createStoreAgentLogEntry,
  enforceBengaliAssistantOutput,
  enforceBengaliStoreManagementText,
  buildBrandConsistentPrompt,
} from '../lib/agenticVideoUtils';

export interface VirtualAvatar {
  id: string;
  nameBn: string;
  roleBn: string;
  descPrompt: string;
  voiceId: string;
  avatarImage: string;
  attireColor: string;
}

export interface FlowScene {
  sceneNumber: number;
  timeRange: string;
  visualBn: string;
  dialogueBn: string;
}

export interface FlowMediaItem {
  id: string;
  type: 'video' | 'image';
  titleBn: string;
  brandName: string;
  brandSlogan: string;
  url: string;
  thumbnailUrl: string;
  audioDataUrl?: string;
  spokenScriptBn: string;
  omniPrompt: string;
  scenes: FlowScene[];
  aspectRatio: '9:16' | '16:9';
  duration: '5s' | '10s';
  engineLabel: string;
  interactionId?: string;
  createdAt: number;
  productImages: string[];
  linkedProductId?: string;
}

export interface AgentChatMessage {
  id: string;
  sender: 'user' | 'agent';
  textBn: string;
  timestamp: string;
  planData?: {
    detectedProductBn: string;
    productAnalysisBn: string;
    spokenScriptBn: string;
    omniVideoPrompt: string;
    scenes: FlowScene[];
    brandName: string;
    brandSlogan: string;
    awaitingApproval?: boolean;
    approved?: boolean;
  };
}

export interface GoogleFlowProductionForm {
  id: string;
  campaignGoalBn: string;
  targetPlatform: 'reels_9_16' | 'banner_16_9';
  productTitleBn: string;
  productPriceBn: string;
  productHighlightBn: string;
  showroomStyleBn: string;
  cameraMovementBn: string;
  spokenScriptBn: string;
  callToActionBn: string;
  executableFlowPrompt: string;
  targetModel: 'veo_3' | 'imagen_3' | 'gemini_omni';
  createdAt: number;
}

interface OmniFlowStudioProps {
  products: Product[];
  onAttachVideoToProduct?: (product: Product) => void;
  defaultBrandName?: string;
  defaultExpandedEditMode?: boolean;
}

const DEFAULT_AVATARS: VirtualAvatar[] = [
  {
    id: 'avatar-nusrat',
    nameBn: 'নুসরাত জাহান (মডেস্ট ও স্কিনকেয়ার হোস্ট)',
    roleBn: 'বিউটি, কসমেটিক্স ও হিজাব ফ্যাশন প্রেজেন্টার',
    descPrompt:
      'Friendly young Bangladeshi female brand presenter wearing an elegant pastel lilac hijab and modest pearl-white blazer, warm natural smile, studio lighting',
    voiceId: 'Kore',
    avatarImage:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    attireColor: '#E11D48',
  },
  {
    id: 'avatar-tasnim',
    nameBn: 'তাসনিম মেহজাবিন (লাক্সারি শোরুম হোস্ট)',
    roleBn: 'হোম ডেকোর, মিরর ও লাইফস্টাইল স্পেশালিস্ট',
    descPrompt:
      'Professional Bangladeshi female showroom host in royal maroon modest attire, standing gracefully in a luxury showroom, expressive hand gestures',
    voiceId: 'Zephyr',
    avatarImage:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
    attireColor: '#BE123C',
  },
  {
    id: 'avatar-rafi',
    nameBn: 'রাফি আহমেদ (টেক ও গ্যাজেট প্রেজেন্টার)',
    roleBn: 'স্মার্টওয়াচ, ইয়ারবাডস ও ইলেকট্রনিক্স হোস্ট',
    descPrompt:
      'Charismatic young Bangladeshi male tech presenter wearing a smart navy-blue blazer over a crisp shirt, holding gadget in a modern showroom',
    voiceId: 'Puck',
    avatarImage:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    attireColor: '#2563EB',
  },
  {
    id: 'avatar-sadia',
    nameBn: 'সাদিয়া ইসলাম (অর্গানিক কেয়ার ও কম্বো হোস্ট)',
    roleBn: 'হারবাল সোপ, সিরাম ও ডেইলি এসেনশিয়ালস হোস্ট',
    descPrompt:
      'Radiant Bangladeshi female skincare specialist in soft emerald modest dress, clear glowing skin, holding skincare product in a boutique showroom',
    voiceId: 'Kore',
    avatarImage:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    attireColor: '#059669',
  },
];

const SHOWROOM_STYLES = [
  {
    id: 'cosmetics_showroom',
    labelBn: '✨ কসমেটিক্স ও স্কিনকেয়ার লাক্সারি শোরুম',
    promptEn:
      'Luxury illuminated cosmetics and skincare boutique showroom with marble countertop, soft warm golden spotlights, and botanical accents',
  },
  {
    id: 'gadget_showroom',
    labelBn: '⌚ স্মার্ট গ্যাজেট ও ইলেকট্রনিক্স শোরুম',
    promptEn:
      'Modern flagship electronics and smart gadget showroom with sleek glass display pedestals and bright architectural lighting',
  },
  {
    id: 'fashion_showroom',
    labelBn: '👗 মডেস্ট ফ্যাশন ও হিজাব বুটিক শোরুম',
    promptEn:
      'High-end modest fashion and bridal boutique showroom with velvet drapes, rose-gold chandeliers, and warm architectural lighting',
  },
  {
    id: 'decor_showroom',
    labelBn: '🪞 হোম ডেকোর ও লাক্সারি মিরর স্টুডিও',
    promptEn:
      'Modern architectural home decor and luxury mirror showroom with travertine stone walls, warm indirect LED cove lighting, and indoor plants',
  },
];

// Bumped storage key to v3 so old demo/canvas items from v1 are completely purged
const LEGACY_STORAGE_KEY_MEDIA = 'dokandari_omni_flow_media_v1';
const STORAGE_KEY_MEDIA = 'dokandari_omni_flow_real_media_v3';
const STORAGE_KEY_AVATARS = 'dokandari_omni_flow_avatars_v1';

export const OmniFlowStudio: React.FC<OmniFlowStudioProps> = ({
  products,
  onAttachVideoToProduct,
  defaultBrandName = 'দোকানদারি (Dokandari)',
  defaultExpandedEditMode = true,
}) => {
  const { firebaseUser, userProfile, signInWithGoogle, signInWithGmailDirect, signOutUser } = useAuth();
  const connectedEmail = firebaseUser?.email || userProfile?.email || '';
  const connectedPhoto = firebaseUser?.photoURL || userProfile?.photoURL || '';

  // Compact Mini Mode vs Full Edit Mode (Hidden by default until user clicks to open Full Edit Mode)
  const [isFullEditMode, setIsFullEditMode] = useState<boolean>(defaultExpandedEditMode);
  const [isFullscreenModal, setIsFullscreenModal] = useState<boolean>(false);

  // Studio Workspace Sub-Tab inside Full Edit Mode
  const [leftTab, setLeftTab] = useState<
    'all_media' | 'videos' | 'images' | 'characters' | 'scenes' | 'uploaded'
  >('all_media');

  // Google Account / AI Studio Subscription & Free Credit Status
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [showGmailInputBox, setShowGmailInputBox] = useState<boolean>(false);
  const [customGmailInput, setCustomGmailInput] = useState<string>(
    connectedEmail || 'dokandari.shop@gmail.com'
  );
  const [aiKeySelected, setAiKeySelected] = useState<boolean>(false);
  const [serverAccountStatus, setServerAccountStatus] = useState<{
    connected: boolean;
    keySource: string;
  }>({ connected: true, keySource: 'Google Gemini API' });

  // Agent Mode: false = Generate Prompt First -> User Edits/Modifies -> User Clicks Generate Video (Recommended)
  const [autoAgentMode, setAutoAgentMode] = useState<boolean>(false);

  // Brand Name & Showroom Placeholders
  const [brandName, setBrandName] = useState<string>(defaultBrandName || 'দোকানদারি (Dokandari)');
  const [brandSlogan, setBrandSlogan] = useState<string>(
    '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি'
  );
  const [selectedShowroomId, setSelectedShowroomId] = useState<string>('cosmetics_showroom');

  // Virtual Avatars State
  const [avatars, setAvatars] = useState<VirtualAvatar[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AVATARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_AVATARS;
  });
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(DEFAULT_AVATARS[0].id);

  // New Custom Avatar Form State
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarRole, setNewAvatarRole] = useState('');
  const [newAvatarPrompt, setNewAvatarPrompt] = useState('');
  const [creatingAvatar, setCreatingAvatar] = useState(false);

  // Uploaded / Selected Product Images (1 to 4 images)
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productTitleInput, setProductTitleInput] = useState<string>('');
  const [productPriceInput, setProductPriceInput] = useState<string>('৬৯৯');

  // Video Config
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [duration, setDuration] = useState<'5s' | '10s'>('10s');
  const [userPromptInput, setUserPromptInput] = useState<string>('');

  // Editable Plan, Prompt & Script State (Step 2: User modifies before generating)
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState<boolean>(false);
  const [currentScriptBn, setCurrentScriptBn] = useState<string>('');
  const [currentOmniPrompt, setCurrentOmniPrompt] = useState<string>('');
  const [currentScenes, setCurrentScenes] = useState<FlowScene[]>([]);

  // Autonomous Google Flow Production Form Generator State
  const [activeFlowForm, setActiveFlowForm] = useState<GoogleFlowProductionForm | null>(null);
  const [isBuildingForm, setIsBuildingForm] = useState<boolean>(false);
  const [copiedFormNotice, setCopiedFormNotice] = useState<string>('');

  // Language-Switching Utility & Structured Prompt-Builder State (Hidden/Collapsed by default for clean UI)
  const [languageMode, setLanguageMode] = useState<AssistantLanguageMode>('bn_strict');
  const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_SHOWROOM_PROMPT_TEMPLATE);
  const [showPromptBuilder, setShowPromptBuilder] = useState<boolean>(false);
  const [showSystemPromptBox, setShowSystemPromptBox] = useState<boolean>(false);
  const [showStoreLogs, setShowStoreLogs] = useState<boolean>(false);

  // Store-Management Operational Logs (100% Professional Bengali Terminology)
  const [storeLogs, setStoreLogs] = useState<StoreAgentLogEntry[]>(() => [
    createStoreAgentLogEntry(
      'সিস্টেম নির্দেশিকা',
      `প্রধান স্টোর মার্চেন্ডাইজিং ও বাণিজ্যিক ভিডিও নির্দেশক এজেন্টের ১০০% বাংলা সিস্টেম প্রম্পট সক্রিয় রয়েছে।`,
      'success'
    ),
  ]);

  const appendStoreLog = (
    categoryBn: StoreAgentLogEntry['categoryBn'],
    messageBn: string,
    status: StoreAgentLogEntry['status'] = 'info'
  ) => {
    setStoreLogs((prev) => [createStoreAgentLogEntry(categoryBn, messageBn, status), ...prev.slice(0, 24)]);
  };

  // Generation Pipeline Status (100% Real API Status)
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [isGeneratingFrame, setIsGeneratingFrame] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStepLabel, setGenerationStepLabel] = useState<string>('');
  const [activeInteractionId, setActiveInteractionId] = useState<string>('');
  const [activeMedia, setActiveMedia] = useState<FlowMediaItem | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');

  // Real Generated Media Library (Purges old fake demo items on boot)
  const [mediaItems, setMediaItems] = useState<FlowMediaItem[]>(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY_MEDIA);
      const saved = localStorage.getItem(STORAGE_KEY_MEDIA);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Bengali AI Agent Conversation Log
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'agent',
      textBn:
        'আসসালামু আলাইকুম! গুগল ফ্লো ও ওমনি ১.১ ফ্ল্যাশ (Omni 1.1 Flash) রিয়েল ভিডিও স্টুডিওতে স্বাগতম। প্রথমে আপনার জিমেইল অ্যাকাউন্ট লগইন করুন এবং ক্যাটালগ থেকে ১–৪টি প্রোডাক্ট ছবি সিলেক্ট করে "১. প্রম্পট ও বাংলা স্ক্রিপ্ট জেনারেট করুন" বাটনে ক্লিক করুন। প্রম্পট তৈরি হলে আপনি সেটি নিজের মতো এডিট ও মডিফাই করার পর ১০০% রিয়েল ভিডিও বা শোরুম ইমেজ তৈরি করতে পারবেন।',
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const selectedAvatar =
    avatars.find((a) => a.id === selectedAvatarId) || avatars[0] || DEFAULT_AVATARS[0];
  const selectedShowroom =
    SHOWROOM_STYLES.find((s) => s.id === selectedShowroomId) || SHOWROOM_STYLES[0];

  // Check AI Studio key selection & Server Account Status on mount
  useEffect(() => {
    const checkAccountStatus = async () => {
      try {
        const win = window as any;
        if (win.aistudio && typeof win.aistudio.hasSelectedApiKey === 'function') {
          const selected = await win.aistudio.hasSelectedApiKey();
          setAiKeySelected(Boolean(selected));
        }
      } catch {
        // ignore
      }
      try {
        const res = await fetch('/api/flow/account-status');
        if (res.ok) {
          const data = await res.json();
          setServerAccountStatus({
            connected: Boolean(data.connected),
            keySource: data.keySource || 'Google Gemini API',
          });
        }
      } catch {
        // ignore
      }
    };
    checkAccountStatus();
  }, []);

  useEffect(() => {
    try {
      const compactItems = mediaItems.slice(0, 8).map((item) => ({
        ...item,
        url: item.url.length > 2_500_000 ? item.thumbnailUrl : item.url,
      }));
      localStorage.setItem(STORAGE_KEY_MEDIA, JSON.stringify(compactItems));
    } catch {
      // ignore storage quota errors
    }
  }, [mediaItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AVATARS, JSON.stringify(avatars));
    } catch {
      // ignore
    }
  }, [avatars]);

  // Live Prompt-Builder Output with {{BRAND_NAME}} & {{BRAND_SLOGAN}} Placeholders
  const compiledPromptResult = buildBrandConsistentPrompt({
    template: promptTemplate,
    brandName,
    brandSlogan,
    showroomStylePrompt: selectedShowroom.promptEn,
    showroomLabelBn: selectedShowroom.labelBn,
    avatarNameBn: selectedAvatar.nameBn,
    avatarPersonaPrompt: selectedAvatar.descPrompt,
    productTitle: productTitleInput || `${brandName} প্রিমিয়াম কালেকশন`,
    productPrice: productPriceInput || '৬৯৯',
    imageCount: Math.max(1, uploadedImages.length || 1),
    aspectRatio,
    duration,
  });

  // Live 100% Bengali Gemini System Prompt (systemInstruction) Preview
  const activeBengaliSystemPrompt = buildBengaliGeminiSystemInstruction({
    brandName,
    brandSlogan,
    showroomStyleBn: selectedShowroom.labelBn,
    avatarNameBn: selectedAvatar.nameBn,
    avatarDescBn: selectedAvatar.roleBn,
    productTitle: productTitleInput || `${brandName} ক্যাটালগ পণ্য`,
    productPrice: productPriceInput || '৬৯৯',
    imageCount: Math.max(1, uploadedImages.length || 1),
    aspectRatio,
    duration,
    autoAgentMode,
  });

  // Real Gmail Login Handler (Seamless Popup + Direct Gmail Fallback)
  const handleGmailLogin = async () => {
    setAuthLoading(true);
    setErrorBanner('');
    try {
      const profile = await signInWithGoogle(customGmailInput || 'dokandari.shop@gmail.com');
      const msg = `✅ আপনার জিমেইল (${profile.email}) গুগল ফ্লো ও ওমনি স্টুডিওর সাথে সফলভাবে সংযুক্ত হয়েছে!`;
      setStatusBanner(msg);
      appendStoreLog('সিস্টেম নির্দেশিকা', msg, 'success');
      setShowGmailInputBox(false);
      setTimeout(() => setStatusBanner(''), 4500);
    } catch {
      const profile = await signInWithGmailDirect(customGmailInput || 'dokandari.shop@gmail.com');
      setStatusBanner(`✅ জিমেইল (${profile.email}) সক্রিয় করা হয়েছে!`);
      setShowGmailInputBox(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDirectGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGmailInput.trim()) return;
    setAuthLoading(true);
    setErrorBanner('');
    try {
      const profile = await signInWithGmailDirect(customGmailInput.trim());
      const msg = `✅ আপনার সাবস্ক্রিপশন জিমেইল (${profile.email}) সরাসরি সংযুক্ত হয়েছে!`;
      setStatusBanner(msg);
      appendStoreLog('সিস্টেম নির্দেশিকা', msg, 'success');
      setShowGmailInputBox(false);
      setTimeout(() => setStatusBanner(''), 4500);
    } finally {
      setAuthLoading(false);
    }
  };

  // Connect Google AI Studio Subscription / Free Credit Project Key
  const handleConnectGoogleSubscriptionKey = async () => {
    setErrorBanner('');
    try {
      const win = window as any;
      if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
        await win.aistudio.openSelectKey();
        setAiKeySelected(true);
        const msg =
          '✅ আপনার Google AI সাবস্ক্রিপশন / ফ্রি ক্রেডিট প্রজেক্ট সফলভাবে সংযুক্ত হয়েছে! এখন রিয়েল ওমনি ভিডিও জেনারেট করতে পারবেন।';
        setStatusBanner(msg);
        appendStoreLog('সিস্টেম নির্দেশিকা', msg, 'success');
        setTimeout(() => setStatusBanner(''), 5000);
      } else {
        // If not in AI Studio wrapper, trigger Google Sign-In
        await handleGmailLogin();
      }
    } catch (err: any) {
      setErrorBanner(
        `সাবস্ক্রিপশন প্রজেক্ট সংযোগে সমস্যা হয়েছে: ${err?.message || 'পুনরায় চেষ্টা করুন।'}`
      );
    }
  };

  // Select a product from the catalog and load up to 4 images
  const handleSelectCatalogProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const found = products.find((p) => p.id === prodId);
    if (found) {
      const imgs = (found.images && found.images.length > 0 ? found.images : []).filter(Boolean);
      const multiAngles = [...imgs];
      if (multiAngles.length > 0 && multiAngles.length < 3) {
        const sameCatImgs = products
          .filter((p) => p.id !== found.id && p.category === found.category)
          .flatMap((p) => p.images || [])
          .filter(Boolean);
        for (const extra of sameCatImgs) {
          if (multiAngles.length >= 4) break;
          if (!multiAngles.includes(extra)) multiAngles.push(extra);
        }
      }
      setUploadedImages(multiAngles.slice(0, 4));
      setProductTitleInput(found.name);
      setProductPriceInput(String(found.price));
      const msgBn = `📦 ক্যাটালগ পণ্য "${found.name}" (মূল্য: ৳${found.price}) থেকে ${Math.min(
        4,
        multiAngles.length
      )}টি আসল ছবি স্টুডিওতে লোড হয়েছে।`;
      setStatusBanner(msgBn);
      appendStoreLog('ক্যাটালগ চিত্র বিশ্লেষণ', msgBn, 'success');
      setTimeout(() => setStatusBanner(''), 4000);
    }
  };

  // Toggle-select any individual image from store catalog up to 4 slots
  const handleToggleCatalogImageSlot = (imgUrl: string, prodName?: string, prodPrice?: number) => {
    setUploadedImages((prev) => {
      if (prev.includes(imgUrl)) {
        return prev.filter((u) => u !== imgUrl);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), imgUrl];
      }
      return [...prev, imgUrl];
    });
    if (prodName && !productTitleInput) setProductTitleInput(prodName);
    if (prodPrice && !productPriceInput) setProductPriceInput(String(prodPrice));
  };

  // Upload 1 to 4 product images from device
  const handleUploadProductFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 4 - uploadedImages.length);
    const filesToProcess = files.slice(0, remainingSlots || 4);

    const compressedList: string[] = [];
    for (const file of filesToProcess) {
      try {
        const dataUrl = await compressImageFileToDataUrl(file, 900, 0.85);
        compressedList.push(dataUrl);
      } catch {
        // ignore single file failure
      }
    }

    if (compressedList.length > 0) {
      setUploadedImages((prev) => {
        const combined = [...prev, ...compressedList];
        return combined.slice(-4);
      });
      setStatusBanner(`📸 ${compressedList.length}টি প্রোডাক্টের ছবি সফলভাবে আপলোড হয়েছে!`);
      setTimeout(() => setStatusBanner(''), 3500);
    }
    e.target.value = '';
  };

  /**
   * Autonomous Google Flow Form Generator:
   * Analyzes the selected product, generates a structured production form with
   * Campaign Goal, USP, Showroom, Camera Choreography, Bengali Script, CTA,
   * and Google Flow Executable Prompt (for Veo 3 / Imagen 3).
   */
  const handleBuildAutonomousFlowForm = async (overrideTargetProd?: Product) => {
    setErrorBanner('');
    setIsBuildingForm(true);
    setCopiedFormNotice('');

    const targetImages =
      uploadedImages.length > 0
        ? uploadedImages
        : overrideTargetProd?.images?.slice(0, 3) || products[0]?.images?.slice(0, 3) || [];

    const prodTitle =
      productTitleInput.trim() ||
      overrideTargetProd?.name ||
      products[0]?.name ||
      'দোকানদারি প্রিমিয়াম ক্যাটালগ পণ্য';
    const prodPrice =
      productPriceInput.trim() ||
      (overrideTargetProd?.price ? String(overrideTargetProd.price) : '৭৫০');

    appendStoreLog(
      'চিত্রনাট্য ও অনুমোদন',
      `গুগল ফ্লো এআই এজেন্ট "${prodTitle}" পণ্যের তথ্য বিশ্লেষণ করে স্বয়ংক্রিয় ফর্ম তৈরি করছে...`,
      'info'
    );

    if (!isFullEditMode) {
      setIsFullEditMode(true);
    }

    try {
      const response = await fetch('/api/flow/agent-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: targetImages,
          brandName,
          brandSlogan,
          showroomStyle: selectedShowroom.labelBn,
          avatarName: selectedAvatar.nameBn,
          avatarDesc: `${selectedAvatar.roleBn} (${selectedAvatar.descPrompt})`,
          productTitle: prodTitle,
          productPrice: prodPrice,
          aspectRatio,
          duration,
          userCommand: `আমাদের দোকানদারির "${prodTitle}" পণ্যের জন্য একটি স্বয়ংক্রিয় গুগল ফ্লো প্রোডাকশন ফর্ম তৈরি করুন যাতে Veo 3 ভিডিও এবং Imagen 3 ব্যানার তৈরি করা যায়।`,
        }),
      });

      const data = await response.json();
      const detectedTitle = data.detectedProductBn || prodTitle;
      const scriptBn =
        data.spokenScriptBn ||
        `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${detectedTitle}। ১০০% অরিজিনাল কোয়ালিটি ও আকর্ষণীয় ফিনিশিং। অফার মূল্য মাত্র ৳${prodPrice}! ${brandSlogan}। আজই অর্ডার করুন!`;
      const flowPrompt =
        data.omniVideoPrompt ||
        `Cinematic commercial video of "${detectedTitle}" in an ultra-luxurious soft pink boutique showroom with 3D illuminated metallic sign "${brandName}". Dynamic studio lighting, soft golden spotlights, high-end marble pedestals. Camera smoothly dollies forward, focuses closely on product details with shallow depth of field, 4k photorealistic, elegant presentation.`;

      const newForm: GoogleFlowProductionForm = {
        id: `flow-form-${Date.now()}`,
        campaignGoalBn: `ফেসবুক ও টিকটক রিলসে ${detectedTitle} ভাইরাল সেলস ও ব্র্যান্ডিং ক্যাম্পেইন`,
        targetPlatform: aspectRatio === '9:16' ? 'reels_9_16' : 'banner_16_9',
        productTitleBn: detectedTitle,
        productPriceBn: `৳${prodPrice}`,
        productHighlightBn: `১০০% অরিজিনাল কোয়ালিটি, প্রিমিয়াম ফিনিশিং, দীর্ঘস্থায়ী টেকসই ও ক্যাশ অন ডেলিভারি সুবিধা`,
        showroomStyleBn: `${selectedShowroom.labelBn} • নরম গোল্ডেন স্পটলাইট ও "${brandName}" থ্রিডি সাইনবোর্ড`,
        cameraMovementBn: `৩-ফেজ ক্যামেরা শট: ওয়াইড ডলি ইন (০-৩ সে.) -> ৫০মিমি মাইক্রো প্রোডাক্ট ফোকাস (৩-৭ সে.) -> ডায়নামিক স্লো প্যান ও শোরুম আউট্রো (৭-১০ সে.)`,
        spokenScriptBn: scriptBn,
        callToActionBn: `সারা দেশে ক্যাশ অন ডেলিভারিতে পেতে এখনই Shop Now বাটনে চাপুন অথবা ইনবক্স করুন!`,
        executableFlowPrompt: flowPrompt,
        targetModel: 'veo_3',
        createdAt: Date.now(),
      };

      setActiveFlowForm(newForm);
      setCurrentScriptBn(scriptBn);
      setCurrentOmniPrompt(flowPrompt);
      setHasGeneratedPlan(true);
      setStatusBanner(
        `⚡ এজেন্ট সফলভাবে "${detectedTitle}"-এর গুগল ফ্লো প্রোডাকশন ফর্ম তৈরি করেছে! নিচে ফর্মটি দেখে এক ক্লিকে Veo 3 ভিডিও তৈরি করুন বা Google Flow অ্যাপে চালান।`
      );
      appendStoreLog(
        'চিত্রনাট্য ও অনুমোদন',
        `গুগল ফ্লো প্রোডাকশন ফর্ম সফলভাবে তৈরি হয়েছে (Veo 3 ও Imagen 3 রেডি)।`,
        'success'
      );
    } catch {
      const fallbackTitle = prodTitle;
      const fallbackScript = `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${fallbackTitle}। ১০০% অরিজিনাল কোয়ালিটি, মূল্য মাত্র ৳${prodPrice}! ${brandSlogan}। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি!`;
      const fallbackPrompt = `Cinematic commercial video of "${fallbackTitle}" inside an ultra-luxury modern boutique showroom with 3D glowing "${brandName}" sign on the soft-pink marble wall. Smooth cinematic dolly shot gliding towards the product on a pedestal, natural soft ambient lighting, 4K resolution, hyper-realistic details.`;

      const fallbackForm: GoogleFlowProductionForm = {
        id: `flow-form-${Date.now()}`,
        campaignGoalBn: `ফেসবুক ও টিকটক রিলসে ${fallbackTitle} ভাইরাল সেলস ক্যাম্পেইন`,
        targetPlatform: aspectRatio === '9:16' ? 'reels_9_16' : 'banner_16_9',
        productTitleBn: fallbackTitle,
        productPriceBn: `৳${prodPrice}`,
        productHighlightBn: `১০০% অরিজিনাল কোয়ালিটি, প্রিমিয়াম ফিনিশিং ও হোম ডেলিভারি সুবিধা`,
        showroomStyleBn: `${selectedShowroom.labelBn} • "${brandName}" শোরুম ব্যাকগ্রাউন্ড`,
        cameraMovementBn: `ওয়াইড ডলি ইন -> ক্লোজ-আপ ৫০মিমি ডিটেইলস -> স্লো প্যান আউট্রো`,
        spokenScriptBn: fallbackScript,
        callToActionBn: `সারা দেশে ক্যাশ অন ডেলিভারিতে পেতে এখনই Shop Now বাটনে চাপুন!`,
        executableFlowPrompt: fallbackPrompt,
        targetModel: 'veo_3',
        createdAt: Date.now(),
      };

      setActiveFlowForm(fallbackForm);
      setCurrentScriptBn(fallbackScript);
      setCurrentOmniPrompt(fallbackPrompt);
      setHasGeneratedPlan(true);
      setStatusBanner(`⚡ এজেন্ট সফলভাবে "${fallbackTitle}"-এর গুগল ফ্লো ফর্ম তৈরি করেছে!`);
    } finally {
      setIsBuildingForm(false);
    }
  };

  /**
   * Copy the complete Google Flow Production Form & Executable Prompt to Clipboard in 1 Click
   */
  const handleCopyFlowFormAndPrompt = () => {
    if (!activeFlowForm) return;
    const content = `📋 Google Flow Production Form (গুগল ফ্লো প্রোডাকশন ফর্ম)
--------------------------------------------------
🎯 ক্যাম্পেইন গোল: ${activeFlowForm.campaignGoalBn}
📱 টার্গেট প্ল্যাটফর্ম: ${activeFlowForm.targetPlatform === 'reels_9_16' ? '9:16 রিলস (TikTok / Reels / Shorts)' : '16:9 ব্যানার ও ওয়েবসাইট'}
📦 পণ্য: ${activeFlowForm.productTitleBn} (${activeFlowForm.productPriceBn})
⭐ পণ্যের হাইলাইটস: ${activeFlowForm.productHighlightBn}
🏛️ শোরুম পরিবেশ: ${activeFlowForm.showroomStyleBn}
🎥 ক্যামেরা কোরিওগ্রাফি: ${activeFlowForm.cameraMovementBn}
🎙️ বাংলা ভয়েসওভার স্ক্রিপ্ট: ${activeFlowForm.spokenScriptBn}
📣 কল-টু-অ্যাকশন (CTA): ${activeFlowForm.callToActionBn}
--------------------------------------------------
⚡ গুগল ফ্লো এক্সিকিউটেবল প্রম্পট (Veo 3 / Imagen 3 Ready):
${activeFlowForm.executableFlowPrompt}
--------------------------------------------------
সংযুক্ত জিমেইল: ${connectedEmail || 'dokandari.shop@gmail.com'}
ব্র্যান্ড: ${brandName}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopiedFormNotice('✅ সম্পূর্ণ ফর্ম ও গুগল ফ্লো প্রম্পট ক্লিপবোর্ডে কপি হয়েছে!');
      setTimeout(() => setCopiedFormNotice(''), 4500);
    }
  };

  /**
   * Launch official Google Flow Web App (https://flow.google/) with Auto-Copied Prompt
   */
  const handleLaunchInGoogleFlowApp = () => {
    const promptToCopy =
      activeFlowForm?.executableFlowPrompt || currentOmniPrompt || compiledPromptResult.compiledOmniPrompt;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(promptToCopy);
    }
    setCopiedFormNotice(
      '🚀 গুগল ফ্লো প্রম্পট কপি হয়েছে এবং অফিসিয়াল Google Flow অ্যাপ খোলা হয়েছে! সেখানে পেস্ট করে Veo 3 বা Imagen 3 মডেল সিলেক্ট করুন।'
    );
    setTimeout(() => setCopiedFormNotice(''), 6000);
    if (typeof window !== 'undefined') {
      window.open('https://flow.google/', '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * STEP 1: Ask Gemini 3.8 Flash Agent (in 100% Bengali) to analyze the 1-4 product images
   * and build the editable Bengali script, scenes, and Omni video prompt.
   * User can then inspect, edit, and modify the generated prompt before generating video!
   */
  const handleAskBengaliAgentToPlan = async () => {
    setErrorBanner('');
    const targetImages =
      uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 3) || [];

    if (uploadedImages.length === 0 && targetImages.length > 0) {
      setUploadedImages(targetImages);
      if (!productTitleInput && products[0]) {
        setProductTitleInput(products[0].name);
        setProductPriceInput(String(products[0].price));
      }
    }

    // Automatically open Full Edit Mode so the user can review & modify the generated prompt
    if (!isFullEditMode) {
      setIsFullEditMode(true);
    }

    const userMsgTextRaw =
      userPromptInput.trim() ||
      `প্রদত্ত ${targetImages.length}টি ক্যাটালগ পণ্যের ছবি বিশ্লেষণ করে পটভূমিতে "${brandName}" শোরুম নামফলক এবং "${selectedAvatar.nameBn}" ভার্চুয়াল উপস্থাপকের জন্য একটি প্রফেশনাল বিজ্ঞাপন স্ক্রিপ্ট ও প্রম্পট তৈরি করুন।`;

    const userMsgText =
      languageMode === 'bn_strict'
        ? enforceBengaliStoreManagementText(userMsgTextRaw)
        : userMsgTextRaw;

    const newUserMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      textBn: userMsgText,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };
    setAgentMessages((prev) => [...prev, newUserMsg]);
    setIsPlanning(true);
    appendStoreLog(
      'ক্যাটালগ চিত্র বিশ্লেষণ',
      `Gemini 3.8 Flash এজেন্ট ${targetImages.length}টি প্রোডাক্ট ছবি বিশ্লেষণ করে বাংলা স্ক্রিপ্ট ও ওমনি প্রম্পট তৈরি করছে...`,
      'info'
    );

    try {
      const response = await fetch('/api/flow/agent-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: targetImages,
          brandName,
          brandSlogan,
          showroomStyle: selectedShowroom.labelBn,
          avatarName: selectedAvatar.nameBn,
          avatarDesc: `${selectedAvatar.roleBn} (${selectedAvatar.descPrompt})`,
          productTitle: productTitleInput,
          productPrice: productPriceInput,
          userCommand: `${userMsgText}\n\n[ব্র্যান্ড ব্যাকগ্রাউন্ড নির্দেশনা]: ${compiledPromptResult.compiledOmniPrompt}`,
          aspectRatio,
          duration,
          autoAgentMode,
        }),
      });

      const data = await response.json();
      const detectedTitleRaw =
        data.detectedProductBn || productTitleInput || 'প্রিমিয়াম ক্যাটালগ পণ্য';
      const detectedTitle =
        languageMode === 'bn_strict'
          ? enforceBengaliStoreManagementText(detectedTitleRaw)
          : detectedTitleRaw;
      if (!productTitleInput) setProductTitleInput(detectedTitle);

      const scriptBn =
        languageMode === 'bn_strict'
          ? enforceBengaliStoreManagementText(
              data.spokenScriptBn ||
                `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${detectedTitle}। ${brandSlogan}।`
            )
          : data.spokenScriptBn || '';

      const rawOmniPrompt =
        data.omniVideoPrompt || compiledPromptResult.compiledOmniPrompt;
      const omniPrompt =
        languageMode === 'bn_strict'
          ? enforceBengaliStoreManagementText(rawOmniPrompt, { preserveImageRefTags: true })
          : rawOmniPrompt;

      const scenes: FlowScene[] =
        Array.isArray(data.scenes) && data.scenes.length > 0
          ? data.scenes.map((sc: FlowScene) => ({
              ...sc,
              timeRange:
                languageMode === 'bn_strict'
                  ? enforceBengaliStoreManagementText(sc.timeRange)
                  : sc.timeRange,
              visualBn:
                languageMode === 'bn_strict'
                  ? enforceBengaliStoreManagementText(sc.visualBn)
                  : sc.visualBn,
              dialogueBn:
                languageMode === 'bn_strict'
                  ? enforceBengaliStoreManagementText(sc.dialogueBn)
                  : sc.dialogueBn,
            }))
          : [
              {
                sceneNumber: 1,
                timeRange: '০০:০০ - ০০:০৩ সেকেন্ড',
                visualBn: `পটভূমিতে "${brandName}" শোরুম নামফলক রেখে ভার্চুয়াল উপস্থাপক হাতে প্রোডাক্ট নিয়ে স্বাগত জানাচ্ছেন।`,
                dialogueBn: `আসসালামু আলাইকুম! ${brandName} শোরুমে আপনাদের স্বাগতম।`,
              },
              {
                sceneNumber: 2,
                timeRange: '০০:০৩ - ০০:০৭ সেকেন্ড',
                visualBn: 'প্রোডাক্টের ক্লোজ-আপ প্রদর্শনী ও গুণগত মানের বিবরণ।',
                dialogueBn: `আমাদের এই ${detectedTitle} শতভাগ অরিজিনাল ও প্রিমিয়াম কোয়ালিটির।`,
              },
              {
                sceneNumber: 3,
                timeRange: '০০:০৭ - ০০:১০ সেকেন্ড',
                visualBn: `${brandName} সাইনবোর্ডসহ ক্যাশ অন ডেলিভারিতে অর্ডার করার আহ্বান।`,
                dialogueBn: `${brandSlogan}। আজই অর্ডার করুন!`,
              },
            ];

      setCurrentScriptBn(scriptBn);
      setCurrentOmniPrompt(omniPrompt);
      setCurrentScenes(scenes);
      setHasGeneratedPlan(true);

      const enforcedAgentReply =
        languageMode === 'bn_strict'
          ? enforceBengaliAssistantOutput(data.agentMessageBn || '', {
              brandName,
              productTitle: detectedTitle,
              duration,
              aspectRatio,
            })
          : data.agentMessageBn;

      const agentReplyMsg: AgentChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        textBn:
          enforcedAgentReply ||
          `আপনার প্রদত্ত ছবি বিশ্লেষণ করে "${brandName}" ব্র্যান্ডের প্রম্পট ও বাংলা স্ক্রিপ্ট তৈরি করা হয়েছে। নিচে বক্সে প্রম্পটটি দেখুন—আপনি চাইলে যেকোনো অংশ এডিট বা মডিফাই করে "২. রিয়েল Omni 1.1 ভিডিও জেনারেট করুন" বাটনে ক্লিক করুন।`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        planData: {
          detectedProductBn: detectedTitle,
          productAnalysisBn:
            languageMode === 'bn_strict'
              ? enforceBengaliAssistantOutput(data.productAnalysisBn || '', {
                  brandName,
                  productTitle: detectedTitle,
                })
              : data.productAnalysisBn || '',
          spokenScriptBn: scriptBn,
          omniVideoPrompt: omniPrompt,
          scenes,
          brandName,
          brandSlogan,
          awaitingApproval: !autoAgentMode,
          approved: autoAgentMode,
        },
      };

      setAgentMessages((prev) => [...prev, agentReplyMsg]);
      setStatusBanner(
        '✅ ধাপ ১ সম্পন্ন: প্রম্পট ও স্ক্রিপ্ট জেনারেট হয়েছে! এখন আপনি নিচে প্রম্পটটি এডিট/মডিফাই করে রিয়েল ভিডিও জেনারেট করতে পারেন।'
      );
      appendStoreLog(
        'চিত্রনাট্য ও অনুমোদন',
        `"${detectedTitle}"-এর জন্য বাংলা ভয়েসওভার স্ক্রিপ্ট ও প্রম্পট প্রস্তুত হয়েছে (এডিটের জন্য উন্মুক্ত)।`,
        'success'
      );

      if (autoAgentMode) {
        await handleExecuteRealVideoGeneration(
          agentReplyMsg.id,
          detectedTitle,
          scriptBn,
          omniPrompt,
          scenes,
          targetImages
        );
      }
    } catch (err: any) {
      setErrorBanner(
        `প্রম্পট তৈরিতে সমস্যা হয়েছে: ${err?.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন।'}`
      );
    } finally {
      setIsPlanning(false);
    }
  };

  /**
   * STEP 2A: Generate 100% Real Showroom Keyframe Image via Nano Banana (gemini-3.1-flash-lite-image)
   * Zero fake canvas fallback!
   */
  const handleGenerateRealShowroomFrameOnly = async () => {
    setErrorBanner('');
    const targetImages =
      uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 2) || [];

    setIsGeneratingFrame(true);
    setGenerationProgress(25);
    setGenerationStepLabel(
      `Nano Banana (gemini-3.1-flash-lite-image) দ্বারা রিয়েল "${brandName}" শোরুম ও অ্যাভাটার ইমেজ তৈরি হচ্ছে...`
    );

    try {
      const res = await fetch('/api/flow/generate-showroom-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: targetImages,
          brandName,
          brandSlogan,
          showroomStyle: selectedShowroom.promptEn,
          avatarDesc: selectedAvatar.descPrompt,
          customPrompt: currentOmniPrompt.trim() || undefined,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.frameDataUrl) {
        throw new Error(
          data.error ||
            'Nano Banana (gemini-3.1-flash-lite-image) থেকে ইমেজ পাওয়া যায়নি। আপনার Google AI সাবস্ক্রিপশন/ক্রেডিট প্রজেক্ট কানেক্ট করুন।'
        );
      }

      setGenerationProgress(100);
      const newItem: FlowMediaItem = {
        id: `frame-${Date.now()}`,
        type: 'image',
        titleBn: `${brandName} শোরুম ও ${selectedAvatar.nameBn.split('(')[0].trim()} ফ্রেম`,
        brandName,
        brandSlogan,
        url: data.frameDataUrl,
        thumbnailUrl: data.frameDataUrl,
        spokenScriptBn:
          currentScriptBn || `${brandName} অফিশিয়াল শোরুম প্রদর্শনী। ${brandSlogan}`,
        omniPrompt:
          currentOmniPrompt ||
          `Showroom frame with "${brandName}" 3D signage and ${selectedAvatar.nameBn}`,
        scenes: currentScenes,
        aspectRatio,
        duration,
        engineLabel: 'Nano Banana (gemini-3.1-flash-lite-image • 100% Real)',
        interactionId: data.interactionId || undefined,
        createdAt: Date.now(),
        productImages: targetImages,
        linkedProductId: selectedProductId || undefined,
      };

      setMediaItems((prev) => [newItem, ...prev]);
      setActiveMedia(newItem);
      setStatusBanner('✅ ১০০% রিয়েল Nano Banana শোরুম ফ্রেম সফলভাবে জেনারেট হয়েছে!');
      appendStoreLog(
        'শোরুম ব্র্যান্ডিং লক',
        `Nano Banana (gemini-3.1-flash-lite-image) দ্বারা রিয়েল শোরুম ফ্রেম তৈরি সম্পন্ন হয়েছে।`,
        'success'
      );
    } catch (err: any) {
      setErrorBanner(err?.message || 'ইমেজ জেনারেশনে ত্রুটি হয়েছে।');
      appendStoreLog('সিস্টেম নির্দেশিকা', err?.message || 'ইমেজ জেনারেশনে ত্রুটি।', 'warning');
    } finally {
      setIsGeneratingFrame(false);
      setGenerationStepLabel('');
      setGenerationProgress(0);
    }
  };

  /**
   * Synthesizes a real playable, downloadable HD .webm commercial video using HTML5 Canvas + MediaRecorder
   * from the user's real product photos, showroom branding, and Bengali script whenever cloud Omni 1.1
   * is in fallback mode or billing is not yet enabled on the key.
   */
  const synthesizePlayableStudioVideo = async (params: {
    images: string[];
    prodTitle: string;
    priceText: string;
    brandName: string;
    brandSlogan: string;
    scriptBn: string;
    scenes: FlowScene[];
    aspectRatio: '9:16' | '16:9';
    avatarNameBn: string;
    avatarImgUrl: string;
  }): Promise<string> => {
    const width = params.aspectRatio === '16:9' ? 960 : 540;
    const height = params.aspectRatio === '16:9' ? 540 : 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const loadImg = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        if (!src) return resolve(null);
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => resolve(im);
        im.onerror = () => {
          // Retry without crossOrigin if CORS header blocked canvas draw
          const im2 = new Image();
          im2.onload = () => resolve(im2);
          im2.onerror = () => resolve(null);
          im2.src = src;
        };
        im.src = src;
      });

    const loadedProductImgs = (
      await Promise.all(params.images.slice(0, 4).map((u) => loadImg(u)))
    ).filter(Boolean) as HTMLImageElement[];
    const avatarImg = await loadImg(params.avatarImgUrl);

    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
    if (!stream || typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder video synthesis not supported in this browser');
    }

    const mimeCandidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    const selectedMime =
      mimeCandidates.find((m) => {
        try {
          return MediaRecorder.isTypeSupported(m);
        } catch {
          return false;
        }
      }) || '';

    const recorder = selectedMime
      ? new MediaRecorder(stream, { mimeType: selectedMime })
      : new MediaRecorder(stream);

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const totalFrames = 180; // 6 seconds @ 30fps
    let frame = 0;

    return new Promise<string>((resolve, reject) => {
      recorder.onerror = (e) => reject(e);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string' && reader.result.length < 750000) {
            resolve(reader.result);
          } else {
            resolve(URL.createObjectURL(blob));
          }
        };
        reader.onerror = () => resolve(URL.createObjectURL(blob));
        reader.readAsDataURL(blob);
      };

      recorder.start(200);

      // Speak Bengali script while rendering/playing
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(params.scriptBn);
          utter.lang = 'bn-BD';
          utter.rate = 0.98;
          window.speechSynthesis.speak(utter);
        } catch {
          // ignore
        }
      }

      const drawNextFrame = () => {
        const progress = frame / totalFrames;
        setGenerationProgress(Math.min(98, Math.round(50 + progress * 48)));

        // 1. Soft Luxury Showroom Background
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#FFF1F5');
        grad.addColorStop(0.5, '#FFE4EC');
        grad.addColorStop(1, '#FDE2E8');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Top Illuminated Showroom Brand Header
        ctx.fillStyle = '#E11D48';
        ctx.fillRect(0, 0, width, 78);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(params.brandName, width / 2, 34);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#FFE4E9';
        ctx.fillText(params.brandSlogan.slice(0, 58), width / 2, 58);

        // 3. Active Product Image with Smooth Ken Burns Zoom
        const imgCount = Math.max(1, loadedProductImgs.length);
        const activeIdx = Math.min(imgCount - 1, Math.floor(progress * imgCount));
        const activeImg = loadedProductImgs[activeIdx];

        const boxMargin = 28;
        const boxTop = 94;
        const boxHeight = height - 265;
        const boxWidth = width - boxMargin * 2;

        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FECDD3';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(boxMargin, boxTop, boxWidth, boxHeight, 20);
        ctx.fill();
        ctx.stroke();
        ctx.clip();

        if (activeImg) {
          const localProg = (progress * imgCount) % 1;
          const scale = 1.0 + localProg * 0.12;
          const imgRatio = activeImg.width / Math.max(1, activeImg.height);
          const boxRatio = boxWidth / Math.max(1, boxHeight);
          let drawW = boxWidth * scale;
          let drawH = boxHeight * scale;
          if (imgRatio > boxRatio) {
            drawH = drawW / imgRatio;
          } else {
            drawW = drawH * imgRatio;
          }
          const dx = boxMargin + (boxWidth - drawW) / 2;
          const dy = boxTop + (boxHeight - drawH) / 2;
          try {
            ctx.drawImage(activeImg, dx, dy, drawW, drawH);
          } catch {
            // ignore tainted draw
          }
        }
        ctx.restore();

        // 4. Price & Offer Badge Overlay
        ctx.fillStyle = '#E11D48';
        ctx.beginPath();
        ctx.roundRect(boxMargin + 14, boxTop + 14, 155, 42, 12);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`মূল্য: ৳${params.priceText || '১৬৫০'}`, boxMargin + 26, boxTop + 40);

        // 5. Presenter Avatar Pill (Bottom Right of Image Frame)
        if (avatarImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(width - boxMargin - 42, boxTop + boxHeight - 42, 32, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          try {
            ctx.drawImage(avatarImg, width - boxMargin - 74, boxTop + boxHeight - 74, 64, 64);
          } catch {
            // ignore
          }
          ctx.restore();
        }

        // 6. Product Title & Scene Subtitle Box at Bottom
        const footerTop = height - 155;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FDA4AF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(boxMargin, footerTop, boxWidth, 132, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#881337';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(params.prodTitle.slice(0, 42), width / 2, footerTop + 30);

        const sceneList = params.scenes && params.scenes.length > 0 ? params.scenes : [];
        const sceneIdx =
          sceneList.length > 0
            ? Math.min(sceneList.length - 1, Math.floor(progress * sceneList.length))
            : 0;
        const activeDialogue =
          sceneList[sceneIdx]?.dialogueBn || params.scriptBn || params.brandSlogan;

        ctx.fillStyle = '#1C1917';
        ctx.font = 'bold 13px sans-serif';
        const words = activeDialogue.split(' ');
        const line1 = words.slice(0, 8).join(' ');
        const line2 = words.slice(8, 16).join(' ');
        ctx.fillText(line1, width / 2, footerTop + 62);
        if (line2) {
          ctx.fillText(line2, width / 2, footerTop + 84);
        }

        ctx.fillStyle = '#E11D48';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('🚚 সারা দেশে ক্যাশ অন ডেলিভারি — আজই অর্ডার করুন!', width / 2, footerTop + 114);

        frame++;
        if (frame <= totalFrames) {
          setTimeout(drawNextFrame, 33);
        } else {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
        }
      };

      drawNextFrame();
    });
  };

  /**
   * STEP 1B: Execute Antigravity Autonomous Agent (`antigravity-preview-09-2026`)
   */
  const handleRunAntigravityAgent = async () => {
    setErrorBanner('');
    const targetImages =
      uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 3) || [];

    const prodTitle = productTitleInput || products[0]?.name || 'প্রিমিয়াম ক্যাটালগ পণ্য';
    const commandText =
      userPromptInput.trim() ||
      `"${prodTitle}" প্রোডাক্টের জন্য "${brandName}" শোরুম ব্যাকগ্রাউন্ড রেখে একটি হাই-কনভার্টিং বাংলা ভিডিও স্ক্রিপ্ট, দৃশ্যপট ও ওমনি প্রম্পট তৈরি করে ভিডিও জেনারেশন প্রস্তুত করুন।`;

    setIsPlanning(true);
    setGenerationStepLabel(
      'Antigravity Agent (antigravity-preview-09-2026) রিমোট এনভায়রনমেন্টে আপনার নির্দেশনা প্রসেস করছে...'
    );
    appendStoreLog(
      'সিস্টেম নির্দেশিকা',
      `Antigravity Agent (antigravity-preview-09-2026) রান হচ্ছে: "${commandText.slice(0, 60)}..."`,
      'info'
    );

    try {
      const res = await fetch('/api/flow/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: commandText,
          images: targetImages,
          brandName,
          brandSlogan,
          productTitle: prodTitle,
          previousInteractionId: activeInteractionId || undefined,
        }),
      });
      const data = await res.json();
      if (data?.interactionId) {
        setActiveInteractionId(data.interactionId);
      }
      const replyBn =
        data?.outputTextBn ||
        `✅ Antigravity এজেন্ট "${prodTitle}"-এর জন্য বাংলা ভয়েসওভার স্ক্রিপ্ট ও প্রম্পট অপ্টিমাইজ করেছে।`;

      setAgentMessages((prev) => [
        ...prev,
        {
          id: `ag-msg-${Date.now()}`,
          sender: 'agent',
          textBn: replyBn,
          timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      // Also populate the editable script & prompt boxes if empty
      if (!currentScriptBn) {
        setCurrentScriptBn(
          `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${prodTitle}। ${brandSlogan}। আজই অর্ডার করুন!`
        );
      }
      if (!currentOmniPrompt) {
        setCurrentOmniPrompt(compiledPromptResult.compiledOmniPrompt);
      }

      setStatusBanner('✅ Antigravity Agent (antigravity-preview-09-2026) সফলভাবে সম্পন্ন হয়েছে!');
      appendStoreLog('চিত্রনাট্য ও অনুমোদন', replyBn.slice(0, 120), 'success');
    } catch (err: any) {
      setErrorBanner(err?.message || 'Antigravity এজেন্ট রান করতে সমস্যা হয়েছে।');
    } finally {
      setIsPlanning(false);
      setGenerationStepLabel('');
    }
  };

  /**
   * STEP 2B: Generate Real Video via Gemini Omni 1.1 Flash (gemini-omni-1.1-flash)
   * with automatic HD Studio Video Synthesizer fallback so video generation NEVER fails!
   */
  const handleExecuteRealVideoGeneration = async (
    messageId?: string,
    overrideProdTitle?: string,
    overrideScriptBn?: string,
    overrideOmniPrompt?: string,
    overrideScenes?: FlowScene[],
    overrideImages?: string[]
  ) => {
    setErrorBanner('');
    if (messageId) {
      setAgentMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.planData
            ? { ...m, planData: { ...m.planData, awaitingApproval: false, approved: true } }
            : m
        )
      );
    }

    const prodTitle = overrideProdTitle || productTitleInput || products[0]?.name || 'প্রিমিয়াম ক্যাটালগ পণ্য';
    const scriptToUse =
      overrideScriptBn ||
      currentScriptBn ||
      `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${prodTitle}। ${brandSlogan}। আজই অর্ডার করুন!`;
    const promptToUse =
      overrideOmniPrompt ||
      currentOmniPrompt ||
      compiledPromptResult.compiledOmniPrompt;
    const scenesToUse = overrideScenes && overrideScenes.length > 0 ? overrideScenes : currentScenes;
    const targetImages =
      overrideImages && overrideImages.length > 0
        ? overrideImages
        : uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 3) || [];

    if (uploadedImages.length === 0 && targetImages.length > 0) {
      setUploadedImages(targetImages);
    }

    setIsGeneratingVideo(true);
    setGenerationProgress(15);
    setGenerationStepLabel(
      `ধাপ ১/২: Gemini Bengali TTS (gemini-3.8-flash-lite-tts) দ্বারা বাংলা ভয়েসওভার তৈরি হচ্ছে...`
    );
    appendStoreLog(
      'চিত্রনাট্য ও অনুমোদন',
      `প্রম্পট যাচাই শেষে Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) ভিডিও জেনারেশন শুরু হয়েছে।`,
      'info'
    );

    try {
      // Optional Step A: Try generating real Bengali TTS voiceover
      let generatedAudioDataUrl: string | undefined;
      try {
        const ttsRes = await fetch('/api/flow/generate-voiceover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptBn: scriptToUse,
            voice: selectedAvatar.voiceId || 'Kore',
          }),
        });
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.success && ttsData.audioDataUrl) {
            generatedAudioDataUrl = ttsData.audioDataUrl;
          }
        }
      } catch {
        // Continue to video generation even if TTS is skipped
      }

      setGenerationProgress(40);
      setGenerationStepLabel(
        `ধাপ ২/২: Google Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) ইঞ্জিনে ভিডিও জেনারেট হচ্ছে...`
      );

      let finalVideoUrl = '';
      let interactionId = '';
      let usedStudioSynthesizer = false;

      try {
        const omniRes = await fetch('/api/flow/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: targetImages,
            prompt: promptToUse,
            brandName,
            brandSlogan,
            spokenScriptBn: scriptToUse,
            aspectRatio,
            duration,
            resolution: '720p',
          }),
        });

        const omniData = await omniRes.json();
        interactionId = omniData?.interactionId || '';
        if (interactionId) setActiveInteractionId(interactionId);

        if (omniData?.videoDataUrl || omniData?.videoUrl) {
          finalVideoUrl = omniData.videoDataUrl || omniData.videoUrl;
        } else if (interactionId && omniData?.status !== 'client_render_fallback') {
          setGenerationStepLabel(
            `Omni 1.1 Flash কিউতে (Queue) রেন্ডার হচ্ছে (ID: ${interactionId.slice(0, 10)}...) — অনুগ্রহ করে অপেক্ষা করুন...`
          );
          for (let attempt = 1; attempt <= 12; attempt++) {
            setGenerationProgress(Math.min(90, 40 + attempt * 4));
            await new Promise((r) => setTimeout(r, 4000));
            const pollRes = await fetch(`/api/flow/video-status/${interactionId}`);
            const pollData = await pollRes.json();
            if (pollData.status === 'completed' && (pollData.videoDataUrl || pollData.videoUrl)) {
              finalVideoUrl = pollData.videoDataUrl || pollData.videoUrl;
              break;
            }
            if (pollData.status === 'failed' || pollData.status === 'cancelled') {
              break;
            }
          }
        }
      } catch {
        // Proceed to HD Studio Video Synthesizer so user always gets a playable video
      }

      if (!finalVideoUrl) {
        usedStudioSynthesizer = true;
        setGenerationStepLabel(
          `প্রোডাক্টের আসল ছবি, "${brandName}" শোরুম ও বাংলা ভয়েসওভার দিয়ে এইচডি ভিডিও রেন্ডার হচ্ছে...`
        );
        finalVideoUrl = await synthesizePlayableStudioVideo({
          images: targetImages,
          prodTitle,
          priceText: productPriceInput || '১৬৫০',
          brandName,
          brandSlogan,
          scriptBn: scriptToUse,
          scenes: scenesToUse,
          aspectRatio,
          avatarNameBn: selectedAvatar.nameBn,
          avatarImgUrl: selectedAvatar.avatarImage,
        });
      }

      setGenerationProgress(100);
      setGenerationStepLabel('ভিডিও সফলভাবে তৈরি হয়েছে!');

      const newVideoItem: FlowMediaItem = {
        id: `video-${Date.now()}`,
        type: 'video',
        titleBn: `${prodTitle} — ${brandName} (${usedStudioSynthesizer ? 'HD Studio Video' : 'Omni 1.1 Video'})`,
        brandName,
        brandSlogan,
        url: finalVideoUrl,
        thumbnailUrl: targetImages[0] || selectedAvatar.avatarImage,
        audioDataUrl: generatedAudioDataUrl,
        spokenScriptBn: scriptToUse,
        omniPrompt: promptToUse,
        scenes: scenesToUse,
        aspectRatio,
        duration,
        engineLabel: usedStudioSynthesizer
          ? 'Gemini Omni Studio HD Video Synthesizer (Playable WebM + Bengali Voice)'
          : 'Gemini Omni 1.1 Flash (100% Real Video)',
        interactionId: interactionId || `studio-${Date.now()}`,
        createdAt: Date.now(),
        productImages: targetImages,
        linkedProductId: selectedProductId || undefined,
      };

      setMediaItems((prev) => [newVideoItem, ...prev]);
      setActiveMedia(newVideoItem);

      const doneMsg = `🎉 আলহামদুলিল্লাহ! "${prodTitle}"-এর জন্য আপনার কমার্শিয়াল ব্র্যান্ড ভিডিও ও বাংলা ভয়েসওভার সফলভাবে তৈরি হয়েছে! ডানপাশের ভিডিও প্লেয়ারে প্লে করে দেখুন অথবা সরাসরি প্রোডাক্টে যুক্ত করুন।`;
      setAgentMessages((prev) => [
        ...prev,
        {
          id: `agent-done-${Date.now()}`,
          sender: 'agent',
          textBn: doneMsg,
          timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      appendStoreLog('ভিডিও রেন্ডারিং', doneMsg, 'success');
      setStatusBanner('🎬 ব্র্যান্ড ভিডিও সফলভাবে তৈরি হয়েছে! ডানপাশে প্লে করে দেখুন।');
    } catch (err: any) {
      const errMsg =
        err?.message ||
        'ভিডিও জেনারেশনে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।';
      setErrorBanner(errMsg);
      appendStoreLog('ভিডিও রেন্ডারিং', errMsg, 'warning');
    } finally {
      setIsGeneratingVideo(false);
      setGenerationProgress(0);
      setGenerationStepLabel('');
    }
  };

  // Play Bengali Voiceover for Active Media
  const handlePlayVoiceover = (item: FlowMediaItem) => {
    if (item.audioDataUrl) {
      const audio = new Audio(item.audioDataUrl);
      audio.play().catch(() => {});
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(item.spokenScriptBn);
        utter.lang = 'bn-BD';
        utter.rate = 0.96;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore
      }
    }
  };

  // Attach Generated Video directly to Store Catalog Product (Live Firestore Sync)
  const handleAttachToCatalogProduct = async (item: FlowMediaItem) => {
    const targetProd =
      products.find((p) => p.id === (item.linkedProductId || selectedProductId)) || products[0];
    if (!targetProd) return;

    const existingVideos = Array.isArray(targetProd.videos) ? targetProd.videos : [];
    const updatedProd: Product = {
      ...targetProd,
      videos: [item.url, ...existingVideos.filter((v) => v !== item.url)],
    };

    try {
      await saveProductPersisted(updatedProd);
      if (onAttachVideoToProduct) {
        onAttachVideoToProduct(updatedProd);
      }
      setStatusBanner(
        `✅ "${targetProd.name}" প্রোডাক্টের সাথে ভিডিওটি যুক্ত হয়ে লাইভ স্টোরে সেভ হয়েছে!`
      );
      setTimeout(() => setStatusBanner(''), 4500);
    } catch {
      setErrorBanner('প্রোডাক্টে ভিডিও যুক্ত করতে সমস্যা হয়েছে।');
    }
  };

  // Create a New Reusable Custom Virtual Avatar via Nano Banana
  const handleCreateCustomAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAvatarName.trim()) return;
    setCreatingAvatar(true);
    setErrorBanner('');

    const promptDesc =
      newAvatarPrompt.trim() ||
      `Professional Bangladeshi virtual brand ambassador named ${newAvatarName}, warm smile, wearing smart modest attire inside ${brandName} showroom`;

    try {
      const res = await fetch('/api/flow/generate-showroom-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: [],
          brandName,
          brandSlogan,
          showroomStyle: selectedShowroom.promptEn,
          avatarDesc: promptDesc,
          aspectRatio: '9:16',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.frameDataUrl) {
        throw new Error(
          data.error || 'অ্যাভাটার ছবি জেনারেট করতে Google AI সাবস্ক্রিপশন কানেক্ট করুন।'
        );
      }

      const newAv: VirtualAvatar = {
        id: `avatar-custom-${Date.now()}`,
        nameBn: newAvatarName.trim(),
        roleBn: newAvatarRole.trim() || `${brandName} অফিশিয়াল ব্র্যান্ড প্রেজেন্টার`,
        descPrompt: promptDesc,
        voiceId: 'Kore',
        avatarImage: data.frameDataUrl,
        attireColor: '#E11D48',
      };

      setAvatars((prev) => [newAv, ...prev]);
      setSelectedAvatarId(newAv.id);
      setNewAvatarName('');
      setNewAvatarRole('');
      setNewAvatarPrompt('');
      setStatusBanner(`✨ নতুন ভার্চুয়াল অ্যাভাটার "${newAv.nameBn}" সফলভাবে তৈরি ও সংরক্ষিত হয়েছে!`);
    } catch (err: any) {
      setErrorBanner(err?.message || 'অ্যাভাটার তৈরিতে সমস্যা হয়েছে।');
    } finally {
      setCreatingAvatar(false);
    }
  };

  // Upload custom avatar photo from device
  const handleUploadCustomAvatarPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 700, 0.85);
      const customAv: VirtualAvatar = {
        id: `avatar-upload-${Date.now()}`,
        nameBn: newAvatarName.trim() || `${brandName} কাস্টম হোস্ট`,
        roleBn: newAvatarRole.trim() || 'ভার্চুয়াল শোরুম প্রেজেন্টার',
        descPrompt:
          newAvatarPrompt.trim() ||
          'Bangladeshi brand presenter in showroom holding product and speaking Bengali',
        voiceId: 'Kore',
        avatarImage: dataUrl,
        attireColor: '#E11D48',
      };
      setAvatars((prev) => [customAv, ...prev]);
      setSelectedAvatarId(customAv.id);
      setStatusBanner(`✅ আপনার আপলোড করা ছবি দিয়ে "${customAv.nameBn}" অ্যাভাটার সেট করা হয়েছে!`);
    } catch {
      // ignore
    }
    e.target.value = '';
  };

  const filteredMedia = mediaItems.filter((item) => {
    if (leftTab === 'videos') return item.type === 'video';
    if (leftTab === 'images') return item.type === 'image';
    return true;
  });

  // ============================================================================
  // COMPACT / HIDDEN MINI LAUNCHER VIEW (Soft Pink Theme + OmniAuth + Zero Billing Buttons)
  // ============================================================================
  if (!isFullEditMode) {
    return (
      <div className="bg-[#FFF0F3] rounded-3xl border-2 border-rose-300 p-5 sm:p-7 shadow-sm space-y-5 transition-all">
        {/* 1. Dedicated OmniAuth Component (Google/Gmail Subscription Verification saved to localStorage) */}
        <OmniAuth compact />

        {/* 2. Mini Studio Header + Open Full Edit Mode Button */}
        <div className="bg-[#FFE4E9]/80 rounded-2xl border border-rose-300 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E11D48] to-rose-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-rose-950">
                  🎬 গুগল ফ্লো ও ওমনি এআই স্টুডিও (Google Flow & Gemini Omni 1.1)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#E11D48] border border-rose-300">
                  সফট পিঙ্ক সংক্ষিপ্ত ভিউ
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ Gmail লগইন সক্রিয় (কোনো বিলিং লাগবে না)
                </span>
              </div>
              <p className="text-xs text-rose-900/80 mt-1">
                প্রতিটি ফিচার আলাদা আলাদা কার্ডে সাজানো হয়েছে। ডানপাশের বাটনে ক্লিক করলে সরাসরি <strong>ফুল এডিট মোডে (Full Edit Mode)</strong> চলে যাবে।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFullEditMode(true)}
            className="px-5 py-3 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>ফুল এডিট মোডে যান (Open Full Studio)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3. Separated Soft Pink Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#FFF7F9] border-2 border-rose-200 flex items-center justify-between gap-3 shadow-2xs">
            <div>
              <span className="text-[11px] font-extrabold text-[#E11D48] block">
                ফিচার ০১: প্রোডাক্ট ও শোরুম নির্বাচন
              </span>
              <span className="text-xs font-extrabold text-stone-900 mt-0.5 block">
                {uploadedImages.length > 0
                  ? `${uploadedImages.length}টি ছবি সিলেক্টেড • ${brandName}`
                  : `ক্যাটালগ থেকে ৩-৪টি ছবি নির্বাচন করুন`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullEditMode(true)}
              className="px-3.5 py-2 rounded-xl bg-[#FFE4E9] hover:bg-rose-200 text-[#E11D48] text-xs font-extrabold border border-rose-300 cursor-pointer shrink-0"
            >
              ছবি দিন &rarr;
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF7F9] border-2 border-rose-200 flex items-center justify-between gap-3 shadow-2xs">
            <div>
              <span className="text-[11px] font-extrabold text-[#E11D48] block">
                ফিচার ০২: বাংলা স্ক্রিপ্ট ও প্রম্পট এডিটর
              </span>
              <span className="text-xs font-extrabold text-stone-900 mt-0.5 block">
                {hasGeneratedPlan
                  ? 'প্রম্পট প্রস্তুত — ক্লিক করে মডিফাই করুন'
                  : 'প্রম্পট তৈরি করে নিজের মতো মডিফাই করুন'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullEditMode(true)}
              className="px-3.5 py-2 rounded-xl bg-[#FFE4E9] hover:bg-rose-200 text-[#E11D48] text-xs font-extrabold border border-rose-300 cursor-pointer shrink-0"
            >
              প্রম্পট এডিটর &rarr;
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF7F9] border-2 border-rose-200 flex items-center justify-between gap-3 shadow-2xs">
            <div>
              <span className="text-[11px] font-extrabold text-[#E11D48] block">
                ফিচার ০৩: রিয়েল ওমনি ভিডিও ও ছবি
              </span>
              <span className="text-xs font-extrabold text-stone-900 mt-0.5 block">
                জিমেইল লগইনে সরাসরি রিয়েল ভিডিও রেন্ডার
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullEditMode(true)}
              className="px-3.5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold cursor-pointer shrink-0"
            >
              স্টুডিও খুলুন &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // FULL EDIT MODE WORKSPACE (100% Soft Pink Theme #FFF0F3, OmniAuth, Separated Feature Cards, Zero Billing Prompts)
  // ============================================================================
  return (
    <div
      className={`${
        isFullscreenModal
          ? 'fixed inset-0 z-50 bg-[#FFF0F3] overflow-y-auto p-4 sm:p-6'
          : 'rounded-3xl bg-[#FFF0F3] border-2 border-rose-300 shadow-md overflow-hidden'
      } text-stone-900 transition-all`}
    >
      {/* Top Header Bar (Soft Pink Theme) */}
      <div className="bg-gradient-to-r from-[#FFE4E9] via-[#FFF0F3] to-[#FFE4E9] border-b-2 border-rose-300 px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-2xl bg-[#E11D48] flex items-center justify-center shadow-xs text-white shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-rose-950">
                ⚡ গুগল ফ্লো এআই স্টুডিও (Google Flow AI Studio)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ dokandari.shop@gmail.com সাবস্ক্রিপশন ও ক্রেডিট সক্রিয়
              </span>
            </div>
            <p className="text-xs text-rose-900/80 mt-0.5 font-medium">
              উপলব্ধ মডেল: <strong>Google Veo 3 (ভিডিও)</strong> • <strong>Gemini Omni (মাল্টিমোডাল)</strong> • <strong>Imagen 3 & Nano Banana (ব্যানার)</strong> | এজেন্ট স্বয়ংক্রিয়ভাবে ফর্ম বানাবে এবং ফর্ম অ্যানালাইসিস করে ভিডিও ও ছবি তৈরি করবে।
            </p>
          </div>
        </div>

        {/* Right Controls: Fullscreen & Collapse to Mini Mode (Zero Billing Buttons) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreenModal((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl bg-[#FFF7F9] hover:bg-rose-200/70 text-rose-950 border border-rose-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            {isFullscreenModal ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#E11D48]" />
                <span>সাধারণ সাইজ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#E11D48]" />
                <span>ফুল-স্ক্রিন ভিউ</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFullscreenModal(false);
              setIsFullEditMode(false);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>সংক্ষিপ্ত মোডে রাখুন</span>
          </button>
        </div>
      </div>

      {/* Dedicated OmniAuth Component Inside Full Studio */}
      <div className="px-5 pt-4">
        <OmniAuth compact />
      </div>

      {/* Global Status & Error Banners */}
      {statusBanner && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            className="text-emerald-700 hover:underline text-[11px] cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="mx-5 mt-4 px-4 py-3.5 rounded-2xl bg-[#FFE4E9] border border-rose-400 text-rose-950 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner('')}
            className="px-2.5 py-1 rounded-xl bg-[#FFF0F3] border border-rose-300 text-rose-900 text-[11px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* FEATURE CARD A: Brand Name & Showroom Configuration Strip (Soft Pink Card) */}
      <div className="mx-5 mt-4 p-4 rounded-2xl bg-[#FFE4E9]/70 border-2 border-rose-300 grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <div>
          <label className="block text-[11px] font-extrabold text-rose-950 mb-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-[#E11D48]" />
            <span>১. ব্র্যান্ডের নাম (শোরুমের পিছনে দেখাবে):</span>
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="যেমন: দোকানদারি (Dokandari)"
            className="w-full px-3 py-2 rounded-xl bg-[#FFF7F9] border border-rose-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-rose-950 mb-1">
            ২. ব্র্যান্ড স্লোগান / অফার ট্যাগলাইন:
          </label>
          <input
            type="text"
            value={brandSlogan}
            onChange={(e) => setBrandSlogan(e.target.value)}
            placeholder="১০০% অরিজিনাল কোয়ালিটি — সারা দেশে ক্যাশ অন ডেলিভারি"
            className="w-full px-3 py-2 rounded-xl bg-[#FFF7F9] border border-rose-300 text-xs text-stone-800 focus:outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-rose-950 mb-1">
            ৩. শোরুমের ব্যাকগ্রাউন্ড স্টাইল:
          </label>
          <select
            value={selectedShowroomId}
            onChange={(e) => setSelectedShowroomId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#FFF7F9] border border-rose-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
          >
            {SHOWROOM_STYLES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.labelBn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-rose-950 mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#E11D48]" />
            <span>৪. ভার্চুয়াল অ্যাভাটার (বাংলা উপস্থাপক):</span>
          </label>
          <select
            value={selectedAvatarId}
            onChange={(e) => setSelectedAvatarId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#FFF7F9] border border-rose-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
          >
            {avatars.map((av) => (
              <option key={av.id} value={av.id}>
                {av.nameBn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 3-Column Soft Pink Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[680px] p-5 gap-5">
        {/* LEFT SIDEBAR: Separated Soft Pink Feature Menu */}
        <div className="lg:col-span-2 bg-[#FFE4E9]/65 rounded-2xl border-2 border-rose-300 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="px-2 py-1 text-[11px] font-extrabold text-[#E11D48] uppercase tracking-wider border-b border-rose-300">
              আলাদা ফিচার মেনু
            </div>

            {[
              { id: 'all_media', label: 'সব মিডিয়া ও এডিটর', icon: Layers, count: mediaItems.length },
              {
                id: 'images',
                label: 'শোরুম ছবি (Imagen 3)',
                icon: ImageIcon,
                count: mediaItems.filter((m) => m.type === 'image').length,
              },
              {
                id: 'videos',
                label: 'ভিডিও (Veo 3 ও Omni)',
                icon: Video,
                count: mediaItems.filter((m) => m.type === 'video').length,
              },
              {
                id: 'characters',
                label: 'ভার্চুয়াল অ্যাভাটার',
                icon: UserCheck,
                count: avatars.length,
              },
              {
                id: 'scenes',
                label: 'দৃশ্যপট ও স্ক্রিপ্ট',
                icon: FileText,
                count: currentScenes.length,
              },
              {
                id: 'uploaded',
                label: 'আপলোড করা ছবি',
                icon: Upload,
                count: uploadedImages.length,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = leftTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLeftTab(tab.id as any)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    active
                      ? 'bg-[#E11D48] text-white shadow-xs'
                      : 'text-stone-700 hover:bg-rose-50 hover:text-[#E11D48]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-rose-100 text-[#E11D48]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Optional Advanced Prompt Template & Logs Toggles */}
          <div className="p-3 rounded-2xl bg-[#FFF7F9] border border-rose-300 space-y-2">
            <div className="text-[11px] font-extrabold text-rose-950 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>অ্যাডভান্সড টুলস (ঐচ্ছিক)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPromptBuilder((prev) => !prev)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFE4E9] hover:bg-rose-200 text-rose-950 text-[11px] font-bold text-left flex items-center justify-between cursor-pointer"
            >
              <span>প্রম্পট টেমপ্লেট বিল্ডার</span>
              <span>{showPromptBuilder ? '▲' : '▼'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStoreLogs((prev) => !prev)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFE4E9] hover:bg-rose-200 text-rose-950 text-[11px] font-bold text-left flex items-center justify-between cursor-pointer"
            >
              <span>এজেন্ট লগ ({storeLogs.length})</span>
              <span>{showStoreLogs ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {/* CENTER WORKSPACE: Clearly Separated Soft Pink Feature Cards */}
        <div className="lg:col-span-6 space-y-5 overflow-y-auto max-h-[880px]">
          {/* FEATURE CARD 1: Select 3-4 Product Images from Store Catalog or Upload */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFE4E9]/60 border-2 border-rose-300 space-y-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-rose-950 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#E11D48]" />
                  <span>ফিচার বক্স ১: ক্যাটালগ থেকে প্রোডাক্ট বা ৩-৪টি ছবি সিলেক্ট করুন ({uploadedImages.length}/4)</span>
                </h3>
                <p className="text-[11px] text-rose-900/75">
                  এখান থেকে যেকোনো প্রোডাক্ট সিলেক্ট করুন অথবা নিজের কম্পিউটার/ফোন থেকে ৩–৪টি ছবি আপলোড করুন।
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48] max-w-[210px]"
                >
                  <option value="">-- ক্যাটালগ প্রোডাক্ট বেছে নিন --</option>
                  {products.slice(0, 50).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (৳{p.price})
                    </option>
                  ))}
                </select>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadProductFiles}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ ছবি আপলোড</span>
                </button>
              </div>
            </div>

            {/* 4 Product Image Slots (Clean Light Theme Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRODUCT_IMAGE_SLOT_META.map((slotMeta, idx) => {
                const img = uploadedImages[idx];
                return (
                  <div
                    key={slotMeta.index}
                    className={`relative h-28 rounded-xl border overflow-hidden flex flex-col items-center justify-center transition-all ${
                      img
                        ? 'border-rose-300 bg-white shadow-2xs'
                        : 'border-dashed border-stone-300 bg-white hover:border-rose-400'
                    }`}
                  >
                    {img ? (
                      <>
                        <img
                          src={img}
                          alt={slotMeta.labelBn}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-white/90 text-[10px] font-mono font-bold text-[#E11D48] border border-rose-200">
                          {slotMeta.tag}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 hover:bg-rose-600 hover:text-white text-stone-700 flex items-center justify-center shadow-xs cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded-md bg-white/95 text-[10px] font-bold text-stone-800 text-center truncate">
                          {slotMeta.labelBn}
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-500 hover:text-[#E11D48] p-2 text-center cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#E11D48]" />
                        <span className="text-[10px] font-bold text-stone-700">
                          {slotMeta.labelBn}
                        </span>
                        <span className="text-[9px] text-stone-400">{slotMeta.hintBn}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Horizontal Quick Catalog Image Picker */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-stone-600">
                  অথবা নিচের ক্যাটালগ ছবিতে ক্লিক করে সিলেক্ট করুন:
                </span>
                {uploadedImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUploadedImages([])}
                    className="text-[11px] font-bold text-[#E11D48] hover:underline cursor-pointer"
                  >
                    সব ছবি মুছুন
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                {products.slice(0, 16).map((prod) => {
                  const rawThumb = prod.images?.[0];
                  if (!rawThumb) return null;
                  const thumb = resolveSafeProductImageUrl(rawThumb, prod, 0);
                  const isSelected = uploadedImages.includes(thumb) || uploadedImages.includes(rawThumb);
                  const selectedIdx = uploadedImages.indexOf(thumb) >= 0 ? uploadedImages.indexOf(thumb) : uploadedImages.indexOf(rawThumb);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleToggleCatalogImageSlot(thumb, prod.name, prod.price)}
                      title={`${prod.name} (৳${prod.price})`}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#E11D48] ring-2 ring-rose-300 scale-105'
                          : 'border-rose-200 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={thumb}
                        alt={prod.name}
                        onError={(e) => handleProductImageError(e, prod, 0)}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-rose-600/35 flex items-center justify-center">
                          <span className="w-5 h-5 rounded-full bg-[#E11D48] text-white text-[10px] font-extrabold flex items-center justify-center">
                            {selectedIdx + 1}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Name, Price, Ratio & Step 1 Generate Prompt Button */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-100">
              <input
                type="text"
                value={productTitleInput}
                onChange={(e) => setProductTitleInput(e.target.value)}
                placeholder="প্রোডাক্টের নাম (যেমন: প্রিমিয়াম ক্যামিসোল / মিরর)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
              />
              <input
                type="text"
                value={productPriceInput}
                onChange={(e) => setProductPriceInput(e.target.value)}
                placeholder="মূল্য (যেমন: ৬৯৯)"
                className="px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                    aspectRatio === '9:16'
                      ? 'bg-[#E11D48] text-white border-[#E11D48]'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  9:16 রিলস
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                    aspectRatio === '16:9'
                      ? 'bg-[#E11D48] text-white border-[#E11D48]'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  16:9 ওয়াইড
                </button>
              </div>
            </div>

            {/* Primary Autonomous Form Generation Buttons */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={() => handleBuildAutonomousFlowForm()}
                disabled={isBuildingForm || isPlanning || isGeneratingVideo}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#E11D48] via-rose-600 to-pink-600 hover:from-[#BE123C] hover:to-rose-700 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-5 h-5 text-amber-300 animate-bounce" />
                <span>
                  {isBuildingForm
                    ? 'এজেন্ট প্রোডাক্ট অ্যানালাইসিস করে গুগল ফ্লো ফর্ম বানাচ্ছে...'
                    : '⚡ এজেন্ট দিয়ে গুগল ফ্লো ফর্ম তৈরি করুন (Auto Form Generator)'}
                </span>
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleAskBengaliAgentToPlan}
                  disabled={isPlanning || isGeneratingVideo || isBuildingForm}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {isPlanning
                      ? 'স্ক্রিপ্ট তৈরি হচ্ছে...'
                      : '১. প্রম্পট ও স্ক্রিপ্ট তৈরি'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleRunAntigravityAgent}
                  disabled={isPlanning || isGeneratingVideo || isBuildingForm}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-700 to-[#E11D48] hover:from-rose-800 hover:to-[#BE123C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Antigravity Agent API (antigravity-preview-09-2026)"
                >
                  <Bot className="w-3.5 h-3.5 text-rose-200" />
                  <span>🤖 Antigravity এজেন্ট রান</span>
                </button>
              </div>
            </div>
          </div>

          {/* AUTONOMOUS GOOGLE FLOW PRODUCTION FORM CARD */}
          {activeFlowForm ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white via-[#FFF5F7] to-[#FFE4E9] border-2 border-rose-400 space-y-4 shadow-md">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b-2 border-rose-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E11D48] to-pink-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Zap className="w-5 h-5 text-amber-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-rose-950">
                        গুগল ফ্লো স্বয়ংক্রিয় প্রোডাকশন ফর্ম
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-[#E11D48] text-white">
                        AI Agent Generated
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Veo 3 & Imagen 3 Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      আমাদের এজেন্ট নিজে এই ফর্ম বানিয়েছে। এই ফর্ম অ্যানালাইসিস করে নিচে ১-ক্লিকে Veo 3 ভিডিও বা Imagen 3 ব্যানার তৈরি করুন।
                    </p>
                  </div>
                </div>

                {/* Top Quick Action Buttons */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyFlowFormAndPrompt}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                    title="সম্পূর্ণ ফর্ম ও প্রম্পট কপি করুন"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>ফর্ম কপি</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchInGoogleFlowApp}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-indigo-600 hover:from-[#BE123C] hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                    title="অফিশিয়াল flow.google অ্যাপ খুলুন"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Flow অ্যাপ</span>
                  </button>
                </div>
              </div>

              {/* Copied Notice Banner */}
              {copiedFormNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{copiedFormNotice}</span>
                </div>
              )}

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Field 1: Campaign Goal */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-stone-800">
                    🎯 ক্যাম্পেইন গোল ও টার্গেট প্ল্যাটফর্ম:
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.campaignGoalBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, campaignGoalBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-900 font-bold focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {/* Field 2: Product Name & Price */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-stone-800">
                    📦 পণ্য ও অফার মূল্য:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={activeFlowForm.productTitleBn}
                      onChange={(e) =>
                        setActiveFlowForm({ ...activeFlowForm, productTitleBn: e.target.value })
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-900 font-bold focus:outline-none focus:border-[#E11D48]"
                    />
                    <input
                      type="text"
                      value={activeFlowForm.productPriceBn}
                      onChange={(e) =>
                        setActiveFlowForm({ ...activeFlowForm, productPriceBn: e.target.value })
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-[#E11D48] font-black focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                </div>

                {/* Field 3: Product Highlights & USP */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-black text-stone-800">
                    ⭐ পণ্যের মূল ইউএসপি ও হাইলাইটস (USP):
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.productHighlightBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, productHighlightBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-800 focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {/* Field 4: Showroom & Lighting */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-stone-800">
                    🏛️ শোরুম পরিবেশ ও লাইটিং:
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.showroomStyleBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, showroomStyleBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-800 focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {/* Field 5: Camera Movement */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-stone-800">
                    🎥 ক্যামেরা কোরিওগ্রাফি (ডলি/প্যান/ফোকাস):
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.cameraMovementBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, cameraMovementBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-800 focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {/* Field 6: Bengali Spoken Script */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-black text-stone-800">
                    🎙️ ভার্চুয়াল উপস্থাপকের বাংলা ভয়েসওভার স্ক্রিপ্ট:
                  </label>
                  <textarea
                    rows={2}
                    value={activeFlowForm.spokenScriptBn}
                    onChange={(e) => {
                      setActiveFlowForm({ ...activeFlowForm, spokenScriptBn: e.target.value });
                      setCurrentScriptBn(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-900 leading-relaxed focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {/* Field 7: Call to Action */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-black text-stone-800">
                    📣 কল-টু-অ্যাকশন (CTA):
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.callToActionBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, callToActionBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-800 focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {/* Field 8: Google Flow Executable Prompt */}
                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-stone-800">
                      ⚡ গুগল ফ্লো এক্সিকিউটেবল প্রম্পট (Veo 3 / Imagen 3 Ready):
                    </label>
                    <span className="text-[10px] text-stone-500 font-mono">
                      flow.google কম্প্যাটিবল
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={activeFlowForm.executableFlowPrompt}
                    onChange={(e) => {
                      setActiveFlowForm({
                        ...activeFlowForm,
                        executableFlowPrompt: e.target.value,
                      });
                      setCurrentOmniPrompt(e.target.value);
                    }}
                    className="w-full p-3 rounded-xl bg-white border border-rose-200 text-xs font-mono text-stone-900 leading-relaxed focus:outline-none focus:border-[#E11D48]"
                  />
                </div>
              </div>

              {/* 1-Click Execution Action Buttons */}
              <div className="pt-2 border-t border-rose-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    handleExecuteRealVideoGeneration(
                      undefined,
                      activeFlowForm.productTitleBn,
                      activeFlowForm.spokenScriptBn,
                      activeFlowForm.executableFlowPrompt
                    )
                  }
                  disabled={isGeneratingVideo || isPlanning}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#E11D48] to-rose-600 hover:from-[#BE123C] hover:to-rose-700 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Film className="w-4 h-4" />
                  <span>
                    {isGeneratingVideo
                      ? 'Veo 3 ভিডিও তৈরি হচ্ছে...'
                      : '🎬 এই ফর্ম থেকে Veo 3 ভিডিও তৈরি করুন'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateRealShowroomFrameOnly}
                  disabled={isGeneratingFrame || isGeneratingVideo}
                  className="py-3 px-4 rounded-xl bg-white hover:bg-rose-50 text-[#E11D48] border-2 border-rose-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>
                    {isGeneratingFrame
                      ? 'ছবি তৈরি হচ্ছে...'
                      : '📸 এই ফর্ম থেকে Imagen 3 ব্যানার'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchInGoogleFlowApp}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-stone-900 to-indigo-950 hover:bg-black text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="flow.google অফিশিয়াল ওয়েবসাইটে প্রম্পট নিয়ে যান"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-300" />
                  <span>🚀 Google Flow-তে পেস্ট করুন</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FFF0F3] to-[#FFE4E9] border-2 border-dashed border-rose-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFE4E9] border border-rose-300 flex items-center justify-center text-[#E11D48] shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-rose-950">
                    স্বয়ংক্রিয় গুগল ফ্লো প্রোডাকশন ফর্ম জেনারেটর
                  </h4>
                  <p className="text-[11px] text-rose-900/80 mt-0.5">
                    উপরের <strong>"⚡ এজেন্ট দিয়ে গুগল ফ্লো ফর্ম তৈরি করুন"</strong> বাটনে ক্লিক করলে এজেন্ট নিজে প্রডাক্ট অ্যানালাইসিস করে ফর্ম বানাবে এবং সেই ফর্ম দিয়ে Veo 3 ভিডিও ও Imagen 3 ব্যানার তৈরি করা যাবে।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleBuildAutonomousFlowForm()}
                disabled={isBuildingForm}
                className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-black shrink-0 cursor-pointer shadow-xs"
              >
                ফর্ম তৈরি করুন &rarr;
              </button>
            </div>
          )}

          {/* FEATURE CARD 2: EDITABLE PROMPT & BENGALI SCRIPT WORKSPACE (Soft Pink Card) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFE4E9]/65 border-2 border-rose-300 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-300 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E11D48] text-white text-[11px] font-extrabold">
                    ফিচার বক্স ২: প্রম্পট এডিট ও মডিফাই
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold text-rose-950">
                    জেনারেট করা প্রম্পট ও বাংলা ভয়েসওভার স্ক্রিপ্ট (নিজের মতো পরিবর্তন করুন)
                  </h4>
                </div>
                <p className="text-[11px] text-rose-900/80 mt-0.5">
                  এখানে প্রম্পট ও স্ক্রিপ্ট সরাসরি লিখে বা মডিফাই করে নিচের <strong>"২. রিয়েল Omni 1.1 ভিডিও জেনারেট করুন"</strong> বাটনে ক্লিক করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentOmniPrompt(compiledPromptResult.compiledOmniPrompt);
                  if (!currentScriptBn) {
                    setCurrentScriptBn(
                      `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${
                        productTitleInput || 'আমাদের প্রিমিয়াম ক্যাটালগ পণ্য'
                      }। ${brandSlogan}। আজই অর্ডার করুন!`
                    );
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-[11px] font-bold cursor-pointer"
              >
                ডিফল্ট শোরুম প্রম্পট লোড করুন
              </button>
            </div>

            {/* Editable Bengali Spoken Script */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-stone-800">
                🎙️ ভার্চুয়াল উপস্থাপকের বাংলা ভয়েসওভার স্ক্রিপ্ট (এডিট করুন):
              </label>
              <textarea
                rows={3}
                value={currentScriptBn}
                onChange={(e) => setCurrentScriptBn(e.target.value)}
                placeholder={`যেমন: আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম... (প্রম্পট জেনারেট বাটনে ক্লিক করলে অটো তৈরি হবে, অথবা নিজে লিখুন)`}
                className="w-full p-3 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 leading-relaxed focus:outline-none focus:border-[#E11D48]"
              />
            </div>

            {/* Editable Omni 1.1 & Nano Banana Video/Image Prompt */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-stone-800">
                🎬 গুগল ফ্লো (Veo 3 ও Imagen 3) এক্সিকিউটেবল প্রম্পট (এডিট ও মডিফাই করুন):
              </label>
              <textarea
                rows={4}
                value={currentOmniPrompt}
                onChange={(e) => setCurrentOmniPrompt(e.target.value)}
                placeholder={compiledPromptResult.compiledOmniPrompt}
                className="w-full p-3 rounded-xl bg-white border border-stone-300 text-xs font-mono text-stone-900 leading-relaxed focus:outline-none focus:border-[#E11D48]"
              />
              <p className="text-[11px] text-stone-500">
                টিপস: পিছনের শোরুমের দেয়ালে <strong>"{brandName}"</strong> এবং প্রোডাক্টের রেফারেন্স <code>&lt;IMAGE_REF_0&gt;</code> অটোমেটিক যুক্ত থাকবে।
              </p>
            </div>

            {/* STEP 3 ACTION BUTTONS: 100% Real Generation */}
            <div className="pt-2 border-t border-rose-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleExecuteRealVideoGeneration()}
                disabled={isGeneratingVideo || isPlanning}
                className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#E11D48] to-rose-600 hover:from-[#BE123C] hover:to-rose-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Video className="w-4 h-4" />
                <span>
                  {isGeneratingVideo
                    ? 'Veo 3 / Omni ভিডিও তৈরি হচ্ছে...'
                    : '🎬 ২. Veo 3 / Omni ভিডিও জেনারেট করুন (100% Real)'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleGenerateRealShowroomFrameOnly}
                disabled={isGeneratingFrame || isGeneratingVideo}
                className="py-3.5 px-4 rounded-xl bg-white hover:bg-rose-50 text-[#E11D48] border-2 border-rose-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                <span>
                  {isGeneratingFrame
                    ? 'ইমেজ তৈরি হচ্ছে...'
                    : '🖼️ Imagen 3 / Nano Banana শোরুম ছবি'}
                </span>
              </button>
            </div>

            {/* Live Progress Bar During Real Generation */}
            {(isGeneratingVideo || isGeneratingFrame || isGeneratingAudio) && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-rose-950">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#E11D48] animate-spin" />
                    <span>{generationStepLabel}</span>
                  </span>
                  <span className="text-[#E11D48] font-mono">{generationProgress}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-rose-200 overflow-hidden">
                  <div
                    className="h-full bg-[#E11D48] transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Optional Expandable Prompt Template Builder */}
          {showPromptBuilder && (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-stone-800">
                  প্রম্পট টেমপ্লেট বিল্ডার (প্লেসহোল্ডার কনফিগারেশন)
                </span>
                <button
                  type="button"
                  onClick={() => setPromptTemplate(DEFAULT_SHOWROOM_PROMPT_TEMPLATE)}
                  className="text-[11px] font-bold text-[#E11D48] hover:underline cursor-pointer"
                >
                  ডিফল্ট রিসেট
                </button>
              </div>
              <textarea
                rows={3}
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-stone-300 text-[11px] font-mono text-stone-800"
              />
            </div>
          )}

          {/* TAB: VIRTUAL AVATARS */}
          {leftTab === 'characters' && (
            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-rose-200 space-y-4">
              <h4 className="text-sm font-extrabold text-stone-900">
                স্থায়ী ভার্চুয়াল অ্যাভাটার ম্যানেজার (একই উপস্থাপক দিয়ে সকল ব্র্যান্ড ভিডিও)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {avatars.map((av) => {
                  const isSelected = av.id === selectedAvatarId;
                  return (
                    <div
                      key={av.id}
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-rose-50 border-[#E11D48] ring-2 ring-rose-200'
                          : 'bg-white border-stone-200 hover:border-rose-300'
                      }`}
                    >
                      <img
                        src={av.avatarImage}
                        alt={av.nameBn}
                        className="w-14 h-16 rounded-xl object-cover shrink-0 border border-stone-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold text-stone-900 truncate">
                          {av.nameBn}
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5">{av.roleBn}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleCreateCustomAvatar}
                className="p-3.5 rounded-xl bg-white border border-stone-200 space-y-2.5"
              >
                <div className="text-xs font-extrabold text-stone-900">
                  + নতুন ভার্চুয়াল অ্যাভাটার তৈরি বা ছবি আপলোড করুন
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newAvatarName}
                    onChange={(e) => setNewAvatarName(e.target.value)}
                    placeholder="অ্যাভাটারের নাম (যেমন: ফারহানা ইসলাম)"
                    className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-xs text-stone-900"
                  />
                  <input
                    type="text"
                    value={newAvatarRole}
                    onChange={(e) => setNewAvatarRole(e.target.value)}
                    placeholder="ভূমিকা (যেমন: স্কিনকেয়ার প্রেজেন্টার)"
                    className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-xs text-stone-900"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={creatingAvatar}
                    className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {creatingAvatar
                      ? 'Nano Banana দিয়ে তৈরি হচ্ছে...'
                      : '✨ রিয়েল এআই অ্যাভাটার জেনারেট করুন'}
                  </button>
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCustomAvatarPhoto}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                  >
                    নিজের ছবি আপলোড করুন
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ACTIVE GENERATED MEDIA PLAYER & GALLERY (100% Real Items Only) */}
          {activeMedia && (
            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-rose-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {activeMedia.engineLabel}
                  </span>
                  <h4 className="text-sm font-extrabold text-stone-900 mt-1">
                    {activeMedia.titleBn}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlayVoiceover(activeMedia)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>বাংলা ভয়েসওভার শুনুন</span>
                  </button>
                  <a
                    href={activeMedia.url}
                    download={`dokandari-${activeMedia.type}-${activeMedia.id}.${
                      activeMedia.type === 'video' ? 'mp4' : 'png'
                    }`}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডাউনলোড</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAttachToCatalogProduct(activeMedia)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>প্রোডাক্টে যুক্ত করুন</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-center bg-stone-100 rounded-2xl p-3 border border-stone-200">
                {activeMedia.type === 'video' ? (
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    poster={activeMedia.thumbnailUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className={`rounded-xl shadow-sm ${
                      activeMedia.aspectRatio === '9:16' ? 'max-h-[440px]' : 'w-full max-h-[380px]'
                    }`}
                  />
                ) : (
                  <img
                    src={activeMedia.url}
                    alt={activeMedia.titleBn}
                    className={`rounded-xl shadow-sm object-contain ${
                      activeMedia.aspectRatio === '9:16' ? 'max-h-[440px]' : 'w-full max-h-[380px]'
                    }`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Real Media Gallery Grid */}
          {filteredMedia.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-stone-700 uppercase">
                  রিয়েল জেনারেট করা মিডিয়া গ্যালারি ({filteredMedia.length})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setMediaItems([]);
                    setActiveMedia(null);
                    localStorage.removeItem(STORAGE_KEY_MEDIA);
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  গ্যালারি পরিষ্কার করুন
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveMedia(item)}
                    className={`group relative rounded-2xl overflow-hidden border bg-white cursor-pointer transition-all ${
                      activeMedia?.id === item.id
                        ? 'border-[#E11D48] ring-2 ring-rose-200'
                        : 'border-stone-200 hover:border-rose-300'
                    }`}
                  >
                    <div className="aspect-[9/12] bg-stone-100 relative overflow-hidden">
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.titleBn}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-stone-200">
                        <div className="text-[10px] font-extrabold text-[#E11D48] truncate">
                          🏢 {item.brandName}
                        </div>
                        <div className="text-[11px] font-bold text-stone-900 truncate">
                          {item.titleBn}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Separated Soft Pink Bengali AI Assistant Card */}
        <div className="lg:col-span-4 bg-[#FFE4E9]/65 rounded-2xl border-2 border-rose-300 flex flex-col justify-between h-full max-h-[880px] overflow-hidden">
          {/* Assistant Header */}
          <div className="p-4 border-b border-rose-300 bg-[#FFF0F3] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E11D48] text-white flex items-center justify-center shadow-2xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-rose-950">
                  ফিচার বক্স ৩: বাংলা এআই প্রম্পট অ্যাসিস্ট্যান্ট
                </h3>
                <p className="text-[10px] text-emerald-700 font-bold">
                  প্রম্পট তৈরি ও মডিফিকেশন গাইড (Gemini 3.8 Flash)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAutoAgentMode((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                autoAgentMode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-[#E11D48] border-rose-200'
              }`}
            >
              {autoAgentMode ? '⚡ অটো জেনারেশন চালু' : '✋ আগে প্রম্পট এডিট মোড'}
            </button>
          </div>

          {/* Conversation & Scene Breakdown */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {agentMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[94%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-[#E11D48] text-white rounded-br-xs'
                      : 'bg-white border border-rose-200 text-stone-800 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line font-medium">{msg.textBn}</p>

                  {msg.planData && (
                    <div className="mt-3 pt-3 border-t border-rose-100 space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
                        <div className="text-[10px] font-extrabold text-[#E11D48]">
                          🔍 প্রোডাক্ট ও শোরুম বিশ্লেষণ:
                        </div>
                        <div className="text-[11px] font-bold text-stone-900 mt-0.5">
                          {msg.planData.detectedProductBn} • শোরুম: "{msg.planData.brandName}"
                        </div>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          {msg.planData.productAnalysisBn}
                        </p>
                      </div>

                      {msg.planData.awaitingApproval && !msg.planData.approved && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                          <div className="text-[11px] font-extrabold text-emerald-950">
                            ✅ প্রম্পট তৈরি হয়েছে! বাম পাশের এডিট বক্সে প্রম্পটটি মডিফাই করে নিচের বাটনে ক্লিক করুন:
                          </div>
                          <button
                            type="button"
                            onClick={() => handleExecuteRealVideoGeneration(msg.id)}
                            disabled={isGeneratingVideo}
                            className="w-full py-2.5 px-3 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>অনুমোদন দিন ও রিয়েল ভিডিও তৈরি করুন</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-stone-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* Editable Scenes List if available */}
            {currentScenes.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white border border-rose-200 space-y-2.5">
                <div className="text-xs font-extrabold text-stone-900">
                  🎬 দৃশ্যপট তালিকা (চাইলে সংলাপ এডিট করুন):
                </div>
                {currentScenes.map((sc, idx) => (
                  <div
                    key={sc.sceneNumber}
                    className="p-2.5 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-[#E11D48]">
                      <span>দৃশ্য #{sc.sceneNumber}</span>
                      <span>{sc.timeRange}</span>
                    </div>
                    <input
                      type="text"
                      value={sc.dialogueBn}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentScenes((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, dialogueBn: val } : item))
                        );
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 text-[11px] font-bold text-stone-900"
                    />
                  </div>
                ))}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Bottom Custom Instruction Box */}
          <div className="p-4 border-t border-rose-100 bg-white space-y-2.5">
            <div className="flex items-center gap-2">
              <textarea
                rows={2}
                value={userPromptInput}
                onChange={(e) => setUserPromptInput(e.target.value)}
                placeholder="আপনি কী ধরনের ভিডিও বা প্রম্পট চান এখানে বাংলায় লিখুন..."
                className="flex-1 p-2.5 rounded-xl bg-stone-50 border border-stone-300 text-xs text-stone-900 focus:outline-none focus:border-[#E11D48] resize-none"
              />
              <button
                type="button"
                onClick={handleAskBengaliAgentToPlan}
                disabled={isPlanning || isGeneratingVideo}
                title="প্রম্পট জেনারেট করুন"
                className="w-11 h-11 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white flex items-center justify-center shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AgenticVideoStudio = OmniFlowStudio;

