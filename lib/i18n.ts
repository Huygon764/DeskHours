import { localeItem } from './storage';
import type { LocaleCode, LocalePreference } from './locale';

type MessageEntry = {
  message: string;
  placeholders?: Record<string, { content: string; example?: string }>;
};

type MessageCatalog = Record<string, MessageEntry>;

const catalogs: Partial<Record<LocaleCode, MessageCatalog>> = {};
let loadedPreference: LocalePreference | null = null;

async function loadCatalog(code: LocaleCode): Promise<MessageCatalog> {
  const cached = catalogs[code];
  if (cached) return cached;
  const url = browser.runtime.getURL(`/_locales/${code}/messages.json`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load locale "${code}": ${res.status}`);
  const catalog = (await res.json()) as MessageCatalog;
  catalogs[code] = catalog;
  return catalog;
}

function substitutionValue(content: string, subs: string[]): string {
  const numbered = /^\$(\d+)$/.exec(content);
  if (numbered) return subs[Number(numbered[1]) - 1] ?? '';
  return content;
}

function formatMessage(entry: MessageEntry, substitutions: string[]): string {
  let msg = entry.message;
  if (entry.placeholders) {
    for (const [key, spec] of Object.entries(entry.placeholders)) {
      msg = msg.replaceAll(`$${key}$`, substitutionValue(spec.content, substitutions));
    }
    return msg;
  }
  substitutions.forEach((sub, i) => {
    msg = msg.replaceAll(`$${i + 1}$`, sub);
  });
  return msg;
}

function fromCatalog(catalog: MessageCatalog, name: string, substitutions: string[]): string {
  const entry = catalog[name];
  if (!entry) return name;
  return formatMessage(entry, substitutions);
}

function browserMessage(name: string, substitutions: string[]): string {
  return browser.i18n.getMessage(name as never, substitutions) || name;
}

async function refreshLocaleCache(): Promise<void> {
  loadedPreference = await localeItem.getValue();
  if (loadedPreference !== 'system') {
    await loadCatalog(loadedPreference);
  }
}

/** Preload messages for the stored preference. Call before mounting UI. */
export async function initI18n(): Promise<void> {
  await refreshLocaleCache();
}

/** Re-render UI when the user changes language in settings. */
export function watchLocale(onChange: () => void): () => void {
  return localeItem.watch(() => {
    void refreshLocaleCache().then(() => onChange());
  });
}

/** Sync translate for UI. Requires initI18n() first for non-system locales. */
export function t(name: string, ...substitutions: string[]): string {
  if (loadedPreference == null || loadedPreference === 'system') {
    return browserMessage(name, substitutions);
  }
  const catalog = catalogs[loadedPreference];
  if (!catalog) return browserMessage(name, substitutions);
  return fromCatalog(catalog, name, substitutions);
}

/** Async translate for background workers and notifications. */
export async function translate(name: string, ...substitutions: string[]): Promise<string> {
  const pref = await localeItem.getValue();
  if (pref === 'system') return browserMessage(name, substitutions);
  const catalog = await loadCatalog(pref);
  return fromCatalog(catalog, name, substitutions);
}

export function presetLabel(id: string): string {
  return t(`preset_${id.replace(/-/g, '_')}_label`);
}

export function presetDescription(id: string): string {
  return t(`preset_${id.replace(/-/g, '_')}_desc`);
}

export function pomodoroPresetLabel(id: string): string {
  return t(`pomodoro_preset_${id}`);
}
