interface Props {
  size?: number;
  className?: string;
}

// A geometric mark: a serifed S-curve flowing into a magnifying lens — "story" + "scope".
export default function Logo({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="StoryScope"
      className={className}
    >
      <circle cx="13" cy="13" r="8.5" />
      <path d="M10 16 C 10 12, 16 12, 16 9 C 16 6.5, 13.5 6, 11 7" />
      <line x1="19.2" y1="19.2" x2="27" y2="27" />
    </svg>
  );
}
