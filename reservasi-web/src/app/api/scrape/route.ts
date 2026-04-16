import { NextResponse } from "next/server";
import { scrapeHTML } from "@/core/scraper";
import { DOMParser } from "@/core/parser";
import { DOMNode } from "@/core/domtree";
import { TreeTraversal, runTraversal, getNodeId, resetNodeIds, getDepth, SerializedNode } from "@/core/traversal";

// ================================================================
// POST /api/scrape
//
// Dua mode request:
//
// 1. Search biasa (lcaNodeA/B tidak ada):
//    → scrape/parse HTML, traversal, return tree + steps + matches
//
// 2. LCA query (lcaNodeA + lcaNodeB + tree dikirim dari frontend):
//    → reconstruct tree dari serialized data, jalankan LCA, return result
//    → TIDAK perlu scrape/parse ulang, sehingga id node tetap konsisten
// ================================================================

// ── Helper: reconstruct DOMNode tree dari SerializedNode (flat map) ──
// Digunakan khusus untuk LCA query agar tidak perlu re-parse HTML
function reconstructTree(flatTree: Record<number, SerializedNode>): Map<number, DOMNode> {
  const nodeMap = new Map<number, DOMNode>();

  // Pass 1: buat semua DOMNode
  for (const serialized of Object.values(flatTree)) {
    const node = new DOMNode(serialized.tag);
    node.attributes = serialized.attributes;
    node.text = serialized.text;
    nodeMap.set(serialized.id, node);
  }

  // Pass 2: sambungkan parent-child pointer
  for (const serialized of Object.values(flatTree)) {
    const node = nodeMap.get(serialized.id)!;
    if (serialized.parentId !== null) {
      const parent = nodeMap.get(serialized.parentId);
      if (parent) {
        node.parent = parent;
      }
    }
    for (const childId of serialized.childIds) {
      const child = nodeMap.get(childId);
      if (child) node.children.push(child);
    }
  }

  return nodeMap;
}

export async function POST(request: Request) {
  const startTotal = Date.now();

  try {
    const body = await request.json();
    const {
      mode,
      url,
      html,
      selector,
      algorithm,
      animate,
      limitType,
      limit,
      lcaNodeA,
      lcaNodeB,
      // Frontend mengirim tree yang sudah dirender untuk LCA query
      serializedTree,
    } = body;

    const isLcaRequest = typeof lcaNodeA === "number" && typeof lcaNodeB === "number";

    // ── JALUR LCA: reconstruct tree dari data frontend ────────────
    if (isLcaRequest && serializedTree) {
      const nodeMap = reconstructTree(serializedTree as Record<number, SerializedNode>);

      // Cari root (#document atau node tanpa parent)
      let root: DOMNode | undefined;
      for (const [, node] of nodeMap) {
        if (node.parent === null) { root = node; break; }
      }

      if (!root) {
        return NextResponse.json({ success: false, error: "Root tidak ditemukan di serializedTree" }, { status: 400 });
      }

      // Preprocess LCA dengan tree yang direconstructed
      TreeTraversal.preprocess(root);

      const nodeA = nodeMap.get(lcaNodeA);
      const nodeB = nodeMap.get(lcaNodeB);

      if (!nodeA || !nodeB) {
        return NextResponse.json({
          success: true,
          lca: { lcaNodeId: null, lcaTag: null, pathNodeIds: [], pathWithRole: [] }
        });
      }

      const ancestor = TreeTraversal.lca(nodeA, nodeB);
      const path = ancestor ? TreeTraversal.getPathBetween(nodeA, nodeB) : [];

      // id node di reconstructed tree = key dari nodeMap (dari serializedTree)
      // Kita perlu mapping DOMNode → id dari serializedTree
      const nodeToId = new Map<DOMNode, number>();
      for (const [id, node] of nodeMap) nodeToId.set(node, id);

      const lcaResult = {
        lcaNodeId: ancestor ? nodeToId.get(ancestor) ?? null : null,
        lcaTag: ancestor?.tag ?? null,
        pathNodeIds: path.map(n => nodeToId.get(n) ?? -1).filter(id => id !== -1),
        pathWithRole: path.map(n => ({
          id: nodeToId.get(n) ?? -1,
          tag: n.tag,
          isLca: n === ancestor,
        })).filter(p => p.id !== -1),
      };

      return NextResponse.json({ success: true, lca: lcaResult });
    }

    // ── JALUR NORMAL: validasi + scrape + traversal ───────────────
    if (!selector) {
      return NextResponse.json({ error: "selector wajib diisi" }, { status: 400 });
    }
    if (mode === "url" && !url) {
      return NextResponse.json({ error: "url wajib diisi" }, { status: 400 });
    }
    if (mode === "html" && !html) {
      return NextResponse.json({ error: "html wajib diisi" }, { status: 400 });
    }
    if (!["DFS", "BFS"].includes(algorithm)) {
      return NextResponse.json({ error: "algorithm harus 'DFS' atau 'BFS'" }, { status: 400 });
    }

    // Step 1: Ambil HTML
    const rawHTML: string = mode === "url" ? await scrapeHTML(url) : html;

    // Step 2: Reset id dan parse
    resetNodeIds();
    const root: DOMNode = DOMParser.parse(rawHTML);

    // Step 3: Preprocess LCA
    TreeTraversal.preprocess(root);

    // Step 4: Traversal
    const topLimit = limitType === "top" && typeof limit === "number" ? limit : undefined;
    const { steps, matches, stats, traversalLog, tree } = runTraversal({
      root,
      method: algorithm as "DFS" | "BFS",
      selector,
      animate: Boolean(animate),
      limitTop: topLimit,
    });

    // Step 5: Format match data
    const matchData = matches.map((node) => ({
      id: getNodeId(node),
      tag: node.tag,
      text: node.text,
      attributes: node.attributes,
      depth: getDepth(node),
      parentId: node.parent ? getNodeId(node.parent) : null,
    }));

    return NextResponse.json({
      success: true,
      data: matchData,
      tree,
      steps: animate ? steps : [],
      traversalLog,
      stats: { ...stats, totalTimeMs: Date.now() - startTotal },
      lca: null,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[API /scrape]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}