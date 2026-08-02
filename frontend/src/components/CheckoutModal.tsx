import React, { useState } from 'react';
import type { PlaybookListing, LicenseRecord, OrderRecord } from '../types/marketplace';
import { PaymentService } from '../services/paymentService';
import { useAuth } from '../context/AuthContext';

interface CheckoutModalProps {
  playbook: PlaybookListing;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (license: LicenseRecord) => void;
}

export function CheckoutModal({ playbook, isOpen, onClose, onSuccess }: CheckoutModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{ order: OrderRecord; license: LicenseRecord; downloadToken: string } | null>(null);

  if (!isOpen) return null;

  const priceUsdFormatted = (playbook.priceUsdCents / 100).toFixed(2);

  const handleConfirmPurchase = async () => {
    if (!user) {
      setError('Please sign in to complete your purchase.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await PaymentService.processCheckout({
      userId: user.id,
      playbookId: playbook.id,
      playbookSlug: playbook.slug,
      playbookTitle: playbook.title,
      priceUsdCents: playbook.priceUsdCents,
      paymentMethod: 'card_test'
    });

    setLoading(false);

    if (res.success && res.order && res.license && res.downloadToken) {
      setCompletedOrder({
        order: res.order,
        license: res.license,
        downloadToken: res.downloadToken
      });
      onSuccess(res.license);
    } else {
      setError(res.error || 'Payment failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
      <div className="bg-[#FFFDF8] border border-[#30323D]/20 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-[#30323D]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#30323D]/60 hover:text-[#30323D] transition-colors p-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-[#D97958]"
          aria-label="Close Checkout"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {!completedOrder ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <img src={playbook.iconUrl} alt="" className="w-12 h-12 rounded-xl object-contain bg-[#30323D]/5 p-2" />
              <div>
                <span className="text-xs font-bold text-[#D97958] uppercase tracking-wider">Commercial License Checkout</span>
                <h2 id="checkout-modal-title" className="text-xl font-bold font-headline leading-snug">{playbook.title}</h2>
              </div>
            </div>

            <div className="bg-[#30323D]/5 p-4 rounded-xl mb-6 space-y-2 border border-[#30323D]/10">
              <div className="flex justify-between text-sm font-medium">
                <span>Playbook Commercial License</span>
                <span className="font-bold">${priceUsdFormatted} USD</span>
              </div>
              <div className="flex justify-between text-xs text-[#30323D]/70">
                <span>Platform Maintenance Fee (Included)</span>
                <span>$0.00</span>
              </div>
              <hr className="border-[#30323D]/10 my-2" />
              <div className="flex justify-between text-base font-bold text-[#30323D]">
                <span>Total Due</span>
                <span className="text-[#D97958]">${priceUsdFormatted} USD</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{error}</span>
              </div>
            )}

            <div className="mb-6 space-y-2 text-xs text-[#30323D]/80 bg-[#30323D]/5 p-3.5 rounded-xl">
              <div className="flex items-center gap-2 font-semibold">
                <span className="material-symbols-outlined text-sm text-emerald-600">verified_user</span>
                <span>Server-Verified Instant Checkout</span>
              </div>
              <p>Instant entitlement activation. Creates an immutable license record linked to your Dokion account.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 border border-[#30323D]/20 hover:bg-[#30323D]/5 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-[#D97958] hover:bg-[#c26543] text-white rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                    <span>Pay ${priceUsdFormatted}</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold font-headline">Purchase Confirmed!</h2>
            <p className="text-xs text-[#30323D]/70 max-w-sm mx-auto">
              Your license is active and ready. You can now install and execute this playbook locally.
            </p>

            <div className="bg-[#30323D] text-[#FFFDF8] p-4 rounded-xl text-left text-xs font-mono space-y-2 relative group">
              <div className="text-[#D97958] font-sans font-bold text-[11px] uppercase tracking-wider">License Key</div>
              <div className="select-all font-bold text-sm tracking-wide">{completedOrder.license.licenseKey}</div>
              <div className="text-[#30323D]/60 pt-2 border-t border-white/10 text-[10px] font-sans">
                Order ID: {completedOrder.order.id}
              </div>
            </div>

            <div className="bg-[#30323D]/5 p-3 rounded-xl text-left">
              <span className="text-[11px] font-bold text-[#30323D]/70 uppercase tracking-wider block mb-1">CLI Installation Command</span>
              <code className="text-xs font-mono bg-[#30323D] text-emerald-400 p-2 rounded-lg block overflow-x-auto">
                dokion playbook install {playbook.slug}
              </code>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#30323D] text-white hover:bg-[#30323D]/90 rounded-xl text-sm font-bold transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
