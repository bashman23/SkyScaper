import { useEffect, useState } from 'react';

const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const ADSENSE_SLOT_PANEL = import.meta.env.VITE_ADSENSE_SLOT_PANEL as string | undefined;
const AD_CONSENT_KEY = 'map-measurement:ad-consent:v1';
type AdConsent = 'accepted' | 'declined' | 'unset';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot() {
  const isConfigured = Boolean(ADSENSE_CLIENT_ID && ADSENSE_SLOT_PANEL);
  const [consent, setConsent] = useState<AdConsent>(() => getStoredConsent());
  const canLoadAds = isConfigured && consent === 'accepted';

  useEffect(() => {
    if (!canLoadAds || document.querySelector('script[data-map-measurement-adsense]')) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.mapMeasurementAdsense = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    document.head.append(script);
  }, [canLoadAds]);

  useEffect(() => {
    if (!canLoadAds) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers and approval states can prevent ad initialization.
    }
  }, [canLoadAds]);

  if (!isConfigured) {
    return (
      <section className="ad-slot ad-placeholder" aria-label="Advertising slot">
        <span>Ad space</span>
        <strong>Free tool supported by sponsors</strong>
      </section>
    );
  }

  if (consent !== 'accepted') {
    return (
      <section className="ad-slot ad-consent" aria-label="Advertising preferences">
        <div>
          <span>Advertising</span>
          <strong>{consent === 'declined' ? 'Ads are paused' : 'Support the free tool'}</strong>
          <p>Allow sponsor ads to help keep Map Measurement free.</p>
        </div>
        <div className="ad-consent-actions">
          <button type="button" onClick={() => updateConsent('accepted', setConsent)}>
            Allow
          </button>
          <button type="button" onClick={() => updateConsent('declined', setConsent)}>
            Decline
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ad-slot" aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-format="auto"
        data-ad-slot={ADSENSE_SLOT_PANEL}
        data-full-width-responsive="true"
        style={{ display: 'block' }}
      />
    </section>
  );
}

function getStoredConsent(): AdConsent {
  try {
    const value = localStorage.getItem(AD_CONSENT_KEY);
    return value === 'accepted' || value === 'declined' ? value : 'unset';
  } catch {
    return 'unset';
  }
}

function updateConsent(consent: AdConsent, setConsent: (consent: AdConsent) => void): void {
  try {
    localStorage.setItem(AD_CONSENT_KEY, consent);
  } catch {
    // The UI state still updates when browser storage is unavailable.
  }
  setConsent(consent);
}
