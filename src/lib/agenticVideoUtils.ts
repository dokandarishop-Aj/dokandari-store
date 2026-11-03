/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssistantLanguageMode = 'bn_strict' | 'bn_with_tech_tags';

export type HumanVideoFormatId = 'ugc_review' | 'before_after' | 'unboxing' | 'brand_avatar';
export type HumanModelGender = 'female' | 'male';

export interface HumanVideoFormatMeta {
  id: HumanVideoFormatId;
  labelBn: string;
  shortTagBn: string;
  badgeBn: string;
  descriptionBn: string;
  promptDirectiveEn: string;
  cameraStyleBn: string;
  sceneStructureBn: string[];
}

export const HUMAN_VIDEO_FORMATS: HumanVideoFormatMeta[] = [
  {
    id: 'ugc_review',
    labelBn: '🤳 ইউজিএসি হিউম্যান রিভিউ ভিডিও (Realistic UGC Product Review)',
    shortTagBn: 'UGC প্রোডাক্ট রিভিউ',
    badgeBn: 'সবচেয়ে বেশি সেলস কনভার্শন',
    descriptionBn:
      'রিয়েল বাংলাদেশি তরুণ-তরুণী (পুরুষ বা নারী মডেল) ঘরের স্বাভাবিক আলোতে হাতে আসল প্রোডাক্ট নিয়ে সরাসরি ক্যামেরার দিকে তাকিয়ে নিজের বাস্তব অভিজ্ঞতা ও রিভিউ দেবেন—কোনো ডামি বা ক্যাটালগ জুম নয়।',
    promptDirectiveEn:
      'Ultra-realistic handheld iPhone 15 Pro UGC selfie-style product review video. An authentic Bangladeshi South Asian human model with natural skin texture holds the exact physical product in hand, speaking expressively with natural lip-sync, eye contact, and hand gestures in a cozy Dhaka apartment room. Zero catalog slideshow, zero static image zoom.',
    cameraStyleBn:
      'আইফোন ১৫ প্রো ফ্রন্ট-ক্যামেরা হ্যান্ডহেল্ড ইউজিএসি শট (ন্যাচারাল আই-কন্টাক্ট -> হাতে প্রোডাক্ট ক্লোজ-আপ -> লাইভ টেক্সচার ডেমো -> স্মাইলিং আউট্রো)',
    sceneStructureBn: [
      'দৃশ্য ১ (হুক ও হাতে প্রোডাক্ট): বাংলাদেশি মডেল হাতে আসল প্রোডাক্ট নিয়ে ক্যামেরার দিকে তাকিয়ে ন্যাচারাল ইউজিএসি স্টাইলে কথা শুরু করছেন।',
      'দৃশ্য ২ (ক্লোজ-আপ ও কোয়ালিটি টেস্ট): মডেলের হাতে প্রোডাক্টের অরিজিনাল টেক্সচার, ফিনিশিং ও কোয়ালিটি ক্যামেরার সামনে লাইভ দেখানো হচ্ছে।',
      'দৃশ্য ৩ (ব্যবহারের বাস্তব অভিজ্ঞতা): মডেল নিজে প্রোডাক্টটি ব্যবহার করে বা ত্বকে/হাতে ধরে এর আসল কার্যকারিতা ও উপকারিতা দেখাচ্ছেন।',
      'দৃশ্য ৪ (ট্রাস্ট ও ক্যাশ অন ডেলিভারি): মডেল হাসিমুখে প্রোডাক্টটি রিকমেন্ড করছেন এবং দোকানদারি থেকে ক্যাশ অন ডেলিভারিতে অর্ডারের আহ্বান জানাচ্ছেন।',
    ],
  },
  {
    id: 'before_after',
    labelBn: '✨ আফটার-বিফোর ট্রান্সফরমেশন ভিডিও (Before & After Real Result)',
    shortTagBn: 'আফটার-বিফোর ভিডিও',
    badgeBn: 'স্কিনকেয়ার ও ডেকোর ভাইরাল ফরম্যাট',
    descriptionBn:
      'বাংলাদেশি মডেলের প্রোডাক্ট ব্যবহারের আগের অবস্থা (Before) এবং দোকানদারির অরিজিনাল প্রোডাক্ট ব্যবহারের পরের চমৎকার পরিবর্তন (After) রিয়েলিস্টিক হিউম্যান ভিডিওতে তুলনা করে দেখানো হবে।',
    promptDirectiveEn:
      'Photorealistic Before-and-After human transformation commercial video featuring an authentic Bangladeshi South Asian model. Scene 1 shows the relatable BEFORE state with natural lighting; Scene 2 transitions into a vibrant AFTER transformation where the same Bangladeshi model has glowing radiant results while holding and applying the authentic product in hand, speaking naturally with lip-sync.',
    cameraStyleBn:
      'রিয়েলিস্টিক বিফোর-আফটার ট্রান্সফরমেশন শট (ব্যবহারের আগের দৃশ্য -> লাইভ প্রোডাক্ট অ্যাপ্লিকেশন ও স্প্লিট ট্রানজিশন -> ব্যবহারের পরের উজ্জ্বল ফলাফল)',
    sceneStructureBn: [
      'দৃশ্য ১ (BEFORE / ব্যবহারের আগে): বাংলাদেশি মডেল প্রোডাক্ট ব্যবহারের আগের সাধারণ সমস্যাটি বাস্তবসম্মতভাবে তুলে ধরছেন।',
      'দৃশ্য ২ (লাইভ অ্যাপ্লিকেশন ও ট্রানজিশন): মডেল হাতে দোকানদারির আসল প্রোডাক্টটি নিয়ে ব্যবহার করছেন এবং চোখের সামনে বিফোর-থেকে-আফটার পরিবর্তন ঘটছে।',
      'দৃশ্য ৩ (AFTER / ব্যবহারের পরে চমৎকার ফলাফল): প্রোডাক্ট ব্যবহারের পর মডেলের উজ্জ্বল ও সন্তুষ্ট লুক—হাতে প্রোডাক্ট ধরে পার্থক্য দেখাচ্ছেন।',
      'দৃশ্য ৪ (গ্যারান্টি ও অর্ডার আহ্বান): ১০০% অরিজিনাল প্রোডাক্টের নিশ্চয়তা দিয়ে সারা বাংলাদেশে ক্যাশ অন ডেলিভারিতে অর্ডারের আহ্বান।',
    ],
  },
  {
    id: 'unboxing',
    labelBn: '📦 আনবক্সিং ও ওপেন পার্সেল রিভিউ ভিডিও (Realistic Human Unboxing)',
    shortTagBn: 'আনবক্সিং ভিডিও',
    badgeBn: '১০০% কাস্টমার বিশ্বাস তৈরি করে',
    descriptionBn:
      'রিয়েল বাংলাদেশি কাস্টমার/মডেল ক্যামেরার সামনে দোকানদারির ডেলিভারি পার্সেল বক্স খুলে (ওপেন পার্সেল চেক) ভেতর থেকে আসল প্রোডাক্ট বের করে হাতে নিয়ে লাইভ রিভিউ দেবেন।',
    promptDirectiveEn:
      'Ultra-realistic first-person and medium-shot human parcel unboxing video. A real Bangladeshi South Asian creator sits at a table, opens a sealed delivery parcel box on camera, pulls out the authentic packaged product from bubble wrap, inspects the original seal with genuine excitement, and speaks naturally to the camera.',
    cameraStyleBn:
      'রিয়েল হিউম্যান আনবক্সিং ভিউ (ডেলিভারি বক্স ওপেনিং -> বাবল র‍্যাপ থেকে আসল প্রোডাক্ট বের করা -> হাতে নিয়ে ৩৬০° চেক -> সন্তুষ্ট কাস্টমার রিভিউ)',
    sceneStructureBn: [
      'দৃশ্য ১ (পার্সেল রিসিভ ও আনবক্সিং শুরু): বাংলাদেশি মডেল ক্যামেরার সামনে দোকানদারির সিলড ডেলিভারি পার্সেল বক্স দেখিয়ে আনবক্সিং শুরু করছেন।',
      'দৃশ্য ২ (বক্স থেকে আসল প্রোডাক্ট বের করা): পার্সেল খুলে বাবল র‍্যাপ ও প্রিমিয়াম প্যাকেজিং থেকে ১০০% অরিজিনাল প্রোডাক্টটি হাতে বের করে দেখাচ্ছেন।',
      'দৃশ্য ৩ (হাতে নিয়ে কোয়ালিটি ও বারকোড চেক): মডেল প্রোডাক্টটি কাছ থেকে দেখিয়ে বলছেন ডেলিভারি ম্যানের সামনেই চেক করে নেওয়ার সুবিধা রয়েছে।',
      'দৃশ্য ৪ (হ্যাপি কাস্টমার রেকমেন্ডেশন): প্রোডাক্ট হাতে নিয়ে পূর্ণ সন্তুষ্টি প্রকাশ ও দোকানদারি থেকে নির্দ্বিধায় অর্ডার করার পরামর্শ।',
    ],
  },
  {
    id: 'brand_avatar',
    labelBn: '🎙️ দোকানদারি অফিশিয়াল ব্র্যান্ড অবতার ভিডিও (Dokandari Brand Presenter)',
    shortTagBn: 'দোকানদারি ব্র্যান্ড অবতার',
    badgeBn: 'অফিশিয়াল ব্র্যান্ড অ্যাম্বাসেডর',
    descriptionBn:
      'দোকানদারির নিজস্ব বাংলাদেশি পুরুষ বা নারী ব্র্যান্ড অবতার হাতে প্রোডাক্ট নিয়ে সরাসরি ক্যামেরার সামনে প্রাঞ্জল বাংলায় লিপ-সিঙ্কসহ প্রোডাক্টের বিস্তারিত গুণাগুণ তুলে ধরবেন।',
    promptDirectiveEn:
      'Photorealistic 4K commercial presenter video featuring Dokandari official Bangladeshi South Asian brand ambassador holding the exact product in hand, speaking directly to camera with synchronized lip-sync, natural facial expressions, realistic hand movements, and warm studio depth of field.',
    cameraStyleBn:
      'সিনেমাটিক পোর্ট্রেট প্রেজেন্টার শট (মিডিয়াম হিউম্যান শট -> প্রোডাক্ট ইন-হ্যান্ড ক্লোজ ফোকাস -> ব্র্যান্ড অবতার আউট্রো)',
    sceneStructureBn: [
      'দৃশ্য ১ (অফিশিয়াল ব্র্যান্ড অবতার স্বাগতম): দোকানদারির বাংলাদেশি ব্র্যান্ড অবতার হাতে আসল প্রোডাক্ট নিয়ে দর্শকদের স্বাগত জানাচ্ছেন।',
      'দৃশ্য ২ (লাইভ ফিচার ও অরিজিনাল কোয়ালিটি বিশ্লেষণ): অবতার প্রোডাক্টটি ক্যামেরার সামনে ঘুরিয়ে এর প্রতিটি প্রিমিয়াম বৈশিষ্ট্য ব্যাখ্যা করছেন।',
      'দৃশ্য ৩ (কেন দোকানদারি সেরা): প্রতারণামুক্ত ১০০% অরিজিনাল প্রোডাক্ট ও ওপেন পার্সেল ক্যাশ অন ডেলিভারি সুবিধার নিশ্চয়তা।',
      'দৃশ্য ৪ (কল-টু-অ্যাকশন): অফার মূল্যে আজই অর্ডার করার জন্য সরাসরি আমন্ত্রণ।',
    ],
  },
];

export interface PromptBuilderConfig {
  template: string;
  brandName: string;
  brandSlogan: string;
  showroomStylePrompt: string;
  showroomLabelBn: string;
  avatarNameBn: string;
  avatarPersonaPrompt: string;
  productTitle: string;
  productPrice: string;
  imageCount: number;
  aspectRatio: '9:16' | '16:9';
  duration: '5s' | '10s';
  videoFormat?: HumanVideoFormatId;
  modelGender?: HumanModelGender;
}

export interface BengaliSystemPromptParams {
  brandName: string;
  brandSlogan: string;
  showroomStyleBn: string;
  avatarNameBn: string;
  avatarDescBn: string;
  productTitle?: string;
  productPrice?: string;
  imageCount: number;
  aspectRatio: '9:16' | '16:9';
  duration: '5s' | '10s';
  autoAgentMode: boolean;
  userCommandBn?: string;
  videoFormat?: HumanVideoFormatId;
  modelGender?: HumanModelGender;
}

export interface StoreAgentLogEntry {
  id: string;
  timestampBn: string;
  categoryBn:
    | 'সিস্টেম নির্দেশিকা'
    | 'ক্যাটালগ চিত্র বিশ্লেষণ'
    | 'শোরুম ব্র্যান্ডিং লক'
    | 'চিত্রনাট্য ও অনুমোদন'
    | 'ভিডিও রেন্ডারিং'
    | 'স্টোর ক্যাটালগ সিঙ্ক';
  messageBn: string;
  status: 'info' | 'success' | 'warning';
}

export const STORE_MANAGEMENT_TERMINOLOGY_BN = {
  studioTitle: 'দোকানদারি রিয়েলিস্টিক হিউম্যান ভিডিও ও ব্র্যান্ড অবতার স্টুডিও',
  studioSubtitle:
    'বাংলাদেশি পুরুষ ও নারী মডেল • ইউজিএসি রিভিউ • আফটার-বিফোর • আনবক্সিং ভিডিও ও গুগল ফ্লো প্রোডাকশন ফর্ম',
  approvalModeLabel: 'প্রশাসনিক অনুমোদন মোড (ফর্ম ও স্ক্রিপ্ট যাচাই পূর্বক রিয়েল হিউম্যান ভিডিও নির্মাণ)',
  autoAgentModeLabel: 'স্বয়ংক্রিয় এজেন্ট মোড (১-ক্লিকে সরাসরি রিয়েলিস্টিক হিউম্যান ভিডিও উৎপাদন)',
  brandPlaceholderLabel: 'ব্র্যান্ডের নাম (দোকানদারি ব্র্যান্ডিং ও ভয়েসওভারে ব্যবহৃত হবে) *',
  sloganPlaceholderLabel: 'ডেলিভারি ও ট্রাস্ট গ্যারান্টি ট্যাগলাইন',
  showroomBackdropLabel: 'ভিডিওর পরিবেশ ও ব্যাকগ্রাউন্ড সেটিং',
  virtualAvatarLabel: 'দোকানদারি বাংলাদেশি ব্র্যান্ড অবতার (পুরুষ / নারী মডেল)',
  imageUploaderHeader: 'প্রোডাক্টের ১ থেকে ৪টি আসল ছবি নির্বাচন করুন (মডেলের হাতে দেখানোর জন্য)',
  imageUploaderSubheader:
    'এজেন্ট প্রোডাক্টের ছবি বিশ্লেষণ করে বাংলাদেশি মডেলের হাতে ইউজিএসি রিভিউ, আফটার-বিফোর বা আনবক্সিং ভিডিওর ফর্ম ও প্রম্পট তৈরি করবে',
  promptBuilderHeader:
    'রিয়েলিস্টিক হিউম্যান ভিডিও প্রম্পট-বিল্ডার ইঞ্জিন (জিরো ক্যাটালগ জুম • ১০০% হিউম্যান মডেল)',
  agentPanelHeader: 'দোকানদারি হিউম্যান ভিডিও ডিরেক্টর এজেন্ট',
  agentPanelSubheader: '• বাংলাদেশি মডেল ইউজিএসি, আফটার-বিফোর ও আনবক্সিং ভিডিও স্পেশালিস্ট',
  activityLogHeader: 'ভিডিও প্রোডাকশন ও এজেন্ট লগ',
} as const;

export const PRODUCT_IMAGE_SLOT_META = [
  {
    index: 0,
    tag: '<IMAGE_REF_0>',
    codeBn: 'প্রোডাক্ট ছবি #১',
    labelBn: 'ছবি #১: মূল প্রোডাক্ট (মডেলের হাতে থাকবে)',
    hintBn: 'বাংলাদেশি মডেলের হাতে সরাসরি দেখানোর জন্য',
  },
  {
    index: 1,
    tag: '<IMAGE_REF_1>',
    codeBn: 'প্রোডাক্ট ছবি #২',
    labelBn: 'ছবি #২: টেক্সচার / ভেতরের অংশ',
    hintBn: 'ক্লোজ-আপ ডেমো ও আনবক্সিং দৃশ্যের জন্য',
  },
  {
    index: 2,
    tag: '<IMAGE_REF_2>',
    codeBn: 'প্রোডাক্ট ছবি #৩',
    labelBn: 'ছবি #৩: প্যাকেজিং ও অরিজিনাল সিল',
    hintBn: 'আনবক্সিং ও আসল পণ্যের প্রমাণের জন্য',
  },
  {
    index: 3,
    tag: '<IMAGE_REF_3>',
    codeBn: 'প্রোডাক্ট ছবি #৪',
    labelBn: 'ছবি #৪: আফটার-বিফোর / ব্যবহারের ফলাফল',
    hintBn: 'ব্যবহারের পরের চমৎকার ফলাফল দেখানোর জন্য',
  },
];

export const DEFAULT_SHOWROOM_PROMPT_TEMPLATE = `Ultra-realistic {{ASPECT_RATIO}} ({{DURATION}}, 720p) human product video for "{{BRAND_NAME}}". Authentic Bangladeshi South Asian model ({{AVATAR_PERSONA}}) in {{SHOWROOM_STYLE}} holding and demonstrating the real physical product "{{PRODUCT_TITLE}}" (Price: ৳{{PRODUCT_PRICE}}) from {{IMAGE_REFS}} in their hands. Natural human skin texture, expressive lip-sync speaking Bengali, authentic hand movements, real-life UGC/review cinematography. STRICT RULE: Do NOT make a static catalog image slideshow or simple zoom-in/zoom-out; the Bangladeshi human model must be actively reviewing/unboxing/applying the product on camera.`;

/**
 * Generates a 100% Bengali System Instruction for the Gemini model focused on
 * Realistic Bangladeshi Human Videos (UGC Review, Before-After, Unboxing, Brand Avatar).
 */
export function buildBengaliGeminiSystemInstruction(params: BengaliSystemPromptParams): string {
  const brand = params.brandName || 'দোকানদারি (Dokandari)';
  const slogan =
    params.brandSlogan || '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি';
  const formatMeta =
    HUMAN_VIDEO_FORMATS.find((f) => f.id === params.videoFormat) || HUMAN_VIDEO_FORMATS[0];
  const genderLabelBn = params.modelGender === 'male' ? 'বাংলাদেশি পুরুষ মডেল' : 'বাংলাদেশি নারী মডেল';

  return `আপনি "${brand}" প্ল্যাটফর্মের প্রধান রিয়েলিস্টিক হিউম্যান ভিডিও ডিরেক্টর ও গুগল ফ্লো (Google Flow / Veo 3 / Gemini Omni 1.1) প্রম্পট ইঞ্জিনিয়ার এজেন্ট।
আপনার জন্য বাধ্যতামূলক নির্দেশাবলি:
১. কোনো ক্যাটালগ বা সাধারণ শোকেস ভিডিও নয়: কখনোই সাধারণ প্রোডাক্ট ক্যাটালগ বা শুধু ছবির জুম-ইন/জুম-আউট স্লাইডশো ভিডিও তৈরি করবেন না। প্রতিটি ভিডিও হতে হবে ১০০% রিয়েলিস্টিক হিউম্যান ভিডিও, যেখানে একজন বাস্তব "${genderLabelBn}" (${params.avatarNameBn} — ${params.avatarDescBn}) নিজের হাতে প্রোডাক্টটি ধরে ক্যামেরার সামনে জীবন্তভাবে রিভিউ, আনবক্সিং বা আফটার-বিফোর ফলাফল দেখাবেন।
২. নির্বাচিত ভিডিও ফরম্যাট: বর্তমান ভিডিওর ধরন হলো "${formatMeta.labelBn}" (${formatMeta.descriptionBn})।
৩. ভাষা ও উপস্থাপনা: আপনার তৈরি করা ভয়েসওভার স্ক্রিপ্ট ও দৃশ্যপট অবশ্যই ১০০% স্বাভাবিক, বিশ্বাসযোগ্য ও প্রাঞ্জল বাংলাদেশি বাংলায় হতে হবে—যেন একজন সত্যিকারের মানুষ ক্যামেরার সামনে দাঁড়িয়ে কথা বলছেন।
৪. গুগল ফ্লো ও ওমনি এক্সিকিউটেবল প্রম্পট: ভিডিও জেনারেশন প্রম্পটে স্পষ্টভাবে উল্লেখ করবেন যে বাংলাদেশি/সাউথ এশিয়ান মডেল হাতে <IMAGE_REF_0> প্রোডাক্টটি ধরে আছেন, তার মুখের স্বাভাবিক অভিব্যক্তি ও লিপ-সিঙ্ক হচ্ছে, এবং ক্যামেরা হ্যান্ডহেল্ড রিয়েলিস্টিক মোশনে দৃশ্য ধারণ করছে।`;
}

/**
 * Generates a 100% Bengali User Prompt for the Gemini multimodal analysis & human video form planner.
 */
export function buildBengaliAgentUserPrompt(params: BengaliSystemPromptParams): string {
  const brand = params.brandName || 'দোকানদারি (Dokandari)';
  const slogan =
    params.brandSlogan || '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি';
  const count = Math.max(1, params.imageCount || 1);
  const ratioBn = params.aspectRatio === '16:9' ? '১৬:৯ ওয়াইডস্ক্রিন' : '৯:১৬ ভার্টিক্যাল রিলস/টিকটক';
  const durBn = params.duration === '5s' ? '৫ সেকেন্ড' : '১০ সেকেন্ড';
  const formatMeta =
    HUMAN_VIDEO_FORMATS.find((f) => f.id === params.videoFormat) || HUMAN_VIDEO_FORMATS[0];
  const genderLabelBn = params.modelGender === 'male' ? 'বাংলাদেশি পুরুষ মডেল (Male)' : 'বাংলাদেশি নারী মডেল (Female)';

  return `রিয়েলিস্টিক হিউম্যান ভিডিও নির্মাণের নির্দেশনা (ক্যাটালগ বা শোকেস জুম সম্পূর্ণ নিষিদ্ধ):
- ব্র্যান্ড: "${brand}" (${slogan})
- ভিডিওর ধরন (Format): "${formatMeta.labelBn}"
- মডেলের লিঙ্গ ও পরিচয়: ${genderLabelBn} — "${params.avatarNameBn}" (${params.avatarDescBn})
- শুটিং পরিবেশ: "${params.showroomStyleBn}"
- পণ্যের নাম ও মূল্য: "${params.productTitle || 'নির্বাচিত অরিজিনাল পণ্য'}" ${
    params.productPrice ? `(মূল্য: ৳${params.productPrice})` : ''
  }
- সংযুক্ত পণ্যের রেফারেন্স ছবি: ${count}টি
- ভিডিওর অনুপাত ও সময়কাল: ${ratioBn}, ${durBn}
- বিশেষ নির্দেশনা: "${
    params.userCommandBn ||
    `কোনো ডামি বা ক্যাটালগ শোকেস নয়—একজন বাস্তব ${genderLabelBn} হাতে প্রোডাক্টটি নিয়ে ক্যামেরার সামনে দাঁড়িয়ে "${formatMeta.shortTagBn}" করছেন এমন ৪টি দৃশ্যের রিয়েলিস্টিক ভিডিও ফর্ম, বাংলা ভয়েসওভার স্ক্রিপ্ট ও Google Flow / Omni প্রম্পট তৈরি করুন।`
  }"

অনুগ্রহ করে নিচের JSON কাঠামোতে উত্তর প্রদান করুন:
১. "detectedProductBn": চিত্রে দৃশ্যমান পণ্যের সঠিক নাম ও ধরন।
২. "productAnalysisBn": ২-৩ বাক্যে পণ্যের মূল উপকারিতা এবং কেন এটি "${formatMeta.shortTagBn}" ভিডিওর মাধ্যমে দেখালে ক্রেতারা ১০০% বিশ্বাস করবেন তার বিশ্লেষণ।
৩. "agentMessageBn": অ্যাডমিনের উদ্দেশ্যে বার্তা—জানান যে ক্যাটালগ জুম বাদ দিয়ে বাস্তব ${genderLabelBn} (${params.avatarNameBn})-কে দিয়ে "${formatMeta.shortTagBn}" ফরম্যাটে রিয়েলিস্টিক হিউম্যান ভিডিওর ফর্ম ও স্ক্রিপ্ট প্রস্তুত করা হয়েছে।
৪. "spokenScriptBn": ${params.avatarNameBn}-এর কণ্ঠে ১০ সেকেন্ডের অত্যন্ত ন্যাচারাল, জীবন্ত ও বিশ্বাসযোগ্য বাংলা ভয়েসওভার স্ক্রিপ্ট (${formatMeta.shortTagBn} স্টাইলে—যেখানে মডেল নিজের হাতে প্রোডাক্টটি দেখিয়ে কথা বলছেন এবং "${brand}" থেকে ক্যাশ অন ডেলিভারিতে অর্ডারের কথা বলছেন)।
৫. "omniVideoPrompt": Google Flow (Veo 3) ও Gemini Omni 1.1 Flash-এর জন্য হাই-রিয়েলিস্টিক হিউম্যান ভিডিও প্রম্পট (ইংরেজি ও <IMAGE_REF_0> ট্যাগসহ যাতে মডেল, ন্যাচারাল স্কিন টেক্সচার, লিপ-সিঙ্ক, হাতে প্রোডাক্ট ধরা এবং "${formatMeta.promptDirectiveEn}" একদম নিখুঁতভাবে রেন্ডার হয়)।
৬. "scenes": ৪টি ধারাবাহিক রিয়েলিস্টিক হিউম্যান দৃশ্যের তালিকা:
   - "sceneNumber": দৃশ্য নম্বর (১, ২, ৩, ৪)
   - "timeRange": সময়সীমা ("০০:০০ - ০০:০৩ সেকেন্ড" ইত্যাদি)
   - "visualBn": দৃশ্যে বাংলাদেশি মডেল কীভাবে প্রোডাক্টটি হাতে ধরে দেখাচ্ছেন, আনবক্সিং করছেন বা আফটার-বিফোর ফলাফল প্রদর্শন করছেন তার জীবন্ত বিবরণ
   - "dialogueBn": উক্ত দৃশ্যে মডেলের মুখের বাংলা সংলাপ।`;
}

export function enforceBengaliStoreManagementText(
  rawText: string,
  options?: { preserveImageRefTags?: boolean }
): string {
  if (!rawText) return '';

  const protectedTags: string[] = [];
  let working = rawText;
  if (options?.preserveImageRefTags) {
    working = working.replace(/<IMAGE_REF_\d+>/g, (match) => {
      protectedTags.push(match);
      return `__IMG_TAG_${protectedTags.length - 1}__`;
    });
  }

  const replacements: Array<[RegExp, string]> = [
    [/I've started generating your .*? video.*?!/gi, 'আপনার রিয়েলিস্টিক হিউম্যান ভিডিও রেন্ডারিং প্রক্রিয়া শুরু হয়েছে!'],
    [/waiting in the queue due to high demand\.?/gi, 'সার্ভারে উচ্চ চাহিদার কারণে রেন্ডারিং সারিতে প্রক্রিয়াধীন রয়েছে।'],
    [/Feel free to check back in a few minutes!?/gi, 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন, স্বয়ংক্রিয়ভাবে ফলাফল প্রদর্শিত হবে।'],
    [/\bApproval Mode\b/gi, 'প্রশাসনিক অনুমোদন মোড'],
    [/\bAuto Agent Mode\b/gi, 'স্বয়ংক্রিয় এজেন্ট মোড'],
    [/\bQueued\b/gi, 'প্রক্রিয়াকরণ সারিতে অপেক্ষমাণ'],
    [/\bIn Progress\b/gi, 'রেন্ডারিং চলমান'],
    [/\bCompleted\b/gi, 'সম্পন্ন'],
  ];

  for (const [pattern, replacementBn] of replacements) {
    working = working.replace(pattern, replacementBn);
  }

  if (options?.preserveImageRefTags) {
    working = working.replace(/__IMG_TAG_(\d+)__/g, (_, idx) => protectedTags[Number(idx)] || '');
  }

  return working.trim();
}

export function enforceBengaliAssistantOutput(
  rawText: string,
  context: {
    brandName: string;
    productTitle?: string;
    duration?: '5s' | '10s';
    aspectRatio?: '9:16' | '16:9';
    mode?: AssistantLanguageMode;
  }
): string {
  const trimmed = (rawText || '').trim();
  const brand = context.brandName || 'দোকানদারি';
  const prod = context.productTitle || 'নির্বাচিত পণ্য';
  const durBn = context.duration === '5s' ? '৫-সেকেন্ডের' : '১০-সেকেন্ডের';
  const ratioBn =
    context.aspectRatio === '16:9' ? 'ওয়াইডস্ক্রিন (১৬:৯)' : 'ভার্টিক্যাল রিলস (৯:১৬)';

  if (!trimmed) {
    return `আসসালামু আলাইকুম! আমি আপনার "${brand}" ব্র্যান্ডের "${prod}"-এর জন্য বাংলাদেশি মডেলের হাতে ${durBn} ${ratioBn} রিয়েলিস্টিক হিউম্যান ভিডিওর ফর্ম ও বাংলা স্ক্রিপ্ট প্রস্তুত করেছি।`;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("i've started generating") ||
    lower.includes('waiting in the queue') ||
    lower.includes('feel free to check back')
  ) {
    return `🎬 "${prod}" পণ্যের জন্য বাংলাদেশি মডেলের ${durBn} ${ratioBn} রিয়েলিস্টিক হিউম্যান ভিডিও রেন্ডারিং শুরু হয়েছে! অনুগ্রহ করে কয়েক মুহূর্ত অপেক্ষা করুন।`;
  }

  if (lower.includes('violates our policy') || lower.includes('refund')) {
    return `⚠️ প্রম্পট নির্দেশনাটি পরিমার্জন করে বাংলাদেশি মডেলের মাধ্যমে "${brand}"-এর রিয়েলিস্টিক হিউম্যান রিভিউ ভিডিও প্রস্তুত করা হচ্ছে।`;
  }

  return enforceBengaliStoreManagementText(trimmed, {
    preserveImageRefTags: true,
  });
}

export function buildBrandConsistentPrompt(config: PromptBuilderConfig): {
  compiledOmniPrompt: string;
  compiledSummaryBn: string;
  imageRefTags: string[];
} {
  const count = Math.max(1, Math.min(4, config.imageCount || 1));
  const imageRefTags = Array.from({ length: count }, (_, idx) => `<IMAGE_REF_${idx}>`);
  const refsJoined = imageRefTags.join(', ');
  const formatMeta =
    HUMAN_VIDEO_FORMATS.find((f) => f.id === config.videoFormat) || HUMAN_VIDEO_FORMATS[0];
  const genderWord = config.modelGender === 'male' ? 'Bangladeshi male model' : 'Bangladeshi female model';

  const compiledOmniPrompt = `${formatMeta.promptDirectiveEn} Featured presenter: ${genderWord} (${config.avatarPersonaPrompt}) inside ${config.showroomStylePrompt}. The model is actively holding, demonstrating, and reviewing the authentic product "${config.productTitle || 'Dokandari Original Product'}" (Price: ৳${config.productPrice || '৬৯৯'}) shown in ${refsJoined} for brand "${config.brandName}". Aspect Ratio: ${config.aspectRatio}, Duration: ${config.duration}. Natural human motion, realistic lip-sync, zero static catalog zoom.`;

  const compiledSummaryBn = `👤 রিয়েলিস্টিক হিউম্যান ভিডিও লক (${formatMeta.shortTagBn}): ${config.avatarNameBn} হাতে আপনার নির্বাচিত প্রোডাক্ট (${refsJoined}) নিয়ে জীবন্তভাবে ক্যামেরার সামনে রিভিউ ও ডেমোনস্ট্রেশন দেবেন—কোনো ডামি বা ক্যাটালগ স্লাইডশো হবে না।`;

  return {
    compiledOmniPrompt,
    compiledSummaryBn,
    imageRefTags,
  };
}

export function createStoreAgentLogEntry(
  categoryBn: StoreAgentLogEntry['categoryBn'],
  messageBn: string,
  status: StoreAgentLogEntry['status'] = 'info'
): StoreAgentLogEntry {
  return {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestampBn: new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    categoryBn,
    messageBn: enforceBengaliStoreManagementText(messageBn, { preserveImageRefTags: true }),
    status,
  };
}
