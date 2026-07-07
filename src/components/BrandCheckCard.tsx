"use client";
import { CONFIG } from "@/lib/config";
import type { BrandCheck } from "@/lib/types";

/** "Does AI know your brand, and is what it says right?" */
export function BrandCheckCard({ brand }: { brand: BrandCheck }) {
  const knows = Boolean(brand.answer && !brand.error);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">Does AI know {brand.businessName}?</h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
            knows ? "border-gain/40 bg-gain/10 text-gain" : "border-warn/40 bg-warn/10 text-warn"
          }`}
        >
          {knows ? "Recognised" : "Not recognised"}
        </span>
      </div>
      {brand.error ? (
        <p className="text-[13.5px] leading-snug text-muted">
          We could not run the brand check ({CONFIG.engineLabels[brand.engine]} unavailable).
        </p>
      ) : brand.answer ? (
        <>
          <p className="rounded-lg bg-surface-sunk/50 px-3 py-2 text-[13.5px] italic leading-snug text-muted">
            &ldquo;{brand.answer}&rdquo;
          </p>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Check this against the facts. If anything is wrong or out of date, that is what guests are
            being told. {brand.ownDomainCited ? "Your own site was cited." : "Your own site was not cited here."}
          </p>
        </>
      ) : (
        <p className="text-[13.5px] leading-snug text-muted">
          AI returned nothing specific about {brand.businessName}. If AI does not know you, it cannot
          recommend you.
        </p>
      )}
    </div>
  );
}
