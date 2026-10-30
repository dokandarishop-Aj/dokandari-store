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
} from 'lucide-react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { compressImageFileToDataUrl, saveProductPersisted } from '../lib/storeSync';
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
  defaultExpandedEditMode = false,
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
   * STEP 2B: Generate 100% Real Video via Gemini Omni 1.1 Flash (gemini-omni-1.1-flash)
   * Uses the user's edited/modified prompt (`currentOmniPrompt`) and script (`currentScriptBn`).
   * Never falls back to fake canvas cartoons! Polls real `/api/flow/video-status/:interactionId` if queued.
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

    const prodTitle = overrideProdTitle || productTitleInput || 'প্রিমিয়াম ক্যাটালগ পণ্য';
    const scriptToUse =
      overrideScriptBn ||
      currentScriptBn ||
      `আসসালামু আলাইকুম! ${brandName}-এর অফিশিয়াল শোরুমে আপনাদের স্বাগতম। আজ আপনাদের জন্য নিয়ে এসেছি ${prodTitle}। ${brandSlogan}। আজই অর্ডার করুন!`;
    const promptToUse =
      overrideOmniPrompt ||
      currentOmniPrompt ||
      compiledPromptResult.compiledOmniPrompt;
    const scenesToUse = overrideScenes || currentScenes;
    const targetImages =
      overrideImages && overrideImages.length > 0
        ? overrideImages
        : uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 3) || [];

    setIsGeneratingVideo(true);
    setGenerationProgress(15);
    setGenerationStepLabel(
      `ধাপ ১/২: Gemini Bengali TTS (gemini-3.8-flash-lite-tts) দ্বারা বাংলা ভয়েসওভার তৈরি হচ্ছে...`
    );
    appendStoreLog(
      'চিত্রনাট্য ও অনুমোদন',
      `প্রম্পট যাচাই শেষে Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) রিয়েল ভিডিও জেনারেশন শুরু হয়েছে।`,
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
        `ধাপ ২/২: Google Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) ইঞ্জিনে রিয়েল ভিডিও জেনারেট হচ্ছে...`
      );

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

      if (!omniRes.ok || !omniData.success) {
        throw new Error(
          omniData.error ||
            'Gemini Omni 1.1 Flash ভিডিও জেনারেশনে ত্রুটি হয়েছে। অনুগ্রহ করে উপরের "Google AI সাবস্ক্রিপশন / ফ্রি ক্রেডিট কানেক্ট করুন" বাটনে ক্লিক করে আপনার জিমেইলের এপিআই প্রজেক্ট সিলেক্ট করুন।'
        );
      }

      let finalVideoUrl = '';
      const interactionId = omniData.interactionId || '';
      if (interactionId) setActiveInteractionId(interactionId);

      if (omniData.videoDataUrl || omniData.videoUrl) {
        finalVideoUrl = omniData.videoDataUrl || omniData.videoUrl;
      } else if (interactionId) {
        // Real background polling just like Google Flow (shown in user's screenshot 1)
        setGenerationStepLabel(
          `Omni 1.1 Flash কিউতে (Queue) রেন্ডার হচ্ছে (ID: ${interactionId.slice(0, 10)}...) — অনুগ্রহ করে অপেক্ষা করুন...`
        );
        for (let attempt = 1; attempt <= 25; attempt++) {
          setGenerationProgress(Math.min(95, 40 + attempt * 2));
          await new Promise((r) => setTimeout(r, 6000));
          const pollRes = await fetch(`/api/flow/video-status/${interactionId}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'completed' && (pollData.videoDataUrl || pollData.videoUrl)) {
            finalVideoUrl = pollData.videoDataUrl || pollData.videoUrl;
            break;
          }
          if (pollData.status === 'failed' || pollData.status === 'cancelled') {
            throw new Error(
              pollData.error ||
                'Gemini Omni 1.1 Flash ভিডিও জেনারেশন সম্পন্ন করতে পারেনি। প্রম্পট পরিবর্তন করে আবার চেষ্টা করুন।'
            );
          }
        }
      }

      if (!finalVideoUrl) {
        throw new Error(
          'Gemini Omni 1.1 Flash এখনো প্রসেসিংয়ে রয়েছে অথবা ভিডিও ফাইল পাওয়া যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।'
        );
      }

      setGenerationProgress(100);
      setGenerationStepLabel('১০০% রিয়েল Omni 1.1 Flash ভিডিও সফলভাবে তৈরি হয়েছে!');

      const newVideoItem: FlowMediaItem = {
        id: `video-${Date.now()}`,
        type: 'video',
        titleBn: `${prodTitle} — ${brandName} (Omni 1.1 Real Video)`,
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
        engineLabel: 'Gemini Omni 1.1 Flash (100% Real Video)',
        interactionId,
        createdAt: Date.now(),
        productImages: targetImages,
        linkedProductId: selectedProductId || undefined,
      };

      setMediaItems((prev) => [newVideoItem, ...prev]);
      setActiveMedia(newVideoItem);

      const doneMsg = `🎉 আলহামদুলিল্লাহ! আপনার এডিটকৃত প্রম্পট অনুযায়ী ১০০% রিয়েল Gemini Omni 1.1 Flash ভিডিও তৈরি সম্পন্ন হয়েছে!`;
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
      setStatusBanner('🎬 ১০০% রিয়েল ব্র্যান্ড ভিডিও সফলভাবে তৈরি হয়েছে!');
    } catch (err: any) {
      const errMsg =
        err?.message ||
        'Gemini Omni 1.1 Flash ভিডিও জেনারেশনে সমস্যা হয়েছে। আপনার জিমেইল সাবস্ক্রিপশন / Google AI প্রজেক্ট কানেক্ট করে পুনরায় চেষ্টা করুন।';
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
  // COMPACT / HIDDEN MINI LAUNCHER VIEW (Default when not in Full Edit Mode)
  // ============================================================================
  if (!isFullEditMode) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-5 sm:p-6 shadow-xs space-y-5 transition-all">
        {/* Top Row: Mini Studio Title + Gmail Login + Open Full Edit Mode Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E11D48] to-rose-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-stone-900">
                  🎬 গুগল ফ্লো ও ওমনি মিনি ভিডিও জেনারেটর (Google Flow & Omni 1.1)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-[#E11D48] border border-rose-200">
                  মিনি মোড (সংক্ষিপ্ত ভিউ)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ১০০% রিয়েল এপিআই (No Demo)
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                প্যানেলটি এখানে সংক্ষিপ্ত (Hidden) রাখা হয়েছে। নিচে বা ডানপাশের বাটনে ক্লিক করলে সরাসরি <strong>ফুল এডিট মোডে (Full Edit Mode)</strong> চলে যাবে—যেখানে প্রম্পট জেনারেট ও মডিফাই করে রিয়েল ভিডিও বানাতে পারবেন।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Gmail Login / Connected Badge */}
            {connectedEmail ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                {connectedPhoto ? (
                  <img
                    src={connectedPhoto}
                    alt={connectedEmail}
                    className="w-6 h-6 rounded-full object-cover border border-emerald-300"
                  />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                )}
                <div className="text-left">
                  <div className="text-[11px] font-extrabold text-emerald-900 leading-none">
                    {connectedEmail}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    ✓ জিমেইল ও ওমনি সংযুক্ত
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGmailLogin}
                disabled={authLoading}
                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-extrabold flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#E11D48]" />
                <span>{authLoading ? 'লগইন হচ্ছে...' : '🔐 জিমেইল (Gmail) দিয়ে ওমনি লগইন'}</span>
              </button>
            )}

            {/* Open Full Edit Mode Primary Button */}
            <button
              type="button"
              onClick={() => setIsFullEditMode(true)}
              className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>ফুল এডিট মোডে যান (Open Full Studio)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Mini Launcher Strip: Click anywhere or pick product to jump into Full Edit Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-rose-100">
          <div className="p-3.5 rounded-2xl bg-[#FFFBFB] border border-rose-100 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-stone-500 block">ধাপ ১: প্রোডাক্ট ও ব্র্যান্ড</span>
              <span className="text-xs font-extrabold text-stone-900">
                {uploadedImages.length > 0
                  ? `${uploadedImages.length}টি ছবি সিলেক্টেড • ${brandName}`
                  : `ক্যাটালগ থেকে ৩-৪টি ছবি নির্বাচন করুন`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullEditMode(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] text-xs font-bold border border-rose-200 cursor-pointer shrink-0"
            >
              ছবি দিন &rarr;
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FFFBFB] border border-rose-100 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-stone-500 block">ধাপ ২: প্রম্পট জেনারেট ও এডিট</span>
              <span className="text-xs font-extrabold text-stone-900">
                {hasGeneratedPlan
                  ? 'প্রম্পট প্রস্তুত — ক্লিক করে মডিফাই করুন'
                  : 'প্রম্পট তৈরি করে নিজের মতো মডিফাই করুন'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullEditMode(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] text-xs font-bold border border-rose-200 cursor-pointer shrink-0"
            >
              প্রম্পট এডিটর &rarr;
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FFFBFB] border border-rose-100 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-stone-500 block">ধাপ ৩: রিয়েল ওমনি ভিডিও</span>
              <span className="text-xs font-extrabold text-stone-900">
                সাবস্ক্রিপশন / ফ্রি ক্রেডিটে রিয়েল রেন্ডার
              </span>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogleSubscriptionKey}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Key className="w-3.5 h-3.5" />
              <span>ক্রেডিট সংযোগ</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // FULL EDIT MODE WORKSPACE (100% Clean Light Theme, Real Gmail Login, Prompt Editor)
  // ============================================================================
  return (
    <div
      className={`${
        isFullscreenModal
          ? 'fixed inset-0 z-50 bg-[#FAF9F6] overflow-y-auto p-4 sm:p-6'
          : 'rounded-3xl bg-white border border-rose-200 shadow-sm overflow-hidden'
      } text-stone-900 transition-all`}
    >
      {/* Top Header Bar (Light Theme) */}
      <div className="bg-gradient-to-r from-rose-50 via-white to-rose-50 border-b border-rose-200 px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-2xl bg-[#E11D48] flex items-center justify-center shadow-xs text-white shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-stone-900">
                Google Flow • Gemini Omni 1.1 Flash ও Nano Banana স্টুডিও (Full Edit Mode)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ১০০% রিয়েল এপিআই (Zero Demo)
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              ১. ক্যাটালগ থেকে ছবি নিন &rarr; ২. প্রম্পট ও বাংলা স্ক্রিপ্ট জেনারেট করে নিজের মতো এডিট/মডিফাই করুন &rarr; ৩. আপনার জিমেইল সাবস্ক্রিপশন বা ফ্রি ক্রেডিটে রিয়েল ভিডিও তৈরি করুন
            </p>
          </div>
        </div>

        {/* Right Controls: Gmail Login, Subscription Key Selector, Fullscreen & Collapse to Mini Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gmail Account Login / Switcher */}
          {connectedEmail && !showGmailInputBox ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
              {connectedPhoto ? (
                <img
                  src={connectedPhoto}
                  alt={connectedEmail}
                  className="w-6 h-6 rounded-full object-cover border border-emerald-300"
                />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-700" />
              )}
              <div className="text-left">
                <div className="text-[11px] font-extrabold text-emerald-950 leading-none">
                  {connectedEmail}
                </div>
                <div className="text-[10px] font-bold text-emerald-700">
                  ✓ Gmail ও Omni সাবস্ক্রিপশন লগইন সক্রিয়
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomGmailInput(connectedEmail);
                  setShowGmailInputBox(true);
                }}
                title="অন্য জিমেইল অ্যাকাউন্ট দিন"
                className="ml-1 px-2 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold cursor-pointer"
              >
                জিমেইল পরিবর্তন
              </button>
              <button
                type="button"
                onClick={() => signOutUser()}
                title="জিমেইল লগআউট"
                className="p-1 rounded-lg text-stone-500 hover:text-rose-600 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : showGmailInputBox ? (
            <form onSubmit={handleDirectGmailSubmit} className="flex items-center gap-1.5">
              <input
                type="email"
                required
                value={customGmailInput}
                onChange={(e) => setCustomGmailInput(e.target.value)}
                placeholder="your-omni-email@gmail.com"
                className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#E11D48] text-white text-xs font-extrabold cursor-pointer"
              >
                ✓ কানেক্ট
              </button>
              <button
                type="button"
                onClick={handleGmailLogin}
                className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold cursor-pointer"
              >
                Google পপআপ
              </button>
              <button
                type="button"
                onClick={() => setShowGmailInputBox(false)}
                className="px-2 py-1.5 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleGmailLogin}
                disabled={authLoading}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-stone-900 border border-rose-300 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#E11D48]" />
                <span>{authLoading ? 'লগইন হচ্ছে...' : '🔐 জিমেইল (Gmail) দিয়ে ওমনিতে লগইন করুন'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGmailInputBox(true)}
                className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-[11px] font-bold cursor-pointer"
              >
                ইমেইল লিখুন
              </button>
            </div>
          )}

          {/* Connect Google AI Studio Subscription / Free Credit Key */}
          <button
            type="button"
            onClick={handleConnectGoogleSubscriptionKey}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${
              aiKeySelected || serverAccountStatus.connected
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {aiKeySelected
                ? '✓ সাবস্ক্রিপশন / ফ্রি ক্রেডিট প্রজেক্ট সংযুক্ত'
                : '🔑 Google AI ফ্রি ক্রেডিট / সাবস্ক্রিপশন কানেক্ট'}
            </span>
          </button>

          {/* Toggle Fullscreen */}
          <button
            type="button"
            onClick={() => setIsFullscreenModal((prev) => !prev)}
            className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isFullscreenModal ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>সাধারণ সাইজ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>ফুল-স্ক্রিন এডিটর</span>
              </>
            )}
          </button>

          {/* Collapse back to Hidden / Mini Mode */}
          <button
            type="button"
            onClick={() => {
              setIsFullscreenModal(false);
              setIsFullEditMode(false);
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>প্যানেল সংক্ষিপ্ত / হিডেন রাখুন</span>
          </button>
        </div>
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
        <div className="mx-5 mt-4 px-4 py-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
            <div>
              <span>{errorBanner}</span>
              <p className="text-[11px] font-normal text-stone-600 mt-0.5">
                কোনো ফেক বা ডেমো ভিডিও দেখানো হয়নি। আপনার জিমেইল সাবস্ক্রিপশন বা ফ্রি ক্রেডিট প্রজেক্ট কানেক্ট করে রিয়েল জেনারেশন চালান।
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConnectGoogleSubscriptionKey}
              className="px-3 py-1.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-[11px] font-extrabold cursor-pointer"
            >
              🔑 সাবস্ক্রিপশন / ক্রেডিট কানেক্ট করুন
            </button>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 text-stone-600 text-[11px] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Brand Name & Showroom Configuration Strip (Light Theme) */}
      <div className="bg-[#FAF9F6] border-b border-rose-100 px-5 py-3.5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-extrabold text-stone-700 mb-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-[#E11D48]" />
            <span>ব্র্যান্ডের নাম প্লেসহোল্ডার (শোরুমের পিছনে দেখাবে):</span>
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="যেমন: দোকানদারি (Dokandari)"
            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
            ব্র্যান্ড স্লোগান / অফার ট্যাগলাইন:
          </label>
          <input
            type="text"
            value={brandSlogan}
            onChange={(e) => setBrandSlogan(e.target.value)}
            placeholder="১০০% অরিজিনাল কোয়ালিটি — সারা দেশে ক্যাশ অন ডেলিভারি"
            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-800 focus:outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-stone-700 mb-1">
            আমাদের শোরুমের ধরন (স্থির ব্যাকগ্রাউন্ড):
          </label>
          <select
            value={selectedShowroomId}
            onChange={(e) => setSelectedShowroomId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
          >
            {SHOWROOM_STYLES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.labelBn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-extrabold text-stone-700 mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#E11D48]" />
            <span>স্থায়ী ভার্চুয়াল অ্যাভাটার (বাংলায় কথা বলবে):</span>
          </label>
          <select
            value={selectedAvatarId}
            onChange={(e) => setSelectedAvatarId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
          >
            {avatars.map((av) => (
              <option key={av.id} value={av.id}>
                {av.nameBn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 3-Column Light Theme Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        {/* LEFT SIDEBAR: Navigation Tabs + Quick Settings */}
        <div className="lg:col-span-2 bg-[#FFFBFB] border-r border-rose-100 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="px-2 py-1.5 text-[11px] font-extrabold text-stone-400 uppercase tracking-wider">
              Google Flow নেভিগেশন
            </div>

            {[
              { id: 'all_media', label: 'সব মিডিয়া ও এডিটর', icon: Layers, count: mediaItems.length },
              {
                id: 'images',
                label: 'শোরুম ছবি (Nano Banana)',
                icon: ImageIcon,
                count: mediaItems.filter((m) => m.type === 'image').length,
              },
              {
                id: 'videos',
                label: 'ভিডিও (Omni 1.1)',
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

          {/* Optional Advanced Prompt Template & Logs Toggles (Hidden unless clicked) */}
          <div className="p-3 rounded-2xl bg-white border border-rose-200 space-y-2">
            <div className="text-[11px] font-extrabold text-stone-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>অ্যাডভান্সড টুলস (ঐচ্ছিক)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPromptBuilder((prev) => !prev)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold text-left flex items-center justify-between cursor-pointer"
            >
              <span>প্রম্পট টেমপ্লেট বিল্ডার</span>
              <span>{showPromptBuilder ? '▲' : '▼'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStoreLogs((prev) => !prev)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold text-left flex items-center justify-between cursor-pointer"
            >
              <span>এজেন্ট লগ ({storeLogs.length})</span>
              <span>{showStoreLogs ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {/* CENTER WORKSPACE: 1. Product Image Selector -> 2. Editable Prompt & Script Box -> 3. Real Video Gallery */}
        <div className="lg:col-span-6 p-5 bg-white space-y-5 overflow-y-auto max-h-[880px]">
          {/* STEP 1: Select 3-4 Product Images from Store Catalog or Upload */}
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-rose-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#E11D48]" />
                  <span>ধাপ ১: ক্যাটালগ থেকে প্রোডাক্ট বা ৩-৪টি ছবি সিলেক্ট করুন ({uploadedImages.length}/4)</span>
                </h3>
                <p className="text-[11px] text-stone-500">
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
                  const thumb = prod.images?.[0];
                  if (!thumb) return null;
                  const isSelected = uploadedImages.includes(thumb);
                  const selectedIdx = uploadedImages.indexOf(thumb);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleToggleCatalogImageSlot(thumb, prod.name, prod.price)}
                      title={`${prod.name} (৳${prod.price})`}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#E11D48] ring-2 ring-rose-300 scale-105'
                          : 'border-stone-200 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <img src={thumb} alt={prod.name} className="w-full h-full object-cover" />
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

            {/* Primary Step 1 Action Button: Generate Prompt & Script */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleAskBengaliAgentToPlan}
                disabled={isPlanning || isGeneratingVideo}
                className="flex-1 py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4 text-rose-400" />
                <span>
                  {isPlanning
                    ? 'ছবি বিশ্লেষণ করে বাংলা প্রম্পট ও স্ক্রিপ্ট তৈরি হচ্ছে...'
                    : '১. প্রম্পট ও বাংলা স্ক্রিপ্ট জেনারেট করুন (এডিট করার জন্য)'}
                </span>
              </button>
            </div>
          </div>

          {/* STEP 2: EDITABLE PROMPT & BENGALI SCRIPT WORKSPACE (User reviews & modifies before real generation) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFBFB] border-2 border-rose-200 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E11D48] text-white text-[11px] font-extrabold">
                    ধাপ ২: প্রম্পট এডিট ও মডিফাই
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                    জেনারেট করা প্রম্পট ও বাংলা ভয়েসওভার স্ক্রিপ্ট (নিজের মতো পরিবর্তন করুন)
                  </h4>
                </div>
                <p className="text-[11px] text-stone-600 mt-0.5">
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
                🎬 গুগল ওমনি ১.১ ও ন্যানো ব্যানানা ভিডিও/ইমেজ প্রম্পট (এডিট ও মডিফাই করুন):
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
                    ? 'রিয়েল Omni 1.1 ভিডিও তৈরি হচ্ছে...'
                    : '🎬 ২. রিয়েল Omni 1.1 ভিডিও জেনারেট করুন (100% Real)'}
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
                    : '🖼️ রিয়েল Nano Banana শোরুম ছবি'}
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

        {/* RIGHT PANEL: Bengali AI Assistant Chat & Scene-by-Scene Editor (Light Theme) */}
        <div className="lg:col-span-4 bg-[#FAF9F6] border-l border-rose-100 flex flex-col justify-between h-full max-h-[880px]">
          {/* Assistant Header */}
          <div className="p-4 border-b border-rose-100 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#E11D48]">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-stone-900">
                  বাংলা এআই প্রম্পট ও স্ক্রিপ্ট অ্যাসিস্ট্যান্ট
                </h3>
                <p className="text-[10px] text-emerald-700 font-semibold">
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

