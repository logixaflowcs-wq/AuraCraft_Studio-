import React from 'react';

interface AuraCraftLogoProps {
  size?: number;
  className?: string;
}

export const AuraCraftLogo: React.FC<AuraCraftLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="uiAuraGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="45%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      <rect x="40" y="40" width="420" height="420" rx="80" fill="#0c101c" stroke="url(#uiAuraGrad)" strokeWidth="18" />

      {/* 3D Holographic Faceted "A" */}
      <polygon points="250,110 180,270 220,270 250,185" fill="#8b5cf6" opacity="0.9" />
      <polygon points="250,110 220,270 250,250" fill="#a855f7" opacity="0.8" />
      <polygon points="250,110 320,270 280,270 250,185" fill="#ec4899" opacity="0.9" />
      <polygon points="250,110 280,270 250,250" fill="#f43f5e" opacity="0.8" />

      <polygon points="180,270 150,345 200,345 220,270" fill="url(#uiAuraGrad)" />
      <polygon points="320,270 350,345 300,345 280,270" fill="url(#uiAuraGrad)" />

      {/* Floating Center Crystal */}
      <polygon points="250,210 285,260 250,310 215,260" fill="#06b6d4" />
      <polygon points="250,210 250,310 215,260" fill="#38bdf8" opacity="0.8" />

      {/* Viseme Dots */}
      <circle cx="120" cy="240" r="10" fill="#38bdf8" />
      <circle cx="380" cy="240" r="10" fill="#ec4899" />
    </svg>
  );
};
