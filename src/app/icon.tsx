/**
 * App Icon - Favicon for browser tab
 * Next.js will automatically use this as favicon.ico
 */

export default function Icon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      
      <rect
        width="32"
        height="32"
        rx="8"
        fill="url(#gradient)"
      />
      
      <path
        d="M8 12C8 10.8954 8.89543 10 10 10H18C19.1046 10 20 10.8954 20 12V18C20 19.1046 19.1046 20 18 20H13L9 24V20C8.89543 20 8 19.1046 8 18V12Z"
        fill="white"
        fillOpacity="0.9"
      />
      
      <circle cx="12" cy="15" r="1.5" fill="#6366f1" />
      <circle cx="16" cy="15" r="1.5" fill="#6366f1" />
      <circle cx="20" cy="15" r="1.5" fill="#6366f1" />
    </svg>
  );
}
