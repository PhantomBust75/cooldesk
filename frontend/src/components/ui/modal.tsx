import { Lock, X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  blocking?: boolean;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, blocking, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={() => !blocking && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          width: "480px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          boxShadow: "0 10px 38px rgba(0,0,0,0.10), 0 10px 20px rgba(0,0,0,0.06)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E5E5E5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: blocking ? "#FFFBEB" : "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {blocking && <Lock size={16} strokeWidth={1.5} color="#B45309" />}
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{title}</span>
            {blocking && (
              <span
                style={{
                  padding: "2px 8px",
                  backgroundColor: "#FEF3C7",
                  color: "#92400E",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                Action required
              </span>
            )}
          </div>
          {!blocking && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#737373",
                lineHeight: 0,
              }}
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div style={{ padding: "20px", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
