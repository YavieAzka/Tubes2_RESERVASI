"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SerializedNode {
  id: number;
  tag: string;
  attributes: Record<string, string>;
  text: string;
  depth: number;
  parentId: number | null;
  childIds: number[];
}

interface TraversalStep {
  nodeId: number;
  tag: string;
  depth: number;
  action: "visit" | "match" | "backtrack";
  parentId: number | null;
  timestamp: number;
}

interface Stats {
  visitedCount: number;
  matchedCount: number;
  timeMs: number;
  maxDepth: number;
  totalTimeMs: number;
}

interface PathNodeWithRole {
  id: number;
  tag: string;
  isLca: boolean;
}

interface LCAResult {
  lcaNodeId: number | null;
  lcaTag: string | null;
  pathNodeIds: number[];
  pathWithRole?: PathNodeWithRole[];
}

interface ApiResponse {
  success: boolean;
  data: Array<{
    id: number;
    tag: string;
    text: string;
    attributes: Record<string, string>;
    depth: number;
  }>;
  tree: Record<number, SerializedNode>;
  steps: TraversalStep[];
  traversalLog: string[];
  stats: Stats;
  lca: LCAResult | null;
  error?: string;
}

//  Tree Layout

interface LayoutNode {
  id: number;
  tag: string;
  x: number;
  y: number;
  depth: number;
  parentId: number | null;
  childIds: number[];
  attributes: Record<string, string>;
}

function buildLayout(tree: Record<number, SerializedNode>): LayoutNode[] {
  const nodes = Object.values(tree).filter((n) => n.tag !== "#text");
  if (nodes.length === 0) return [];

  // Find root (parentId === null or parentId not in tree)
  const ids = new Set(nodes.map((n) => n.id));
  const root = nodes.find((n) => n.parentId === null || !ids.has(n.parentId!));
  if (!root) return [];

  const MAX_NODES = 120;
  const layout: LayoutNode[] = [];
  const xCountByDepth: Record<number, number> = {};

  // BFS layout
  const queue: Array<{ node: SerializedNode; depth: number }> = [
    { node: root, depth: 0 },
  ];
  const visited = new Set<number>();

  while (queue.length > 0 && layout.length < MAX_NODES) {
    const { node, depth } = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);

    const xIndex = xCountByDepth[depth] ?? 0;
    xCountByDepth[depth] = xIndex + 1;

    layout.push({
      id: node.id,
      tag: node.tag,
      x: xIndex,
      y: depth,
      depth,
      parentId: node.parentId,
      childIds: node.childIds.filter((id) => tree[id]?.tag !== "#text"),
      attributes: node.attributes,
    });

    for (const childId of node.childIds) {
      const child = tree[childId];
      if (child && child.tag !== "#text" && !visited.has(childId)) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }
  }

  // Normalize x positions per depth
  const depthGroups: Record<number, LayoutNode[]> = {};
  for (const n of layout) {
    if (!depthGroups[n.depth]) depthGroups[n.depth] = [];
    depthGroups[n.depth].push(n);
  }

  const maxWidth = Math.max(...Object.values(depthGroups).map((g) => g.length));
  const NODE_W = 70;
  const NODE_H = 70;
  const PAD_X = 20;
  const PAD_Y = 20;

  for (const [depth, group] of Object.entries(depthGroups)) {
    const d = Number(depth);
    const totalW = group.length * NODE_W + (group.length - 1) * PAD_X;
    const canvasW = Math.max(totalW, maxWidth * (NODE_W + PAD_X));
    const startX = (canvasW - totalW) / 2;
    group.forEach((n, i) => {
      n.x = startX + i * (NODE_W + PAD_X) + NODE_W / 2;
      n.y = d * (NODE_H + PAD_Y) + NODE_H / 2 + 20;
    });
  }

  return layout;
}

//  Node Color

function getNodeColor(
  id: number,
  currentStep: TraversalStep | null,
  nodeStates: Map<number, "visit" | "match" | "backtrack">,
  isDone: boolean,
  lcaResult: { lcaNodeId: number | null; pathNodeIds: number[] } | null,
) {
  // LCA ancestor node — cyan
  if (lcaResult?.lcaNodeId === id) {
    return { fill: "#06B6D4", stroke: "#0891B2", text: "#fff" };
  }
  // LCA path node — orange
  if (lcaResult?.pathNodeIds.includes(id)) {
    return { fill: "#F97316", stroke: "#EA580C", text: "#fff" };
  }

  const state = nodeStates.get(id);
  const isCurrent = currentStep?.nodeId === id;

  if (isCurrent && !isDone)
    return { fill: "#FBBF24", stroke: "#F59E0B", text: "#1a1a2e" };
  if (state === "match")
    return { fill: "#10B981", stroke: "#059669", text: "#fff" };
  if (state === "visit" && isDone)
    return { fill: "#6366f1", stroke: "#4F46E5", text: "#fff" };
  if (state === "backtrack")
    return { fill: "#7f1d1d", stroke: "#EF4444", text: "#FCA5A5" };
  if (state === "visit")
    return { fill: "#818CF8", stroke: "#6366F1", text: "#fff" };
  return { fill: "#1E293B", stroke: "#334155", text: "#94A3B8" };
}

//  Main Component

export default function Home() {
  // Input state
  const [inputMode, setInputMode] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("https://example.com");
  const [htmlText, setHtmlText] = useState("");
  const [selector, setSelector] = useState("h1");
  const [algorithm, setAlgorithm] = useState<"DFS" | "BFS">("DFS");
  const [limitType, setLimitType] = useState<"all" | "top">("all");
  const [limitN, setLimitN] = useState(10);
  const [animateOn, setAnimateOn] = useState(true);
  const [animSpeed, setAnimSpeed] = useState(300); // ms per step

  // LCA state
  const [lcaEnabled, setLcaEnabled] = useState(false);
  const [lcaNodeA, setLcaNodeA] = useState<string>("");
  const [lcaNodeB, setLcaNodeB] = useState<string>("");
  const [lcaLoading, setLcaLoading] = useState(false);
  const [lcaResult, setLcaResult] = useState<LCAResult | null>(null);

  // Result state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [layout, setLayout] = useState<LayoutNode[]>([]);

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [nodeStates, setNodeStates] = useState<
    Map<number, "visit" | "match" | "backtrack">
  >(new Map());
  const [isDone, setIsDone] = useState(false);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Log scroll
  const logRef = useRef<HTMLDivElement>(null);

  // SVG dimensions
  const [svgSize, setSvgSize] = useState({ w: 800, h: 400 });

  // Compute SVG size from layout
  useEffect(() => {
    if (layout.length === 0) return;
    const maxX = Math.max(...layout.map((n) => n.x)) + 60;
    const maxY = Math.max(...layout.map((n) => n.y)) + 60;
    setSvgSize({ w: Math.max(maxX, 600), h: Math.max(maxY, 300) });
  }, [layout]);

  // Scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [stepIndex]);

  //  API call
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setLayout([]);
    setNodeStates(new Map());
    setStepIndex(-1);
    setIsDone(false);
    setIsPlaying(false);
    setLcaResult(null);
    if (animRef.current) clearTimeout(animRef.current);

    try {
      const body = {
        mode: inputMode,
        url: inputMode === "url" ? url : undefined,
        html: inputMode === "html" ? htmlText : undefined,
        selector,
        algorithm,
        animate: animateOn,
        limitType,
        limit: limitType === "top" ? limitN : undefined,
      };

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json: ApiResponse = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal scraping");

      setResult(json);
      setLayout(buildLayout(json.tree));

      // If no animation, mark all matches immediately
      if (!animateOn) {
        const states = new Map<number, "visit" | "match" | "backtrack">();
        for (const m of json.data) states.set(m.id, "match");
        setNodeStates(states);
        setIsDone(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error tidak diketahui");
    } finally {
      setLoading(false);
    }
  };

  // ── Animation engine ──────────────────────────────────────────────────────
  const playNext = useCallback(
    (
      idx: number,
      steps: TraversalStep[],
      states: Map<number, "visit" | "match" | "backtrack">,
    ) => {
      if (idx >= steps.length) {
        setIsDone(true);
        setIsPlaying(false);
        return;
      }

      const step = steps[idx];
      const newStates = new Map(states);

      // Jangan overwrite state "match" dengan apapun — node match harus tetap hijau
      if (newStates.get(step.nodeId) !== "match") {
        newStates.set(step.nodeId, step.action);
      }

      setNodeStates(newStates);
      setStepIndex(idx);

      animRef.current = setTimeout(() => {
        playNext(idx + 1, steps, newStates);
      }, animSpeed);
    },
    [animSpeed],
  );

  const handlePlay = () => {
    if (!result || !result.steps.length) return;
    if (isDone) {
      // Reset and replay
      setNodeStates(new Map());
      setStepIndex(-1);
      setIsDone(false);
    }
    setIsPlaying(true);
    playNext(stepIndex < 0 ? 0 : stepIndex, result.steps, nodeStates);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (animRef.current) clearTimeout(animRef.current);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setIsDone(false);
    setStepIndex(-1);
    setNodeStates(new Map());
    if (animRef.current) clearTimeout(animRef.current);
  };

  //  LCA Query
  const handleLCA = async () => {
    if (!result || lcaNodeA === "" || lcaNodeB === "") return;
    setLcaLoading(true);
    setLcaResult(null);

    try {
      // Kirim serializedTree dari hasil search sebelumnya
      // Server akan reconstruct tree dari data ini — TIDAK re-scrape/parse
      // sehingga id node tetap konsisten dengan yang ditampilkan di UI
      const body = {
        lcaNodeA: Number(lcaNodeA),
        lcaNodeB: Number(lcaNodeB),
        serializedTree: result.tree,
      };

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "LCA gagal");
      setLcaResult(json.lca);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "LCA error");
    } finally {
      setLcaLoading(false);
    }
  };

  useEffect(
    () => () => {
      if (animRef.current) clearTimeout(animRef.current);
    },
    [],
  );

  // Current step for highlighting
  const currentStep = result?.steps?.[stepIndex] ?? null;

  // Active log lines up to current step
  const visibleLog = result ? result.traversalLog.slice(0, stepIndex + 2) : [];

  //  Render
  return (
    <main
      className="min-h-screen"
      style={{
        background: "#0b0f1a",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid #1e2d40",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "linear-gradient(90deg, #0b0f1a 0%, #0f172a 100%)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #10b981)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 14,
            color: "#fff",
          }}
        >
          TS
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "0.5px",
            }}
          >
            DOM Traversal Engine
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
            IF2211 Strategi Algoritma · Tubes 2
          </p>
        </div>
        {result && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 999,
              background: "#10b98122",
              color: "#10b981",
              border: "1px solid #10b98155",
            }}
          >
            ● Engine Ready
          </span>
        )}
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px" }}>
        {/* ── Control Panel ── */}
        <section
          style={{
            background: "#0f172a",
            border: "1px solid #1e2d40",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              fontWeight: 600,
              color: "#64748b",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Control Panel
          </h2>

          {/* Row 1: Input mode toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["url", "html"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setInputMode(m)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: inputMode === m ? "#6366f1" : "#1e2d40",
                  color: inputMode === m ? "#fff" : "#64748b",
                  border:
                    inputMode === m ? "1px solid #818cf8" : "1px solid #1e2d40",
                }}
              >
                {m === "url" ? "🌐 URL" : "📄 HTML Langsung"}
              </button>
            ))}
          </div>

          {/* Row 2: main inputs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* URL or HTML input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#64748b",
                  marginBottom: 4,
                  letterSpacing: "1px",
                }}
              >
                {inputMode === "url" ? "TARGET URL" : "HTML TEKS"}
              </label>
              {inputMode === "url" ? (
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={inputStyle}
                />
              ) : (
                <textarea
                  value={htmlText}
                  onChange={(e) => setHtmlText(e.target.value)}
                  placeholder="<div><p class='hi'>Hello</p></div>"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", height: 60 }}
                />
              )}
            </div>

            {/* CSS Selector */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#64748b",
                  marginBottom: 4,
                  letterSpacing: "1px",
                }}
              >
                CSS SELECTOR
              </label>
              <input
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="div > p.highlight"
                style={inputStyle}
              />
            </div>

            {/* Algorithm */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#64748b",
                  marginBottom: 4,
                  letterSpacing: "1px",
                }}
              >
                ALGORITMA
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as "DFS" | "BFS")}
                style={inputStyle}
              >
                <option value="DFS">Depth-First Search (DFS)</option>
                <option value="BFS">Breadth-First Search (BFS)</option>
              </select>
            </div>

            {/* Limit type */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#64748b",
                  marginBottom: 4,
                  letterSpacing: "1px",
                }}
              >
                JUMLAH HASIL
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  value={limitType}
                  onChange={(e) =>
                    setLimitType(e.target.value as "all" | "top")
                  }
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="all">Semua</option>
                  <option value="top">Top N</option>
                </select>
                {limitType === "top" && (
                  <input
                    type="number"
                    min={1}
                    value={limitN}
                    onChange={(e) => setLimitN(Number(e.target.value))}
                    style={{ ...inputStyle, width: 60 }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Row 3: animation toggle + speed + search button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              <div
                onClick={() => setAnimateOn((v) => !v)}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: animateOn ? "#6366f1" : "#1e2d40",
                  border: "1px solid " + (animateOn ? "#818cf8" : "#334155"),
                  position: "relative",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: animateOn ? 20 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </div>
              Animasi Penelusuran
            </label>

            {animateOn && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                Kecepatan:
                <input
                  type="range"
                  min={50}
                  max={1000}
                  step={50}
                  value={animSpeed}
                  onChange={(e) => setAnimSpeed(Number(e.target.value))}
                  style={{ accentColor: "#6366f1", width: 100 }}
                />
                <span style={{ color: "#6366f1", minWidth: 45 }}>
                  {animSpeed}ms
                </span>
              </label>
            )}

            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                marginLeft: "auto",
                padding: "10px 28px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                background: loading
                  ? "#1e2d40"
                  : "linear-gradient(135deg, #6366f1, #818cf8)",
                color: loading ? "#4b5563" : "#fff",
                border: "none",
                letterSpacing: "0.5px",
                transition: "all 0.2s",
                boxShadow: loading ? "none" : "0 4px 20px #6366f155",
              }}
            >
              {loading ? "⏳ Memproses..." : "▶ Mulai Pencarian"}
            </button>
          </div>

          {/* Row 4: LCA (Bonus) */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid #1e2d40",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Toggle LCA */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                onClick={() => {
                  setLcaEnabled((v) => !v);
                  setLcaResult(null);
                }}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: lcaEnabled ? "#06B6D4" : "#1e2d40",
                  border: "1px solid " + (lcaEnabled ? "#0891B2" : "#334155"),
                  position: "relative",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: lcaEnabled ? 20 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>LCA Query</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 999,
                  background: "#06B6D422",
                  color: "#06B6D4",
                  border: "1px solid #06B6D455",
                }}
              >
                BONUS
              </span>
            </div>

            {/* LCA inputs — hanya muncul kalau toggle ON */}
            {lcaEnabled && (
              <>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: "#64748b",
                      marginBottom: 3,
                      letterSpacing: "1px",
                    }}
                  >
                    NODE A (id)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={lcaNodeA}
                    onChange={(e) => setLcaNodeA(e.target.value)}
                    placeholder="contoh: 3"
                    style={{ ...inputStyle, width: 110 }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: "#64748b",
                      marginBottom: 3,
                      letterSpacing: "1px",
                    }}
                  >
                    NODE B (id)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={lcaNodeB}
                    onChange={(e) => setLcaNodeB(e.target.value)}
                    placeholder="contoh: 7"
                    style={{ ...inputStyle, width: 110 }}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  <label
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      letterSpacing: "1px",
                    }}
                  >
                    ⓘ lihat label <code style={{ color: "#818cf8" }}>id=N</code>{" "}
                    di tree
                  </label>
                  <button
                    onClick={handleLCA}
                    disabled={
                      lcaLoading ||
                      !result ||
                      lcaNodeA === "" ||
                      lcaNodeB === ""
                    }
                    style={{
                      padding: "7px 20px",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor:
                        lcaLoading ||
                        !result ||
                        lcaNodeA === "" ||
                        lcaNodeB === ""
                          ? "not-allowed"
                          : "pointer",
                      background:
                        lcaLoading ||
                        !result ||
                        lcaNodeA === "" ||
                        lcaNodeB === ""
                          ? "#1e2d40"
                          : "linear-gradient(135deg, #06B6D4, #0891B2)",
                      color:
                        lcaLoading ||
                        !result ||
                        lcaNodeA === "" ||
                        lcaNodeB === ""
                          ? "#4b5563"
                          : "#fff",
                      border: "none",
                      boxShadow: "0 2px 10px #06B6D422",
                    }}
                  >
                    {lcaLoading ? "⏳..." : "🔍 Cari LCA"}
                  </button>
                </div>

                {/* Inline result di control panel */}
                {lcaResult && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#080d18",
                      border: "1px solid #06B6D433",
                      flexWrap: "wrap",
                    }}
                  >
                    {lcaResult.lcaNodeId !== null ? (
                      <>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          LCA:
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#06B6D4",
                            fontFamily: "monospace",
                          }}
                        >
                          &lt;{lcaResult.lcaTag}&gt; (id={lcaResult.lcaNodeId})
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          path:
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          {(
                            lcaResult.pathWithRole ??
                            lcaResult.pathNodeIds.map((id) => ({
                              id,
                              tag: "?",
                              isLca: id === lcaResult.lcaNodeId,
                            }))
                          ).map((node, i, arr) => (
                            <span
                              key={node.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  fontWeight: node.isLca ? 700 : 400,
                                  background: node.isLca
                                    ? "#06B6D422"
                                    : "#F9731622",
                                  color: node.isLca ? "#06B6D4" : "#F97316",
                                  border: `1px solid ${node.isLca ? "#06B6D455" : "#F9731655"}`,
                                }}
                              >
                                {node.isLca ? "★ " : ""}
                                {node.id}
                              </span>
                              {i !== arr.length - 1 && (
                                <span
                                  style={{ color: "#F97316", fontSize: 12 }}
                                >
                                  →
                                </span>
                              )}
                            </span>
                          ))}
                        </span>
                        <button
                          onClick={() => setLcaResult(null)}
                          style={{
                            marginLeft: 4,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            background: "transparent",
                            color: "#475569",
                            border: "1px solid #334155",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: "#ef4444" }}>
                        ⚠ LCA tidak ditemukan
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#2d1515",
              border: "1px solid #ef444455",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              color: "#f87171",
              fontSize: 13,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {result && (
          <>
            {/* ── Stats Bar ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Node Dikunjungi",
                  value: result.stats.visitedCount,
                  icon: "👁",
                },
                {
                  label: "Elemen Cocok",
                  value: result.stats.matchedCount,
                  icon: "✅",
                },
                {
                  label: "Waktu Cocok",
                  value: `${result.stats.timeMs}ms`,
                  icon: "⚡",
                },
                {
                  label: "Kedalaman Maks",
                  value: result.stats.maxDepth,
                  icon: "🌳",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #1e2d40",
                    borderRadius: 10,
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                      letterSpacing: "1px",
                    }}
                  >
                    {s.icon} {s.label}
                  </div>
                  <div
                    style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Main 2-col layout ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 320px",
                gap: 20,
                marginBottom: 20,
              }}
            >
              {/* ── DOM Tree Visualization ── */}
              <div
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e2d40",
                  borderRadius: 12,
                  padding: 20,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      letterSpacing: "1px",
                    }}
                  >
                    🌲 DOM Tree Visualization
                  </h3>
                  {/* Legend */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 10,
                      color: "#64748b",
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      { color: "#FBBF24", label: "Active" },
                      { color: "#6366f1", label: "Visited" },
                      { color: "#10B981", label: "Match" },
                      { color: "#EF4444", label: "Backtrack" },
                      { color: "#06B6D4", label: "LCA" },
                      { color: "#F97316", label: "LCA Path" },
                    ].map((l) => (
                      <span
                        key={l.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: l.color,
                            display: "inline-block",
                          }}
                        />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Animation controls */}
                {animateOn && result.steps.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <button
                      onClick={handlePlay}
                      disabled={isPlaying}
                      style={ctrlBtn(!isPlaying)}
                    >
                      ▶ Play
                    </button>
                    <button
                      onClick={handlePause}
                      disabled={!isPlaying}
                      style={ctrlBtn(isPlaying)}
                    >
                      ⏸ Pause
                    </button>
                    <button onClick={handleReset} style={ctrlBtn(true)}>
                      ↺ Reset
                    </button>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        marginLeft: "auto",
                      }}
                    >
                      Step {Math.max(0, stepIndex + 1)} / {result.steps.length}
                      {isDone && (
                        <span style={{ color: "#10b981", marginLeft: 8 }}>
                          ✓ Selesai
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* SVG Tree */}
                <div
                  style={{
                    overflowX: "auto",
                    overflowY: "auto",
                    maxHeight: 480,
                  }}
                >
                  <svg
                    width={svgSize.w}
                    height={svgSize.h}
                    style={{ display: "block" }}
                  >
                    {/* Arrow marker definitions */}
                    <defs>
                      <marker
                        id="arrow-lca"
                        markerWidth="8"
                        markerHeight="8"
                        refX="6"
                        refY="3"
                        orient="auto"
                      >
                        <path d="M0,0 L0,6 L8,3 z" fill="#F97316" />
                      </marker>
                      <marker
                        id="arrow-normal"
                        markerWidth="6"
                        markerHeight="6"
                        refX="5"
                        refY="3"
                        orient="auto"
                      >
                        <path d="M0,0 L0,6 L6,3 z" fill="#6366f133" />
                      </marker>
                    </defs>

                    {/* Edges */}
                    {layout.map((node) => {
                      if (node.parentId === null) return null;
                      const parent = layout.find((n) => n.id === node.parentId);
                      if (!parent) return null;

                      const parentState = nodeStates.get(parent.id);
                      const childState = nodeStates.get(node.id);
                      const edgeActive =
                        (parentState === "visit" || parentState === "match") &&
                        (childState === "visit" || childState === "match");

                      // Cek apakah edge ini bagian dari LCA path
                      const pathIds = lcaResult?.pathNodeIds ?? [];
                      const parentInPath = pathIds.includes(parent.id);
                      const childInPath = pathIds.includes(node.id);
                      const isLcaEdge = parentInPath && childInPath;

                      // Hitung endpoint yang sedikit ditarik agar tidak tertutup lingkaran
                      const r = 23;
                      const dx = node.x - parent.x;
                      const dy = node.y - parent.y;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                      const x1 = parent.x + (dx / dist) * r;
                      const y1 = parent.y + (dy / dist) * r;
                      const x2 = node.x - (dx / dist) * r;
                      const y2 = node.y - (dy / dist) * r;

                      return (
                        <line
                          key={`edge-${node.id}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={
                            isLcaEdge
                              ? "#F97316"
                              : edgeActive
                                ? "#6366f155"
                                : "#1e2d40"
                          }
                          strokeWidth={isLcaEdge ? 2.5 : edgeActive ? 2 : 1}
                          markerEnd={isLcaEdge ? "url(#arrow-lca)" : undefined}
                          style={{ transition: "all 0.3s" }}
                        />
                      );
                    })}

                    {/* Nodes */}
                    {layout.map((node) => {
                      const colors = getNodeColor(
                        node.id,
                        currentStep,
                        nodeStates,
                        isDone,
                        lcaResult,
                      );
                      const isActive =
                        currentStep?.nodeId === node.id && !isDone;
                      const isLcaNode = lcaResult?.lcaNodeId === node.id;
                      const isLcaPath = lcaResult?.pathNodeIds.includes(
                        node.id,
                      );
                      return (
                        <g key={node.id} style={{ transition: "all 0.3s" }}>
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isActive ? 26 : isLcaNode ? 26 : 22}
                            fill={colors.fill}
                            stroke={colors.stroke}
                            strokeWidth={
                              isActive
                                ? 2.5
                                : isLcaNode
                                  ? 3
                                  : isLcaPath
                                    ? 2
                                    : 1.5
                            }
                            style={{
                              transition: "all 0.2s",
                              filter: isActive
                                ? "drop-shadow(0 0 8px #FBBF2488)"
                                : isLcaNode
                                  ? "drop-shadow(0 0 10px #06B6D488)"
                                  : isLcaPath
                                    ? "drop-shadow(0 0 6px #F9731688)"
                                    : "none",
                            }}
                          />
                          <text
                            x={node.x}
                            y={node.y + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={node.tag.length > 5 ? 8 : 10}
                            fontWeight={600}
                            fill={colors.text}
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {node.tag === "#document" ? "doc" : node.tag}
                          </text>
                          {/* id badge kecil untuk LCA input reference */}
                          <text
                            x={node.x}
                            y={node.y + 34}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#4b5563"
                            fontFamily="monospace"
                          >
                            id={node.id} d={node.depth}
                          </text>
                          {/* match label */}
                          {nodeStates.get(node.id) === "match" &&
                            !isLcaNode && (
                              <text
                                x={node.x}
                                y={node.y - 30}
                                textAnchor="middle"
                                fontSize={9}
                                fill="#10b981"
                                fontFamily="monospace"
                              >
                                match
                              </text>
                            )}
                          {/* LCA label */}
                          {isLcaNode && (
                            <text
                              x={node.x}
                              y={node.y - 32}
                              textAnchor="middle"
                              fontSize={9}
                              fontWeight={700}
                              fill="#06B6D4"
                              fontFamily="monospace"
                            >
                              LCA ★
                            </text>
                          )}
                          {/* LCA path label (non-LCA nodes on path) */}
                          {isLcaPath && !isLcaNode && (
                            <text
                              x={node.x}
                              y={node.y - 30}
                              textAnchor="middle"
                              fontSize={9}
                              fill="#F97316"
                              fontFamily="monospace"
                            >
                              path
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* ── Live Traversal Log ── */}
              <div
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e2d40",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#e2e8f0",
                    letterSpacing: "1px",
                  }}
                >
                  📋 Traversal Log
                </h3>
                <div
                  ref={logRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: 430,
                    background: "#080d18",
                    borderRadius: 8,
                    padding: 12,
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "#64748b",
                    lineHeight: 1.8,
                  }}
                >
                  {(animateOn ? visibleLog : result.traversalLog).map(
                    (line, i) => {
                      const isMatch = line.includes("MATCH");
                      const isVisit = line.includes("Visit");
                      return (
                        <div
                          key={i}
                          style={{
                            color: isMatch
                              ? "#10b981"
                              : isVisit
                                ? "#818cf8"
                                : "#475569",
                            borderLeft: isMatch
                              ? "2px solid #10b981"
                              : "2px solid transparent",
                            paddingLeft: 8,
                            marginBottom: 1,
                          }}
                        >
                          {line}
                        </div>
                      );
                    },
                  )}
                  {(!animateOn || isDone) && (
                    <div
                      style={{
                        color: "#6366f1",
                        marginTop: 8,
                        borderTop: "1px solid #1e2d40",
                        paddingTop: 8,
                      }}
                    >
                      — Traversal selesai —
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Matched Nodes JSON ── */}
            <div
              style={{
                background: "#0f172a",
                border: "1px solid #1e2d40",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  letterSpacing: "1px",
                }}
              >
                ✅ Matched Nodes Data — {result.data.length} elemen ditemukan
              </h3>
              <div
                style={{
                  background: "#080d18",
                  borderRadius: 8,
                  padding: 16,
                  maxHeight: 280,
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#10b981",
                  lineHeight: 1.7,
                }}
              >
                <pre style={{ margin: 0 }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "#1e2d40",
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌲</div>
            <p>
              Masukkan URL atau HTML, lalu klik{" "}
              <strong style={{ color: "#6366f1" }}>Mulai Pencarian</strong>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// Shared styles
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#080d18",
  border: "1px solid #1e2d40",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  color: "#e2e8f0",
  fontFamily: "JetBrains Mono, monospace",
  outline: "none",
};

function ctrlBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 14px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: active ? "pointer" : "not-allowed",
    background: active ? "#1e2d40" : "#0b0f1a",
    color: active ? "#94a3b8" : "#2d3748",
    border: "1px solid " + (active ? "#334155" : "#1a2030"),
  };
}
