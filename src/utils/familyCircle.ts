import type { FamilyCircleConfig, TrustedContact } from '../types/safevoice';

export const FAMILY_CIRCLE_STORAGE_KEY = 'safevoice_family_circle_v1';

export const DEFAULT_FAMILY_CIRCLE: FamilyCircleConfig = {
  safeWord: 'Mango Orchard',
  contacts: [
    {
      id: 'contact-1',
      name: 'Aarav Sharma',
      relationship: 'Son',
      phone: '+91 98765 43210',
    },
    {
      id: 'contact-2',
      name: 'Meera Nair',
      relationship: 'Daughter',
      phone: '+91 98111 22334',
    },
    {
      id: 'contact-3',
      name: 'Rohan Verma',
      relationship: 'Grandson',
      phone: '+91 99000 11223',
    },
  ],
};

export function readFamilyCircleFromStorage(): FamilyCircleConfig | null {
  try {
    const raw = window.localStorage.getItem(FAMILY_CIRCLE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<FamilyCircleConfig>;
    const safeWord =
      typeof parsed.safeWord === 'string' ? parsed.safeWord.trim() : '';
    const contacts = Array.isArray(parsed.contacts)
      ? parsed.contacts.filter(
          (c): c is TrustedContact =>
            Boolean(c) &&
            typeof c === 'object' &&
            typeof c.id === 'string' &&
            typeof c.name === 'string' &&
            typeof c.relationship === 'string' &&
            typeof c.phone === 'string'
        )
      : [];

    if (!safeWord) {
      return null;
    }

    return { safeWord, contacts };
  } catch {
    return null;
  }
}

export function loadFamilyCircle(): FamilyCircleConfig {
  return readFamilyCircleFromStorage() ?? DEFAULT_FAMILY_CIRCLE;
}

export function saveFamilyCircle(config: FamilyCircleConfig): void {
  try {
    window.localStorage.setItem(
      FAMILY_CIRCLE_STORAGE_KEY,
      JSON.stringify(config)
    );
  } catch {
    // Ignore localStorage quota/private mode errors gracefully
  }
}

export function clearFamilyCircleStorage(): void {
  try {
    window.localStorage.removeItem(FAMILY_CIRCLE_STORAGE_KEY);
  } catch {
    // Ignore errors gracefully
  }
}

export function hasActiveSafeWordInStorage(): boolean {
  const stored = readFamilyCircleFromStorage();
  return Boolean(stored && stored.safeWord.trim().length > 0);
}

export function formatTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}
