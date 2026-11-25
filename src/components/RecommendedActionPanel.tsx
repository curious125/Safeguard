import { KeyRound, PhoneCall, PhoneOff, ShieldCheck, Users } from 'lucide-react';
import type { FamilyCircleConfig, RiskFusionResult } from '../types/safevoice';
import { formatTelHref } from '../utils/familyCircle';

interface RecommendedActionPanelProps {
  fusion: RiskFusionResult;
  familyCircle: FamilyCircleConfig;
  onOpenFamilyCircle: () => void;
}

export function RecommendedActionPanel({
  fusion,
  familyCircle,
  onOpenFamilyCircle,
}: RecommendedActionPanelProps) {
  const isElevated =
    fusion.riskLevel === 'HIGH RISK' || fusion.riskLevel === 'MEDIUM RISK';

  if (!isElevated && !fusion.hasPaymentMention) {
    return null;
  }

  // Low risk with payment mention: show a concise safety reminder
  if (!isElevated && fusion.hasPaymentMention) {
    return (
      <section
        aria-labelledby="action-reminder-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <ShieldCheck
              className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <h3
                id="action-reminder-heading"
                className="text-lg font-bold text-slate-900"
              >
                Money Mentioned — Quick Safety Reminder
              </h3>
              <p className="text-base text-slate-700 mt-1">
                Although this clip scored as Low Risk, any request involving money or payments is safest when confirmed with your Family Safe Word ({' '}
                <strong className="text-slate-900">{familyCircle.safeWord}</strong>
                ).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenFamilyCircle}
            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0"
          >
            View Family Circle
          </button>
        </div>
      </section>
    );
  }

  const isHigh = fusion.riskLevel === 'HIGH RISK';

  return (
    <section
      aria-labelledby="recommended-action-heading"
      className={`rounded-xl border p-6 sm:p-8 shadow-xs ${
        isHigh
          ? 'bg-white border-red-300'
          : 'bg-white border-amber-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div
            className={`text-sm font-bold uppercase tracking-wide ${
              isHigh ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            Recommended Action Plan
          </div>
          <h3
            id="recommended-action-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 mt-1"
          >
            Follow These 3 Steps Before Taking Action
          </h3>
        </div>

        <button
          type="button"
          onClick={onOpenFamilyCircle}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Users className="w-4 h-4" aria-hidden="true" />
          <span>Edit Family Circle</span>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Hang Up */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-red-700 font-bold text-base">
              <PhoneOff className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Step 1 · Hang Up Immediately</span>
            </div>
            <p className="text-base text-slate-800 mt-3 leading-relaxed">
              End the call right away. Do not transfer money, scan any QR code, or share OTPs, bank details, or your UPI PIN.
            </p>
          </div>
        </div>

        {/* Step 2: Call Back Trusted Number */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base">
            <PhoneCall className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Step 2 · Call Back on Saved Number</span>
          </div>
          <p className="text-sm sm:text-base text-slate-700 mt-2.5 leading-relaxed">
            Dial your family member directly using their saved number below—never redial the incoming caller ID.
          </p>

          <div className="mt-4 space-y-2.5">
            {familyCircle.contacts.length > 0 ? (
              familyCircle.contacts.map((contact) => (
                <a
                  key={contact.id}
                  href={formatTelHref(contact.phone)}
                  className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-lg bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <div className="min-w-0">
                    <div className="text-base font-bold truncate">
                      {contact.name}
                    </div>
                    <div className="text-xs text-slate-600">
                      {contact.relationship} ·{' '}
                      <span className="font-mono tabular-nums">{contact.phone}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 shrink-0">
                    <PhoneCall className="w-4 h-4" aria-hidden="true" />
                    <span>Call</span>
                  </span>
                </a>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No trusted contacts saved yet. Add contacts in Family Circle.
              </p>
            )}
          </div>
        </div>

        {/* Step 3: Family Safe Word */}
        <div className="rounded-xl bg-slate-900 text-white p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-amber-300 font-bold text-base">
              <KeyRound className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Step 3 · Ask for Family Safe Word</span>
            </div>
            <p className="text-base text-slate-200 mt-3 leading-relaxed">
              Ask the caller to say your private family phrase. An AI voice clone or stranger will not know it.
            </p>
          </div>

          <div className="mt-5 rounded-lg bg-slate-800 border border-slate-700 p-4 text-center">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Active Family Safe Word
            </div>
            <div className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">
              “{familyCircle.safeWord}”
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
