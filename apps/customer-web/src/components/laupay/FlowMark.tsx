/**
 * LAUPAY flow-bridge mark used by the marketing site and authenticated app.
 * Keep the geometry and colors aligned with web/src/components/laupay/FlowMark.
 */
export function FlowMark({
  inverse = false,
  size = 32,
  className = "",
}: {
  inverse?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ height: size, width: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible">
        <path
          d="M8 7v14c0 4 2.5 6 6.5 6H21"
          fill="none"
          stroke={inverse ? "#FFFFFF" : "#171A4A"}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 7h8.5c4 0 5.5 2.5 5.5 6v8c0 4-2.5 6-6.5 6H15"
          fill="none"
          stroke="#F4B33F"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default FlowMark;