import React from 'react';

export function ScissorsIcon(props: { size?: number; color?: string }): JSX.Element {
  const size = props.size ?? 16;
  const color = props.color ?? 'currentColor';

  // A simple, high-contrast scissors glyph that reads clearly at 16px.
  // Drawn locally (not copied) to avoid relying on external icon sets.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={true}
      focusable={false}
    >
      <circle cx="4.25" cy="11.75" r="1.75" stroke={color} strokeWidth="1.5" />
      <circle cx="4.25" cy="4.25" r="1.75" stroke={color} strokeWidth="1.5" />

      <path d="M5.6 5.4 L14.6 0.9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.6 10.6 L14.6 15.1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M6.0 7.2 L8.2 8.0" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.0 8.8 L8.2 8.0" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
