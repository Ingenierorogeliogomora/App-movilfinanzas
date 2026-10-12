import { getLocales } from 'expo-localization';
import { useMemo } from 'react';

import { formatMoney } from '@/core/money';
import type { Category } from '@/core/types';
import { useStore, type LanguagePref } from '@/state/store';

import { en } from './en';
import { es, type TKey } from './es';

export type { TKey };
export type Lang = 'es' | 'en';
type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<TKey, string>> = { es, en };

export function resolveLanguage(pref: LanguagePref): Lang {
  if (pref === 'es' || pref === 'en') return pref;
  const code = getLocales()[0]?.languageCode;
  return code === 'es' ? 'es' : 'en';
}

/** Formatting locale: the chosen language with the device region (es-US, en-MX…). */
export function resolveLocale(lang: Lang): string {
  const region = getLocales()[0]?.regionCode ?? 'US';
  return `${lang}-${region}`;
}

export function translate(lang: Lang, key: TKey, params?: Params): string {
  const template = DICTS[lang][key] ?? es[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] !== undefined ? String(params[name]) : `{${name}}`));
}

export function useI18n() {
  const pref = useStore((s) => s.settings.language);
  const currency = useStore((s) => s.settings.currency);
  return useMemo(() => {
    const lang = resolveLanguage(pref);
    const locale = resolveLocale(lang);
    const t = (key: TKey, params?: Params) => translate(lang, key, params);
    const money = (cents: number, opts?: { compact?: boolean; signed?: boolean; whole?: boolean }) =>
      formatMoney(cents, currency, locale, opts);
    const pct = (ratio: number | null, digits = 0) =>
      ratio === null || !Number.isFinite(ratio)
        ? '—'
        : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(ratio);
    const categoryName = (c: Category | undefined | null) => {
      if (!c) return t('common.uncategorized');
      if (c.name) return c.name;
      return c.key ? translate(lang, `cat.${c.key}` as TKey) : '—';
    };
    return { lang, locale, currency, t, money, pct, categoryName };
  }, [pref, currency]);
}

export type I18n = ReturnType<typeof useI18n>;
