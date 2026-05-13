export const C = {
  // ── Synchrony brand ──────────────────────────────────────────────────────
  gold:         "#FBC600",
  goldDark:     "#D9A800",
  goldSubtle:   "#fffae8",
  charcoal:     "#3B3C43",
  charcoalDark: "#2a2b30",
  white:        "#fbfbf8",
  muted:        "#6f737d",

  // ── Semantic (kept for SVG fills, inline borders, etc.) ──────────────────
  border:       "rgba(255,255,255,0.26)",
  bg:           "rgba(18,20,28,0.86)",
  pageBg:       "radial-gradient(circle at 12% 8%, rgba(251,198,0,0.26) 0, transparent 28%), radial-gradient(circle at 88% 12%, rgba(98,108,132,0.22) 0, transparent 28%), linear-gradient(135deg, #13151d 0%, #202331 52%, #171923 100%)",

  // ── Glassmorphism ─────────────────────────────────────────────────────────
  glassBg:         "rgba(248,248,242,0.86)",
  glassBgSubtle:   "rgba(255,255,255,0.11)",
  glassBorder:     "rgba(255,255,255,0.28)",
  glassBorderDark: "rgba(255,255,255,0.14)",
  goldGlass:       "rgba(251,198,0,0.18)",
  goldGlassBorder: "rgba(251,198,0,0.42)",
  cyan:            "#54D6FF",
  cyanGlass:       "rgba(84,214,255,0.14)",
  cyanGlassBorder: "rgba(84,214,255,0.34)",
  violet:          "#9D7CFF",
  violetGlass:     "rgba(157,124,255,0.13)",
  /** Warm fills inside glass panels (replaces flat grey) */
  inset:           "rgba(255,252,245,0.82)",
  insetMuted:      "rgba(255,248,235,0.65)",
  insetBorder:     "rgba(255,255,255,0.50)",
  dividerWarm:     "rgba(251,198,0,0.14)",
  darkCanvas:      "#13151d",
  panelShadow:     "0 22px 60px rgba(4,8,18,0.24), 0 2px 0 rgba(255,255,255,0.28) inset",
  softShadow:      "0 14px 34px rgba(5,8,16,0.18)",
  focusRing:       "0 0 0 3px rgba(251,198,0,0.28)",

  // ── Status / feedback ─────────────────────────────────────────────────────
  red:          "#dc2626",
  redBg:        "rgba(254,242,242,0.88)",
  redBorder:    "rgba(252,165,165,0.76)",
  green:        "#059669",
  greenBg:      "rgba(240,253,244,0.88)",
  blue:         "#0057a8",
  blueBg:       "rgba(239,246,255,0.88)",
  orange:       "#d97706",
  orangeBg:     "rgba(255,251,235,0.90)",
  yellow:       "#ca8a04",
} as const;

export const FONT = "'Synchrony Sans', Arial, sans-serif";

/** Spread this onto any card/panel container that should be a frosted glass surface. */
export const GLASS_CARD_STYLE = {
  background:           "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,248,0.72))",
  backdropFilter:       "blur(22px) saturate(140%)",
  WebkitBackdropFilter: "blur(22px) saturate(140%)",
  border:               "1px solid rgba(255,255,255,0.34)",
  boxShadow:            C.panelShadow,
} as const;
