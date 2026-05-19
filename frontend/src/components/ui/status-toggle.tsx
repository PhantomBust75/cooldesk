interface StatusToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function StatusToggle({ active, onToggle, disabled = false }: StatusToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "9999px",
        border: `1px solid ${active ? "#CCFBF1" : "#E5E5E5"}`,
        backgroundColor: active ? "#F0FDFA" : "#F5F5F5",
        color: active ? "#134E4A" : "#525252",
        fontSize: "12px",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
      aria-pressed={active}
      aria-label={active ? "Set inactive" : "Set active"}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: active ? "#10B981" : "#A3A3A3",
        }}
      />
      {active ? "Active" : "Inactive"}
    </button>
  );
}
