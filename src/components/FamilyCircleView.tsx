import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  KeyRound,
  Pencil,
  PhoneCall,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type { FamilyCircleConfig, TrustedContact } from '../types/safevoice';
import { formatTelHref } from '../utils/familyCircle';

interface FamilyCircleViewProps {
  config: FamilyCircleConfig;
  onUpdate: (nextConfig: FamilyCircleConfig) => void;
  onBackToVerify: () => void;
}

export function FamilyCircleView({
  config,
  onUpdate,
  onBackToVerify,
}: FamilyCircleViewProps) {
  const [isEditingSafeWord, setIsEditingSafeWord] = useState(false);
  const [safeWordDraft, setSafeWordDraft] = useState(config.safeWord);
  const [safeWordSavedNote, setSafeWordSavedNote] = useState(false);

  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TrustedContact | null>(null);

  function handleSaveSafeWord() {
    const trimmed = safeWordDraft.trim();
    if (!trimmed) {
      setSafeWordDraft(config.safeWord);
      setIsEditingSafeWord(false);
      return;
    }
    onUpdate({
      ...config,
      safeWord: trimmed,
    });
    setIsEditingSafeWord(false);
    setSafeWordSavedNote(true);
    window.setTimeout(() => setSafeWordSavedNote(false), 2500);
  }

  function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name = newName.trim();
    const relationship = newRelationship.trim();
    const phone = newPhone.trim();

    if (!name || !relationship || !phone) {
      setFormError('Please enter a name, relationship, and phone number.');
      return;
    }

    const newContact: TrustedContact = {
      id: `contact-${Date.now()}`,
      name,
      relationship,
      phone,
    };

    onUpdate({
      ...config,
      contacts: [...config.contacts, newContact],
    });

    setNewName('');
    setNewRelationship('');
    setNewPhone('');
  }

  function startEditContact(contact: TrustedContact) {
    setEditingId(contact.id);
    setEditDraft({ ...contact });
  }

  function saveEditContact() {
    if (!editDraft) return;
    if (
      !editDraft.name.trim() ||
      !editDraft.relationship.trim() ||
      !editDraft.phone.trim()
    ) {
      return;
    }

    onUpdate({
      ...config,
      contacts: config.contacts.map((c) =>
        c.id === editDraft.id
          ? {
              ...editDraft,
              name: editDraft.name.trim(),
              relationship: editDraft.relationship.trim(),
              phone: editDraft.phone.trim(),
            }
          : c
      ),
    });
    setEditingId(null);
    setEditDraft(null);
  }

  function handleDeleteContact(id: string) {
    onUpdate({
      ...config,
      contacts: config.contacts.filter((c) => c.id !== id),
    });
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
            Family Circle Protection Setup
          </h1>
          <p className="text-base text-slate-600 mt-1 break-words">
            Configure your private Family Safe Word and trusted callback numbers. Saved securely to your account.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToVerify}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-base font-semibold text-slate-900 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Call Checker</span>
        </button>
      </div>

      {/* Section 1: Family Safe Word */}
      <section
        aria-labelledby="safeword-heading"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-xs min-w-0"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="safeword-heading"
                className="text-xl font-bold text-slate-900"
              >
                Family Safe Word / Secret Phrase
              </h2>
              <p className="text-base text-slate-600 mt-1 max-w-2xl break-words">
                Choose a memorable phrase shared only offline with family members. If anyone calls in a panic asking for money, ask for this phrase first.
              </p>
            </div>
          </div>

          {!isEditingSafeWord && (
            <button
              type="button"
              onClick={() => {
                setSafeWordDraft(config.safeWord);
                setIsEditingSafeWord(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              <span>Edit Safe Word</span>
            </button>
          )}
        </div>

        <div className="mt-6">
          {isEditingSafeWord ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-xl">
              <label htmlFor="safe-word-input" className="sr-only">
                Family Safe Word
              </label>
              <input
                id="safe-word-input"
                type="text"
                value={safeWordDraft}
                onChange={(e) => setSafeWordDraft(e.target.value)}
                placeholder="e.g., Mango Orchard"
                className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-slate-300 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={handleSaveSafeWord}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-base font-semibold"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Save Phrase</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSafeWordDraft(config.safeWord);
                  setIsEditingSafeWord(false);
                }}
                className="w-full sm:w-auto px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-base font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 min-w-0">
              <div className="w-full sm:w-auto px-6 py-4 rounded-xl bg-slate-900 text-white text-xl sm:text-2xl font-extrabold tracking-tight break-words text-center sm:text-left">
                “{config.safeWord}”
              </div>
              {safeWordSavedNote && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Saved to account</span>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Trusted Contacts List */}
      <section
        aria-labelledby="contacts-heading"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-xs min-w-0"
      >
        <div className="flex items-start sm:items-center gap-3 pb-5 border-b border-slate-200 min-w-0">
          <Users className="w-5 h-5 text-slate-800 shrink-0 mt-1 sm:mt-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="contacts-heading" className="text-xl font-bold text-slate-900">
              Trusted Family Callback Numbers
            </h2>
            <p className="text-base text-slate-600 mt-0.5 break-words">
              These numbers appear automatically on Medium and High Risk alert screens for instant one-tap verification.
            </p>
          </div>
        </div>

        {/* Contact Rows */}
        <div className="mt-5 divide-y divide-slate-200">
          {config.contacts.length === 0 ? (
            <p className="py-6 text-base text-slate-600">
              No trusted contacts configured yet. Add a family member below.
            </p>
          ) : (
            config.contacts.map((contact) => {
              const isEditing = editingId === contact.id && editDraft;
              return (
                <div key={contact.id} className="py-4 min-w-0">
                  {isEditing && editDraft ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                      <input
                        type="text"
                        aria-label="Contact name"
                        value={editDraft.name}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, name: e.target.value })
                        }
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-lg border border-slate-300 text-base text-slate-900"
                      />
                      <input
                        type="text"
                        aria-label="Relationship"
                        value={editDraft.relationship}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            relationship: e.target.value,
                          })
                        }
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-lg border border-slate-300 text-base text-slate-900"
                      />
                      <input
                        type="tel"
                        aria-label="Phone number"
                        value={editDraft.phone}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, phone: e.target.value })
                        }
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-lg border border-slate-300 text-base font-mono text-slate-900"
                      />
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          type="button"
                          onClick={saveEditContact}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(null);
                          }}
                          className="w-full sm:w-auto px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-900 break-words">
                          {contact.name}
                        </div>
                        <div className="text-base text-slate-600 break-words">
                          {contact.relationship} ·{' '}
                          <span className="font-mono tabular-nums text-slate-800">
                            {contact.phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <a
                          href={formatTelHref(contact.phone)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-sm font-semibold text-blue-800"
                        >
                          <PhoneCall className="w-4 h-4" aria-hidden="true" />
                          <span>Call</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => startEditContact(contact)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(contact.id)}
                          aria-label={`Remove ${contact.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Contact Form */}
        <form
          onSubmit={handleAddContact}
          className="mt-6 pt-6 border-t border-slate-200"
        >
          <h3 className="text-base font-bold text-slate-900 mb-3">
            Add Trusted Family Member
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="contact-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Priya Sharma"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="contact-rel" className="block text-sm font-medium text-slate-700 mb-1">
                Relationship
              </label>
              <input
                id="contact-rel"
                type="text"
                value={newRelationship}
                onChange={(e) => setNewRelationship(e.target.value)}
                placeholder="e.g., Daughter"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="block text-sm font-medium text-slate-700 mb-1">
                Saved Phone Number
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g., +91 98765 43210"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 text-base font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Contact</span>
              </button>
            </div>
          </div>
          {formError && (
            <p role="alert" className="mt-2.5 text-sm font-medium text-red-700">
              {formError}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
