import React from "react";

export default function ContentImage({ src, alt = "", className = "", imageClassName = "", draggable, fit = "contain" }) {
  if (!src) return null;
  const cover = fit === "cover";
  return (
    <div className={`relative isolate overflow-hidden ${cover ? "bg-transparent" : "bg-tossGrey50"} ${className}`}>
      {!cover && <img src={src} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />}
      <img src={src} alt={alt} draggable={draggable} className={`relative z-10 w-full ${cover ? "object-cover" : "object-contain"} ${imageClassName}`} />
    </div>
  );
}
