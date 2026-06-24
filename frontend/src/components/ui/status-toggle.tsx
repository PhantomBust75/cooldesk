interface StatusToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function StatusToggle({ active, onToggle, disabled = false, loading = false }: StatusToggleProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "9999px",
        border: `1px solid ${active ? "#10B981" : "#E5E5E5"}`,
        backgroundColor: active ? "rgba(16,185,129,0.10)" : "#F5F5F5",
        color: active ? "#10B981" : "#737373",
        fontSize: "12px",
        fontWeight: 500,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "opacity 120ms ease",
      }}
      aria-pressed={active}
      aria-label={active ? "Set inactive" : "Set active"}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: active ? "#10B981" : "#737373",
        }}
      />
      {active ? "Active" : "Inactive"}
    </button>
  );
}
