import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export function ConfirmDeleteDialog({ open, title = "Hapus data?", message, item, onClose, onConfirm, confirmLabel = "Ya, Hapus" }) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const doConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-testid="confirm-delete-dialog" className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-800" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {message && <p className="text-xs text-slate-500 mt-1">{message}</p>}
          </div>
        </div>
        {item && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
            {Object.entries(item).map(([k, v]) => (
              <div key={k}><span className="text-slate-500">{k}:</span>{" "}<span className="font-semibold text-slate-900">{String(v)}</span></div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} data-testid="confirm-delete-cancel"
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50">Batal</button>
          <button type="button" onClick={doConfirm} disabled={busy} data-testid="confirm-delete-yes"
            className="inline-flex items-center px-4 py-2 bg-red-900 text-white rounded-md text-xs font-semibold hover:bg-red-800 disabled:opacity-60">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />{busy ? "Menghapus..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalShell({ open, title, onClose, children, testid = "form-modal" }) {
  if (!open) return null;
  return (
    <div data-testid={testid} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} type="button" className="text-slate-400 hover:text-slate-600" data-testid={`${testid}-close`}>
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white focus:ring-1 focus:ring-red-900 focus:outline-none placeholder-slate-400";

export function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-800 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-800 mt-1">{error}</p>}
    </div>
  );
}

export const btnPrimary = "inline-flex items-center px-4 py-2 bg-red-900 text-white rounded-md text-xs font-semibold hover:bg-red-800 disabled:opacity-60";
export const btnGhost = "px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50";
