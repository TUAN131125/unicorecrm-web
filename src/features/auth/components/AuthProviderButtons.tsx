import React from "react";

export type ExternalAuthProvider = "google" | "microsoft";

interface AuthProviderButtonsProps {
  onSelect: (provider: ExternalAuthProvider) => void;
  disabled?: boolean;
}

const GoogleMark = () => (
  <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#4285F4] shadow-sm ring-1 ring-slate-200">G</span>
);

const MicrosoftMark = () => (
  <span aria-hidden="true" className="grid h-4 w-4 grid-cols-2 gap-[2px]">
    <span className="bg-[#f25022]" />
    <span className="bg-[#7fba00]" />
    <span className="bg-[#00a4ef]" />
    <span className="bg-[#ffb900]" />
  </span>
);

export const AuthProviderButtons: React.FC<AuthProviderButtonsProps> = ({ onSelect, disabled = false }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <button
      type="button"
      onClick={() => onSelect("google")}
      disabled={disabled}
      className="flex h-11 items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/45 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <GoogleMark /> Google
    </button>
    <button
      type="button"
      onClick={() => onSelect("microsoft")}
      disabled={disabled}
      className="flex h-11 items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/45 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <MicrosoftMark /> Microsoft
    </button>
  </div>
);

export const AuthDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
    <span className="h-px flex-1 bg-slate-200" />
    <span>{label}</span>
    <span className="h-px flex-1 bg-slate-200" />
  </div>
);
