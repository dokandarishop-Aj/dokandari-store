/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Product } from '../types';

export type DeliveryZone = 'dhaka' | 'outside_dhaka';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, selectedColor?: string, selectedSize?: string, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  deliveryZone: DeliveryZone;
  setDeliveryZone: (zone: DeliveryZone) => void;
  shippingFee: number;
  discount: number;
  discountCode: string;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  total: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  freeShippingThreshold: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const FREE_SHIPPING_MIN = 2000;
const SHIPPING_DHAKA = 70;
const SHIPPING_OUTSIDE_DHAKA = 130;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('dokandari_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>('dhaka');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem('dokandari_cart', JSON.stringify(items));
    } catch (err) {
      console.warn('Failed to save cart to localStorage', err);
    }
  }, [items]);

  const addToCart = (
    product: Product,
    selectedColor?: string,
    selectedSize?: string,
    quantity = 1
  ) => {
    const lineId = `${product.id}-${selectedColor || 'default'}-${selectedSize || 'default'}`;

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.id === lineId);
      if (existingIndex > -1) {
        const next = [...prevItems];
        next[existingIndex].quantity += quantity;
        return next;
      }
      return [
        ...prevItems,
        {
          id: lineId,
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.images[0] || '',
          quantity,
          selectedColor,
          selectedSize,
          category: product.category,
        },
      ];
    });

    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
    setDiscount(0);
    setDiscountCode('');
    try {
      localStorage.removeItem('dokandari_cart');
    } catch {
      // ignore
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Free delivery threshold: ৳2,000 or with coupon
  const baseShipping = deliveryZone === 'dhaka' ? SHIPPING_DHAKA : SHIPPING_OUTSIDE_DHAKA;
  const isFreeShipping = subtotal >= FREE_SHIPPING_MIN || discountCode === 'FREESHIP';
  const shippingFee = items.length === 0 ? 0 : isFreeShipping ? 0 : baseShipping;

  const total = Math.max(0, subtotal + shippingFee - discount);

  const applyCoupon = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed === 'DOKANDARI10') {
      const calculatedDiscount = Math.round(subtotal * 0.1);
      setDiscount(calculatedDiscount);
      setDiscountCode('DOKANDARI10');
      return { success: true, message: '10% discount applied successfully!' };
    } else if (trimmed === 'FREESHIP') {
      setDiscountCode('FREESHIP');
      setDiscount(0);
      return { success: true, message: 'Free shipping applied!' };
    } else if (trimmed === 'WELCOME100') {
      setDiscount(100);
      setDiscountCode('WELCOME100');
      return { success: true, message: '৳100 Welcome voucher applied!' };
    }
    return { success: false, message: 'Invalid coupon code. Try DOKANDARI10' };
  };

  const removeCoupon = () => {
    setDiscountCode('');
    setDiscount(0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        deliveryZone,
        setDeliveryZone,
        shippingFee,
        discount,
        discountCode,
        applyCoupon,
        removeCoupon,
        total,
        isCartOpen,
        setIsCartOpen,
        freeShippingThreshold: FREE_SHIPPING_MIN,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
