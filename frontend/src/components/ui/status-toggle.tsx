interface StatusToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function StatusToggle({ active, onToggle, disabled = false, loading = false }: StatusToggleProps) {
  const isDisabled = disabled || loading;

  function handleActiveClick() {
    if (!active && !isDisabled) onToggle();
  }

  function handleInactiveClick() {
    if (active && !isDisabled) onToggle();
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        backgroundColor: '#EBEBEB',
        borderRadius: '9999px',
        padding: '3px',
        gap: '2px',
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {/* Active side */}
      <button
        type="button"
        onClick={handleActiveClick}
        disabled={isDisabled}
        aria-pressed={active}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: active ? '#ECFDF5' : 'transparent',
          cursor: active || isDisabled ? 'default' : 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          color: active ? '#065F46' : '#A3A3A3',
          transition: 'background-color 180ms, color 180ms',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: active ? '#34D399' : 'transparent',
          }}
        />
        Active
      </button>

      {/* Inactive side */}
      <button
        type="button"
        onClick={handleInactiveClick}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: !active ? '#F1F5F9' : 'transparent',
          cursor: !active || isDisabled ? 'default' : 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          color: !active ? '#475569' : '#A3A3A3',
          transition: 'background-color 180ms, color 180ms',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: !active ? '#94A3B8' : 'transparent',
          }}
        />
        Inactive
      </button>
    </div>
  );
}
