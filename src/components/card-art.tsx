import type { CSSProperties } from "react";
import { cardArtworkUrl, getCardArtwork } from "@/lib/card-artwork";
import { getTemplate } from "@/lib/rules";

interface CardArtProps {
  templateId: string;
  className?: string;
  priority?: boolean;
  /** Use when the card's name is already present immediately beside the image. */
  decorative?: boolean;
}

export function CardArt({templateId, className = "", priority = false, decorative = false}: CardArtProps) {
  const artwork = getCardArtwork(templateId);
  const template = getTemplate(templateId);
  const name = artwork?.name ?? template?.name ?? "Card";
  const style: CSSProperties = {display: "block", position: "relative", aspectRatio: "1.586", flexShrink: 0};

  if (!artwork) {
    return <span className={`card-art card-art-fallback ${className}`} style={{...style, background: template?.accent ?? "#616875"}} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : `${name} · artwork unavailable`} aria-hidden={decorative || undefined}>
      <span className="card-art-fallback-name">{name}</span>
      <span className="card-art-fallback-caption">Artwork unavailable</span>
    </span>;
  }

  return <span className={`card-art ${className}`} style={style} aria-hidden={decorative || undefined}>
    {/* Local static images preserve the issuer design and need no image server. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={cardArtworkUrl(artwork.src)} width={artwork.width} height={artwork.height} alt={decorative ? "" : `${name} card artwork`} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" draggable={false} style={{display: "block", width: "100%", height: "100%", objectFit: "contain"}} />
  </span>;
}
