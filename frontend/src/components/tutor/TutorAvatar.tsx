import { useId } from "react";

/** Ilustración local de la guía; no representa a una persona conectada. */
export function TutorAvatar({
  small = false,
  estado = "reposo",
}: {
  small?: boolean;
  estado?: "reposo" | "pensando" | "celebrando" | "atento";
}) {
  const id = useId().replace(/:/g, "");
  return (
    <span
      className={`tutor-avatar${small ? " tutor-avatar--small" : ""} tw-avatar--${estado}`}
      data-estado={estado}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="64" y2="64">
            <stop stopColor="#F2CBC3" />
            <stop offset="1" stopColor="#FFF0E6" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
        <path
          d="M16 33C11 13 24 7 34 9c15-2 20 10 17 25l5 20H11l5-21Z"
          fill="#352329"
        />
        <path d="M14 64c1-15 7-20 18-20s19 6 21 20" fill="#9B2545" />
        <path d="M27 41v8c0 6 11 6 11 0v-9" fill="#D99579" />
        <path
          d="M21 27c0-9 6-13 13-13 9 0 12 7 12 14l-2 12c-2 5-6 9-11 9-6 0-11-5-12-11V27Z"
          fill="#EDB18F"
        />
        <path
          d="M20 31c-3-10 0-19 11-19l11 2 4 13c-6-1-9-6-10-9-1 9-10 10-16 13Z"
          fill="#352329"
        />
        <path
          d="M26 31h3m9 0h3"
          stroke="#513137"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d={
            estado === "atento"
              ? "M31 40h6"
              : estado === "celebrando"
                ? "M29 38c3 6 7 6 10 0"
                : "M31 39c2 2 4 2 6 0"
          }
          stroke="#9B514B"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M33 32v4h2" stroke="#C88169" strokeLinecap="round" />
      </svg>
    </span>
  );
}
