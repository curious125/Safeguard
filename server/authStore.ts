import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ACCOUNTS_FILE = path.resolve(DATA_DIR, 'accounts.json');

export interface StoredContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export interface StoredFamilyCircle {
  safeWord: string;
  contacts: StoredContact[];
}

export interface StoredAccount {
  username: string;
  usernameLower: string;
  passwordHash: string;
  createdAt: string;
  familyCircle: StoredFamilyCircle;
}

interface ActiveSession {
  usernameLower: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const activeSessions = new Map<string, ActiveSession>();

export function createDefaultFamilyCircle(): StoredFamilyCircle {
  return {
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
}

function ensureSafeDataPath(): void {
  if (!ACCOUNTS_FILE.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid storage path configuration.');
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAccounts(): StoredAccount[] {
  ensureSafeDataPath();
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is StoredAccount =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as StoredAccount).username === 'string' &&
        typeof (item as StoredAccount).usernameLower === 'string' &&
        typeof (item as StoredAccount).passwordHash === 'string' &&
        Boolean((item as StoredAccount).familyCircle)
    );
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]): void {
  ensureSafeDataPath();
  const tempPath = path.resolve(DATA_DIR, `accounts.${process.pid}.tmp.json`);
  if (!tempPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temporary storage path.');
  }
  fs.writeFileSync(tempPath, JSON.stringify(accounts, null, 2), 'utf8');
  fs.renameSync(tempPath, ACCOUNTS_FILE);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

export function validateUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length < 4 || raw.length > 128) {
    return null;
  }
  return raw;
}

export function registerAccount(
  usernameRaw: unknown,
  passwordRaw: unknown,
  safeWordRaw?: unknown
): { ok: true; token: string; account: StoredAccount } | { ok: false; status: number; error: string } {
  const username = validateUsername(usernameRaw);
  if (!username) {
    return {
      ok: false,
      status: 400,
      error:
        'Username must be 3 to 32 characters using only letters, numbers, dots, underscores, or hyphens.',
    };
  }

  const password = validatePassword(passwordRaw);
  if (!password) {
    return {
      ok: false,
      status: 400,
      error: 'Password must be between 4 and 128 characters.',
    };
  }

  const usernameLower = username.toLowerCase();
  const accounts = readAccounts();

  if (accounts.some((acc) => acc.usernameLower === usernameLower)) {
    return {
      ok: false,
      status: 409,
      error: 'An account with this username already exists. Please sign in instead.',
    };
  }

  const familyCircle = createDefaultFamilyCircle();
  if (typeof safeWordRaw === 'string' && safeWordRaw.trim().length > 0) {
    familyCircle.safeWord = safeWordRaw.trim().slice(0, 64);
  }

  const newAccount: StoredAccount = {
    username,
    usernameLower,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    familyCircle,
  };

  accounts.push(newAccount);
  writeAccounts(accounts);

  const token = issueSessionToken(usernameLower);
  return { ok: true, token, account: newAccount };
}

export function loginAccount(
  usernameRaw: unknown,
  passwordRaw: unknown
): { ok: true; token: string; account: StoredAccount } | { ok: false; status: number; error: string } {
  const username = typeof usernameRaw === 'string' ? usernameRaw.trim() : '';
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';

  if (!username || !password) {
    return {
      ok: false,
      status: 400,
      error: 'Please enter both your username and password.',
    };
  }

  const usernameLower = username.toLowerCase();
  const accounts = readAccounts();
  const account = accounts.find((acc) => acc.usernameLower === usernameLower);

  if (!account) {
    return {
      ok: false,
      status: 401,
      error: 'Incorrect password or unknown username.',
    };
  }

  const matches = verifyPassword(password, account.passwordHash);
  if (!matches) {
    return {
      ok: false,
      status: 401,
      error: 'Incorrect password',
    };
  }

  const token = issueSessionToken(account.usernameLower);
  return { ok: true, token, account };
}

function issueSessionToken(usernameLower: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    usernameLower,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function getAuthenticatedAccount(token: string): StoredAccount | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  const accounts = readAccounts();
  return accounts.find((acc) => acc.usernameLower === session.usernameLower) ?? null;
}

export function revokeSessionToken(token: string): void {
  if (token) {
    activeSessions.delete(token);
  }
}

export function updateAccountFamilyCircle(
  usernameLower: string,
  nextCircle: unknown
): StoredFamilyCircle | null {
  if (!nextCircle || typeof nextCircle !== 'object') {
    return null;
  }

  const rawCircle = nextCircle as { safeWord?: unknown; contacts?: unknown };
  const safeWord =
    typeof rawCircle.safeWord === 'string' && rawCircle.safeWord.trim().length > 0
      ? rawCircle.safeWord.trim().slice(0, 80)
      : 'Mango Orchard';

  const contacts: StoredContact[] = Array.isArray(rawCircle.contacts)
    ? rawCircle.contacts
        .filter(
          (c): c is StoredContact =>
            Boolean(c) &&
            typeof c === 'object' &&
            typeof (c as StoredContact).id === 'string' &&
            typeof (c as StoredContact).name === 'string' &&
            typeof (c as StoredContact).relationship === 'string' &&
            typeof (c as StoredContact).phone === 'string'
        )
        .slice(0, 20)
        .map((c) => ({
          id: c.id.slice(0, 64),
          name: c.name.trim().slice(0, 80),
          relationship: c.relationship.trim().slice(0, 40),
          phone: c.phone.trim().slice(0, 32),
        }))
    : [];

  const sanitized: StoredFamilyCircle = { safeWord, contacts };
  const accounts = readAccounts();
  const idx = accounts.findIndex((acc) => acc.usernameLower === usernameLower);
  if (idx === -1) return null;

  accounts[idx] = {
    ...accounts[idx],
    familyCircle: sanitized,
  };
  writeAccounts(accounts);
  return sanitized;
}
