import { NextResponse } from "next/server";
import { scrapeHTML } from "@/core/scraper";
import { DOMParser } from "@/core/parser";
import { Worker } from "worker_threads";
import path from "path";
import { DOMNode } from "@/core/domtree";

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
    // Require 'algo' from the frontend (default to BFS if missing)
    const { url, selector, algo = "BFS" } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL tidak diberikan" },
        { status: 400 },
      );
    }

    const htmlString = await scrapeHTML(url);
    const root = DOMParser.parse(htmlString);

    const maxTreeDepth = getMaxDepth(root);
    const serializedTree = serializeTreeForFrontend(root);

    let results: any[] = [];
    let executionTimeMs = 0;
    let nodesVisited = 0;
    let traversalLog: any[] = [];

    if (selector && selector.trim() !== "") {
      const startTime = performance.now();

      const queryResult = await runMultithreadedQuery(root, selector, algo);

      const endTime = performance.now();

      executionTimeMs = endTime - startTime;
      nodesVisited = queryResult.visitedCount;
      traversalLog = queryResult.traversalLog;

      results = queryResult.matchedNodes.map((node) => ({
        tag: node.tag,
        text: node.text,
        attributes: node.attributes,
        classes: node.classes,
        id: node.id,
      }));
    } else {
      results = [
        {
          info: "Tidak ada selector spesifik yang diminta. Menampilkan sebagian dari dokumen HTML.",
          htmlPreview: htmlString.substring(0, 500) + "...",
        },
      ];
    }

    return NextResponse.json({
      success: true,
      message: "Scraping & Parsing berhasil",
      algorithm: algo,
      executionTimeMs: Number(executionTimeMs.toFixed(2)),
      nodesVisited: nodesVisited,
      maxDepth: maxTreeDepth,
      traversalLog: traversalLog, // The log containing traversal steps
      treeData: serializedTree,
      matchedCount: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error("Scraping Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Terjadi kesalahan internal" },
      { status: 500 },
    );
  }
}
