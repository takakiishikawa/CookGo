export function ChefHatIcon({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 21h8" />
      <path d="M8 21v-5" />
      <path d="M16 21v-5" />
      <path d="M18 10.5a4 4 0 0 0-3-6.4A3.5 3.5 0 0 0 8.7 3a3.5 3.5 0 0 0-3 5.3A4 4 0 0 0 6 16h12a4 4 0 0 0 0-5.5Z" />
    </svg>
  );
}
