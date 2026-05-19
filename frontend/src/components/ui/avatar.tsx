const PALETTE = ["#E8D5C4", "#C4D5E8", "#C4E8D5", "#E8C4D5", "#D5E8C4", "#D5C4E8"];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string) {
  const index = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTE.length;
  return PALETTE[index];
}

interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 36 }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "9999px",
        backgroundColor: avatarColor(name),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.max(11, Math.round(size * 0.34))}px`,
        fontWeight: 600,
        color: "#404040",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials(name) || "?"}
    </span>
  );
}
