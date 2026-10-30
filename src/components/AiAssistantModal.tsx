/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, User, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { askAiShoppingAssistant } from '../lib/gemini';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (p: Product) => void;
}

interface Message {
  role: 'assistant' | 'user';
  text: string;
  recommendedProduct?: Product;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'আসসালামু আলাইকুম! আমি Dokandari-এর রিয়েল-টাইম AI শপিং অ্যাসিস্ট্যান্ট (Gemini 3.8 Flash)। হোম ডেকোর, গ্যাজেটস, ইলেকট্রনিক্স, ফ্যাশন, কিচেন বা যেকোনো পণ্যের দাম, সাইজ ও কোয়ালিটি নিয়ে প্রশ্ন করতে পারেন!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await askAiShoppingAssistant(userText, products);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.reply,
          recommendedProduct: result.recommendedProduct,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'আপনার পছন্দের জন্য ধন্যবাদ! Dokandari-তে সকল অর্ডারে ক্যাশ অন ডেলিভারি এবং পার্সেল খুলে পণ্য দেখে নেওয়ার সুবিধা রয়েছে।',
          recommendedProduct: products[0],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-rose-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - strictly brand Crimson */}
        <div className="p-4 bg-gradient-to-r from-[#D81B60] via-[#E11D48] to-[#9F1239] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <span>Dokandari AI শপিং অ্যাসিস্ট্যান্ট</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Gemini 3.8 Flash</span>
              </h3>
              <p className="text-[11px] text-white/85">স্মার্ট মাল্টি-ক্যাটাগরি প্রোডাক্ট গাইড</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 text-white/90 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-[#FFF8F9]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-rose-100 text-[#E11D48] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className="space-y-2 max-w-[82%]">
                <div
                  className={`p-3 rounded-2xl ${
                    m.role === 'user'
                      ? 'bg-[#E11D48] text-white rounded-br-xs'
                      : 'bg-white border border-rose-100 text-stone-800 rounded-bl-xs leading-relaxed shadow-2xs'
                  }`}
                >
                  {m.text}
                </div>

                {m.recommendedProduct && (
                  <div
                    onClick={() => {
                      onClose();
                      onSelectProduct(m.recommendedProduct!);
                    }}
                    className="p-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50/60 transition-all cursor-pointer flex items-center gap-2.5 shadow-2xs"
                  >
                    <img
                      src={m.recommendedProduct.images[0]}
                      alt={m.recommendedProduct.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-stone-900 truncate">{m.recommendedProduct.name}</div>
                      <div className="text-[11px] font-mono font-bold text-[#E11D48]">
                        ৳{m.recommendedProduct.price.toLocaleString()}
                      </div>
                    </div>
                    <ShoppingBag className="w-4 h-4 text-[#E11D48]" />
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-[#E11D48] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-stone-500 text-xs">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-[#E11D48] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <span>Gemini AI উত্তর লিখছে...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-rose-100 bg-white flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="যেকোনো পণ্যের নাম বা প্রশ্ন লিখুন (যেমন: ঘর সাজানোর আয়না বা ইয়ারবাডস)..."
            className="flex-1 px-3.5 py-2 text-xs bg-[#FFF8F9] border border-rose-200 rounded-xl focus:outline-none focus:border-[#E11D48]"
          />
          <button
            type="submit"
            disabled={isTyping}
            className="px-3.5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
