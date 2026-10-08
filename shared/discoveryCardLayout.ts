/**
 * Bounded discovery-card layout config.
 * Parser never throws — invalid input falls back to defaults + clamps.
 */

export const DISCOVERY_CARD_WIDGETS = [
  'statusBadge',
  'verifiedIcon',
  'name',
  'age',
  'flag',
  'country',
  'callButton',
] as const;

export type DiscoveryCardWidgetId = (typeof DISCOVERY_CARD_WIDGETS)[number];

export const DISCOVERY_CARD_SLOTS = [
  'topLeft',
  'topRight',
  'metaPrimary',
  'metaSecondary',
  'footerLeft',
  'footerCenter',
  'footerRight',
] as const;

export type DiscoveryCardSlotId = (typeof DISCOVERY_CARD_SLOTS)[number];

export const WIDGET_ALLOWED_SLOTS: Record<DiscoveryCardWidgetId, readonly DiscoveryCardSlotId[]> = {
  statusBadge: ['topLeft', 'topRight', 'metaPrimary', 'metaSecondary'],
  verifiedIcon: ['topLeft', 'topRight', 'metaPrimary', 'metaSecondary'],
  name: ['metaPrimary', 'metaSecondary', 'topLeft', 'topRight'],
  age: ['metaPrimary', 'metaSecondary', 'topLeft', 'topRight'],
  flag: ['metaPrimary', 'metaSecondary', 'topLeft', 'topRight'],
  country: ['metaPrimary', 'metaSecondary', 'topLeft', 'topRight'],
  callButton: ['footerLeft', 'footerCenter', 'footerRight'],
};

/** Horizontal align for the line this widget starts (or belongs to as first on line). */
export type DiscoveryHAlign = 'left' | 'right';

export const H_ALIGN_LABELS: Record<DiscoveryHAlign, string> = {
  left: 'Left',
  right: 'Right',
};

export const WIDGET_DEFAULT_SLOT: Record<DiscoveryCardWidgetId, DiscoveryCardSlotId> = {
  statusBadge: 'topLeft',
  verifiedIcon: 'topRight',
  name: 'metaPrimary',
  age: 'metaPrimary',
  flag: 'metaPrimary',
  country: 'metaPrimary',
  callButton: 'footerCenter',
};

export const CHIP_WIDGETS: readonly DiscoveryCardWidgetId[] = [
  'statusBadge',
  'verifiedIcon',
  'age',
  'flag',
];

export const SIZE_BOUNDS = {
  nameFontPx: { min: 11, max: 20, default: 14 },
  metaFontPx: { min: 10, max: 16, default: 11 },
  badgeFontPx: { min: 9, max: 14, default: 11 },
  verifiedIconPx: { min: 12, max: 22, default: 16 },
  callButtonPx: { min: 36, max: 56, default: 44 },
  callIconPx: { min: 14, max: 24, default: 20 },
} as const;

/** Per-widget padding (px), clamped so layout cannot blow out the card. */
export const PAD_BOUNDS = { min: 0, max: 16, default: 0 } as const;

/**
 * Share of the line width (10–100). 0 = auto (content-sized).
 * Example: Name 80 + Status 20 on one line; Country 100 on the next (full width).
 */
export const WIDTH_BOUNDS = { min: 0, max: 100, default: 0 } as const;

export type DiscoveryFlagSize = 'xs' | 'sm' | 'md';
export type DiscoveryAspectMobile = '2/3' | '9/16';
export type DiscoveryAspectDesktop = '3/4' | '2/3';
export type DiscoveryCallStyle = 'circle' | 'pill';
export type DiscoveryPhotoSource = 'avatarThenGallery' | 'avatar' | 'galleryFirst';
export type DiscoveryPhotoFit = 'cover' | 'contain';
export type DiscoveryPhotoPosition = 'center' | 'top' | 'bottom';

export interface DiscoveryCardWidgetConfig {
  id: DiscoveryCardWidgetId;
  enabled: boolean;
  slot: DiscoveryCardSlotId;
  /** Lower = earlier in the slot's flex order */
  order: number;
  /**
   * When true, this widget starts on a new line within its slot
   * (e.g. name on line 1; flag with nextLine → line 2; country/age same line after flag).
   */
  nextLine: boolean;
  /** Align the line that contains this widget (used from the first widget on that line). */
  hAlign: DiscoveryHAlign;
  /** Outer padding around the widget (px), each side clamped 0–16. */
  padT: number;
  padR: number;
  padB: number;
  padL: number;
  /**
   * Line width share (0 = auto; 10–100 = %).
   * Use 100 for a full-width row (e.g. long country name on its own line).
   */
  widthPercent: number;
}

export interface DiscoveryCardLayout {
  version: 1;
  widgets: DiscoveryCardWidgetConfig[];
  nameFontPx: number;
  metaFontPx: number;
  badgeFontPx: number;
  verifiedIconPx: number;
  flagSize: DiscoveryFlagSize;
  callButtonPx: number;
  callIconPx: number;
  cardAspectMobile: DiscoveryAspectMobile;
  cardAspectDesktop: DiscoveryAspectDesktop;
  callStyle: DiscoveryCallStyle;
  /** Show host photo as card background */
  showPhoto: boolean;
  /** Which media field to prefer for the card image */
  photoSource: DiscoveryPhotoSource;
  photoFit: DiscoveryPhotoFit;
  photoPosition: DiscoveryPhotoPosition;
}

export const SLOT_LABELS: Record<DiscoveryCardSlotId, string> = {
  topLeft: 'Top Left',
  topRight: 'Top Right',
  metaPrimary: 'Meta Primary',
  metaSecondary: 'Meta Secondary',
  footerLeft: 'Footer Left',
  footerCenter: 'Footer Center',
  footerRight: 'Footer Right',
};

export const WIDGET_LABELS: Record<DiscoveryCardWidgetId, string> = {
  statusBadge: 'Status Badge',
  verifiedIcon: 'Verified Icon',
  name: 'Name',
  age: 'Age',
  flag: 'Flag',
  country: 'Country',
  callButton: 'Call Button',
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isWidgetId(v: unknown): v is DiscoveryCardWidgetId {
  return typeof v === 'string' && (DISCOVERY_CARD_WIDGETS as readonly string[]).includes(v);
}

function isSlotId(v: unknown): v is DiscoveryCardSlotId {
  return typeof v === 'string' && (DISCOVERY_CARD_SLOTS as readonly string[]).includes(v);
}

function defaultWidgets(): DiscoveryCardWidgetConfig[] {
  return DISCOVERY_CARD_WIDGETS.map((id, index) => ({
    id,
    enabled: id !== 'age',
    slot: WIDGET_DEFAULT_SLOT[id],
    order: index,
    // Flag then country: each can start a line; country is full width by default
    nextLine: id === 'flag' || id === 'country',
    hAlign: id === 'verifiedIcon' || id === 'callButton' ? 'right' : 'left',
    padT: PAD_BOUNDS.default,
    padR: PAD_BOUNDS.default,
    padB: PAD_BOUNDS.default,
    padL: PAD_BOUNDS.default,
    widthPercent: id === 'country' ? 100 : WIDTH_BOUNDS.default,
  }));
}

export const DEFAULT_DISCOVERY_CARD_LAYOUT: DiscoveryCardLayout = {
  version: 1,
  widgets: defaultWidgets(),
  nameFontPx: SIZE_BOUNDS.nameFontPx.default,
  metaFontPx: SIZE_BOUNDS.metaFontPx.default,
  badgeFontPx: SIZE_BOUNDS.badgeFontPx.default,
  verifiedIconPx: SIZE_BOUNDS.verifiedIconPx.default,
  flagSize: 'sm',
  callButtonPx: SIZE_BOUNDS.callButtonPx.default,
  callIconPx: SIZE_BOUNDS.callIconPx.default,
  cardAspectMobile: '9/16',
  cardAspectDesktop: '3/4',
  callStyle: 'circle',
  showPhoto: true,
  photoSource: 'avatarThenGallery',
  photoFit: 'cover',
  photoPosition: 'center',
};

function coerceFlagSize(v: unknown): DiscoveryFlagSize {
  return v === 'xs' || v === 'md' || v === 'sm' ? v : 'sm';
}

function coerceAspectMobile(v: unknown): DiscoveryAspectMobile {
  return v === '2/3' || v === '9/16' ? v : '9/16';
}

function coerceAspectDesktop(v: unknown): DiscoveryAspectDesktop {
  return v === '2/3' || v === '3/4' ? v : '3/4';
}

function coerceCallStyle(v: unknown): DiscoveryCallStyle {
  return v === 'pill' || v === 'circle' ? v : 'circle';
}

function coercePhotoSource(v: unknown): DiscoveryPhotoSource {
  return v === 'avatar' || v === 'galleryFirst' || v === 'avatarThenGallery' ? v : 'avatarThenGallery';
}

function coercePhotoFit(v: unknown): DiscoveryPhotoFit {
  return v === 'contain' || v === 'cover' ? v : 'cover';
}

function coercePhotoPosition(v: unknown): DiscoveryPhotoPosition {
  return v === 'top' || v === 'bottom' || v === 'center' ? v : 'center';
}

function coerceHAlign(v: unknown, fallback: DiscoveryHAlign): DiscoveryHAlign {
  return v === 'left' || v === 'right' ? v : fallback;
}

/** Split ordered widgets into lines using nextLine flags. */
export function splitSlotIntoLines(
  widgets: DiscoveryCardWidgetConfig[]
): DiscoveryCardWidgetConfig[][] {
  const lines: DiscoveryCardWidgetConfig[][] = [];
  for (const w of widgets) {
    if (lines.length === 0 || w.nextLine) {
      lines.push([w]);
    } else {
      lines[lines.length - 1].push(w);
    }
  }
  return lines;
}

/** Merge raw widget list with defaults; fix illegal slots; ensure all known widgets exist. */
function normalizeWidgets(raw: unknown): DiscoveryCardWidgetConfig[] {
  const byId = new Map<DiscoveryCardWidgetId, DiscoveryCardWidgetConfig>();
  for (const d of defaultWidgets()) byId.set(d.id, { ...d });

  if (Array.isArray(raw)) {
    raw.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const id = (item as any).id;
      if (!isWidgetId(id)) return;
      const allowed = WIDGET_ALLOWED_SLOTS[id];
      let slot = (item as any).slot;
      if (!isSlotId(slot) || !allowed.includes(slot)) {
        slot = WIDGET_DEFAULT_SLOT[id];
      }
      const def = byId.get(id)!;
      const enabled = Boolean((item as any).enabled);
      const order = clampInt((item as any).order, 0, 999, idx);
      const nextLine = (item as any).nextLine !== undefined ? Boolean((item as any).nextLine) : def.nextLine;
      const hAlign = coerceHAlign((item as any).hAlign, def.hAlign);
      const padT = clampInt((item as any).padT, PAD_BOUNDS.min, PAD_BOUNDS.max, def.padT);
      const padR = clampInt((item as any).padR, PAD_BOUNDS.min, PAD_BOUNDS.max, def.padR);
      const padB = clampInt((item as any).padB, PAD_BOUNDS.min, PAD_BOUNDS.max, def.padB);
      const padL = clampInt((item as any).padL, PAD_BOUNDS.min, PAD_BOUNDS.max, def.padL);
      const widthPercent = clampInt(
        (item as any).widthPercent,
        WIDTH_BOUNDS.min,
        WIDTH_BOUNDS.max,
        def.widthPercent
      );
      byId.set(id, { id, enabled, slot, order, nextLine, hAlign, padT, padR, padB, padL, widthPercent });
    });
  }

  // Safety: at least name or callButton must stay enabled
  const list = Array.from(byId.values());
  const nameCfg = list.find((w) => w.id === 'name');
  const callCfg = list.find((w) => w.id === 'callButton');
  if (nameCfg && callCfg && !nameCfg.enabled && !callCfg.enabled) {
    nameCfg.enabled = true;
  }

  return list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Build CSS padding style from widget pad fields. */
export function widgetPaddingStyle(w: Pick<DiscoveryCardWidgetConfig, 'padT' | 'padR' | 'padB' | 'padL'>): {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
} {
  return {
    paddingTop: clampInt(w.padT, PAD_BOUNDS.min, PAD_BOUNDS.max, 0),
    paddingRight: clampInt(w.padR, PAD_BOUNDS.min, PAD_BOUNDS.max, 0),
    paddingBottom: clampInt(w.padB, PAD_BOUNDS.min, PAD_BOUNDS.max, 0),
    paddingLeft: clampInt(w.padL, PAD_BOUNDS.min, PAD_BOUNDS.max, 0),
  };
}

/**
 * Parse any raw value (object, JSON string, null) into a safe DiscoveryCardLayout.
 * Never throws.
 */
export function parseDiscoveryCardLayout(raw: unknown): DiscoveryCardLayout {
  let obj: any = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { ...DEFAULT_DISCOVERY_CARD_LAYOUT, widgets: defaultWidgets() };
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return { ...DEFAULT_DISCOVERY_CARD_LAYOUT, widgets: defaultWidgets() };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return { ...DEFAULT_DISCOVERY_CARD_LAYOUT, widgets: defaultWidgets() };
  }

  return {
    version: 1,
    widgets: normalizeWidgets(obj.widgets),
    nameFontPx: clampInt(obj.nameFontPx, SIZE_BOUNDS.nameFontPx.min, SIZE_BOUNDS.nameFontPx.max, SIZE_BOUNDS.nameFontPx.default),
    metaFontPx: clampInt(obj.metaFontPx, SIZE_BOUNDS.metaFontPx.min, SIZE_BOUNDS.metaFontPx.max, SIZE_BOUNDS.metaFontPx.default),
    badgeFontPx: clampInt(obj.badgeFontPx, SIZE_BOUNDS.badgeFontPx.min, SIZE_BOUNDS.badgeFontPx.max, SIZE_BOUNDS.badgeFontPx.default),
    verifiedIconPx: clampInt(
      obj.verifiedIconPx,
      SIZE_BOUNDS.verifiedIconPx.min,
      SIZE_BOUNDS.verifiedIconPx.max,
      SIZE_BOUNDS.verifiedIconPx.default
    ),
    flagSize: coerceFlagSize(obj.flagSize),
    callButtonPx: clampInt(
      obj.callButtonPx,
      SIZE_BOUNDS.callButtonPx.min,
      SIZE_BOUNDS.callButtonPx.max,
      SIZE_BOUNDS.callButtonPx.default
    ),
    callIconPx: clampInt(obj.callIconPx, SIZE_BOUNDS.callIconPx.min, SIZE_BOUNDS.callIconPx.max, SIZE_BOUNDS.callIconPx.default),
    cardAspectMobile: coerceAspectMobile(obj.cardAspectMobile),
    cardAspectDesktop: coerceAspectDesktop(obj.cardAspectDesktop),
    callStyle: coerceCallStyle(obj.callStyle),
    showPhoto: obj.showPhoto === undefined ? true : Boolean(obj.showPhoto),
    photoSource: coercePhotoSource(obj.photoSource),
    photoFit: coercePhotoFit(obj.photoFit),
    photoPosition: coercePhotoPosition(obj.photoPosition),
  };
}

export interface SlotConflict {
  slot: DiscoveryCardSlotId;
  widgets: DiscoveryCardWidgetId[];
  /** Soft-block save when top corner overcrowded */
  blocksSave: boolean;
}

/** Enabled widgets grouped by slot, sorted by order. */
export function groupWidgetsBySlot(
  layout: DiscoveryCardLayout
): Record<DiscoveryCardSlotId, DiscoveryCardWidgetConfig[]> {
  const groups = Object.fromEntries(DISCOVERY_CARD_SLOTS.map((s) => [s, [] as DiscoveryCardWidgetConfig[]])) as Record<
    DiscoveryCardSlotId,
    DiscoveryCardWidgetConfig[]
  >;
  for (const w of layout.widgets) {
    if (!w.enabled) continue;
    const slot = WIDGET_ALLOWED_SLOTS[w.id].includes(w.slot) ? w.slot : WIDGET_DEFAULT_SLOT[w.id];
    groups[slot].push({ ...w, slot });
  }
  for (const slot of DISCOVERY_CARD_SLOTS) {
    groups[slot].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
  return groups;
}

/** Detect shared-slot conflicts; top corners with >2 chip widgets block save. */
export function getDiscoveryCardConflicts(layout: DiscoveryCardLayout): SlotConflict[] {
  const groups = groupWidgetsBySlot(layout);
  const conflicts: SlotConflict[] = [];

  for (const slot of DISCOVERY_CARD_SLOTS) {
    const widgets = groups[slot];
    if (widgets.length < 2) continue;
    const ids = widgets.map((w) => w.id);
    const isTopCorner = slot === 'topLeft' || slot === 'topRight';
    const chipCount = ids.filter((id) => CHIP_WIDGETS.includes(id)).length;
    conflicts.push({
      slot,
      widgets: ids,
      blocksSave: isTopCorner && chipCount > 2,
    });
  }
  return conflicts;
}

export function discoveryCardLayoutBlocksSave(layout: DiscoveryCardLayout): boolean {
  return getDiscoveryCardConflicts(layout).some((c) => c.blocksSave);
}
