/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles, ShoppingBag, Eye, X } from 'lucide-react';
import { Product } from '../types';
import { parseEmbedVideoUrl } from '../lib/gemini';

interface VideoGalleryPageProps {
  products: Product[];
  onBackToHome: () => void;
  onOpenProductDetail: (product: Product) => void;
  onInstantOrder: (product: Product) => void;
}

export const VideoGalleryPage: React.FC<VideoGalleryPageProps> = ({
  products,
  onBackToHome,
  onOpenProductDetail,
  onInstantOrder,
}) => {
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Products with actual video links or fallback showcase
  const productsWithVideos = products.filter((p) => p.videos && p.videos.length > 0);
  const displayList = productsWithVideos.length > 0 ? productsWithVideos : products.slice(0, 8);

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16 animate-in fade-in">
      {/* 100% Light Rose/Cream Header Banner — Zero Dark Background */}
      <div className="bg-gradient-to-br from-[#FFF5F7] via-[#FFF0F3] to-[#FFE4E8] text-stone-900 border-b border-rose-200 py-10 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-3">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-800 hover:text-[#E11D48] transition-colors cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-rose-200 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#E11D48]" />
            <span>&larr; শপে ফিরে যান</span>
          </button>

          <div>
            <div className="inline-block px-3.5 py-1 rounded-full bg-white text-[#E11D48] border border-rose-200 text-xs font-extrabold tracking-wider shadow-2xs">
              LIVE PRODUCT SHOWCASE
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight">
            অরিজিনাল ভিডিও গ্যালারি ও আনবক্সিং রিলস
          </h1>
          <p className="text-xs sm:text-sm text-stone-700 font-medium max-w-xl">
            অর্ডার করার আগেই দেখে নিন পণ্যের আসল কোয়ালিটি, ফিনিশিং ও ব্যবহারিক ডেমো। ১০০% সততা ও ক্যাশ অন ডেলিভারি নিশ্চয়তা।
          </p>
        </div>
      </div>

      {/* Video Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {displayList.map((product) => {
            const videoUrl =
              product.videos?.[0] || 'https://www.w3schools.com/html/mov_bbb.mp4';

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-rose-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Video / Thumbnail Area */}
                <div className="relative aspect-square bg-stone-950 overflow-hidden cursor-pointer">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                    referrerPolicy="no-referrer"
                  />

                  {/* Play Overlay */}
                  <button
                    onClick={() => setActiveVideoUrl(videoUrl)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[#E11D48]/90 hover:bg-[#E11D48] text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 cursor-pointer"
                    title="ভিডিও চালু করুন"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>

                  <div className="absolute top-2.5 left-2.5 bg-stone-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>রিয়েল ভিডিও ডেমো</span>
                  </div>
                </div>

                {/* Details & Actions */}
                <div className="p-3.5 space-y-2.5">
                  <div>
                    <h3 className="font-bold text-xs text-stone-900 line-clamp-1">{product.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-extrabold text-[#E11D48] font-mono">
                        ৳{product.price.toLocaleString()}
                      </span>
                      {product.originalPrice && (
                        <span className="text-[11px] text-stone-400 line-through font-mono">
                          ৳{product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-100">
                    <button
                      onClick={() => onOpenProductDetail(product)}
                      className="py-1.5 px-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-[11px] font-bold rounded-lg border border-stone-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>বিস্তারিত</span>
                    </button>

                    <button
                      onClick={() => onInstantOrder(product)}
                      className="py-1.5 px-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>অর্ডার</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Video Modal Player */}
      {activeVideoUrl && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-stone-900 rounded-3xl overflow-hidden max-w-2xl w-full border border-stone-700 shadow-2xl">
            <button
              onClick={() => setActiveVideoUrl(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-stone-800/80 hover:bg-stone-700 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-video w-full bg-black">
              {(() => {
                const embed = parseEmbedVideoUrl(activeVideoUrl);
                return embed.type === 'iframe' ? (
                  <iframe
                    src={embed.src}
                    title="Product Video"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video src={embed.src} controls autoPlay playsInline className="w-full h-full object-contain" />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
