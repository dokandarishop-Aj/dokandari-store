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
  Maximize2,
  Minimize2,
  AlertCircle,
  EyeOff,
  ChevronRight,
  Sliders,
  Copy,
  ExternalLink,
  Film,
  Users,
  PackageOpen,
  SplitSquareVertical,
  Camera,
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
  HumanVideoFormatId,
  HumanModelGender,
  HUMAN_VIDEO_FORMATS,
  PRODUCT_IMAGE_SLOT_META,
  DEFAULT_SHOWROOM_PROMPT_TEMPLATE,
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
  gender: HumanModelGender;
  descPrompt: string;
  voiceId: string;
  avatarImage: string;
  attireColor: string;
  badgeBn?: string;
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
  videoFormat?: HumanVideoFormatId;
  modelGender?: HumanModelGender;
  avatarNameBn?: string;
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
    videoFormat?: HumanVideoFormatId;
    modelGender?: HumanModelGender;
    awaitingApproval?: boolean;
    approved?: boolean;
  };
}

export interface GoogleFlowProductionForm {
  id: string;
  videoFormat: HumanVideoFormatId;
  videoFormatLabelBn: string;
  modelGender: HumanModelGender;
  modelNameBn: string;
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

/**
 * Official Dokandari Realistic Bangladeshi / South Asian Male & Female Brand Avatars & UGC Models
 */
const DEFAULT_AVATARS: VirtualAvatar[] = [
  {
    id: 'avatar-bd-female-nusrat',
    nameBn: 'নুসরাত জাহান (বাংলাদেশি ইউজিএসি ও স্কিনকেয়ার মডেল)',
    roleBn: 'ইউজিএসি প্রোডাক্ট রিভিউ, বিউটি ও আফটার-বিফোর ক্রিয়েটর (নারী)',
    gender: 'female',
    badgeBn: 'দোকানদারি অফিশিয়াল নারী অবতার',
    descPrompt:
      'Authentic young Bangladeshi South Asian woman in her mid-20s with warm natural glowing skin, wearing an elegant rose-pink modest salwar kameez and soft dupatta in a cozy Dhaka apartment room, speaking naturally to smartphone front camera',
    voiceId: 'Kore',
    avatarImage:
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=85',
    attireColor: '#E11D48',
  },
  {
    id: 'avatar-bd-male-rafi',
    nameBn: 'রাফি আহমেদ (দোকানদারি অফিশিয়াল পুরুষ ব্র্যান্ড অবতার)',
    roleBn: 'আনবক্সিং, ওপেন পার্সেল রিভিউ ও গ্যাজেট/লাইফস্টাইল মডেল (পুরুষ)',
    gender: 'male',
    badgeBn: 'দোকানদারি অফিশিয়াল পুরুষ অবতার',
    descPrompt:
      'Charismatic young Bangladeshi South Asian man in his late-20s with neatly groomed beard and natural skin texture, wearing a smart olive-green polo shirt in a modern Dhaka home living room, speaking enthusiastically to camera while holding product',
    voiceId: 'Puck',
    avatarImage:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=85',
    attireColor: '#2563EB',
  },
  {
    id: 'avatar-bd-female-tasnim',
    nameBn: 'তাসনিম মেহজাবিন (মডেস্ট ফ্যাশন ও হোম ডেকোর অবতার)',
    roleBn: 'হিজাব, আবায়া, লাক্সারি মিরর ও হোম ডেকোর রিভিউয়ার (নারী)',
    gender: 'female',
    badgeBn: 'মডেস্ট ও ডেকোর স্পেশালিস্ট',
    descPrompt:
      'Graceful Bangladeshi South Asian female model in her mid-20s wearing modest maroon embroidered ethnic attire, standing in a sunlit contemporary Dhaka living room, expressive hand gestures and warm smile',
    voiceId: 'Zephyr',
    avatarImage:
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=900&q=85',
    attireColor: '#BE123C',
  },
  {
    id: 'avatar-bd-male-tanvir',
    nameBn: 'তানভীর হাসান (বাংলাদেশি ইউজিএসি ও আনবক্সিং ক্রিয়েটর)',
    roleBn: 'রিয়েল কাস্টমার আনবক্সিং, আফটার-বিফোর ও কোয়ালিটি টেস্টার (পুরুষ)',
    gender: 'male',
    badgeBn: 'ইউজিএসি ও আনবক্সিং মডেল',
    descPrompt:
      'Trustworthy young Bangladeshi South Asian man in his late-20s wearing a crisp casual shirt in a bright Dhaka home studio, opening parcel box and reviewing authentic product on camera',
    voiceId: 'Fenrir',
    avatarImage:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=85',
    attireColor: '#059669',
  },
  {
    id: 'avatar-bd-female-sadia',
    nameBn: 'সাদিয়া ইসলাম (আফটার-বিফোর ও আনবক্সিং মডেল)',
    roleBn: 'হারবাল সোপ, সিরাম ও আফটার-বিফোর স্কিন ট্রান্সফরমেশন (নারী)',
    gender: 'female',
    badgeBn: 'আফটার-বিফোর স্পেশালিস্ট',
    descPrompt:
      'Radiant Bangladeshi South Asian young woman in soft emerald kurti with clear glowing skin in a natural bedroom setting, demonstrating skincare before-and-after results on camera',
    voiceId: 'Kore',
    avatarImage:
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=900&q=85',
    attireColor: '#059669',
  },
  {
    id: 'avatar-bd-male-farhan',
    nameBn: 'ফারহান সাদিক (মেনজ কেয়ার ও আফটার-বিফোর মডেল)',
    roleBn: 'মেনজ গ্রুমিং, স্কিনকেয়ার ও লাইফস্টাইল রিভিউয়ার (পুরুষ)',
    gender: 'male',
    badgeBn: 'আফটার-বিফোর পুরুষ মডেল',
    descPrompt:
      'Authentic Bangladeshi South Asian young man in his mid-20s with clear skin, wearing a smart navy panjabi/shirt in a natural Dhaka home room, showing before and after product results on camera',
    voiceId: 'Puck',
    avatarImage:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85',
    attireColor: '#7C3AED',
  },
];

const SHOWROOM_STYLES = [
  {
    id: 'natural_home_ugc',
    labelBn: '🏠 ন্যাচারাল বাংলাদেশি হোম ও বেডরুম (রিয়েল ইউজিএসি পরিবেশ)',
    promptEn:
      'Cozy, authentic modern Dhaka apartment bedroom and living space with warm natural window daylight, indoor plants, and soft depth of field',
  },
  {
    id: 'unboxing_desk_studio',
    labelBn: '📦 লাইভ আনবক্সিং টেবিল ও হোম স্টুডিও (ওপেন পার্সেল ভিউ)',
    promptEn:
      'Clean wooden desk in a bright Bangladeshi home room set up for a real customer parcel unboxing and close-up product inspection',
  },
  {
    id: 'before_after_vanity',
    labelBn: '✨ বিফোর-আফটার মিরর ও স্কিনকেয়ার ভ্যানিটি রুম',
    promptEn:
      'Well-lit natural vanity mirror and skincare room with soft daylight ideal for authentic Before and After transformation comparisons',
  },
  {
    id: 'dokandari_flagship_studio',
    labelBn: '🏢 দোকানদারি অফিশিয়াল ব্র্যান্ড স্টুডিও (অবতার প্রেজেন্টেশন)',
    promptEn:
      'Modern lifestyle studio in Dhaka with warm ambient lighting, subtle Dokandari brand accents, and shallow depth of field',
  },
];

// Bumped storage keys to v8 so any previous canvas-composited demo videos are purged immediately
const LEGACY_KEYS_TO_PURGE = [
  'dokandari_omni_flow_media_v1',
  'dokandari_omni_flow_real_media_v3',
  'dokandari_omni_flow_avatars_v1',
  'dokandari_omni_flow_human_videos_v6',
  'dokandari_omni_flow_human_videos_v7',
];
const STORAGE_KEY_MEDIA = 'dokandari_google_flow_real_veo_v8';
const STORAGE_KEY_AVATARS = 'dokandari_omni_flow_bd_avatars_v6';

export const OmniFlowStudio: React.FC<OmniFlowStudioProps> = ({
  products,
  onAttachVideoToProduct,
  defaultBrandName = 'দোকানদারি (Dokandari)',
  defaultExpandedEditMode = true,
}) => {
  const { firebaseUser, userProfile, signInWithGoogle, signInWithGmailDirect } = useAuth();
  const connectedEmail = firebaseUser?.email || userProfile?.email || '';

  const [isFullEditMode, setIsFullEditMode] = useState<boolean>(defaultExpandedEditMode);
  const [isFullscreenModal, setIsFullscreenModal] = useState<boolean>(false);
  const [requiresPaidKeyPrompt, setRequiresPaidKeyPrompt] = useState<boolean>(false);
  const [product3dAnalysisSummary, setProduct3dAnalysisSummary] = useState<string>('');
  const syncAudioRef = useRef<HTMLAudioElement | null>(null);

  const [leftTab, setLeftTab] = useState<
    'all_media' | 'videos' | 'images' | 'characters' | 'scenes' | 'uploaded'
  >('all_media');

  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [customGmailInput] = useState<string>(connectedEmail || 'dokandari.shop@gmail.com');
  const [autoAgentMode, setAutoAgentMode] = useState<boolean>(false);

  // Brand Name & Environment
  const [brandName, setBrandName] = useState<string>(defaultBrandName || 'দোকানদারি (Dokandari)');
  const [brandSlogan, setBrandSlogan] = useState<string>(
    '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি'
  );
  const [selectedShowroomId, setSelectedShowroomId] = useState<string>('natural_home_ugc');

  // Realistic Human Video Format & Model Gender Filter
  const [selectedVideoFormat, setSelectedVideoFormat] = useState<HumanVideoFormatId>('ugc_review');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<'all' | HumanModelGender>('all');

  // Virtual Avatars State (Bangladeshi Male & Female Models)
  const [avatars, setAvatars] = useState<VirtualAvatar[]>(() => {
    try {
      for (const k of LEGACY_KEYS_TO_PURGE) localStorage.removeItem(k);
      const saved = localStorage.getItem(STORAGE_KEY_AVATARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.gender) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_AVATARS;
  });
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(DEFAULT_AVATARS[0].id);

  // New Custom Dokandari Brand Avatar Creator Form State
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarGender, setNewAvatarGender] = useState<HumanModelGender>('female');
  const [newAvatarAttire, setNewAvatarAttire] = useState('মার্জিত সালোয়ার কামিজ ও ন্যাচারাল লুক');
  const [newAvatarRole, setNewAvatarRole] = useState('');
  const [newAvatarPrompt, setNewAvatarPrompt] = useState('');
  const [creatingAvatar, setCreatingAvatar] = useState(false);
  const [showQuickAvatarCreator, setShowQuickAvatarCreator] = useState(false);

  // Uploaded / Selected Product Images (1 to 4 images)
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productTitleInput, setProductTitleInput] = useState<string>('');
  const [productPriceInput, setProductPriceInput] = useState<string>('৬৯৯');

  // Video Config
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [duration, setDuration] = useState<'5s' | '10s'>('10s');
  const [userPromptInput, setUserPromptInput] = useState<string>('');

  // Editable Plan, Prompt & Script State
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState<boolean>(false);
  const [currentScriptBn, setCurrentScriptBn] = useState<string>('');
  const [currentOmniPrompt, setCurrentOmniPrompt] = useState<string>('');
  const [currentScenes, setCurrentScenes] = useState<FlowScene[]>([]);

  // Autonomous Google Flow Production Form Generator State
  const [activeFlowForm, setActiveFlowForm] = useState<GoogleFlowProductionForm | null>(null);
  const [isBuildingForm, setIsBuildingForm] = useState<boolean>(false);
  const [copiedFormNotice, setCopiedFormNotice] = useState<string>('');
  const [googleFlowProjectUrl, setGoogleFlowProjectUrl] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('dokandari_google_flow_project_url') ||
        'https://labs.google/fx/tools/flow'
      );
    } catch {
      return 'https://labs.google/fx/tools/flow';
    }
  });

  const handleSaveGoogleFlowProjectUrl = (nextUrl: string) => {
    setGoogleFlowProjectUrl(nextUrl);
    try {
      localStorage.setItem('dokandari_google_flow_project_url', nextUrl.trim() || 'https://labs.google/fx/tools/flow');
    } catch {
      // ignore
    }
  };

  const [languageMode] = useState<AssistantLanguageMode>('bn_strict');
  const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_SHOWROOM_PROMPT_TEMPLATE);
  const [showPromptBuilder, setShowPromptBuilder] = useState<boolean>(false);
  const [showStoreLogs, setShowStoreLogs] = useState<boolean>(false);

  const [storeLogs, setStoreLogs] = useState<StoreAgentLogEntry[]>(() => [
    createStoreAgentLogEntry(
      'সিস্টেম নির্দেশিকা',
      `দোকানদারি রিয়েলিস্টিক বাংলাদেশি হিউম্যান ভিডিও স্টুডিও সক্রিয় (ক্যাটালগ জুম বন্ধ • ১০০% হিউম্যান মডেল)।`,
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

  // Generation Pipeline Status
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [isGeneratingFrame, setIsGeneratingFrame] = useState<boolean>(false);
  const [isGeneratingAudio] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStepLabel, setGenerationStepLabel] = useState<string>('');
  const [activeInteractionId, setActiveInteractionId] = useState<string>('');
  const [activeMedia, setActiveMedia] = useState<FlowMediaItem | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');

  // Real Generated Human Media Library (Purges old catalog zoom items on boot)
  const [mediaItems, setMediaItems] = useState<FlowMediaItem[]>(() => {
    try {
      for (const k of LEGACY_KEYS_TO_PURGE) localStorage.removeItem(k);
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

  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'agent',
      textBn:
        'আসসালামু আলাইকুম! দোকানদারি রিয়েলিস্টিক বাংলাদেশি হিউম্যান ভিডিও স্টুডিওতে স্বাগতম। এখানে কোনো ক্যাটালগ বা ছবির জুম-ইন/জুম-আউট স্লাইডশো হবে না! আপনি ১) বাংলাদেশি নারী বা পুরুষ মডেল (অবতার) সিলেক্ট করুন, ২) ভিডিওর ধরন (UGC রিভিউ / আফটার-বিফোর / আনবক্সিং / ব্র্যান্ড অবতার) বেছে নিন, এবং ৩) প্রোডাক্ট সিলেক্ট করে "⚡ হিউম্যান ভিডিও ফর্ম তৈরি করুন" বা "🎬 রিয়েল হিউম্যান ভিডিও জেনারেট করুন" বাটনে ক্লিক করুন।',
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
  const selectedFormatMeta =
    HUMAN_VIDEO_FORMATS.find((f) => f.id === selectedVideoFormat) || HUMAN_VIDEO_FORMATS[0];

  const filteredAvatars = avatars.filter((av) =>
    selectedGenderFilter === 'all' ? true : av.gender === selectedGenderFilter
  );

  // When user switches gender filter (Male / Female), auto-select the first matching avatar
  const handleSelectModelGender = (gender: 'all' | HumanModelGender) => {
    setSelectedGenderFilter(gender);
    if (gender !== 'all') {
      const match = avatars.find((a) => a.gender === gender);
      if (match) {
        setSelectedAvatarId(match.id);
      }
    }
  };

  useEffect(() => {
    try {
      const compactItems = mediaItems.slice(0, 6).map((item) => ({
        ...item,
        url: item.url.length > 2_000_000 ? item.thumbnailUrl : item.url,
      }));
      localStorage.setItem(STORAGE_KEY_MEDIA, JSON.stringify(compactItems));
    } catch {
      // ignore quota errors
    }
  }, [mediaItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AVATARS, JSON.stringify(avatars));
    } catch {
      // ignore
    }
  }, [avatars]);

  const compiledPromptResult = buildBrandConsistentPrompt({
    template: promptTemplate,
    brandName,
    brandSlogan,
    showroomStylePrompt: selectedShowroom.promptEn,
    showroomLabelBn: selectedShowroom.labelBn,
    avatarNameBn: selectedAvatar.nameBn,
    avatarPersonaPrompt: selectedAvatar.descPrompt,
    productTitle: productTitleInput || `${brandName} অরিজিনাল প্রোডাক্ট`,
    productPrice: productPriceInput || '৬৯৯',
    imageCount: Math.max(1, uploadedImages.length || 1),
    aspectRatio,
    duration,
    videoFormat: selectedVideoFormat,
    modelGender: selectedAvatar.gender,
  });

  // Select a product from the catalog, load up to 4 images, and automatically analyze its 3D image to build the Google Flow prompt
  const handleSelectCatalogProduct = async (prodId: string) => {
    setSelectedProductId(prodId);
    const found = products.find((p) => p.id === prodId);
    if (found) {
      const imgs = (found.images && found.images.length > 0 ? found.images : [])
        .filter(Boolean)
        .map((raw, i) => resolveSafeProductImageUrl(raw, found, i));
      setUploadedImages(imgs.slice(0, 4));
      setProductTitleInput(found.name);
      setProductPriceInput(String(found.price));
      const msgBn = `📦 "${found.name}" (মূল্য: ৳${found.price}) সিলেক্ট হয়েছে—এআই এখন এই প্রোডাক্টের আসল ছবি বিশ্লেষণ করে রিয়েল হিউম্যান ইউজিএসি প্রম্পট তৈরি করছে...`;
      setStatusBanner(msgBn);
      appendStoreLog('ক্যাটালগ চিত্র বিশ্লেষণ', msgBn, 'success');
      await handleBuildAutonomousFlowForm(
        selectedVideoFormat,
        selectedAvatar,
        imgs.slice(0, 4),
        found.name,
        String(found.price)
      );
    }
  };

  const handleToggleCatalogImageSlot = async (imgUrl: string, prodName?: string, prodPrice?: number) => {
    let nextImages: string[] = [];
    setUploadedImages((prev) => {
      if (prev.includes(imgUrl)) {
        nextImages = prev.filter((u) => u !== imgUrl);
      } else if (prev.length >= 4) {
        nextImages = [...prev.slice(1), imgUrl];
      } else {
        nextImages = [...prev, imgUrl];
      }
      return nextImages;
    });
    const nextTitle = prodName || productTitleInput;
    const nextPrice = prodPrice ? String(prodPrice) : productPriceInput;
    if (prodName) setProductTitleInput(prodName);
    if (prodPrice) setProductPriceInput(String(prodPrice));
    if (nextImages.length > 0) {
      await handleBuildAutonomousFlowForm(
        selectedVideoFormat,
        selectedAvatar,
        nextImages,
        nextTitle,
        nextPrice
      );
    }
  };

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
        // ignore
      }
    }

    if (compressedList.length > 0) {
      const nextImgs = [...uploadedImages, ...compressedList].slice(-4);
      setUploadedImages(nextImgs);
      setStatusBanner(`📸 ${compressedList.length}টি প্রোডাক্টের ছবি আপলোড হয়েছে! এআই ছবি বিশ্লেষণ করে প্রম্পট তৈরি করছে...`);
      await handleBuildAutonomousFlowForm(
        selectedVideoFormat,
        selectedAvatar,
        nextImgs,
        productTitleInput,
        productPriceInput
      );
    }
    e.target.value = '';
  };

  /**
   * Autonomous Realistic Human Video Form Generator (UGC Review / Before-After / Unboxing / Brand Avatar)
   */
  const handleBuildAutonomousFlowForm = async (
    overrideFormat?: HumanVideoFormatId,
    overrideAvatar?: VirtualAvatar,
    overrideImages?: string[],
    overrideProdTitle?: string,
    overrideProdPrice?: string
  ) => {
    setErrorBanner('');
    setIsBuildingForm(true);
    setCopiedFormNotice('');

    const fmt = overrideFormat || selectedVideoFormat;
    const fmtMeta = HUMAN_VIDEO_FORMATS.find((f) => f.id === fmt) || selectedFormatMeta;
    const av = overrideAvatar || selectedAvatar;

    const targetImages =
      overrideImages && overrideImages.length > 0
        ? overrideImages
        : uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 3) || [];

    const prodTitle =
      (overrideProdTitle ?? productTitleInput).trim() ||
      products[0]?.name ||
      'দোকানদারি অরিজিনাল প্রোডাক্ট';
    const prodPrice =
      (overrideProdPrice ?? productPriceInput).trim() ||
      (products[0]?.price ? String(products[0].price) : '৬৯৯');

    appendStoreLog(
      'চিত্রনাট্য ও অনুমোদন',
      `এজেন্ট "${prodTitle}"-এর জন্য বাংলাদেশি ${av.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল (${av.nameBn.split('(')[0].trim()}) দিয়ে "${fmtMeta.shortTagBn}" ফর্ম তৈরি করছে...`,
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
          avatarName: av.nameBn,
          avatarDesc: `${av.roleBn} (${av.descPrompt})`,
          productTitle: prodTitle,
          productPrice: prodPrice,
          aspectRatio,
          duration,
          videoFormat: fmt,
          modelGender: av.gender,
          userCommand: `আমাদের "${brandName}"-এর "${prodTitle}" পণ্যের জন্য কোনো ক্যাটালগ বা জুম ভিডিও নয়—একজন বাস্তব বাংলাদেশি ${av.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল (${av.nameBn}) হাতে প্রোডাক্ট নিয়ে "${fmtMeta.labelBn}" করছেন এমন একটি রিয়েলিস্টিক হিউম্যান ভিডিও প্রোডাকশন ফর্ম, ৪টি দৃশ্যপট, বাংলা ভয়েসওভার স্ক্রিপ্ট ও Google Flow / Omni প্রম্পট তৈরি করুন।`,
        }),
      });

      const data = await response.json();
      const detectedTitle = data.detectedProductBn || prodTitle;
      const visual3dSummary =
        data.product3dVisualSummary ||
        `Genuine 3D physical packaging and product "${detectedTitle}" with authentic brand label typography, texture, and proportions`;
      setProduct3dAnalysisSummary(visual3dSummary);

      const scriptBn =
        data.spokenScriptBn ||
        `আসসালামু আলাইকুম সবাইকে! আমি ${av.nameBn.split('(')[0].trim()}, আজ আপনাদের সামনে একদম হাতে নিয়ে দেখাচ্ছি ${brandName}-এর ১০০% অরিজিনাল ${detectedTitle}। এর কোয়ালিটি ও ফলাফল জাস্ট অসাধারণ! অফার মূল্য মাত্র ৳${prodPrice}। ডেলিভারি ম্যানের সামনে চেক করে সারা দেশে ক্যাশ অন ডেলিভারিতে আজই অর্ডার করুন!`;
      const flowPrompt =
        data.omniVideoPrompt ||
        `${fmtMeta.promptDirectiveEn} Featured model: ${av.descPrompt} inside ${selectedShowroom.promptEn}. The Bangladeshi ${av.gender} model is physically holding and demonstrating the exact 3D product "${detectedTitle}" (${visual3dSummary}, <IMAGE_REF_0>) in their real human hands with natural finger wrap, contact shadows, and realistic Bengali lip-sync. Photorealistic 8k cinema camera footage, zero 2D sticker overlay, zero static catalog zoom.`;

      const scenes: FlowScene[] =
        Array.isArray(data.scenes) && data.scenes.length > 0
          ? data.scenes
          : fmtMeta.sceneStructureBn.map((vis, idx) => ({
              sceneNumber: idx + 1,
              timeRange: `০০:০${idx * 2} - ০০:০${(idx + 1) * 2 + 1} সেকেন্ড`,
              visualBn: vis,
              dialogueBn:
                idx === 0
                  ? `আসসালামু আলাইকুম! আজ আপনাদের দেখাচ্ছি ${brandName}-এর অরিজিনাল ${detectedTitle}।`
                  : idx === 1
                  ? `হাতে নিলেই বুঝবেন এর ফিনিশিং ও ১০০% আসল কোয়ালিটি কতটা প্রিমিয়াম!`
                  : idx === 2
                  ? `ব্যবহারের পর এর বাস্তব ফলাফল দেখে আমি নিজেই মুগ্ধ হয়েছি।`
                  : `মাত্র ৳${prodPrice} টাকায় সারা দেশে ক্যাশ অন ডেলিভারিতে আজই অর্ডার করুন!`,
            }));

      const newForm: GoogleFlowProductionForm = {
        id: `flow-form-${Date.now()}`,
        videoFormat: fmt,
        videoFormatLabelBn: fmtMeta.labelBn,
        modelGender: av.gender,
        modelNameBn: av.nameBn,
        campaignGoalBn: `ফেসবুক ও টিকটকে রিয়েল বাংলাদেশি ${av.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেলের মাধ্যমে "${fmtMeta.shortTagBn}" ক্যাম্পেইন`,
        targetPlatform: aspectRatio === '9:16' ? 'reels_9_16' : 'banner_16_9',
        productTitleBn: detectedTitle,
        productPriceBn: `৳${prodPrice}`,
        productHighlightBn:
          data.productAnalysisBn ||
          `৩ডি প্রোডাক্ট বিশ্লেষণ সম্পন্ন • ১০০% রিয়েল হিউম্যান রিভিউ • হাতে ধরে আসল ৩ডি প্রোডাক্ট প্রদর্শন`,
        showroomStyleBn: `${selectedShowroom.labelBn} • মডেল: ${av.nameBn.split('(')[0].trim()}`,
        cameraMovementBn: fmtMeta.cameraStyleBn,
        spokenScriptBn: scriptBn,
        callToActionBn: `ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখে নিন — অর্ডার করতে এখনই Shop Now বাটনে ক্লিক করুন!`,
        executableFlowPrompt: flowPrompt,
        targetModel: 'veo_3',
        createdAt: Date.now(),
      };

      setActiveFlowForm(newForm);
      setCurrentScriptBn(scriptBn);
      setCurrentOmniPrompt(flowPrompt);
      setCurrentScenes(scenes);
      setHasGeneratedPlan(true);
      setStatusBanner(
        `✅ "${detectedTitle}" প্রোডাক্টের ৩ডি প্যাকেজিং ও টেক্সচার বিশ্লেষণ করে রিয়েল Google Flow প্রম্পট ও বাংলা স্ক্রিপ্ট প্রস্তুত হয়েছে!`
      );
      appendStoreLog(
        'চিত্রনাট্য ও অনুমোদন',
        `"${detectedTitle}"-এর ৩ডি প্রোডাক্ট অ্যানালাইসিস ও অরিজিনাল Google Flow প্রম্পট তৈরি সম্পন্ন।`,
        'success'
      );
    } catch {
      const fallbackScript = `আসসালামু আলাইকুম সবাইকে! আমি গত কয়েকদিন ধরে ${brandName} থেকে নেওয়া এই অরিজিনাল ${prodTitle} ব্যবহার করছি। হাতে নিলেই বুঝবেন এটি ১০০% অরিজিনাল। অফার মূল্য মাত্র ৳${prodPrice}—সারা দেশে ক্যাশ অন ডেলিভারিতে আজই অর্ডার করুন!`;
      const fallbackPrompt = `${fmtMeta.promptDirectiveEn} Featured model: ${av.descPrompt}. Physically holding the real 3D product "${prodTitle}" (<IMAGE_REF_0>) in hand, speaking naturally with lip-sync. Photorealistic Google Flow Veo 3.1 cinema footage, zero 2D cutout overlay.`;
      const fallbackScenes: FlowScene[] = fmtMeta.sceneStructureBn.map((vis, idx) => ({
        sceneNumber: idx + 1,
        timeRange: `০০:০${idx * 2} - ০০:০${(idx + 1) * 2 + 1} সেকেন্ড`,
        visualBn: vis,
        dialogueBn:
          idx === 0
            ? `আসসালামু আলাইকুম! আজ আপনাদের দেখাচ্ছি ${brandName}-এর অরিজিনাল ${prodTitle}।`
            : idx === 1
            ? `হাতে নিলেই বুঝবেন এর ফিনিশিং ও ১০০% আসল কোয়ালিটি কতটা চমৎকার!`
            : idx === 2
            ? `ব্যবহারের পর এর বাস্তব ফলাফল সত্যিই অসাধারণ।`
            : `মাত্র ৳${prodPrice} টাকায় ক্যাশ অন ডেলিভারিতে আজই অর্ডার করুন!`,
      }));

      setActiveFlowForm({
        id: `flow-form-${Date.now()}`,
        videoFormat: fmt,
        videoFormatLabelBn: fmtMeta.labelBn,
        modelGender: av.gender,
        modelNameBn: av.nameBn,
        campaignGoalBn: `রিয়েল বাংলাদেশি মডেলের মাধ্যমে "${fmtMeta.shortTagBn}" ভাইরাল ক্যাম্পেইন`,
        targetPlatform: aspectRatio === '9:16' ? 'reels_9_16' : 'banner_16_9',
        productTitleBn: prodTitle,
        productPriceBn: `৳${prodPrice}`,
        productHighlightBn: `১০০% রিয়েল হিউম্যান মডেল • আসল ৩ডি প্রোডাক্ট হাতে নিয়ে রিভিউ`,
        showroomStyleBn: `${selectedShowroom.labelBn} • মডেল: ${av.nameBn.split('(')[0].trim()}`,
        cameraMovementBn: fmtMeta.cameraStyleBn,
        spokenScriptBn: fallbackScript,
        callToActionBn: `সারা দেশে ক্যাশ অন ডেলিভারিতে পেতে এখনই অর্ডার করুন!`,
        executableFlowPrompt: fallbackPrompt,
        targetModel: 'veo_3',
        createdAt: Date.now(),
      });
      setCurrentScriptBn(fallbackScript);
      setCurrentOmniPrompt(fallbackPrompt);
      setCurrentScenes(fallbackScenes);
      setHasGeneratedPlan(true);
    } finally {
      setIsBuildingForm(false);
    }
  };

  const handleCopyFlowFormAndPrompt = () => {
    if (!activeFlowForm) return;
    const content = `📋 Dokandari Original Google Flow Human Video Form (${activeFlowForm.videoFormatLabelBn})
--------------------------------------------------
👤 বাংলাদেশি মডেল (অবতার): ${activeFlowForm.modelNameBn} (${activeFlowForm.modelGender === 'male' ? 'পুরুষ মডেল' : 'নারী মডেল'})
🎬 ভিডিওর ধরন: ${activeFlowForm.videoFormatLabelBn}
🎯 ক্যাম্পেইন গোল: ${activeFlowForm.campaignGoalBn}
📦 পণ্য ও মূল্য: ${activeFlowForm.productTitleBn} (${activeFlowForm.productPriceBn})
🔍 ৩ডি প্রোডাক্ট বিশ্লেষণ: ${product3dAnalysisSummary || activeFlowForm.productHighlightBn}
🎥 ক্যামেরা স্টাইল: ${activeFlowForm.cameraMovementBn}
🎙️ মডেলের বাংলা ভয়েসওভার স্ক্রিপ্ট: ${activeFlowForm.spokenScriptBn}
--------------------------------------------------
⚡ Google Flow / Veo 3.1 / Omni 1.1 Executable Prompt:
${activeFlowForm.executableFlowPrompt}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopiedFormNotice('✅ অরিজিনাল Google Flow হিউম্যান ভিডিও ফর্ম ও ৩ডি প্রম্পট কপি হয়েছে!');
      setTimeout(() => setCopiedFormNotice(''), 4500);
    }
  };

  const handleLaunchInGoogleFlowApp = () => {
    const promptToCopy =
      activeFlowForm?.executableFlowPrompt || currentOmniPrompt || compiledPromptResult.compiledOmniPrompt;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(promptToCopy);
    }
    const targetUrl = googleFlowProjectUrl.trim() || 'https://labs.google/fx/tools/flow';
    setCopiedFormNotice(
      '🚀 অরিজিনাল Google Flow হিউম্যান ভিডিও প্রম্পট ক্লিপবোর্ডে কপি হয়েছে এবং আপনার Google Flow প্রজেক্ট ট্যাবে খোলা হয়েছে! সেখানে প্রম্পটটি পেস্ট (Ctrl+V) করুন।'
    );
    setStatusBanner(
      '📋 প্রম্পট কপি সম্পন্ন! নতুন ট্যাবে খোলা Google Flow প্রজেক্টে প্রম্পটটি পেস্ট করুন এবং রেফারেন্স প্রোডাক্ট ছবিটি দিন।'
    );
    setTimeout(() => setCopiedFormNotice(''), 7000);
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadReferenceProductImage = () => {
    const refImg = uploadedImages[0] || products[0]?.images?.[0];
    if (!refImg) return;
    const a = document.createElement('a');
    a.href = refImg;
    a.download = `dokandari-reference-product-${Date.now()}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setCopiedFormNotice('📥 রেফারেন্স প্রোডাক্টের ছবি ডাউনলোড হয়েছে! এটি Google Flow প্রজেক্টে আপলোড করুন।');
    setTimeout(() => setCopiedFormNotice(''), 5000);
  };

  const handleConnectPaidKeyAndRetry = async () => {
    try {
      const aiStudio = (window as any).aistudio;
      if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
        await aiStudio.openSelectKey();
        setRequiresPaidKeyPrompt(false);
        setErrorBanner('');
        setStatusBanner(
          '✅ পেইড Google Flow / Veo 3.1 API Key সংযুক্ত হয়েছে! এখন অরিজিনাল হিউম্যান ভিডিও তৈরি হচ্ছে...'
        );
      }
    } catch {
      // ignore
    }
  };

  /**
   * STEP 1: Ask Bengali Director Agent to plan Realistic Bangladeshi Human Video
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

    if (!isFullEditMode) {
      setIsFullEditMode(true);
    }

    const userMsgText =
      userPromptInput.trim() ||
      `প্রোডাক্টের ৩ডি প্যাকেজিং ও ছবি বিশ্লেষণ করে আমাদের বাংলাদেশি ${selectedAvatar.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল "${selectedAvatar.nameBn}" আসল প্রোডাক্ট হাতে নিয়ে "${selectedFormatMeta.shortTagBn}" করছেন এমন অরিজিনাল Google Flow প্রম্পট ও বাংলা স্ক্রিপ্ট তৈরি করুন।`;

    const newUserMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      textBn: userMsgText,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };
    setAgentMessages((prev) => [...prev, newUserMsg]);
    setIsPlanning(true);

    try {
      await handleBuildAutonomousFlowForm(selectedVideoFormat, selectedAvatar);
      const detectedTitle = productTitleInput || products[0]?.name || 'দোকানদারি অরিজিনাল প্রোডাক্ট';
      const agentReplyMsg: AgentChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        textBn: `✅ প্রোডাক্টের আসল ছবি ও ৩ডি প্যাকেজিং অ্যানালাইসিস করে বাংলাদেশি ${selectedAvatar.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল (${selectedAvatar.nameBn.split('(')[0].trim()})-এর জন্য অরিজিনাল Google Flow / Veo 3.1 / Omni 1.1 প্রম্পট ও বাংলা স্ক্রিপ্ট প্রস্তুত করা হয়েছে! নিচে "🎬 রিয়েল হিউম্যান ভিডিও জেনারেট করুন" বাটনে ক্লিক করুন।`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        planData: {
          detectedProductBn: detectedTitle,
          productAnalysisBn: `${selectedAvatar.nameBn} হাতে আসল ৩ডি প্রোডাক্ট নিয়ে ক্যামেরার সামনে জীবন্তভাবে "${selectedFormatMeta.shortTagBn}" উপস্থাপন করবেন।`,
          spokenScriptBn: currentScriptBn,
          omniVideoPrompt: currentOmniPrompt,
          scenes: currentScenes,
          brandName,
          brandSlogan,
          videoFormat: selectedVideoFormat,
          modelGender: selectedAvatar.gender,
          awaitingApproval: !autoAgentMode,
          approved: autoAgentMode,
        },
      };
      setAgentMessages((prev) => [...prev, agentReplyMsg]);

      if (autoAgentMode) {
        await handleExecuteRealVideoGeneration(agentReplyMsg.id, detectedTitle);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'প্রম্পট তৈরিতে সমস্যা হয়েছে।');
    } finally {
      setIsPlanning(false);
    }
  };

  /**
   * Generate Photorealistic Bangladeshi Human Model Holding Product Keyframe (100% Real AI Image — No Fake Fallback)
   */
  const handleGenerateRealShowroomFrameOnly = async () => {
    setErrorBanner('');
    setRequiresPaidKeyPrompt(false);
    const targetImages =
      uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 2) || [];

    setIsGeneratingFrame(true);
    setGenerationProgress(30);
    setGenerationStepLabel(
      `বাংলাদেশি ${selectedAvatar.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল (${selectedAvatar.nameBn.split('(')[0].trim()}) আসল ৩ডি প্রোডাক্ট হাতে নিয়ে রিয়েলিস্টিক ছবি তৈরি হচ্ছে (Nano Banana 2.1)...`
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
          modelGender: selectedAvatar.gender,
          videoFormat: selectedVideoFormat,
        }),
      });
      const data = await res.json();
      if (res.status === 402 || data?.requiresPaidKey) {
        setRequiresPaidKeyPrompt(true);
        const aiStudio = (window as any).aistudio;
        if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
          await aiStudio.openSelectKey();
        }
        throw new Error(
          data.error ||
            'অরিজিনাল Google Flow ও Nano Banana 2.1 ইঞ্জিনে রিয়েল হিউম্যান ছবি তৈরির জন্য পেইড API Key সিলেক্ট করুন।'
        );
      }
      if (!res.ok || !data.success || !data.frameDataUrl) {
        throw new Error(data.error || 'মডেল ফ্রেম তৈরিতে সমস্যা হয়েছে।');
      }

      setGenerationProgress(100);
      const newItem: FlowMediaItem = {
        id: `frame-${Date.now()}`,
        type: 'image',
        titleBn: `${selectedAvatar.nameBn.split('(')[0].trim()} — হাতে আসল ৩ডি প্রোডাক্ট (${selectedFormatMeta.shortTagBn})`,
        brandName,
        brandSlogan,
        url: data.frameDataUrl,
        thumbnailUrl: data.frameDataUrl,
        spokenScriptBn:
          currentScriptBn || `${brandName} রিয়েল হিউম্যান রিভিউ। ${brandSlogan}`,
        omniPrompt: currentOmniPrompt || selectedAvatar.descPrompt,
        scenes: currentScenes,
        aspectRatio,
        duration,
        engineLabel: `Google Flow Real Human 3D Product Frame (${data.model || 'Nano Banana 2.1'})`,
        interactionId: data.interactionId || undefined,
        createdAt: Date.now(),
        productImages: targetImages,
        linkedProductId: selectedProductId || undefined,
        videoFormat: selectedVideoFormat,
        modelGender: selectedAvatar.gender,
        avatarNameBn: selectedAvatar.nameBn,
      };

      setMediaItems((prev) => [newItem, ...prev]);
      setActiveMedia(newItem);
      setStatusBanner('✅ বাংলাদেশি মডেলের হাতে আসল ৩ডি প্রোডাক্টের রিয়েলিস্টিক ছবি সফলভাবে তৈরি হয়েছে!');
    } catch (err: any) {
      setErrorBanner(err?.message || 'ইমেজ জেনারেশনে ত্রুটি হয়েছে।');
    } finally {
      setIsGeneratingFrame(false);
      setGenerationStepLabel('');
      setGenerationProgress(0);
    }
  };

  /**
   * Execute Antigravity Autonomous Agent (`antigravity-preview-09-2026`)
   */
  const handleRunAntigravityAgent = async () => {
    setErrorBanner('');
    const targetImages =
      uploadedImages.length > 0
        ? uploadedImages
        : products[0]?.images?.slice(0, 3) || [];

    const prodTitle = productTitleInput || products[0]?.name || 'দোকানদারি অরিজিনাল প্রোডাক্ট';
    const commandText =
      userPromptInput.trim() ||
      `"${prodTitle}" প্রোডাক্টের ৩ডি প্যাকেজিং বিশ্লেষণ করে বাংলাদেশি ${selectedAvatar.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল "${selectedAvatar.nameBn}"-কে দিয়ে একটি "${selectedFormatMeta.labelBn}" অরিজিনাল Google Flow ভিডিওর ফর্ম, বাংলা স্ক্রিপ্ট ও প্রম্পট তৈরি করুন।`;

    setIsPlanning(true);
    setGenerationStepLabel(
      'Antigravity Agent প্রোডাক্টের ৩ডি ছবি বিশ্লেষণ করে অরিজিনাল Google Flow হিউম্যান ভিডিও প্ল্যান তৈরি করছে...'
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
        `✅ Antigravity এজেন্ট "${prodTitle}"-এর ৩ডি প্যাকেজিং বিশ্লেষণ করে বাংলাদেশি মডেলের অরিজিনাল Google Flow ভিডিও স্ক্রিপ্ট ও প্রম্পট প্রস্তুত করেছে।`;

      setAgentMessages((prev) => [
        ...prev,
        {
          id: `ag-msg-${Date.now()}`,
          sender: 'agent',
          textBn: replyBn,
          timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      await handleBuildAutonomousFlowForm(selectedVideoFormat, selectedAvatar);
      setStatusBanner('✅ Antigravity Agent সফলভাবে ৩ডি প্রোডাক্ট বিশ্লেষণ ও হিউম্যান ভিডিও ফর্ম তৈরি করেছে!');
    } catch (err: any) {
      setErrorBanner(err?.message || 'Antigravity এজেন্ট রান করতে সমস্যা হয়েছে।');
    } finally {
      setIsPlanning(false);
      setGenerationStepLabel('');
    }
  };

  /**
   * STEP 2: Generate 100% Real Google Flow / Gemini Omni 1.1 / Veo 3.1 Bangladeshi Human Video
   * (Strictly ZERO fake canvas cutout video fallback! Uses real AI product analysis + real Bengali voiceover + real Google Flow video engine)
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
    setRequiresPaidKeyPrompt(false);
    if (messageId) {
      setAgentMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.planData
            ? { ...m, planData: { ...m.planData, awaitingApproval: false, approved: true } }
            : m
        )
      );
    }

    const prodTitle =
      overrideProdTitle || productTitleInput || products[0]?.name || 'দোকানদারি অরিজিনাল প্রোডাক্ট';
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
    setGenerationProgress(10);
    setGenerationStepLabel(
      `ধাপ ১/৪: এআই এজেন্ট "${prodTitle}"-এর আসল ৩ডি প্যাকেজিং, শেপ ও লেবেল গভীরভাবে বিশ্লেষণ করছে...`
    );
    appendStoreLog(
      'ভিডিও রেন্ডারিং',
      `${selectedAvatar.nameBn} মডেলের মাধ্যমে অরিজিনাল Google Flow (${selectedFormatMeta.shortTagBn}) রিয়েল হিউম্যান ভিডিও জেনারেশন শুরু হয়েছে।`,
      'info'
    );

    try {
      // Step 1: Ensure Deep 3D Product Analysis & Authentic Google Flow Prompt from the actual product image
      let scriptToUse = overrideScriptBn || currentScriptBn;
      let promptToUse = overrideOmniPrompt || currentOmniPrompt;
      let scenesToUse =
        overrideScenes && overrideScenes.length > 0 ? overrideScenes : currentScenes;

      try {
        const planRes = await fetch('/api/flow/agent-plan', {
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
            productPrice: productPriceInput || '৬৯৯',
            aspectRatio,
            duration,
            videoFormat: selectedVideoFormat,
            modelGender: selectedAvatar.gender,
          }),
        });
        if (planRes.ok) {
          const planData = await planRes.json();
          if (planData.product3dVisualSummary) {
            setProduct3dAnalysisSummary(planData.product3dVisualSummary);
          }
          if (!overrideScriptBn && planData.spokenScriptBn) {
            scriptToUse = planData.spokenScriptBn;
            setCurrentScriptBn(planData.spokenScriptBn);
          }
          if (!overrideOmniPrompt && planData.omniVideoPrompt) {
            promptToUse = planData.omniVideoPrompt;
            setCurrentOmniPrompt(planData.omniVideoPrompt);
          }
          if (Array.isArray(planData.scenes) && planData.scenes.length > 0) {
            scenesToUse = planData.scenes;
            setCurrentScenes(planData.scenes);
          }
        }
      } catch {
        // continue with existing script/prompt
      }

      if (!scriptToUse) {
        scriptToUse = `আসসালামু আলাইকুম সবাইকে! আমি ${selectedAvatar.nameBn.split('(')[0].trim()}, আজ আপনাদের হাতে নিয়ে দেখাচ্ছি ${brandName}-এর ১০০% অরিজিনাল ${prodTitle}। এর কোয়ালিটি ও ফলাফল জাস্ট অসাধারণ! অফার মূল্য মাত্র ৳${productPriceInput || '৬৯৯'}—সারা বাংলাদেশে ক্যাশ অন ডেলিভারিতে আজই অর্ডার করুন!`;
      }
      if (!promptToUse) {
        promptToUse = compiledPromptResult.compiledOmniPrompt;
      }

      // Step 2: Generate Real Bengali TTS Voiceover (Preserved as requested by user!)
      setGenerationProgress(25);
      setGenerationStepLabel(
        `ধাপ ২/৪: বাংলাদেশি ${selectedAvatar.gender === 'male' ? 'পুরুষ' : 'নারী'} মডেল (${selectedAvatar.nameBn.split('(')[0].trim()})-এর রিয়েল বাংলা ভয়েসওভার তৈরি হচ্ছে...`
      );

      let generatedAudioDataUrl: string | undefined;
      try {
        const ttsRes = await fetch('/api/flow/generate-voiceover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptBn: scriptToUse,
            voice: selectedAvatar.voiceId || (selectedAvatar.gender === 'male' ? 'Puck' : 'Kore'),
          }),
        });
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.success && ttsData.audioDataUrl) {
            generatedAudioDataUrl = ttsData.audioDataUrl;
          }
        }
      } catch {
        // continue
      }

      // Step 3: Generate Photorealistic Bangladeshi Human Model Physically Holding the Exact 3D Product Keyframe
      setGenerationProgress(42);
      setGenerationStepLabel(
        `ধাপ ৩/৪: বাংলাদেশি মডেল (${selectedAvatar.nameBn.split('(')[0].trim()}) আসল ৩ডি প্রোডাক্ট হাতে নিয়ে ফটোরিয়েলিস্টিক ফ্রেম তৈরি হচ্ছে...`
      );

      let humanHoldingProductUrl: string | null = null;
      try {
        const sceneRes = await fetch('/api/flow/generate-human-scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImages: targetImages,
            productTitle: prodTitle,
            avatarDesc: selectedAvatar.descPrompt,
            modelGender: selectedAvatar.gender,
            videoFormat: selectedVideoFormat,
            aspectRatio,
          }),
        });
        if (sceneRes.ok) {
          const sceneData = await sceneRes.json();
          if (sceneData?.humanHoldingProductUrl) {
            humanHoldingProductUrl = sceneData.humanHoldingProductUrl;
          }
        }
      } catch {
        // continue directly to Google Flow video engine with actual product images
      }

      // Step 4: Call Original Google Flow (`gemini-omni-1.1-flash` / `veo-3.1-fast-generate-preview`) with actual 3D product images
      setGenerationProgress(58);
      setGenerationStepLabel(
        `ধাপ ৪/৪: অরিজিনাল Google Flow (Gemini Omni 1.1 / Veo 3.1) ইঞ্জিনে ১০০% রিয়েল হিউম্যান ভিডিও রেন্ডার হচ্ছে...`
      );

      const omniRes = await fetch('/api/flow/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showroomFrame: humanHoldingProductUrl || undefined,
          images: targetImages,
          prompt: promptToUse,
          brandName,
          brandSlogan,
          spokenScriptBn: scriptToUse,
          aspectRatio,
          duration,
          resolution: '720p',
          videoFormat: selectedVideoFormat,
          modelGender: selectedAvatar.gender,
          avatarDesc: selectedAvatar.descPrompt,
        }),
      });

      const omniData = await omniRes.json();

      if (omniRes.status === 402 || omniData?.requiresPaidKey) {
        setRequiresPaidKeyPrompt(true);
        const aiStudio = (window as any).aistudio;
        if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
          await aiStudio.openSelectKey();
        }
        throw new Error(
          omniData?.error ||
            'অরিজিনাল Google Flow (Gemini Omni 1.1 ও Veo 3.1) ইঞ্জিনে রিয়েল হিউম্যান ভিডিও তৈরির জন্য ফ্রি-টিয়ার কী-তে কোটা নেই (limit: 0)। অনুগ্রহ করে পেইড Google AI Studio API Key সিলেক্ট করে পুনরায় ক্লিক করুন।'
        );
      }

      if (!omniRes.ok || omniData?.success === false) {
        throw new Error(
          omniData?.error ||
            'Google Flow ভিডিও ইঞ্জিন থেকে রেসপন্স পাওয়া যায়নি। আপনার পেইড API Key চেক করে আবার চেষ্টা করুন।'
        );
      }

      let finalVideoUrl = omniData?.videoDataUrl || omniData?.videoUrl || '';
      let usedModelName = omniData?.model || 'gemini-omni-1.1-flash';
      const interactionId = omniData?.interactionId || '';
      if (interactionId) setActiveInteractionId(interactionId);

      if (!finalVideoUrl && interactionId) {
        for (let attempt = 1; attempt <= 24; attempt++) {
          setGenerationProgress(Math.min(95, 58 + Math.round(attempt * 1.5)));
          setGenerationStepLabel(
            `অরিজিনাল Google Flow (${usedModelName}) সার্ভারে রিয়েল হিউম্যান ভিডিও রেন্ডার হচ্ছে (${attempt}/24)...`
          );
          await new Promise((r) => setTimeout(r, 5000));
          const pollRes = await fetch(`/api/flow/video-status/${interactionId}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'completed' && (pollData.videoDataUrl || pollData.videoUrl)) {
            finalVideoUrl = pollData.videoDataUrl || pollData.videoUrl;
            break;
          }
          if (pollData.status === 'failed' || pollData.status === 'cancelled') {
            throw new Error(
              pollData.error || 'Google Flow ভিডিও রেন্ডারিং সম্পন্ন হয়নি। আবার চেষ্টা করুন।'
            );
          }
        }
      }

      if (!finalVideoUrl) {
        throw new Error(
          'Google Flow ভিডিও রেন্ডারিংয়ে নির্ধারিত সময়ের বেশি লাগছে। অনুগ্রহ করে কয়েক মুহূর্ত পর আবার চেষ্টা করুন।'
        );
      }

      setGenerationProgress(100);
      setGenerationStepLabel('অরিজিনাল Google Flow রিয়েলিস্টিক হিউম্যান ভিডিও সফলভাবে তৈরি হয়েছে!');

      const newVideoItem: FlowMediaItem = {
        id: `google-flow-video-${Date.now()}`,
        type: 'video',
        titleBn: `${selectedFormatMeta.shortTagBn}: ${prodTitle} — মডেল: ${selectedAvatar.nameBn.split('(')[0].trim()}`,
        brandName,
        brandSlogan,
        url: finalVideoUrl,
        thumbnailUrl: humanHoldingProductUrl || targetImages[0] || selectedAvatar.avatarImage,
        audioDataUrl: generatedAudioDataUrl,
        spokenScriptBn: scriptToUse,
        omniPrompt: promptToUse,
        scenes: scenesToUse,
        aspectRatio,
        duration,
        engineLabel: `Original Google Flow (${usedModelName} • Real 3D Product in Hand + Bengali Voiceover)`,
        interactionId: interactionId || `google-flow-${Date.now()}`,
        createdAt: Date.now(),
        productImages: targetImages,
        linkedProductId: selectedProductId || undefined,
        videoFormat: selectedVideoFormat,
        modelGender: selectedAvatar.gender,
        avatarNameBn: selectedAvatar.nameBn,
      };

      setMediaItems((prev) => [newVideoItem, ...prev]);
      setActiveMedia(newVideoItem);

      const doneMsg = `🎉 আলহামদুলিল্লাহ! অরিজিনাল Google Flow (${usedModelName}) দিয়ে বাংলাদেশি ${
        selectedAvatar.gender === 'male' ? 'পুরুষ' : 'নারী'
      } মডেল "${selectedAvatar.nameBn.split('(')[0].trim()}" হাতে আসল ৩ডি "${prodTitle}" নিয়ে ১০০% রিয়েলিস্টিক হিউম্যান ভিডিও ও বাংলা ভয়েসওভার তৈরি হয়েছে!`;
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
      setStatusBanner(
        `🎬 অরিজিনাল Google Flow (${usedModelName}) রিয়েলিস্টিক হিউম্যান ভিডিও ও বাংলা ভয়েসওভার তৈরি সম্পন্ন!`
      );
    } catch (err: any) {
      const errMsg =
        err?.message || 'ভিডিও জেনারেশনে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।';
      setErrorBanner(errMsg);
      appendStoreLog('ভিডিও রেন্ডারিং', errMsg, 'warning');
    } finally {
      setIsGeneratingVideo(false);
      setGenerationProgress(0);
      setGenerationStepLabel('');
    }
  };

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
        `✅ "${targetProd.name}" প্রোডাক্টের সাথে রিয়েল হিউম্যান ভিডিওটি যুক্ত হয়ে লাইভ স্টোরে সেভ হয়েছে!`
      );
      setTimeout(() => setStatusBanner(''), 4500);
    } catch {
      setErrorBanner('প্রোডাক্টে ভিডিও যুক্ত করতে সমস্যা হয়েছে।');
    }
  };

  /**
   * Create a New Reusable Custom Dokandari Bangladeshi Brand Avatar (Male or Female)
   */
  const handleCreateCustomAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAvatarName.trim()) return;
    setCreatingAvatar(true);
    setErrorBanner('');

    const genderWordEn =
      newAvatarGender === 'male'
        ? 'Authentic Bangladeshi South Asian male brand presenter in his late 20s'
        : 'Authentic Bangladeshi South Asian female brand presenter in her mid 20s';

    const promptDesc =
      newAvatarPrompt.trim() ||
      `${genderWordEn} named ${newAvatarName}, wearing ${newAvatarAttire}, warm trustworthy smile, natural skin texture, inside a cozy modern Dhaka home studio for ${brandName}`;

    try {
      const res = await fetch('/api/flow/generate-showroom-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: uploadedImages.slice(0, 1),
          brandName,
          brandSlogan,
          showroomStyle: selectedShowroom.promptEn,
          avatarDesc: promptDesc,
          aspectRatio: '9:16',
          modelGender: newAvatarGender,
          videoFormat: selectedVideoFormat,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.frameDataUrl) {
        throw new Error(data.error || 'অবতার ছবি তৈরিতে সমস্যা হয়েছে।');
      }

      const newAv: VirtualAvatar = {
        id: `avatar-custom-${Date.now()}`,
        nameBn: `${newAvatarName.trim()} (${newAvatarGender === 'male' ? 'পুরুষ অবতার' : 'নারী অবতার'})`,
        roleBn:
          newAvatarRole.trim() ||
          `${brandName} অফিশিয়াল ${newAvatarGender === 'male' ? 'পুরুষ' : 'নারী'} ব্র্যান্ড অবতার`,
        gender: newAvatarGender,
        badgeBn: 'দোকানদারি কাস্টম অবতার',
        descPrompt: promptDesc,
        voiceId: newAvatarGender === 'male' ? 'Puck' : 'Kore',
        avatarImage: data.frameDataUrl,
        attireColor: newAvatarGender === 'male' ? '#2563EB' : '#E11D48',
      };

      setAvatars((prev) => [newAv, ...prev]);
      setSelectedAvatarId(newAv.id);
      setSelectedGenderFilter('all');
      setNewAvatarName('');
      setNewAvatarRole('');
      setNewAvatarPrompt('');
      setShowQuickAvatarCreator(false);
      setStatusBanner(
        `✨ দোকানদারির জন্য নতুন বাংলাদেশি ${
          newAvatarGender === 'male' ? 'পুরুষ' : 'নারী'
        } ব্র্যান্ড অবতার "${newAv.nameBn}" তৈরি ও সিলেক্ট হয়েছে!`
      );
    } catch (err: any) {
      setErrorBanner(err?.message || 'অবতার তৈরিতে সমস্যা হয়েছে।');
    } finally {
      setCreatingAvatar(false);
    }
  };

  const handleUploadCustomAvatarPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 700, 0.85);
      const customAv: VirtualAvatar = {
        id: `avatar-upload-${Date.now()}`,
        nameBn:
          newAvatarName.trim() ||
          `${brandName} ${newAvatarGender === 'male' ? 'পুরুষ মডেল' : 'নারী মডেল'}`,
        roleBn: newAvatarRole.trim() || 'দোকানদারি অফিশিয়াল ব্র্যান্ড অবতার',
        gender: newAvatarGender,
        badgeBn: 'আপলোড করা অবতার',
        descPrompt:
          newAvatarPrompt.trim() ||
          `Bangladeshi ${newAvatarGender} brand presenter holding product and speaking Bengali`,
        voiceId: newAvatarGender === 'male' ? 'Puck' : 'Kore',
        avatarImage: dataUrl,
        attireColor: '#E11D48',
      };
      setAvatars((prev) => [customAv, ...prev]);
      setSelectedAvatarId(customAv.id);
      setShowQuickAvatarCreator(false);
      setStatusBanner(`✅ আপনার আপলোড করা ছবি দিয়ে "${customAv.nameBn}" অবতার সেট করা হয়েছে!`);
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
  // COMPACT MINI LAUNCHER VIEW
  // ============================================================================
  if (!isFullEditMode) {
    return (
      <div className="bg-[#FFF0F3] rounded-3xl border-2 border-rose-300 p-5 sm:p-7 shadow-sm space-y-5 transition-all">
        <OmniAuth compact />

        <div className="bg-[#FFE4E9]/80 rounded-2xl border border-rose-300 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E11D48] to-rose-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-rose-950">
                  🎬 দোকানদারি রিয়েলিস্টিক বাংলাদেশি হিউম্যান ভিডিও ও অবতার স্টুডিও
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ বাংলাদেশি পুরুষ ও নারী মডেল • ক্যাটালগ জুম বন্ধ
                </span>
              </div>
              <p className="text-xs text-rose-900/80 mt-1">
                ইউজিএসি রিভিউ ভিডিও, আফটার-বিফোর ভিডিও, আনবক্সিং ভিডিও এবং দোকানদারির নিজস্ব ব্র্যান্ড অবতার দিয়ে ১০০% রিয়েলিস্টিক হিউম্যান ভিডিও তৈরি করুন।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFullEditMode(true)}
            className="px-5 py-3 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>হিউম্যান ভিডিও স্টুডিও খুলুন</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // FULL REALISTIC BANGLADESHI HUMAN VIDEO STUDIO WORKSPACE
  // ============================================================================
  return (
    <div
      className={`${
        isFullscreenModal
          ? 'fixed inset-0 z-50 bg-[#FFF0F3] overflow-y-auto p-4 sm:p-6'
          : 'rounded-3xl bg-[#FFF0F3] border-2 border-rose-300 shadow-md overflow-hidden'
      } text-stone-900 transition-all`}
    >
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-[#FFE4E9] via-[#FFF0F3] to-[#FFE4E9] border-b-2 border-rose-300 px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-2xl bg-[#E11D48] flex items-center justify-center shadow-xs text-white shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-rose-950">
                ⚡ দোকানদারি রিয়েলিস্টিক হিউম্যান ভিডিও ও ব্র্যান্ড অবতার স্টুডিও (Google Flow & Omni 1.1)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ ১০০% রিয়েল বাংলাদেশি হিউম্যান মডেল (কোনো ক্যাটালগ জুম নয়)
              </span>
            </div>
            <p className="text-xs text-rose-900/80 mt-0.5 font-medium">
              <strong>বাংলাদেশি নারী ও পুরুষ মডেল</strong> • <strong>🤳 UGC প্রোডাক্ট রিভিউ</strong> • <strong>✨ আফটার-বিফোর ভিডিও</strong> • <strong>📦 আনবক্সিং ভিডিও</strong> • <strong>🎙️ দোকানদারি ব্র্যান্ড অবতার</strong>
            </p>
          </div>
        </div>

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

      {/* Dedicated OmniAuth Component */}
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
        <div className="mx-5 mt-4 px-4 py-3.5 rounded-2xl bg-[#FFE4E9] border border-rose-400 text-rose-950 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
            <span>{errorBanner}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {requiresPaidKeyPrompt && (
              <button
                type="button"
                onClick={handleConnectPaidKeyAndRetry}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🔑 পেইড Google Flow API Key সিলেক্ট করুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="px-2.5 py-1 rounded-xl bg-[#FFF0F3] border border-rose-300 text-rose-900 text-[11px] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          STEP A: DOKANDARI BANGLADESHI BRAND AVATAR (MALE / FEMALE) & VIDEO FORMAT SELECTOR
         ======================================================================== */}
      <div className="mx-5 mt-4 p-4 sm:p-5 rounded-2xl bg-white border-2 border-rose-300 shadow-xs space-y-4">
        {/* 1. Video Format Selector (4 Realistic Human Video Formats) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#E11D48]" />
              <span>১. রিয়েলিস্টিক হিউম্যান ভিডিওর ধরন সিলেক্ট করুন (ক্যাটালগ বা শোকেস জুম নয়):</span>
            </label>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              সিলেক্ট করলে এজেন্ট স্বয়ংক্রিয়ভাবে ঐ ফরম্যাটের ফর্ম রেডি করবে
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {HUMAN_VIDEO_FORMATS.map((fmt) => {
              const isSelected = selectedVideoFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    setSelectedVideoFormat(fmt.id);
                    handleBuildAutonomousFlowForm(fmt.id, selectedAvatar);
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-[#FFF0F3] border-[#E11D48] ring-2 ring-rose-200 shadow-xs'
                      : 'bg-stone-50/70 border-stone-200 hover:border-rose-300 hover:bg-rose-50/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-stone-900">{fmt.shortTagBn}</span>
                      <span
                        className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-[#E11D48] text-white'
                            : 'bg-rose-100 text-[#E11D48]'
                        }`}
                      >
                        {fmt.badgeBn}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-1 line-clamp-2 leading-snug">
                      {fmt.descriptionBn}
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-[#E11D48] flex items-center gap-1 pt-1 border-t border-rose-100">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>{isSelected ? '✓ সিলেক্টেড ফরম্যাট' : 'এই ফরম্যাট নিন →'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Dokandari Bangladeshi Male / Female Brand Avatar Selector */}
        <div className="pt-3 border-t border-rose-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#E11D48]" />
                <span>২. দোকানদারি বাংলাদেশি ব্র্যান্ড অবতার সিলেক্ট করুন (নারী বা পুরুষ মডেল):</span>
              </h3>
              <p className="text-[11px] text-stone-600">
                নিচের যেকোনো বাংলাদেশি পুরুষ বা নারী মডেল সিলেক্ট করুন অথবা নিজের দোকানদারি ব্র্যান্ডের জন্য নতুন অবতার বানান।
              </p>
            </div>

            {/* Gender Filter Buttons + Create Custom Brand Avatar Toggle */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectModelGender('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                  selectedGenderFilter === 'all'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-rose-300'
                }`}
              >
                👥 সব মডেল ({avatars.length})
              </button>
              <button
                type="button"
                onClick={() => handleSelectModelGender('female')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                  selectedGenderFilter === 'female'
                    ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-rose-300'
                }`}
              >
                👩 নারী মডেল ({avatars.filter((a) => a.gender === 'female').length})
              </button>
              <button
                type="button"
                onClick={() => handleSelectModelGender('male')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                  selectedGenderFilter === 'male'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-blue-300'
                }`}
              >
                👨 পুরুষ মডেল ({avatars.filter((a) => a.gender === 'male').length})
              </button>
              <button
                type="button"
                onClick={() => setShowQuickAvatarCreator((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-pink-600 hover:from-[#BE123C] hover:to-pink-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ দোকানদারি নতুন অবতার বানান</span>
              </button>
            </div>
          </div>

          {/* Horizontal Selectable Bangladeshi Human Avatar Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredAvatars.map((av) => {
              const isSelected = av.id === selectedAvatarId;
              return (
                <div
                  key={av.id}
                  onClick={() => {
                    setSelectedAvatarId(av.id);
                    if (hasGeneratedPlan) {
                      handleBuildAutonomousFlowForm(selectedVideoFormat, av);
                    }
                  }}
                  className={`p-2.5 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FFF0F3] border-[#E11D48] ring-2 ring-rose-200 shadow-xs'
                      : 'bg-white border-stone-200 hover:border-rose-300'
                  }`}
                >
                  <div className="relative w-14 h-16 rounded-xl overflow-hidden shrink-0 border border-rose-200 bg-stone-100">
                    <img
                      src={av.avatarImage}
                      alt={av.nameBn}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute bottom-0 inset-x-0 text-[9px] font-black text-white text-center py-0.5 ${
                        av.gender === 'male' ? 'bg-blue-600/90' : 'bg-[#E11D48]/90'
                      }`}
                    >
                      {av.gender === 'male' ? '👨 পুরুষ' : '👩 নারী'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-stone-900 truncate">
                        {av.nameBn.split('(')[0].trim()}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-extrabold shrink-0">
                          ✓ সিলেক্টেড
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-stone-600 line-clamp-2 mt-0.5 leading-snug">
                      {av.roleBn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expandable Quick Custom Dokandari Brand Avatar Creator */}
          {showQuickAvatarCreator && (
            <form
              onSubmit={handleCreateCustomAvatar}
              className="p-4 rounded-2xl bg-[#FFF5F7] border-2 border-rose-300 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#E11D48]" />
                  <span>✨ আমাদের দোকানদারি ব্র্যান্ডের জন্য কাস্টম বাংলাদেশি অবতার বানান (পুরুষ / নারী)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAvatarCreator(false)}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
                >
                  বন্ধ করুন ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    ১. অবতারের লিঙ্গ (Gender):
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNewAvatarGender('female');
                        setNewAvatarAttire('মার্জিত সালোয়ার কামিজ ও ন্যাচারাল বাংলাদেশি লুক');
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                        newAvatarGender === 'female'
                          ? 'bg-[#E11D48] text-white border-[#E11D48]'
                          : 'bg-white text-stone-700 border-stone-300'
                      }`}
                    >
                      👩 নারী মডেল
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewAvatarGender('male');
                        setNewAvatarAttire('স্মার্ট পোলো শার্ট / পাঞ্জাবি ও গ্রুমড বাংলাদেশি লুক');
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                        newAvatarGender === 'male'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-stone-700 border-stone-300'
                      }`}
                    >
                      👨 পুরুষ মডেল
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    ২. অবতারের নাম:
                  </label>
                  <input
                    type="text"
                    required
                    value={newAvatarName}
                    onChange={(e) => setNewAvatarName(e.target.value)}
                    placeholder={
                      newAvatarGender === 'male'
                        ? 'যেমন: আরিফ হোসেন (দোকানদারি হোস্ট)'
                        : 'যেমন: ফারহানা ইসলাম (দোকানদারি হোস্ট)'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs font-bold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    ৩. পোশাক ও লুক ( বাংলাদেশি স্টাইল):
                  </label>
                  <select
                    value={newAvatarAttire}
                    onChange={(e) => setNewAvatarAttire(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs font-bold text-stone-900"
                  >
                    {newAvatarGender === 'female' ? (
                      <>
                        <option value="মার্জিত সালোয়ার কামিজ ও ন্যাচারাল বাংলাদেশি লুক">
                          মার্জিত সালোয়ার কামিজ (ন্যাচারাল হোম UGC)
                        </option>
                        <option value="প্রিমিয়াম হিজাব ও মডেস্ট কুর্তি/আবায়া">
                          হিজাব ও মডেস্ট কুর্তি / আবায়া
                        </option>
                        <option value="ফেস্টিভ জামদানি/কুর্তি ও গ্লোয়িং স্কিনকেয়ার লুক">
                          জামদানি / স্কিনকেয়ার স্পেশালিস্ট লুক
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="স্মার্ট পোলো শার্ট ও ক্যাজুয়াল বাংলাদেশি তরুণ লুক">
                          স্মার্ট পোলো শার্ট (UGC ও আনবক্সিং লুক)
                        </option>
                        <option value="প্রিমিয়াম নেভি-ব্লু পাঞ্জাবি ও মার্জিত দাড়ি">
                          প্রিমিয়াম পাঞ্জাবি (অফিশিয়াল ব্র্যান্ড অবতার)
                        </option>
                        <option value="স্মার্ট ক্যাজুয়াল শার্ট ও মডার্ন টেক প্রেজেন্টার লুক">
                          স্মার্ট ক্যাজুয়াল শার্ট (টেক ও লাইফস্টাইল)
                        </option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    ৪. অবতারের ভূমিকা:
                  </label>
                  <input
                    type="text"
                    value={newAvatarRole}
                    onChange={(e) => setNewAvatarRole(e.target.value)}
                    placeholder="যেমন: ইউজিএসি ও আনবক্সিং রিভিউয়ার"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs text-stone-900"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creatingAvatar}
                  className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {creatingAvatar
                      ? 'দোকানদারি ব্র্যান্ড অবতার তৈরি হচ্ছে...'
                      : '✨ এআই দিয়ে রিয়েল বাংলাদেশি অবতার তৈরি করুন'}
                  </span>
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
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>অথবা নিজের মডেলের ছবি আপলোড করুন</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Main 3-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[680px] p-5 gap-5">
        {/* LEFT SIDEBAR */}
        <div className="lg:col-span-2 bg-[#FFE4E9]/65 rounded-2xl border-2 border-rose-300 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="px-2 py-1 text-[11px] font-extrabold text-[#E11D48] uppercase tracking-wider border-b border-rose-300">
              স্টুডিও মেনু
            </div>

            {[
              { id: 'all_media', label: 'সব ভিডিও ও এডিটর', icon: Layers, count: mediaItems.length },
              {
                id: 'videos',
                label: 'হিউম্যান ভিডিও',
                icon: Video,
                count: mediaItems.filter((m) => m.type === 'video').length,
              },
              {
                id: 'images',
                label: 'মডেল ফ্রেম ছবি',
                icon: ImageIcon,
                count: mediaItems.filter((m) => m.type === 'image').length,
              },
              {
                id: 'characters',
                label: 'দোকানদারি অবতার',
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
                label: 'প্রোডাক্ট ছবি',
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

          <div className="p-3 rounded-2xl bg-[#FFF7F9] border border-rose-300 space-y-2">
            <div className="text-[11px] font-extrabold text-rose-950 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>অ্যাডভান্সড টুলস</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPromptBuilder((prev) => !prev)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFE4E9] hover:bg-rose-200 text-rose-950 text-[11px] font-bold text-left flex items-center justify-between cursor-pointer"
            >
              <span>প্রম্পট টেমপ্লেট</span>
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

        {/* CENTER WORKSPACE */}
        <div className="lg:col-span-6 space-y-5 overflow-y-auto max-h-[920px]">
          {/* ACTIVE GENERATED HUMAN VIDEO PLAYER (Placed right at top when generated so user immediately sees it!) */}
          {activeMedia && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-400 shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    ✓ {activeMedia.engineLabel}
                  </span>
                  <h4 className="text-sm sm:text-base font-black text-stone-900 mt-1">
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
                    download={`dokandari-google-flow-${activeMedia.type}-${activeMedia.id}.${
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

              <div className="flex flex-col items-center justify-center bg-stone-950 rounded-2xl p-3 border border-stone-800">
                {activeMedia.type === 'video' && activeMedia.audioDataUrl && (
                  <audio
                    ref={syncAudioRef}
                    src={activeMedia.audioDataUrl}
                    preload="auto"
                    className="hidden"
                  />
                )}
                {activeMedia.type === 'video' ? (
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    poster={activeMedia.thumbnailUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    onPlay={() => {
                      if (syncAudioRef.current) {
                        syncAudioRef.current.currentTime = 0;
                        syncAudioRef.current.play().catch(() => {});
                      }
                    }}
                    onPause={() => {
                      if (syncAudioRef.current) {
                        syncAudioRef.current.pause();
                      }
                    }}
                    onSeeked={(e) => {
                      if (syncAudioRef.current && e.currentTarget.currentTime < 0.3) {
                        syncAudioRef.current.currentTime = 0;
                        syncAudioRef.current.play().catch(() => {});
                      }
                    }}
                    className={`rounded-xl shadow-lg ${
                      activeMedia.aspectRatio === '9:16' ? 'max-h-[480px]' : 'w-full max-h-[380px]'
                    }`}
                  />
                ) : (
                  <img
                    src={activeMedia.url}
                    alt={activeMedia.titleBn}
                    className={`rounded-xl shadow-lg object-contain ${
                      activeMedia.aspectRatio === '9:16' ? 'max-h-[480px]' : 'w-full max-h-[380px]'
                    }`}
                  />
                )}
              </div>
            </div>
          )}

          {/* FEATURE CARD 1: Select Product for the Bangladeshi Model to Hold & Review */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFE4E9]/60 border-2 border-rose-300 space-y-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-rose-950 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#E11D48]" />
                  <span>
                    ৩. মডেলের হাতে দেওয়ার জন্য প্রোডাক্ট সিলেক্ট করুন ({uploadedImages.length}/4)
                  </span>
                </h3>
                <p className="text-[11px] text-rose-900/75">
                  নির্বাচিত বাংলাদেশি মডেল ({selectedAvatar.nameBn.split('(')[0].trim()}) এই প্রোডাক্টটি হাতে নিয়ে <strong>{selectedFormatMeta.shortTagBn}</strong> ভিডিও করবেন।
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E11D48] max-w-[220px]"
                >
                  <option value="">-- ক্যাটালগ প্রোডাক্ট বেছে নিন --</option>
                  {products.slice(0, 60).map((p) => (
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

            {/* 4 Product Image Slots */}
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
                  অথবা নিচের প্রোডাক্ট ছবিতে ক্লিক করে সিলেক্ট করুন:
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
                {products.slice(0, 18).map((prod) => {
                  const rawThumb = prod.images?.[0];
                  if (!rawThumb) return null;
                  const thumb = resolveSafeProductImageUrl(rawThumb, prod, 0);
                  const isSelected =
                    uploadedImages.includes(thumb) || uploadedImages.includes(rawThumb);
                  const selectedIdx =
                    uploadedImages.indexOf(thumb) >= 0
                      ? uploadedImages.indexOf(thumb)
                      : uploadedImages.indexOf(rawThumb);
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

            {/* Product Name, Price, Ratio */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-100">
              <input
                type="text"
                value={productTitleInput}
                onChange={(e) => setProductTitleInput(e.target.value)}
                placeholder="প্রোডাক্টের নাম (যেমন: Skin Brightening Soap / প্রিমিয়াম মিরর)"
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

            {/* Action Buttons: Analyze Product -> Build Realistic Human Video Form OR Directly Launch in Google Flow */}
            <div className="pt-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleBuildAutonomousFlowForm()}
                  disabled={isBuildingForm || isPlanning || isGeneratingVideo}
                  className="py-3.5 px-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>
                    {isBuildingForm
                      ? 'প্রোডাক্ট ছবি বিশ্লেষণ হচ্ছে...'
                      : `⚡ ১. ছবি বিশ্লেষণ ও প্রম্পট তৈরি`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchInGoogleFlowApp}
                  className="py-3.5 px-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-600 hover:opacity-95 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>🚀 ২. প্রম্পট কপি করে Google Flow প্রজেক্টে যান</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteRealVideoGeneration()}
                  disabled={isGeneratingVideo || isPlanning}
                  className="py-3.5 px-3.5 rounded-2xl bg-gradient-to-r from-[#E11D48] via-rose-600 to-pink-600 hover:from-[#BE123C] hover:to-rose-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Video className="w-4 h-4 shrink-0" />
                  <span>
                    {isGeneratingVideo
                      ? 'ভিডিও তৈরি হচ্ছে...'
                      : `🎬 ৩. স্টুডিওতে ভিডিও জেনারেট`}
                  </span>
                </button>
              </div>

              {/* Direct Google Flow Project Link Bar + Reference Image Downloader */}
              <div className="p-3.5 rounded-2xl bg-white border-2 border-indigo-200 space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-indigo-950 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                    <span>🔗 আপনার সরাসরি Google Flow / Omni প্রজেক্ট লিংক (১-ক্লিকে প্রম্পট কপি হয়ে এই লিংকে যাবে):</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadReferenceProductImage}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-[10.5px] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>📥 রেফারেন্স প্রোডাক্ট ছবি ডাউনলোড</span>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="url"
                    value={googleFlowProjectUrl}
                    onChange={(e) => handleSaveGoogleFlowProjectUrl(e.target.value)}
                    placeholder="https://labs.google/fx/tools/flow অথবা আপনার নির্দিষ্ট প্রজেক্ট লিংক পেস্ট করুন..."
                    className="flex-1 px-3 py-2 rounded-xl bg-stone-50 border border-indigo-200 text-xs font-mono text-stone-800 focus:outline-none focus:border-indigo-600"
                  />
                  <a
                    href={googleFlowProjectUrl.trim() || 'https://labs.google/fx/tools/flow'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      const promptToCopy =
                        activeFlowForm?.executableFlowPrompt ||
                        currentOmniPrompt ||
                        compiledPromptResult.compiledOmniPrompt;
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(promptToCopy);
                      }
                      setCopiedFormNotice(
                        '✅ প্রম্পট ক্লিপবোর্ডে কপি হয়েছে! Google Flow প্রজেক্টে পেস্ট (Ctrl+V) করে ভিডিও তৈরি করুন।'
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>📋 প্রম্পট কপি ও প্রজেক্ট ওপেন করুন ↗</span>
                  </a>
                </div>
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
          </div>

          {/* AUTONOMOUS REALISTIC HUMAN VIDEO PRODUCTION FORM CARD */}
          {activeFlowForm && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white via-[#FFF5F7] to-[#FFE4E9] border-2 border-rose-400 space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b-2 border-rose-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E11D48] to-pink-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Zap className="w-5 h-5 text-amber-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-rose-950">
                        রিয়েলিস্টিক হিউম্যান ভিডিও প্রোডাকশন ফর্ম ({activeFlowForm.videoFormatLabelBn})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-[#E11D48] text-white">
                        {activeFlowForm.modelGender === 'male' ? '👨 বাংলাদেশি পুরুষ মডেল' : '👩 বাংলাদেশি নারী মডেল'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      মডেল: <strong>{activeFlowForm.modelNameBn}</strong> • কোনো ক্যাটালগ স্লাইডশো নয়, ১০০% হিউম্যান রিভিউ ও ডেমোনস্ট্রেশন।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyFlowFormAndPrompt}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>ফর্ম কপি</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchInGoogleFlowApp}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-indigo-600 hover:from-[#BE123C] hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Flow অ্যাপ</span>
                  </button>
                </div>
              </div>

              {copiedFormNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{copiedFormNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-stone-800">
                    🎯 হিউম্যান ভিডিও ক্যাম্পেইন গোল:
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.campaignGoalBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, campaignGoalBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-900 font-bold"
                  />
                </div>

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
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-900 font-bold"
                    />
                    <input
                      type="text"
                      value={activeFlowForm.productPriceBn}
                      onChange={(e) =>
                        setActiveFlowForm({ ...activeFlowForm, productPriceBn: e.target.value })
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-[#E11D48] font-black"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-black text-stone-800">
                    🎥 রিয়েলিস্টিক হিউম্যান ক্যামেরা ও অ্যাকশন স্টাইল:
                  </label>
                  <input
                    type="text"
                    value={activeFlowForm.cameraMovementBn}
                    onChange={(e) =>
                      setActiveFlowForm({ ...activeFlowForm, cameraMovementBn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-800"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-black text-stone-800">
                    🎙️ বাংলাদেশি মডেলের মুখের বাংলা ভয়েসওভার স্ক্রিপ্ট (লিপ-সিঙ্ক হবে):
                  </label>
                  <textarea
                    rows={3}
                    value={activeFlowForm.spokenScriptBn}
                    onChange={(e) => {
                      setActiveFlowForm({ ...activeFlowForm, spokenScriptBn: e.target.value });
                      setCurrentScriptBn(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-stone-900 leading-relaxed"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[11px] font-black text-stone-800">
                    ⚡ Google Flow / Veo 3 / Gemini Omni রিয়েলিস্টিক হিউম্যান ভিডিও প্রম্পট:
                  </label>
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
                    className="w-full p-3 rounded-xl bg-white border border-rose-200 text-xs font-mono text-stone-900 leading-relaxed"
                  />
                </div>
              </div>

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
                      ? 'হিউম্যান ভিডিও তৈরি হচ্ছে...'
                      : `🎬 এই ফর্ম থেকে "${selectedFormatMeta.shortTagBn}" তৈরি করুন`}
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
                      ? 'মডেল ফ্রেম তৈরি হচ্ছে...'
                      : '📸 মডেলের হাতে প্রোডাক্ট ছবি'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* FEATURE CARD 2: EDITABLE SCRIPT & PROMPT */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFE4E9]/65 border-2 border-rose-300 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-300 pb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-rose-950">
                  ✍️ মডেলের বাংলা স্ক্রিপ্ট ও গুগল ফ্লো প্রম্পট এডিটর
                </h4>
                <p className="text-[11px] text-rose-900/80 mt-0.5">
                  চাইলে এখানে মডেলের সংলাপ বা প্রম্পট নিজের মতো পরিবর্তন করে ভিডিও জেনারেট করতে পারেন।
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-stone-800">
                🎙️ বাংলাদেশি মডেলের বাংলা ভয়েসওভার স্ক্রিপ্ট:
              </label>
              <textarea
                rows={3}
                value={currentScriptBn}
                onChange={(e) => setCurrentScriptBn(e.target.value)}
                placeholder={`আসসালামু আলাইকুম সবাইকে! আমি ${selectedAvatar.nameBn.split('(')[0].trim()}, আজ আপনাদের সামনে একদম হাতে নিয়ে দেখাচ্ছি ${brandName}-এর অরিজিনাল প্রোডাক্ট...`}
                className="w-full p-3 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 leading-relaxed focus:outline-none focus:border-[#E11D48]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-stone-800">
                🎬 গুগল ফ্লো / ওমনি রিয়েলিস্টিক হিউম্যান ভিডিও প্রম্পট:
              </label>
              <textarea
                rows={3}
                value={currentOmniPrompt}
                onChange={(e) => setCurrentOmniPrompt(e.target.value)}
                placeholder={compiledPromptResult.compiledOmniPrompt}
                className="w-full p-3 rounded-xl bg-white border border-stone-300 text-xs font-mono text-stone-900 leading-relaxed focus:outline-none focus:border-[#E11D48]"
              />
            </div>
          </div>

          {/* Generated Media Gallery */}
          {filteredMedia.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-stone-700 uppercase">
                  জেনারেট করা হিউম্যান ভিডিও ও ফ্রেম গ্যালারি ({filteredMedia.length})
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
                    <div className="aspect-[9/12] bg-[#FFFDF9] relative overflow-hidden">
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.titleBn}
                        className="w-full h-full object-cover bg-white"
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-stone-200">
                        <div className="text-[10px] font-extrabold text-[#E11D48] truncate">
                          👤 {item.avatarNameBn?.split('(')[0] || item.brandName}
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

        {/* RIGHT PANEL: Bengali Human Video Director Agent */}
        <div className="lg:col-span-4 bg-[#FFE4E9]/65 rounded-2xl border-2 border-rose-300 flex flex-col justify-between h-full max-h-[920px] overflow-hidden">
          <div className="p-4 border-b border-rose-300 bg-[#FFF0F3] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E11D48] text-white flex items-center justify-center shadow-2xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-rose-950">
                  হিউম্যান ভিডিও ডিরেক্টর এজেন্ট
                </h3>
                <p className="text-[10px] text-emerald-700 font-bold">
                  UGC • আফটার-বিফোর • আনবক্সিং ফর্ম স্পেশালিস্ট
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
              {autoAgentMode ? '⚡ অটো জেনারেশন চালু' : '✋ ফর্ম রিভিউ মোড'}
            </button>
          </div>

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
                          👤 নির্বাচিত মডেল ও ভিডিও ফরম্যাট:
                        </div>
                        <div className="text-[11px] font-bold text-stone-900 mt-0.5">
                          {selectedAvatar.nameBn.split('(')[0].trim()} • {selectedFormatMeta.shortTagBn}
                        </div>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          {msg.planData.productAnalysisBn}
                        </p>
                      </div>

                      {msg.planData.awaitingApproval && !msg.planData.approved && (
                        <button
                          type="button"
                          onClick={() => handleExecuteRealVideoGeneration(msg.id)}
                          disabled={isGeneratingVideo}
                          className="w-full py-2.5 px-3 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>রিয়েল হিউম্যান ভিডিও জেনারেট করুন</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-stone-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* 4-Scene Realistic Human Storyboard Breakdown */}
            {currentScenes.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white border border-rose-200 space-y-2.5">
                <div className="text-xs font-extrabold text-stone-900">
                  🎬 ৪-দৃশ্যের হিউম্যান স্টোরিবোর্ড ({selectedFormatMeta.shortTagBn}):
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
                    <p className="text-[10.5px] text-stone-600">{sc.visualBn}</p>
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

          <div className="p-4 border-t border-rose-100 bg-white space-y-2.5">
            <div className="flex items-center gap-2">
              <textarea
                rows={2}
                value={userPromptInput}
                onChange={(e) => setUserPromptInput(e.target.value)}
                placeholder="যেমন: নারী মডেল হাতে সাবানটি নিয়ে আফটার-বিফোর স্কিন গ্লো রিভিউ দেবেন..."
                className="flex-1 p-2.5 rounded-xl bg-stone-50 border border-stone-300 text-xs text-stone-900 focus:outline-none focus:border-[#E11D48] resize-none"
              />
              <button
                type="button"
                onClick={handleAskBengaliAgentToPlan}
                disabled={isPlanning || isGeneratingVideo}
                title="হিউম্যান ভিডিও ফর্ম জেনারেট করুন"
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
