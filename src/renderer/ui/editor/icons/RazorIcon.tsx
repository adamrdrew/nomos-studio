import React from 'react';

export function RazorIcon(props: { size?: number; color?: string }): JSX.Element {
  const size = props.size ?? 16;
  const color = props.color ?? 'currentColor';

  // Simple, original razor-blade glyph: a thin blade with a small notch and handle line.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 9 L18 6 L21 9 L6 12 L3 9 Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M7 11 L8.6 14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M9.5 10.5 L11.3 13.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M12 10 L14 13" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M14.5 9.5 L16.8 12.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <path
        d="M6 12 L5 17.5"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M5 17.5 L6.8 20"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
