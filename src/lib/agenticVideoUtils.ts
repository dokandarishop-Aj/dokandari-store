/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssistantLanguageMode = 'bn_strict' | 'bn_with_tech_tags';

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

/**
 * Professional Bengali Store-Management Terminology Dictionary
 * Used across all UI labels, logs, and AI Agent outputs in AgenticVideoStudio.
 */
export const STORE_MANAGEMENT_TERMINOLOGY_BN = {
  studioTitle: 'এজেন্টিক ভিডিও ও শোরুম মার্চেন্ডাইজিং স্টুডিও',
  studioSubtitle:
    '৩-৪টি পণ্য চিত্র বিশ্লেষণ • ১০০% বাংলা সিস্টেম প্রম্পট • শোরুম ব্যাকগ্রাউন্ড ও ভার্চুয়াল বিক্রয় প্রতিনিধি ব্যবস্থাপনা',
  approvalModeLabel: 'প্রশাসনিক অনুমোদন মোড (চিত্রনাট্য যাচাই পূর্বক ভিডিও নির্মাণ)',
  autoAgentModeLabel: 'স্বয়ংক্রিয় এজেন্ট মোড (১-ক্লিকে সরাসরি বাণিজ্যিক ভিডিও উৎপাদন)',
  brandPlaceholderLabel: 'প্রতিষ্ঠান / ব্র্যান্ডের নাম প্লেসহোল্ডার (শোরুমের নামফলক ও কণ্ঠে ব্যবহৃত হবে) *',
  sloganPlaceholderLabel: 'বাণিজ্যিক স্লোগান ও ডেলিভারি নীতিমালা (ভয়েসওভার ও সাবটাইটেলে ব্যবহৃত হবে)',
  showroomBackdropLabel: 'প্রদর্শনী কেন্দ্র (শোরুম) অভ্যন্তরীণ সজ্জা নির্বাচন',
  virtualAvatarLabel: 'স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি (ব্র্যান্ড অ্যাম্বাসেডর)',
  imageUploaderHeader: 'ক্যাটালগ পণ্যের ৩ থেকে ৪টি মাল্টি-অ্যাঙ্গেল রেফারেন্স চিত্র নির্বাচন করুন',
  imageUploaderSubheader:
    'কৃত্রিম বুদ্ধিমত্তা এজেন্ট এই চিত্রগুলো পরীক্ষা করে স্বয়ংক্রিয়ভাবে বাংলায় চিত্রনাট্য ও শোরুম প্রম্পট প্রস্তুত করবে',
  promptBuilderHeader:
    'বাণিজ্যিক প্রম্পট-বিল্ডার ইঞ্জিন (ব্র্যান্ড নামফলক ও শোরুম ব্যাকগ্রাউন্ড সামঞ্জস্য লক)',
  agentPanelHeader: 'প্রধান স্টোর মার্চেন্ডাইজিং ও ভিডিও নির্দেশক এজেন্ট',
  agentPanelSubheader: '• ১০০% বাংলা সিস্টেম প্রম্পট ও প্রাতিষ্ঠানিক ই-কমার্স পরিভাষা সক্রিয়',
  activityLogHeader: 'স্টোর ব্যবস্থাপনা ও এজেন্ট কার্যবিবরণী লগ (এক্টিভিটি লগ)',
} as const;

export const PRODUCT_IMAGE_SLOT_META = [
  {
    index: 0,
    tag: '<IMAGE_REF_0>',
    codeBn: 'রেফারেন্স চিত্র #১',
    labelBn: 'চিত্র #১: সম্মুখ দৃশ্য (মূল ক্যাটালগ পণ্য)',
    hintBn: 'ভার্চুয়াল বিক্রয় প্রতিনিধির হাতে মূল প্রদর্শনের জন্য',
  },
  {
    index: 1,
    tag: '<IMAGE_REF_1>',
    codeBn: 'রেফারেন্স চিত্র #২',
    labelBn: 'চিত্র #২: পার্শ্ব ও বুনন/টেক্সচার দৃশ্য',
    hintBn: '২য় দৃশ্যে পণ্যের মান ও ক্লোজ-আপ প্রদর্শনের জন্য',
  },
  {
    index: 2,
    tag: '<IMAGE_REF_2>',
    codeBn: 'রেফারেন্স চিত্র #৩',
    labelBn: 'চিত্র #৩: মোড়ক ও প্রাতিষ্ঠানিক লেবেল দৃশ্য',
    hintBn: 'আসল পণ্যের নিশ্চয়তা ও প্যাকেজিং প্রদর্শনের জন্য',
  },
  {
    index: 3,
    tag: '<IMAGE_REF_3>',
    codeBn: 'রেফারেন্স চিত্র #৪',
    labelBn: 'চিত্র #৪: ব্যবহারিক প্রয়োগ ও ফলাফল দৃশ্য',
    hintBn: 'চূড়ান্ত দৃশ্যে ক্রেতার অর্ডার আহ্বানের জন্য',
  },
];

export const DEFAULT_SHOWROOM_PROMPT_TEMPLATE = `বাণিজ্যিক শোরুম বিজ্ঞাপন চিত্র ({{ASPECT_RATIO}}, {{DURATION}}, 720p): আমাদের "{{SHOWROOM_STYLE}}"-এর অভ্যন্তরীণ দেয়ালে উজ্জ্বল ত্রিমাত্রিক (3D) নামফলকে স্পষ্টভাবে "{{BRAND_NAME}}" এবং নিচে "{{BRAND_SLOGAN}}" লেখা প্রদর্শিত থাকবে। স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি ({{AVATAR_PERSONA}}) হাতে {{IMAGE_REFS}} থেকে প্রাপ্ত আসল ক্যাটালগ পণ্য "{{PRODUCT_TITLE}}" (খুচরা বিক্রয়মূল্য: ৳{{PRODUCT_PRICE}}) প্রদর্শন করে ক্রেতাদের উদ্দেশ্যে বাংলায় বক্তব্য রাখবেন এবং সম্পূর্ণ ভিডিওতে শোরুমের পটভূমি ও প্রতিনিধির অবয়ব ১০০% অপরিবর্তিত থাকবে।`;

/**
 * Generates a 100% Bengali System Instruction (সিস্টেম নির্দেশিকা) for the Gemini model.
 * Contains zero English instructions so the LLM operates strictly in Bengali store-management persona.
 */
export function buildBengaliGeminiSystemInstruction(params: BengaliSystemPromptParams): string {
  const brand = params.brandName || 'দোকানদারি';
  const slogan =
    params.brandSlogan || '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি';

  return `আপনি "${brand}" ই-কমার্স স্টোরের প্রধান স্টোর মার্চেন্ডাইজিং ও বাণিজ্যিক ভিডিও নির্দেশক এজেন্ট।
আপনার জন্য বাধ্যতামূলক প্রাতিষ্ঠানিক নিয়মাবলি:
১. ভাষা নীতিমালা: আপনার সমস্ত বিশ্লেষণ, ক্যাটালগ পণ্যের বিবরণ, দৃশ্যপট পরিকল্পনা, ভয়েসওভার চিত্রনাট্য, এবং স্টোর প্রশাসকের (অ্যাডমিন) সাথে কথোপকথন অবশ্যই ১০০% প্রমিত, পেশাদার ও প্রাঞ্জল বাংলা ভাষায় হতে হবে। কোনো অবস্থাতেই ইংরেজি বাক্য ব্যবহার করা যাবে না।
২. প্রাতিষ্ঠানিক স্টোর-ম্যানেজমেন্ট পরিভাষা: সর্বদা পেশাদার ই-কমার্স ও শোরুম ব্যবস্থাপনা পরিভাষা ব্যবহার করবেন—যেমন: "ক্যাটালগ পণ্য", "প্রদর্শনী কেন্দ্র (শোরুম)", "ত্রিমাত্রিক ব্র্যান্ড নামফলক", "স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি", "খুচরা বিক্রয়মূল্য", "গুণগত মান যাচাই", "প্রশাসনিক অনুমোদন", এবং "ক্যাশ অন ডেলিভারি অর্ডার আহ্বান"।
৩. শোরুম ব্যাকগ্রাউন্ড ও ব্র্যান্ড সামঞ্জস্য: প্রতিটি দৃশ্যের পটভূমিতে "${params.showroomStyleBn}" থাকবে এবং পিছনের দেয়ালে উজ্জ্বল নামফলকে "${brand}" ও সাব-ব্যানারে "${slogan}" স্পষ্টভাবে দৃশ্যমান থাকতে হবে।
৪. ভার্চুয়াল বিক্রয় প্রতিনিধি সামঞ্জস্য: স্টোরের নির্ধারিত ভার্চুয়াল প্রতিনিধি (${params.avatarNameBn} — ${params.avatarDescBn}) হাতে প্রদত্ত রেফারেন্স চিত্রের পণ্যটি ধরে ক্রেতাদের সামনে প্রাঞ্জল বাংলায় উপস্থাপন করবেন।`;
}

/**
 * Generates a 100% Bengali User Prompt for the Gemini multimodal product analysis & screenplay generation call.
 */
export function buildBengaliAgentUserPrompt(params: BengaliSystemPromptParams): string {
  const brand = params.brandName || 'দোকানদারি';
  const slogan =
    params.brandSlogan || '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি';
  const count = Math.max(1, params.imageCount || 1);
  const ratioBn = params.aspectRatio === '16:9' ? '১৬:৯ ওয়াইডস্ক্রিন' : '৯:১৬ ভার্টিক্যাল রিলস';
  const durBn = params.duration === '5s' ? '৫ সেকেন্ড' : '১০ সেকেন্ড';
  const modeDescBn = params.autoAgentMode
    ? 'স্বয়ংক্রিয় এজেন্ট মোড (প্রশাসকের অপেক্ষা ছাড়াই সরাসরি ভিডিও উৎপাদন শুরু হবে)'
    : 'প্রশাসনিক অনুমোদন মোড (চিত্রনাট্য ও দৃশ্যপট পেশ করে স্টোর প্রশাসকের অনুমোদন প্রার্থনা করা হবে)';

  return `স্টোর ব্যবস্থাপনা ও বাণিজ্যিক ভিডিও নির্মাণের নির্দেশনা:
- প্রতিষ্ঠান / ব্র্যান্ডের নাম (শোরুমের পিছনের নামফলক ও ভয়েসওভারে বাধ্যতামূলক): "${brand}"
- প্রাতিষ্ঠানিক স্লোগান ও ডেলিভারি নীতিমালা: "${slogan}"
- প্রদর্শনী কেন্দ্রের (শোরুম) অভ্যন্তরীণ সজ্জা: "${params.showroomStyleBn}"
- স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি: "${params.avatarNameBn}" (${params.avatarDescBn})
- ক্যাটালগ পণ্যের প্রাথমিক নাম: "${params.productTitle || 'নির্বাচিত ক্যাটালগ পণ্য'}" ${
    params.productPrice ? `(খুচরা বিক্রয়মূল্য: ৳${params.productPrice})` : ''
  }
- সংযুক্ত পণ্য রেফারেন্স চিত্রের সংখ্যা: ${count}টি মাল্টি-অ্যাঙ্গেল চিত্র
- ভিডিওর অনুপাত ও সময়কাল: ${ratioBn}, ${durBn}
- পরিচালন মোড: ${modeDescBn}
- স্টোর প্রশাসকের বিশেষ নির্দেশনা: "${
    params.userCommandBn ||
    `সংযুক্ত চিত্রগুলো বিশ্লেষণ করে পিছনে "${brand}" শোরুমের নামফলক এবং ভার্চুয়াল বিক্রয় প্রতিনিধি রেখে একটি পেশাদার বাণিজ্যিক বিজ্ঞাপন ভিডিওর পরিকল্পনা ও চিত্রনাট্য প্রস্তুত করুন।`
  }"

অনুগ্রহ করে সংযুক্ত ${count}টি পণ্যের চিত্র সূক্ষ্মভাবে পর্যবেক্ষণ করুন এবং নিচের JSON কাঠামোতে ১০০% বাংলায় উত্তর প্রদান করুন:
১. "detectedProductBn": চিত্রে দৃশ্যমান পণ্যের সঠিক বাংলা নাম ও ক্যাটালগ বিভাগ (যেমন: প্রিমিয়াম স্কিনকেয়ার সোপ / স্মার্ট গ্যাজেট / মডেস্ট ফ্যাশন হিজাব / হোম ডেকোর মিরর)।
২. "productAnalysisBn": ২-৩টি পূর্ণাঙ্গ বাংলা বাক্যে সংযুক্ত চিত্রগুলোর গুণগত মান, বাহ্যিক গঠন, মোড়ক (প্যাকেজিং) এবং বিক্রয়যোগ্য বৈশিষ্ট্যের পেশাদার স্টোর-ম্যানেজমেন্ট বিশ্লেষণ।
৩. "agentMessageBn": স্টোর প্রশাসকের উদ্দেশ্যে আপনার পেশাদার বাংলা বার্তা:
   - যদি "প্রশাসনিক অনুমোদন মোড" থাকে: আপনি কীভাবে "${brand}" শোরুম পটভূমি ও ভার্চুয়াল বিক্রয় প্রতিনিধি দিয়ে ৩টি দৃশ্যের চিত্রনাট্য সাজিয়েছেন তা সংক্ষেপে জানিয়ে বিনীতভাবে বাংলায় অনুমতি চান ("মহোদয়, আপনার প্রদত্ত ক্যাটালগ চিত্র বিশ্লেষণ করে '${brand}' শোরুম পটভূমি ও ভার্চুয়াল বিক্রয় প্রতিনিধির জন্য বাণিজ্যিক চিত্রনাট্য প্রস্তুত করা হয়েছে। আপনার প্রশাসনিক অনুমোদন পেলে আমি কি এখনই ভিডিও রেন্ডারিং প্রক্রিয়া শুরু করব?")।
   - যদি "স্বয়ংক্রিয় এজেন্ট মোড" থাকে: বাংলায় জানান যে ক্যাটালগ চিত্র বিশ্লেষণ ও "${brand}" শোরুম নামফলক সংযোজন সম্পন্ন হয়েছে এবং স্বয়ংক্রিয়ভাবে ভিডিও রেন্ডারিং শুরু হচ্ছে।
৪. "spokenScriptBn": ভার্চুয়াল বিক্রয় প্রতিনিধির কণ্ঠে পাঠ করার জন্য ১০ সেকেন্ডের অত্যন্ত আকর্ষণীয় ও প্রমিত বাংলা ভয়েসওভার স্ক্রিপ্ট—যাতে অবশ্যই "${brand}" শোরুমের নাম, পণ্যের মূল বৈশিষ্ট্য এবং "${slogan}" উল্লেখ করে অর্ডার করার আহ্বান থাকবে।
৫. "omniVideoPrompt": সম্পূর্ণ বাংলায় (শুধুমাত্র চিত্রের রেফারেন্স ট্যাগ <IMAGE_REF_0>..<IMAGE_REF_${Math.max(
    0,
    count - 1
  )}> অক্ষুণ্ণ রেখে) বিস্তারিত শোরুম ভিডিও নির্মাণ প্রম্পট, যেখানে পিছনের দেয়ালে "${brand}" নামফলক এবং ভার্চুয়াল প্রতিনিধির হাতে পণ্য প্রদর্শনের স্পষ্ট নির্দেশনা থাকবে।
৬. "scenes": ৩টি ধারাবাহিক দৃশ্যের তালিকা, যার প্রতিটিতে থাকবে:
   - "sceneNumber": দৃশ্য নম্বর (১, ২, ৩)
   - "timeRange": সময়সীমা (যেমন: "০০:০০ - ০০:০৩ সেকেন্ড")
   - "visualBn": দৃশ্যের বিস্তারিত বাংলা বিবরণ ("${brand}" শোরুম নামফলক, পণ্যের ক্লোজ-আপ এবং ভার্চুয়াল প্রতিনিধির অঙ্গভঙ্গিসহ)
   - "dialogueBn": উক্ত দৃশ্যে বিক্রয় প্রতিনিধির বাংলা সংলাপ।`;
}

/**
 * Replaces English technical/status words with professional Bengali store-management terminology
 * while preserving `<IMAGE_REF_N>` tags and `{{PLACEHOLDER}}` tokens when needed.
 */
export function enforceBengaliStoreManagementText(
  rawText: string,
  options?: { preserveImageRefTags?: boolean }
): string {
  if (!rawText) return '';

  // Temporarily protect <IMAGE_REF_0..3> tags if requested
  const protectedTags: string[] = [];
  let working = rawText;
  if (options?.preserveImageRefTags) {
    working = working.replace(/<IMAGE_REF_\d+>/g, (match) => {
      protectedTags.push(match);
      return `__IMG_TAG_${protectedTags.length - 1}__`;
    });
  }

  const replacements: Array<[RegExp, string]> = [
    [/I've started generating your .*? video.*?!/gi, 'আপনার বাণিজ্যিক শোরুম ভিডিও রেন্ডারিং প্রক্রিয়া শুরু হয়েছে!'],
    [/waiting in the queue due to high demand\.?/gi, 'সার্ভারে উচ্চ চাহিদার কারণে রেন্ডারিং সারিতে প্রক্রিয়াধীন রয়েছে।'],
    [/Feel free to check back in a few minutes!?/gi, 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন, স্বয়ংক্রিয়ভাবে ফলাফল প্রদর্শিত হবে।'],
    [/Cinematic commercial video/gi, 'বাণিজ্যিক শোরুম বিজ্ঞাপন চিত্র'],
    [/Cinematic vertical commercial video/gi, 'ভার্টিক্যাল বাণিজ্যিক শোরুম বিজ্ঞাপন চিত্র'],
    [/inside a luxury/gi, 'একটি বিলাসবহুল'],
    [/with 3D illuminated wall signage reading/gi, 'যার পিছনের দেয়ালে উজ্জ্বল ত্রিমাত্রিক নামফলকে লেখা রয়েছে'],
    [/Consistent virtual brand presenter/gi, 'স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি'],
    [/holds and showcases the exact product/gi, 'হাতে আসল ক্যাটালগ পণ্যটি প্রদর্শন করছেন'],
    [/maintaining 100% showroom background and character consistency across all scenes/gi, 'এবং প্রতিটি দৃশ্যে শোরুমের পটভূমি ও প্রতিনিধির অবয়ব ১০০% অপরিবর্তিত থাকছে'],
    [/\bApproval Mode\b/gi, 'প্রশাসনিক অনুমোদন মোড'],
    [/\bAuto Agent Mode\b/gi, 'স্বয়ংক্রিয় এজেন্ট মোড'],
    [/\bBrand Name\b/gi, 'প্রতিষ্ঠানের নাম'],
    [/\bShowroom\b/gi, 'প্রদর্শনী কেন্দ্র (শোরুম)'],
    [/\bVirtual Avatar\b/gi, 'ভার্চুয়াল বিক্রয় প্রতিনিধি'],
    [/\bProduct Catalog\b/gi, 'পণ্য ক্যাটালগ'],
    [/\bPrice\b/gi, 'খুচরা বিক্রয়মূল্য'],
    [/\bScene\b/gi, 'দৃশ্যপট'],
    [/\bFrame\b/gi, 'স্থিরচিত্র ফ্রেম'],
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

/**
 * Language-Switching & Bengali Enforcement Utility:
 * Intercepts any English status or conversational phrases from the video/agent pipeline
 * and converts them into 100% natural Bangladeshi Bengali store-management terminology.
 */
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
  const prod = context.productTitle || 'নির্বাচিত ক্যাটালগ পণ্য';
  const durBn = context.duration === '5s' ? '৫-সেকেন্ডের' : '১০-সেকেন্ডের';
  const ratioBn =
    context.aspectRatio === '16:9' ? 'ওয়াইডস্ক্রিন (১৬:৯)' : 'ভার্টিক্যাল রিলস (৯:১৬)';

  if (!trimmed) {
    return `আসসালামু আলাইকুম! আমি আপনার "${brand}" স্টোরের জন্য "${prod}"-এর ${durBn} ${ratioBn} শোরুম বাণিজ্যিক ভিডিওর চিত্রনাট্য ও প্রদর্শনী পরিকল্পনা প্রস্তুত করেছি।`;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("i've started generating") ||
    lower.includes('waiting in the queue') ||
    lower.includes('feel free to check back')
  ) {
    return `🎬 আমি আপনার স্টোরের "${prod}" পণ্যের জন্য ${durBn} ${ratioBn} বাণিজ্যিক ভিডিও রেন্ডারিং প্রক্রিয়া শুরু করেছি! ভিডিওর পটভূমিতে "${brand}"-এর ত্রিমাত্রিক শোরুম নামফলক এবং স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি সংযোজন করা হচ্ছে। অনুগ্রহ করে কয়েক মুহূর্ত অপেক্ষা করুন!`;
  }

  if (lower.includes('violates our policy') || lower.includes('refund')) {
    return `⚠️ প্রম্পট নির্দেশনাটি প্রাতিষ্ঠানিক নীতিমালা অনুযায়ী পরিমার্জন করে নিরাপদ শোরুম মোডে "${brand}"-এর জন্য পুনরায় বাণিজ্যিক বিজ্ঞাপন ভিডিও প্রস্তুত করা হচ্ছে।`;
  }

  const sanitized = enforceBengaliStoreManagementText(trimmed, {
    preserveImageRefTags: context.mode === 'bn_with_tech_tags',
  });

  const bengaliChars = (sanitized.match(/[\u0980-\u09FF]/g) || []).length;
  const latinChars = (sanitized.match(/[a-zA-Z]/g) || []).length;

  // If the response has zero Bengali characters or is predominantly English, convert to 100% Bengali store-management message
  if (bengaliChars === 0 || (context.mode === 'bn_strict' && latinChars > bengaliChars * 1.2)) {
    return `🤖 আপনার প্রদত্ত ক্যাটালগ চিত্র ও মার্চেন্ডাইজিং নির্দেশনা বিশ্লেষণ সম্পন্ন হয়েছে। পটভূমিতে "${brand}"-এর অফিশিয়াল শোরুম নামফলক এবং স্থায়ী ভার্চুয়াল বিক্রয় প্রতিনিধি রেখে "${prod}"-এর জন্য ${durBn} একটি বাণিজ্যিক বিজ্ঞাপন ভিডিওর বাংলা চিত্রনাট্য প্রস্তুত করা হয়েছে। আপনার প্রশাসনিক অনুমোদন পেলে এখনই রেন্ডারিং শুরু করা হবে!`;
  }

  return sanitized;
}

/**
 * Prompt-Builder Utility:
 * Dynamically interpolates {{BRAND_NAME}}, {{BRAND_SLOGAN}}, {{SHOWROOM_STYLE}},
 * {{AVATAR_PERSONA}}, {{PRODUCT_TITLE}}, {{PRODUCT_PRICE}}, and <IMAGE_REF_0..3>
 * to guarantee professional store background consistency across all frames.
 */
export function buildBrandConsistentPrompt(config: PromptBuilderConfig): {
  compiledOmniPrompt: string;
  compiledSummaryBn: string;
  imageRefTags: string[];
} {
  const count = Math.max(1, Math.min(4, config.imageCount || 1));
  const imageRefTags = Array.from({ length: count }, (_, idx) => `<IMAGE_REF_${idx}>`);
  const refsJoined = imageRefTags.join(', ');

  const rawTemplate = config.template?.trim() || DEFAULT_SHOWROOM_PROMPT_TEMPLATE;

  const compiledRaw = rawTemplate
    .replace(/\{\{BRAND_NAME\}\}/g, config.brandName || 'দোকানদারি')
    .replace(
      /\{\{BRAND_SLOGAN\}\}/g,
      config.brandSlogan || '১০০% অরিজিনাল কোয়ালিটি — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি'
    )
    .replace(/\{\{SHOWROOM_STYLE\}\}/g, config.showroomLabelBn || config.showroomStylePrompt)
    .replace(/\{\{AVATAR_PERSONA\}\}/g, config.avatarNameBn || config.avatarPersonaPrompt)
    .replace(/\{\{AVATAR_NAME\}\}/g, config.avatarNameBn)
    .replace(/\{\{PRODUCT_TITLE\}\}/g, config.productTitle || `${config.brandName} প্রিমিয়াম ক্যাটালগ পণ্য`)
    .replace(/\{\{PRODUCT_PRICE\}\}/g, config.productPrice || '৬৯৯')
    .replace(/\{\{IMAGE_REFS\}\}/g, refsJoined)
    .replace(/\{\{ASPECT_RATIO\}\}/g, config.aspectRatio === '16:9' ? '১৬:৯ ওয়াইডস্ক্রিন' : '৯:১৬ রিলস')
    .replace(/\{\{DURATION\}\}/g, config.duration === '5s' ? '৫ সেকেন্ড' : '১০ সেকেন্ড');

  const compiledOmniPrompt = enforceBengaliStoreManagementText(compiledRaw, {
    preserveImageRefTags: true,
  });

  const compiledSummaryBn = `🏢 শোরুম ব্র্যান্ডিং সামঞ্জস্য লক: পটভূমির "${config.showroomLabelBn}"-এর দেয়ালে "${config.brandName}" নামফলক এবং সাব-ব্যানারে "${config.brandSlogan}" স্থির থাকবে। ভার্চুয়াল বিক্রয় প্রতিনিধি (${config.avatarNameBn}) আপনার নির্বাচিত ${count}টি ক্যাটালগ পণ্য চিত্র (${refsJoined}) হাতে নিয়ে প্রমিত বাংলায় উপস্থাপন করবেন।`;

  return {
    compiledOmniPrompt,
    compiledSummaryBn,
    imageRefTags,
  };
}

/**
 * Helper to create a structured Bengali Store-Management Activity Log entry.
 */
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
