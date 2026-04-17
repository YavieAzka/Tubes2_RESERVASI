import { NextResponse } from "next/server";
import { scrapeHTML } from "@/core/scraper";
import { DOMParser } from "@/core/parser";
import { Worker } from "worker_threads";
import path from "path";
import { DOMNode } from "@/core/domtree";
import { TreeTraversal } from "@/core/traversal";

// 1. Helper to flatten tree based on BFS or DFS selection
function getTraversalSequence(root: DOMNode, algo: "BFS" | "DFS"): DOMNode[] {
  const result: DOMNode[] = [];

  if (algo === "BFS") {
    const queue: DOMNode[] = [root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const child of current.children) {
        queue.push(child);
      }
    }
  } else {
    // DFS
    const stack: DOMNode[] = [root];
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      // Push children in reverse order so the first child is popped first
      for (let i = current.children.length - 1; i >= 0; i--) {
        stack.push(current.children[i]);
      }
    }
  }
  return result;
}

// 2. Helper to get maximum depth
function getMaxDepth(node: DOMNode): number {
  if (!node || node.children.length === 0) return 0;
  let maxChildDepth = 0;
  for (const child of node.children) {
    maxChildDepth = Math.max(maxChildDepth, getMaxDepth(child));
  }
  return 1 + maxChildDepth;
}

// 3. Helper to serialize tree for frontend visualization
function serializeTreeForFrontend(node: DOMNode): any {
  return {
    tag: node.tag,
    attributes: node.attributes,
    text:
      node.text.length > 50 ? node.text.substring(0, 50) + "..." : node.text,
    children: node.children.map((child) => serializeTreeForFrontend(child)),
  };
}

// 4. Multithreaded query runner
async function runMultithreadedQuery(
  root: DOMNode,
  selector: string,
  algo: "BFS" | "DFS",
): Promise<{
  matchedNodes: DOMNode[];
  visitedCount: number;
  traversalLog: any[];
}> {
  return new Promise((resolve, reject) => {
    // Determine the traversal sequence based on user input
    const allNodes = getTraversalSequence(root, algo);
    const totalNodes = allNodes.length;
    const numThreads = 4;
    const chunkSize = Math.ceil(totalNodes / numThreads);

    let completedWorkers = 0;
    let allMatchedIndices: number[] = [];

    for (let i = 0; i < numThreads; i++) {
      const startIdx = i * chunkSize;
      const endIdx = startIdx + chunkSize;

      const workerPath = path.resolve(
        process.cwd(),
        "src/core/traversal.worker.js",
      );
      const worker = new Worker(workerPath);

      worker.postMessage({
        plainTree: root,
        selector: selector,
        startIdx: startIdx,
        endIdx: endIdx,
      });

      worker.on("message", (matchedIndices: number[]) => {
        allMatchedIndices.push(...matchedIndices);
        completedWorkers++;

        if (completedWorkers === numThreads) {
          const matchedNodes = allMatchedIndices.map((idx) => allNodes[idx]);

          // Generate a lightweight traversal log for the frontend
          const traversalLog = allNodes.map((node, index) => ({
            step: index + 1,
            tag: node.tag,
            id: node.id || null,
            classes: node.classes || [],
          }));

          resolve({
            matchedNodes,
            visitedCount: totalNodes,
            traversalLog,
          });
        }
      });

      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0)
          reject(new Error(`Worker stopped with exit code ${code}`));
      });
    }
  });
}



export async function POST(request: Request) {
  try {
    const body = await request.json();

    //  LCA Query: reconstruct tree dari serializedTree, pakai TreeTraversal 
    if (body.lcaNodeA !== undefined && body.lcaNodeB !== undefined && body.serializedTree) {
      const flatTree = body.serializedTree as Record<number, any>;
      const nodeMap = new Map<number, DOMNode>();

      // Pass 1: buat semua DOMNode
      for (const [idStr, data] of Object.entries(flatTree)) {
        const node = new DOMNode(data.tag);
        node.attributes = data.attributes ?? {};
        node.text = data.text ?? "";
        nodeMap.set(Number(idStr), node);
      }

      // Pass 2: sambungkan parent-child pointer
      let lcaRoot: DOMNode | null = null;
      for (const [idStr, data] of Object.entries(flatTree)) {
        const id = Number(idStr);
        const node = nodeMap.get(id)!;
        if (data.parentId == null) {
          lcaRoot = node;
        } else {
          const parent = nodeMap.get(data.parentId);
          if (parent) node.parent = parent;
        }
        for (const childId of (data.childIds ?? [])) {
          const child = nodeMap.get(childId);
          if (child) node.children.push(child);
        }
      }

      const empty = { success: true, lca: { lcaNodeId: null, lcaTag: null, pathNodeIds: [], pathWithRole: [] } };
      if (!lcaRoot) return NextResponse.json(empty);

      // Preprocess + query pakai TreeTraversal dari traversal.ts
      TreeTraversal.preprocess(lcaRoot);

      const nodeA = nodeMap.get(Number(body.lcaNodeA));
      const nodeB = nodeMap.get(Number(body.lcaNodeB));
      if (!nodeA || !nodeB) return NextResponse.json(empty);

      const ancestor = TreeTraversal.lca(nodeA, nodeB);
      const path = ancestor ? TreeTraversal.getPathBetween(nodeA, nodeB) : [];

      // Mapping DOMNode → id
      const nodeToId = new Map<DOMNode, number>();
      for (const [id, node] of nodeMap) nodeToId.set(node, id);

      return NextResponse.json({
        success: true,
        lca: {
          lcaNodeId: ancestor ? nodeToId.get(ancestor) ?? null : null,
          lcaTag: ancestor?.tag ?? null,
          pathNodeIds: path.map(n => nodeToId.get(n) ?? -1).filter(id => id !== -1),
          pathWithRole: path.map(n => ({
            id: nodeToId.get(n) ?? -1,
            tag: n.tag,
            isLca: n === ancestor,
          })).filter(p => p.id !== -1),
        }
      });
    }

    // Ekstrak parameter baru dari frontend
    const { url, html, mode = "url", selector, algorithm = "BFS" } = body;

    let htmlString = "";
    if (mode === "url") {
      if (!url)
        return NextResponse.json(
          { success: false, error: "URL tidak diberikan" },
          { status: 400 },
        );
      htmlString = await scrapeHTML(url);
    } else {
      if (!html)
        return NextResponse.json(
          { success: false, error: "HTML kosong" },
          { status: 400 },
        );
      htmlString = html;
    }

    const root = DOMParser.parse(htmlString);
    const maxTreeDepth = getMaxDepth(root);

    //  FRONTEND ADAPTER: Buat Flat Tree & ID Numerik 
    const nodeToNumericId = new Map<DOMNode, number>();
    let currentNumericId = 1;
    const flatTree: Record<number, any> = {};

    function traverseAndFlatten(
      node: DOMNode,
      depth: number,
      parentId: number | null,
    ): number {
      const id = currentNumericId++;
      nodeToNumericId.set(node, id);

      const childIds: number[] = [];
      for (const child of node.children) {
        childIds.push(traverseAndFlatten(child, depth + 1, id));
      }

      flatTree[id] = {
        id,
        tag: node.tag,
        attributes: node.attributes,
        text:
          node.text.length > 50
            ? node.text.substring(0, 50) + "..."
            : node.text,
        depth,
        parentId,
        childIds,
      };
      return id;
    }

    // Mulai pembuatan flat tree dari root
    traverseAndFlatten(root, 0, null);

    let finalData: any[] = [];
    let executionTimeMs = 0;
    let nodesVisited = 0;
    let steps: any[] = [];
    let traversalLogStrings: string[] = [];

    if (selector && selector.trim() !== "") {
      const startTime = performance.now();
      const queryResult = await runMultithreadedQuery(
        root,
        selector,
        algorithm,
      );
      const endTime = performance.now();

      executionTimeMs = endTime - startTime;
      nodesVisited = queryResult.visitedCount;

      // Buat Set id dari node yang match untuk lookup O(1)
      const matchedSet = new Set<DOMNode>(queryResult.matchedNodes);

      // Hitung "ancestorPath", semua ancestor dari setiap matched node
      const onPathSet = new Set<DOMNode>();
      for (const matchedNode of queryResult.matchedNodes) {
        let cur = matchedNode.parent;
        while (cur) {
          onPathSet.add(cur);
          cur = cur.parent;
        }
      }

      // Buat limit untuk early stop animasi
      const limitTop = body.limitType === "top" && typeof body.limit === "number"
        ? body.limit
        : undefined;

      const sequence = getTraversalSequence(root, algorithm);
      let matchCount = 0;
      let stopped = false;

      for (const node of sequence) {
        if (stopped) break;
        const numericId = nodeToNumericId.get(node)!;
        const nodeInfo = flatTree[numericId];

        // Step VISIT
        steps.push({
          nodeId: numericId,
          tag: node.tag,
          depth: nodeInfo.depth,
          action: "visit",
          parentId: nodeInfo.parentId,
          timestamp: Date.now(),
        });
        traversalLogStrings.push(`[${algorithm}] Visit <${node.tag}> (id=${numericId}, depth=${nodeInfo.depth})`);

        if (matchedSet.has(node)) {
          // Step MATCH
          steps.push({
            nodeId: numericId,
            tag: node.tag,
            depth: nodeInfo.depth,
            action: "match",
            parentId: nodeInfo.parentId,
            timestamp: Date.now(),
          });
          traversalLogStrings.push(`[${algorithm}] ✓ MATCH <${node.tag}> (id=${numericId})`);
          matchCount++;

          // Early stop jika limit tercapai
          if (limitTop !== undefined && matchCount >= limitTop) {
            traversalLogStrings.push(`[${algorithm}] Limit ${limitTop} tercapai, pencarian dihentikan.`);
            stopped = true;
          }
        } else if (algorithm === "DFS" && !onPathSet.has(node)) {
          steps.push({
            nodeId: numericId,
            tag: node.tag,
            depth: nodeInfo.depth,
            action: "backtrack",
            parentId: nodeInfo.parentId,
            timestamp: Date.now(),
          });
          traversalLogStrings.push(`[DFS] Backtrack <${node.tag}> (id=${numericId})`);
        }
      }

      // Format final data (hanya matched nodes, dibatasi limitTop)
      const limitedMatched = limitTop !== undefined
        ? queryResult.matchedNodes.slice(0, limitTop)
        : queryResult.matchedNodes;

      finalData = limitedMatched.map((node) => {
        const numericId = nodeToNumericId.get(node)!;
        return {
          id: numericId,
          tag: node.tag,
          text: node.text,
          attributes: node.attributes,
          depth: flatTree[numericId].depth,
        };
      });
    }

    // Kembalikan JSON dengan format yang presisi sesuai ApiResponse page.tsx
    return NextResponse.json({
      success: true,
      data: finalData,
      tree: flatTree,
      steps: steps,
      traversalLog: traversalLogStrings,
      stats: {
        visitedCount: nodesVisited,
        matchedCount: finalData.length,
        timeMs: Number(executionTimeMs.toFixed(2)),
        maxDepth: maxTreeDepth,
        totalTimeMs: Number(executionTimeMs.toFixed(2)),
      },
      lca: null,
    });
  } catch (error: any) {
    console.error("Scraping Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Terjadi kesalahan internal" },
      { status: 500 },
    );
  }
}