import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * RADIAL DAY PROTOTYPE (single-file)
 *
 * Edit the CONFIG section to quickly morph the design.
 */

const CONFIG = {
  // Bedtime (local time). You can tweak this while prototyping.
  bedtime: { h: 23, m: 30 },

  // Ring geometry
  ring: {
    size: 360, // px
    stroke: 46, // px
    gapDeg: 10, // small gap so the ring feels like a “session”, not a full clock
    startDeg: -90, // top
  },

  // Snap + duration constraints
  snapMinutes: 5,
  minBlockMinutes: 5,
  maxHoursButtons: 8, // hour chips shown: 0..N

  // Visual language for universal tags
  tags: {
    essential: { key: "essential", label: "★" },
    optional: { key: "optional", label: "◇" },
    uncertain: { key: "uncertain", label: "?" },
  },

  // Templates (quick add)
  templates: [
    { id: "walk", icon: "🚶", color: "#5CC8FF", name: "Walk", defaultMin: 30, minMin: 10 },
    { id: "food", icon: "🍽️", color: "#FFD166", name: "Food", defaultMin: 25, minMin: 10 },
    { id: "work", icon: "🧠", color: "#9B5DE5", name: "Work", defaultMin: 45, minMin: 15 },
    { id: "guitar", icon: "🎸", color: "#00BBF9", name: "Guitar", defaultMin: 40, minMin: 10 },
    { id: "shower", icon: "🚿", color: "#A0E7E5", name: "Shower", defaultMin: 15, minMin: 10 },
    { id: "admin", icon: "🧾", color: "#F15BB5", name: "Admin", defaultMin: 20, minMin: 10 },
  ],

  // Compression (squeeze) weights: higher = protected (shrinks less)
  squeezeWeights: {
    essential: 3.0,
    uncertain: 1.5,
    optional: 0.8,
    none: 1.0,
  },
};

// ---------- Helpers ----------

function pad2(n) {
  return String(n).padStart(2, "0");
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function snap(n, step) {
  return Math.round(n / step) * step;
}

function minutesSinceMidnight(d) {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function bedtimeMinutes() {
  return CONFIG.bedtime.h * 60 + CONFIG.bedtime.m;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (Math.PI / 180) * angleDeg;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  // SVG arc uses end point + flags.
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const delta = ((endDeg - startDeg) % 360 + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function fmtHM(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function tagClass(tagKey) {
  if (tagKey === "essential") return "essential";
  if (tagKey === "optional") return "optional";
  if (tagKey === "uncertain") return "uncertain";
  return "";
}

function computeTagWeight(tags) {
  // if multiple tags, protect essential the most, optional the least
  if (tags?.essential) return CONFIG.squeezeWeights.essential;
  if (tags?.uncertain) return CONFIG.squeezeWeights.uncertain;
  if (tags?.optional) return CONFIG.squeezeWeights.optional;
  return CONFIG.squeezeWeights.none;
}

function pickOverlay(tags) {
  if (tags?.essential) return "url(#glowStroke)";
  if (tags?.optional) return "url(#hatchPattern)";
  if (tags?.uncertain) return "url(#noisePattern)";
  return null;
}

// ---------- Circular minutes control (0-60) ----------

function MinutesRing({ valueMin, onChange }) {
  const ref = useRef(null);

  const size = 150;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;

  const angle = useMemo(() => {
    // map 0..60 to -90..270
    return -90 + (clamp(valueMin, 0, 60) / 60) * 360;
  }, [valueMin]);

  const knob = polarToCartesian(cx, cy, r, angle);

  function setFromEvent(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const dx = x - cx;
    const dy = y - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
    // normalize to 0..360 starting from -90
    deg = (deg - (-90) + 360) % 360;
    let m = Math.round((deg / 360) * 60);
    m = clamp(m, 0, 60);
    onChange?.(m);
  }

  return (
    <div className="select-none">
      <svg
        ref={ref}
        width={size}
        height={size}
        className="touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) setFromEvent(e);
        }}
      >
        <defs>
          <linearGradient id="minGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
        <path
          d={arcPath(cx, cy, r, -90, angle)}
          fill="none"
          stroke="url(#minGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx={knob.x} cy={knob.y} r={9} fill="rgba(255,255,255,0.92)" />
        <circle cx={knob.x} cy={knob.y} r={13} fill="rgba(255,255,255,0.12)" />
      </svg>
      <div className="text-center text-sm font-semibold tracking-tight text-white/90">{pad2(valueMin)}m</div>
    </div>
  );
}

// ---------- Main App ----------

export default function RadialDayPrototype() {
  const [sessionStart, setSessionStart] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  // “cursor” is where next block will land (minutes into session). defaults to now.
  const [cursorMin, setCursorMin] = useState(0);

  // blocks stored as minutes into session
  const [blocks, setBlocks] = useState(() => []);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("add");
  const [tinker, setTinker] = useState(true);

  // For squeeze: pick a “target” block (selected) to squeeze everything from now up to its start.

  // Update now every second.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Session length = from sessionStart time-of-day to bedtime.
  const sessionLenMin = useMemo(() => {
    const startMM = minutesSinceMidnight(sessionStart);
    const bedMM = bedtimeMinutes();
    // if bedtime earlier than start, assume bedtime is tomorrow
    const len = bedMM >= startMM ? bedMM - startMM : 24 * 60 - startMM + bedMM;
    return Math.max(1, Math.round(len));
  }, [sessionStart]);

  const nowMinRaw = useMemo(() => {
    const startMM = minutesSinceMidnight(sessionStart);
    const nowMM = minutesSinceMidnight(now);
    let delta = nowMM - startMM;
    if (delta < 0) delta += 24 * 60;
    return delta;
  }, [sessionStart, now]);

  const nowMin = clamp(nowMinRaw, 0, sessionLenMin);

  // Keep cursor following now unless user has moved it recently.
  useEffect(() => {
    setCursorMin((c) => (c === 0 ? nowMin : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMin]);

  const remaining = Math.max(0, sessionLenMin - nowMin);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) || null, [blocks, selectedId]);

  // Geometry
  const size = CONFIG.ring.size;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = CONFIG.ring.stroke;
  const r = (size - stroke) / 2;

  // Map session minutes -> degrees along ring
  const usableDeg = 360 - CONFIG.ring.gapDeg;
  const startDeg = CONFIG.ring.startDeg;
  function minToDeg(m) {
    return startDeg + (clamp(m, 0, sessionLenMin) / sessionLenMin) * usableDeg;
  }

  // For tinkering/legibility: map session-minutes -> clock label
  const startMM = useMemo(() => minutesSinceMidnight(sessionStart), [sessionStart]);
  function timeLabelAtSessionMin(m) {
    const mm = (startMM + m) % (24 * 60);
    const hh = Math.floor(mm / 60);
    const mi = Math.floor(mm % 60);
    return `${pad2(hh)}:${pad2(mi)}`;
  }
  const nowClock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const startClock = `${pad2(sessionStart.getHours())}:${pad2(sessionStart.getMinutes())}`;

  // Version/build id (shows only in tinker mode)
  const buildId =
    (typeof import.meta !== "undefined" &&
      import.meta?.env &&
      (import.meta.env.VERCEL_GIT_COMMIT_SHA ||
        import.meta.env.VITE_BUILD_ID ||
        import.meta.env.VITE_GIT_SHA ||
        import.meta.env.VITE_COMMIT_SHA)) ||
    "dev";
  const buildShort = typeof buildId === "string" ? buildId.slice(0, 7) : "dev";

  // Human version (you control this)
  const appVersion =
    (typeof import.meta !== "undefined" &&
      import.meta?.env &&
      (import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_VERSION)) ||
    "0.0";

  // Basic stacking: keep blocks sorted by start.
  const sortedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => a.startMin - b.startMin);
  }, [blocks]);

  // Auto-pack forward helper
  function packFrom(idxStart, startAt) {
    setBlocks((prev) => {
      const arr = [...prev].sort((a, b) => a.startMin - b.startMin);
      for (let i = idxStart; i < arr.length; i++) {
        const b = arr[i];
        if (b.pinned) continue;
        const minStart = startAt;
        if (b.startMin < minStart) b.startMin = minStart;
        startAt = b.startMin + b.durMin;
      }
      return arr.map((x) => ({ ...x }));
    });
  }

  function addTemplate(tpl) {
    const start = snap(cursorMin, CONFIG.snapMinutes);
    const dur = snap(tpl.defaultMin, CONFIG.snapMinutes);
    const id = uid();
    const b = {
      id,
      templateId: tpl.id,
      name: tpl.name,
      icon: tpl.icon,
      color: tpl.color,
      startMin: start,
      durMin: clamp(dur, tpl.minMin ?? CONFIG.minBlockMinutes, sessionLenMin),
      minMin: tpl.minMin ?? CONFIG.minBlockMinutes,
      tags: { essential: false, optional: false, uncertain: false },
      pinned: false,
    };
    setBlocks((prev) => {
      const next = [...prev, b];
      return next;
    });
    setSelectedId(id);
    setTab("duration");
    setCursorMin(clamp(start + b.durMin, 0, sessionLenMin));
  }

  function addScratch() {
    const start = snap(cursorMin, CONFIG.snapMinutes);
    const id = uid();
    const b = {
      id,
      templateId: null,
      name: "",
      icon: "＋",
      color: "#FFFFFF",
      startMin: start,
      durMin: 15,
      minMin: CONFIG.minBlockMinutes,
      tags: { essential: false, optional: false, uncertain: false },
      pinned: false,
    };
    setBlocks((prev) => [...prev, b]);
    setSelectedId(id);
    setTab("duration");
    setCursorMin(clamp(start + b.durMin, 0, sessionLenMin));
  }

  function toggleTag(tagKey) {
    if (!selected) return;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== selected.id) return b;
        const nextTags = { ...b.tags, [tagKey]: !b.tags?.[tagKey] };
        // keep it “one-of” by default (comment this out if you want multi)
        if (nextTags[tagKey]) {
          for (const k of Object.keys(nextTags)) if (k !== tagKey) nextTags[k] = false;
        }
        return { ...b, tags: nextTags };
      })
    );
  }

  function togglePin() {
    if (!selected) return;
    setBlocks((prev) => prev.map((b) => (b.id === selected.id ? { ...b, pinned: !b.pinned } : b)));
  }

  function removeSelected() {
    if (!selected) return;
    setBlocks((prev) => prev.filter((b) => b.id !== selected.id));
    setSelectedId(null);
  }

  function setSelectedDuration(totalMin) {
    if (!selected) return;
    const step = CONFIG.snapMinutes;
    const snapped = snap(totalMin, step);
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== selected.id) return b;
        const minMin = b.minMin ?? CONFIG.minBlockMinutes;
        const dur = clamp(snapped, minMin, sessionLenMin);
        return { ...b, durMin: dur };
      })
    );
    // keep cursor at end of selected for rapid chaining
    setCursorMin(clamp(selected.startMin + snapped, 0, sessionLenMin));
  }

  function shiftFromNow() {
    // Move all non-pinned blocks that start >= now so the first starts at now; keep order.
    setBlocks((prev) => {
      const arr = [...prev].sort((a, b) => a.startMin - b.startMin);
      const movable = arr.filter((b) => !b.pinned && b.startMin >= nowMin);
      if (movable.length === 0) return prev;
      const fixed = arr.filter((b) => b.pinned || b.startMin < nowMin);
      // Find earliest movable block index
      const earliest = movable[0];
      const delta = nowMin - earliest.startMin;
      for (const b of movable) b.startMin = clamp(b.startMin + delta, 0, sessionLenMin);
      // Pack contiguously from now
      movable.sort((a, b) => a.startMin - b.startMin);
      let t = nowMin;
      for (const b of movable) {
        b.startMin = t;
        t = b.startMin + b.durMin;
      }
      return [...fixed, ...movable].sort((a, b) => a.startMin - b.startMin).map((x) => ({ ...x }));
    });
  }

  function squeezeUpToSelectedTarget() {
    if (!selected) return;
    const targetStart = selected.startMin;
    const startPoint = nowMin;
    if (targetStart <= startPoint) return;

    setBlocks((prev) => {
      const arr = [...prev].sort((a, b) => a.startMin - b.startMin).map((x) => ({ ...x }));
      const inRange = arr.filter((b) => b.id !== selected.id && b.startMin >= startPoint && b.startMin < targetStart && !b.pinned);
      if (inRange.length === 0) return prev;

      // Pack range contiguously starting at startPoint (preserve order)
      inRange.sort((a, b) => a.startMin - b.startMin);
      let t = startPoint;
      for (const b of inRange) {
        b.startMin = t;
        t += b.durMin;
      }

      const available = targetStart - startPoint;
      const total = inRange.reduce((s, b) => s + b.durMin, 0);
      if (total <= available) {
        // Already fits: just packed.
        return arr.map((b) => {
          const repl = inRange.find((x) => x.id === b.id);
          return repl ?? b;
        });
      }

      // Need to reduce R minutes across inRange, respecting mins and weights.
      let R = total - available;
      const items = inRange.map((b) => {
        const minMin = b.minMin ?? CONFIG.minBlockMinutes;
        const reducible = Math.max(0, b.durMin - minMin);
        const w = computeTagWeight(b.tags);
        return { b, minMin, reducible, w };
      });

      // Iterative proportional reduction (stable, predictable)
      // Reduce by slices until R consumed or no reducible.
      for (let iter = 0; iter < 50 && R > 0.001; iter++) {
        const active = items.filter((it) => it.reducible > 0.001);
        if (active.length === 0) break;
        const denom = active.reduce((s, it) => s + (1 / it.w), 0);
        const slice = Math.min(R, 10); // reduce in chunks for stability
        for (const it of active) {
          const share = (1 / it.w) / denom;
          const take = Math.min(it.reducible, slice * share);
          it.b.durMin -= take;
          it.reducible -= take;
          R -= take;
        }
      }

      // Snap + enforce mins, then re-pack contiguously to target
      for (const it of items) {
        const snapped = snap(it.b.durMin, CONFIG.snapMinutes);
        it.b.durMin = clamp(snapped, it.minMin, 24 * 60);
      }
      inRange.sort((a, b) => a.startMin - b.startMin);
      let tt = startPoint;
      for (const b of inRange) {
        b.startMin = tt;
        tt += b.durMin;
      }

      return arr.map((b) => {
        const repl = inRange.find((x) => x.id === b.id);
        return repl ?? b;
      });
    });
  }

  function resetSession() {
    const d = new Date();
    setSessionStart(d);
    setNow(d);
    setBlocks([]);
    setSelectedId(null);
    setCursorMin(0);
    setTab("add");
  }

  // Drag to move cursor around ring
  const ringRef = useRef(null);
  function setCursorFromPointer(e) {
    const el = ringRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const dx = x - cx;
    const dy = y - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
    // Convert to fraction along usable arc
    // Normalize relative to startDeg
    let rel = (deg - startDeg + 360) % 360;
    rel = clamp(rel, 0, usableDeg);
    const m = snap((rel / usableDeg) * sessionLenMin, CONFIG.snapMinutes);
    setCursorMin(clamp(m, 0, sessionLenMin));
  }

  // Drag blocks around ring (startMin)
  const drag = useRef({ id: null, startAt: 0 });
  function startDragBlock(id, e) {
    drag.current = { id, startAt: blocks.find((b) => b.id === id)?.startMin ?? 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDragBlock(e) {
    if (!drag.current.id) return;
    const el = ringRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - cx;
    const dy = y - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let rel = (deg - startDeg + 360) % 360;
    rel = clamp(rel, 0, usableDeg);
    const m = snap((rel / usableDeg) * sessionLenMin, CONFIG.snapMinutes);

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== drag.current.id) return b;
        if (b.pinned) return b;
        return { ...b, startMin: clamp(m, 0, sessionLenMin) };
      })
    );
  }
  function endDragBlock() {
    drag.current = { id: null, startAt: 0 };
    // Optional: pack after drag (simple)
    // (Leave off if you want freer overlaps during tinkering)
    // setBlocks((prev) => [...prev].sort((a, b) => a.startMin - b.startMin));
  }

  // Render arcs
  function BlockArc({ b }) {
    const a0 = minToDeg(b.startMin);
    const a1 = minToDeg(b.startMin + b.durMin);
    const isSel = b.id === selectedId;
    const overlay = pickOverlay(b.tags);

    return (
      <g>
        {/* base */}
        <path
          d={arcPath(cx, cy, r, a0, a1)}
          fill="none"
          stroke={b.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          opacity={isSel ? 0.95 : 0.82}
          onPointerDown={(e) => {
            setSelectedId(b.id);
            startDragBlock(b.id, e);
          }}
          onPointerMove={moveDragBlock}
          onPointerUp={endDragBlock}
        />

        {/* tag overlay (pattern / shader feel) */}
        {overlay && (
          <path
            d={arcPath(cx, cy, r, a0, a1)}
            fill="none"
            stroke={overlay}
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={b.tags?.essential ? 0.55 : 0.35}
            pointerEvents="none"
          />
        )}

        {/* selection highlight */}
        {isSel && (
          <path
            d={arcPath(cx, cy, r, a0, a1)}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={4}
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}
      </g>
    );
  }

  // Now hand
  const nowDeg = minToDeg(nowMin);
  const handInner = polarToCartesian(cx, cy, r - stroke / 2 - 12, nowDeg);
  const handOuter = polarToCartesian(cx, cy, r + stroke / 2 + 8, nowDeg);

  // Cursor marker
  const curDeg = minToDeg(cursorMin);
  const curA = polarToCartesian(cx, cy, r + stroke / 2 + 2, curDeg);

  // Selected duration -> hours + minutes (0..60)
  const selDur = selected?.durMin ?? 0;
  const selH = Math.floor(selDur / 60);
  const selM = Math.round(selDur % 60);

  // Hour tick marks (tinker mode)
  const hourTicks = useMemo(() => {
    const out = [];
    for (let m = 0; m <= sessionLenMin; m += 60) out.push(m);
    return out;
  }, [sessionLenMin]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-between p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <button
            onClick={resetSession}
            className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 active:bg-white/20"
            title="New session"
          >
            ⟳
          </button>
          <div className="text-sm font-semibold tracking-tight text-white/90">
            {fmtHM(remaining)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTinker((v) => !v)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 active:bg-white/20"
              title="Toggle hints"
            >
              {tinker ? "Hints on" : "Hints off"}
            </button>
            <button
              onClick={() => {
                setBlocks([]);
                setSelectedId(null);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 active:bg-white/20"
              title="Clear"
            >
              ⊘
            </button>
          </div>
        </div>

        <div className="mt-3 relative">
          <svg
            ref={ringRef}
            width={size}
            height={size}
            className="mx-auto block"
            onPointerDown={(e) => {
              // If user taps empty space, move cursor
              const target = e.target;
              // Only move cursor if not tapping a block path
              if (target?.tagName !== "path") {
                e.currentTarget.setPointerCapture(e.pointerId);
                setCursorFromPointer(e);
              }
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) {
                const target = e.target;
                if (target?.tagName !== "path") setCursorFromPointer(e);
              }
            }}
          >
            <defs>
              {/* Optional hatch */}
              <pattern id="hatchPattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                <rect width="8" height="8" fill="rgba(255,255,255,0)" />
                <rect x="0" y="0" width="2" height="8" fill="rgba(255,255,255,0.75)" />
              </pattern>

              {/* Uncertain: animated noise-ish overlay */}
              <filter id="noiseFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="2" result="noise">
                  <animate attributeName="baseFrequency" dur="2.4s" values="0.7;0.9;0.75" repeatCount="indefinite" />
                </feTurbulence>
                <feColorMatrix type="matrix" values="1 0 0 0 0\n0 1 0 0 0\n0 0 1 0 0\n0 0 0 0.45 0" />
                <feComposite operator="in" in2="SourceGraphic" />
              </filter>
              <linearGradient id="noisePattern" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
              </linearGradient>

              {/* Essential: glossy stroke */}
              <linearGradient id="glowStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.28)" />
              </linearGradient>
            </defs>

            {/* Session ring background */}
            <path
              d={arcPath(cx, cy, r, startDeg, startDeg + usableDeg)}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />

            {/* Hour ticks (tinker mode) */}
            {tinker &&
              hourTicks.map((m) => {
                const deg = minToDeg(m);
                const p1 = polarToCartesian(cx, cy, r - stroke / 2 - 6, deg);
                const p2 = polarToCartesian(cx, cy, r + stroke / 2 + 6, deg);
                const pt = polarToCartesian(cx, cy, r + stroke / 2 + 22, deg);
                return (
                  <g key={`tick-${m}`}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                    <text
                      x={pt.x}
                      y={pt.y}
                      fill="rgba(255,255,255,0.55)"
                      fontSize="10"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {timeLabelAtSessionMin(m)}
                    </text>
                  </g>
                );
              })}

            {/* Planned blocks */}
            {sortedBlocks.map((b) => (
              <BlockArc key={b.id} b={b} />
            ))}

            {/* Uncertain overlay uses filter */}
            {sortedBlocks
              .filter((b) => b.tags?.uncertain)
              .map((b) => {
                const a0 = minToDeg(b.startMin);
                const a1 = minToDeg(b.startMin + b.durMin);
                return (
                  <path
                    key={b.id + ":noise"}
                    d={arcPath(cx, cy, r, a0, a1)}
                    fill="none"
                    stroke="url(#noisePattern)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    filter="url(#noiseFilter)"
                    opacity={0.55}
                    pointerEvents="none"
                  />
                );
              })}

            {/* Now hand */}
            <line x1={handInner.x} y1={handInner.y} x2={handOuter.x} y2={handOuter.y} stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
            <circle cx={cx} cy={cy} r={5} fill="rgba(255,255,255,0.9)" />

            {/* Cursor marker */}
            <circle cx={curA.x} cy={curA.y} r={4} fill="rgba(255,255,255,0.65)" />
          </svg>

          {/* Minimal center info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-3xl font-semibold tracking-tight">{fmtHM(remaining)}</div>
            <div className="mt-1 text-xs text-white/55">
              Bedtime {pad2(CONFIG.bedtime.h)}:{pad2(CONFIG.bedtime.m)}
            </div>
            {tinker && (
              <div className="mt-1 text-[11px] text-white/45">
                Start {startClock} • Now {nowClock}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dock */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <DockTab icon="➕" label="Add" active={tab === "add"} onClick={() => setTab("add")} tinker={tinker} />
          <DockTab icon="⏱" label="Duration" active={tab === "duration"} onClick={() => setTab("duration")} tinker={tinker} />
          <DockTab icon="🪄" label="Effects" active={tab === "effects"} onClick={() => setTab("effects")} tinker={tinker} />
          <DockTab icon="⇄" label="Push" active={tab === "push"} onClick={() => setTab("push")} tinker={tinker} />
        </div>

        <div className="rounded-3xl bg-white/6 border border-white/10 shadow-xl p-3 backdrop-blur">
          {tinker && (
            <div className="mb-3 rounded-2xl bg-white/5 border border-white/10 p-3 text-xs text-white/80">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Now</span>
                <span className="font-semibold">{nowClock} · {fmtHM(nowMin)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-white/60">Cursor</span>
                <span className="font-semibold">{timeLabelAtSessionMin(cursorMin)} · {fmtHM(cursorMin)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-white/60">Session start</span>
                <span className="font-semibold">{startClock}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-white/60">Version</span>
                <span className="font-semibold">{appVersion}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-white/60">Build</span>
                <span className="font-semibold">{buildShort}</span>
              </div>

              <div className="mt-2 h-px bg-white/10" />

              <div className="mt-2 flex items-center justify-between">
                <span className="text-white/60">Selected</span>
                <span className="font-semibold">{selected ? (selected.name || "(scratch)") : "—"}</span>
              </div>

              {selected && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-1">
                    <div className="text-white/50">Start</div>
                    <div className="font-semibold">{timeLabelAtSessionMin(selected.startMin)} · {fmtHM(selected.startMin)}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-1">
                    <div className="text-white/50">Duration</div>
                    <div className="font-semibold">{fmtHM(selected.durMin)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "add" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {CONFIG.templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addTemplate(t)}
                    className="rounded-2xl px-3 py-2 bg-white/7 hover:bg-white/10 active:bg-white/15 border border-white/10"
                    style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.05) inset` }}
                    title={t.name}
                  >
                    <span className="text-sm font-semibold text-white/90">{t.name}</span>
                    <span className="ml-2 text-sm font-semibold text-white/85">{t.defaultMin}</span>
                  </button>
                ))}

                <button
                  onClick={addScratch}
                  className="rounded-2xl px-3 py-2 bg-white/7 hover:bg-white/10 active:bg-white/15 border border-white/10"
                  title="Scratch"
                >
                  <span className="text-base">＋</span>
                  <span className="ml-2 text-sm font-semibold text-white/85">15</span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    // snap cursor to now
                    setCursorMin(snap(nowMin, CONFIG.snapMinutes));
                  }}
                  className="rounded-full px-4 py-2 bg-white/8 hover:bg-white/12 active:bg-white/15 text-sm font-semibold"
                  title="Cursor → now"
                >
                  ◎
                </button>

                <div className="text-sm font-semibold text-white/75">{fmtHM(cursorMin)}</div>

                <button
                  onClick={() => {
                    // move cursor to end of selected
                    if (!selected) return;
                    setCursorMin(clamp(selected.startMin + selected.durMin, 0, sessionLenMin));
                  }}
                  className="rounded-full px-4 py-2 bg-white/8 hover:bg-white/12 active:bg-white/15 text-sm font-semibold"
                  title="Cursor → end"
                >
                  ▶
                </button>
              </div>
            </div>
          )}

          {tab === "duration" && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <MinutesRing
                    valueMin={clamp(selM, 0, 60)}
                    onChange={(m) => {
                      const h = clamp(selH, 0, CONFIG.maxHoursButtons);
                      setSelectedDuration(h * 60 + m);
                    }}
                  />

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: CONFIG.maxHoursButtons + 1 }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const m = clamp(selM, 0, 60);
                            setSelectedDuration(i * 60 + m);
                          }}
                          className={
                            "w-10 h-10 rounded-2xl font-semibold border " +
                            (i === selH ? "bg-white/18 border-white/25" : "bg-white/7 border-white/10 hover:bg-white/10")
                          }
                          title={`${i}h`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selected && setSelectedDuration(Math.max((selected.durMin ?? 0) - 5, selected.minMin ?? 5))}
                        className="w-12 h-10 rounded-2xl bg-white/7 hover:bg-white/10 border border-white/10"
                        title="-5m"
                      >
                        −
                      </button>
                      <div className="text-lg font-semibold tracking-tight text-white/85 w-24 text-center">
                        {selected ? fmtHM(selected.durMin) : "—"}
                      </div>
                      <button
                        onClick={() => selected && setSelectedDuration((selected.durMin ?? 0) + 5)}
                        className="w-12 h-10 rounded-2xl bg-white/7 hover:bg-white/10 border border-white/10"
                        title="+5m"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={togglePin}
                  className={
                    "w-12 h-12 rounded-2xl border " +
                    (selected?.pinned ? "bg-white/18 border-white/25" : "bg-white/7 border-white/10 hover:bg-white/10")
                  }
                  title="Pin"
                >
                  ⌁
                </button>
                <button
                  onClick={removeSelected}
                  className="w-12 h-12 rounded-2xl bg-white/7 hover:bg-white/10 border border-white/10"
                  title="Delete"
                >
                  ⌫
                </button>
              </div>
            </div>
          )}

          {tab === "effects" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Object.values(CONFIG.tags).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => toggleTag(t.key)}
                    className={
                      "w-14 h-14 rounded-3xl border text-xl " +
                      (selected?.tags?.[t.key] ? "bg-white/18 border-white/25" : "bg-white/7 border-white/10 hover:bg-white/10")
                    }
                    title={t.key}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="text-sm font-semibold text-white/75">
                {selected ? "" : ""}
              </div>

              <button
                onClick={() => {
                  // quick: cycle selected base color through templates (tinker helper)
                  if (!selected) return;
                  const idx = CONFIG.templates.findIndex((t) => t.color === selected.color);
                  const next = CONFIG.templates[(idx + 1 + CONFIG.templates.length) % CONFIG.templates.length];
                  setBlocks((prev) => prev.map((b) => (b.id === selected.id ? { ...b, color: next.color } : b)));
                }}
                className="w-14 h-14 rounded-3xl bg-white/7 hover:bg-white/10 border border-white/10 text-xl"
                title="Cycle color"
              >
                ◐
              </button>
            </div>
          )}

          {tab === "push" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={shiftFromNow}
                  className="flex-1 rounded-2xl py-3 bg-white/10 hover:bg-white/12 active:bg-white/15 border border-white/10 font-semibold"
                  title="Shift from now → bedtime"
                >
                  ⇄
                </button>
                <button
                  onClick={squeezeUpToSelectedTarget}
                  className="flex-1 rounded-2xl py-3 bg-white/10 hover:bg-white/12 active:bg-white/15 border border-white/10 font-semibold"
                  title="Squeeze from now → selected"
                >
                  ⇣
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    // auto-pack everything from now (lightweight)
                    setBlocks((prev) => {
                      const arr = [...prev].sort((a, b) => a.startMin - b.startMin).map((x) => ({ ...x }));
                      let t = nowMin;
                      for (const b of arr) {
                        if (b.pinned) continue;
                        if (b.startMin < nowMin) continue;
                        b.startMin = t;
                        t += b.durMin;
                      }
                      return arr;
                    });
                  }}
                  className="rounded-full px-4 py-2 bg-white/8 hover:bg-white/12 border border-white/10 font-semibold"
                  title="Pack"
                >
                  ▦
                </button>

                <div className="text-sm font-semibold text-white/75">{selected ? fmtHM(selected.startMin) : ""}</div>

                <button
                  onClick={() => {
                    // quick: make selected start at cursor
                    if (!selected || selected.pinned) return;
                    setBlocks((prev) => prev.map((b) => (b.id === selected.id ? { ...b, startMin: snap(cursorMin, CONFIG.snapMinutes) } : b)));
                  }}
                  className="rounded-full px-4 py-2 bg-white/8 hover:bg-white/12 border border-white/10 font-semibold"
                  title="Selected → cursor"
                >
                  ⇢
                </button>
              </div>
            </div>
          )}
        </div>

        {/* tiny hint row (tinker mode) */}
        {tinker && (
          <div className="mt-2 text-center text-[11px] text-white/35">
            Add: tap template • Drag arcs to move • Tap ring to set cursor • Push: ⇄ shifts from now, ⇣ squeezes up to selected
          </div>
        )}
      </div>
    </div>
  );
}

function DockTab({ icon, label, active, onClick, tinker }) {
  return (
    <button
      onClick={onClick}
      className={
        "w-12 h-12 rounded-2xl border flex flex-col items-center justify-center transition px-1 " +
        (active ? "bg-white/18 border-white/25" : "bg-white/7 border-white/10 hover:bg-white/10")
      }
      title={label}
    >
      <div className={"leading-none " + (tinker ? "text-lg" : "text-xl")}>{icon}</div>
      {tinker && <div className="mt-0.5 text-[10px] font-semibold text-white/75 truncate w-full text-center">{label}</div>}
    </button>
  );
}
