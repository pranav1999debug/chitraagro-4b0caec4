import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <>
      <div className="modal-overlay" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-card rounded-xl p-6 z-50 max-w-sm mx-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-heading text-base font-bold">{title}</h3>
          <button onClick={onCancel}><X size={18} className="text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground font-body mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg px-4 py-3 font-heading font-semibold text-sm transition-opacity active:opacity-90 ${
              variant === 'danger' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
            }`}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="flex-1 rounded-lg border border-border py-3 text-muted-foreground font-heading text-sm">
            {cancelLabel}
          </button>
        </div>
      </div>
    </>
  );
}
