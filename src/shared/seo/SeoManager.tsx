import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PublicSeoConfig {
  title: string;
  description: string;
}

const BRAND = 'MarketHub';
const DEFAULT_DESCRIPTION =
  'Marketplace sotuvchilari uchun mahsulot, buyurtma, ombor va savdoni boshqarish platformasi.';

const PUBLIC_ROUTES: Record<string, PublicSeoConfig> = {
  '/login': {
    title: 'MarketHub Seller — sotuvchi kabinetiga kirish',
    description:
      'MarketHub seller kabinetiga kiring va mahsulotlar, buyurtmalar, omborlar hamda savdo ko‘rsatkichlarini bir joydan boshqaring.',
  },
  '/register': {
    title: 'MarketHub’da sotuvchi sifatida ro‘yxatdan o‘tish',
    description:
      'MarketHub marketplace platformasida do‘kon oching, mahsulotlaringizni joylang va onlayn savdoni boshlang.',
  },
};

function getSiteOrigin(): string {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      // Noto‘g‘ri env qiymati sahifani ishdan chiqarmasligi kerak.
    }
  }
  return window.location.origin;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function setCanonical(url: string | null): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = url;
}

function setStructuredData(origin: string, enabled: boolean): void {
  const id = 'markethub-structured-data';
  const current = document.getElementById(id);
  if (!enabled) {
    current?.remove();
    return;
  }

  const script = current ?? document.createElement('script');
  script.id = id;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MarketHub Seller',
    url: `${origin}/login`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'uz-Latn',
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: BRAND,
      logo: `${origin}/favicon.svg`,
    },
  }).replace(/</g, '\\u003c');
  if (!current) document.head.append(script);
}

export function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const publicConfig = PUBLIC_ROUTES[pathname];
    const indexable = Boolean(publicConfig);
    const origin = getSiteOrigin();
    const title = publicConfig?.title ?? `${BRAND} Seller — boshqaruv kabineti`;
    const description = publicConfig?.description ?? DEFAULT_DESCRIPTION;
    const canonical = indexable ? `${origin}${pathname}` : null;
    const image = `${origin}/og-markethub.jpg`;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical ?? `${origin}${pathname}`);
    setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setCanonical(canonical);
    setStructuredData(origin, indexable);
  }, [pathname]);

  return null;
}
