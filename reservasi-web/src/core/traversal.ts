import { DOMNode } from "./domtree";
import { SelectorMatcher } from "./selector-matcher";
import { SelectorParser } from "./selector-parser";


const nodeIdMap = new WeakMap<DOMNode, number>();
let _idCounter = 0;

export function getNodeId(node: DOMNode): number {
  if (!nodeIdMap.has(node)) {
    nodeIdMap.set(node, _idCounter++);
  }
  return nodeIdMap.get(node)!;
}

export function resetNodeIds(): void {
  _idCounter = 0;
}


export type StepAction = "visit" | "match" | "backtrack";

export interface TraversalStep {
  nodeId: number;
  tag: string;
  depth: number;
  action: StepAction;
  parentId: number | null;
  timestamp: number; // ms sejak traversal mulai
}

/** Versi JSON-safe dari DOMNode (tanpa circular reference) untuk dikirim ke frontend */
export interface SerializedNode {
  id: number;
  tag: string;
  attributes: Record<string, string>;
  text: string;
  depth: number;
  parentId: number | null;
  childIds: number[];
}

export interface TraversalResult {
  steps: TraversalStep[];
  matches: DOMNode[];
  stats: {
    visitedCount: number;
    matchedCount: number;
    timeMs: number;
    maxDepth: number;
  };
  traversalLog: string[];
  tree: Record<number, SerializedNode>; // flat tree untuk page.tsx
}

export interface TraversalOptions {
  root: DOMNode;
  method: "DFS" | "BFS";
  selector: string;
  animate: boolean;
  limitTop?: number;
}


/** Hitung depth node dengan naik ke parent */
export function getDepth(node: DOMNode): number {
  let d = 0;
  let cur = node.parent;
  while (cur) { d++; cur = cur.parent; }
  return d;
}

/** Hitung kedalaman maksimum tree */
function computeMaxDepth(root: DOMNode): number {
  let max = 0;
  TreeTraversal.dfs(root, (node) => {
    const d = getDepth(node);
    if (d > max) max = d;
  });
  return max;
}


// TREE SERIALIZER

export function serializeTree(root: DOMNode): Record<number, SerializedNode> {
  const result: Record<number, SerializedNode> = {};
  const visited = new Set<DOMNode>();

  // BFS supaya id ter-assign urut dari root ke bawah
  const queue: DOMNode[] = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);

    const id = getNodeId(node);

    result[id] = {
      id,
      tag: node.tag,
      attributes: { ...node.attributes },
      text: node.text,
      depth: getDepth(node),
      parentId: node.parent ? getNodeId(node.parent) : null,
      childIds: node.children.map(c => getNodeId(c)),
    };

    for (const child of node.children) {
      queue.push(child);
    }
  }

  return result;
}

//  CSS SELECTOR MATCHING HELPER

let _cachedSelector = "";
let _cachedParsed: ReturnType<typeof SelectorParser.parse> | null = null;

function checkMatch(node: DOMNode, selector: string): boolean {
  try {
    // Parse sekali, reuse untuk semua node dalam satu traversal
    if (selector !== _cachedSelector) {
      _cachedParsed = SelectorParser.parse(selector);
      _cachedSelector = selector;
    }
    return SelectorMatcher.matches(node, _cachedParsed!);
  } catch {
    return false;
  }
}


export class TreeTraversal {

  private static readonly LOG = 20;

  // Binary lifting tables
  private static upperN = new Map<DOMNode, DOMNode[]>();
  private static depthMap = new Map<DOMNode, number>();

  // LCA Preprocessing
  public static preprocess(root: DOMNode): void {
    this.upperN.clear();
    this.depthMap.clear();
    this.depthMap.set(root, 0);

    const rootAncestors: DOMNode[] = new Array(this.LOG).fill(root);
    this.upperN.set(root, rootAncestors);

    for (const child of root.children) {
      this.depthMap.set(child, 1);
      this.lcaBuild(child);
    }
  }

  private static lcaBuild(node: DOMNode): void {
    const parent = node.parent ?? node;

    const ancestors: DOMNode[] = new Array(this.LOG);
    ancestors[0] = parent;

    for (let i = 1; i < this.LOG; i++) {
      const half = ancestors[i - 1];
      const halfUp = this.upperN.get(half);
      ancestors[i] = halfUp ? halfUp[i - 1] : half;
    }

    this.upperN.set(node, ancestors);

    for (const child of node.children) {
      this.depthMap.set(child, (this.depthMap.get(node) ?? 0) + 1);
      this.lcaBuild(child);
    }
  }

  // LCA Query
  public static lca(a: DOMNode, b: DOMNode): DOMNode | null {
    if (!this.depthMap.has(a) || !this.depthMap.has(b)) return null;

    let da = this.depthMap.get(a)!;
    let db = this.depthMap.get(b)!;

    // Pastikan a lebih dalam
    if (da < db) { [a, b] = [b, a]; [da, db] = [db, da]; }

    // Naikkan a sampai kedalaman sama dengan b
    let diff = da - db;
    for (let i = 0; i < this.LOG; i++) {
      if (diff & (1 << i)) {
        a = this.upperN.get(a)?.[i] ?? a;
      }
    }

    if (a === b) return a;

    // Naikkan keduanya bersama sampai tepat di bawah LCA
    for (let i = this.LOG - 1; i >= 0; i--) {
      const upA = this.upperN.get(a)?.[i];
      const upB = this.upperN.get(b)?.[i];
      if (upA && upB && upA !== upB) {
        a = upA;
        b = upB;
      }
    }

    return this.upperN.get(a)?.[0] ?? null;
  }

 
  public static getPathBetween(a: DOMNode, b: DOMNode): DOMNode[] {
    const ancestor = this.lca(a, b);
    if (!ancestor) return [];

    const pathUp = (node: DOMNode): DOMNode[] => {
      const path: DOMNode[] = [];
      let cur: DOMNode | null = node;
      while (cur && cur !== ancestor) {
        path.push(cur);
        cur = cur.parent;
      }
      path.push(ancestor);
      return path;
    };

    const pathA = pathUp(a);
    const pathB = pathUp(b).reverse().slice(1); // hilangkan duplikat ancestor
    return [...pathA, ...pathB];
  }


  public static bfs(root: DOMNode, onVisit: (node: DOMNode) => void): void {
    const queue: DOMNode[] = [root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      onVisit(current);
      for (const child of current.children) {
        queue.push(child);
      }
    }
  }


  public static dfs(root: DOMNode, onVisit: (node: DOMNode) => void): void {
    onVisit(root);
    for (const child of root.children) {
      this.dfs(child, onVisit);
    }
  }
}


function runDFS(
  root: DOMNode,
  selector: string,
  animate: boolean,
  startTime: number,
  steps: TraversalStep[],
  matches: DOMNode[],
  log: string[],
  limitTop: number | undefined,
): number {
  let visited = 0;
  let stopped = false;

  function dfs(node: DOMNode): void {
    if (stopped) return;
    if (node.tag === "#text") return;

    visited++;
    const nodeId = getNodeId(node);
    const depth = getDepth(node);
    const elapsed = Date.now() - startTime;

    if (animate) {
      steps.push({
        nodeId, tag: node.tag, depth,
        action: "visit",
        parentId: node.parent ? getNodeId(node.parent) : null,
        timestamp: elapsed,
      });
    }
    log.push(`[DFS] Visit <${node.tag}> (id=${nodeId}, depth=${depth})`);

    const isMatch = checkMatch(node, selector);

    if (isMatch) {
      matches.push(node);
      if (animate) {
        steps.push({
          nodeId, tag: node.tag, depth,
          action: "match",
          parentId: node.parent ? getNodeId(node.parent) : null,
          timestamp: Date.now() - startTime,
        });
      }
      log.push(`[DFS] ✓ MATCH <${node.tag}> (id=${nodeId})`);

      // Early stop jika limit tercapai
      if (limitTop !== undefined && matches.length >= limitTop) {
        log.push(`[DFS] Limit ${limitTop} tercapai, pencarian dihentikan.`);
        stopped = true;
        return;
      }
    }

    for (const child of node.children) {
      if (stopped) break;
      dfs(child);
    }

    if (!stopped && !isMatch) {
      if (animate) {
        steps.push({
          nodeId, tag: node.tag, depth,
          action: "backtrack",
          parentId: node.parent ? getNodeId(node.parent) : null,
          timestamp: Date.now() - startTime,
        });
      }
      log.push(`[DFS] Backtrack <${node.tag}> (id=${nodeId})`);
    }
  }

  for (const child of root.children) {
    if (stopped) break;
    dfs(child);
  }

  return visited;
}

function runBFS(
  root: DOMNode,
  selector: string,
  animate: boolean,
  startTime: number,
  steps: TraversalStep[],
  matches: DOMNode[],
  log: string[],
  limitTop: number | undefined,
): number {
  let visited = 0;
  const queue: DOMNode[] = [...root.children];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.tag === "#text") continue;

    visited++;
    const nodeId = getNodeId(node);
    const depth = getDepth(node);
    const elapsed = Date.now() - startTime;

    if (animate) {
      steps.push({
        nodeId, tag: node.tag, depth,
        action: "visit",
        parentId: node.parent ? getNodeId(node.parent) : null,
        timestamp: elapsed,
      });
    }
    log.push(`[BFS] Visit <${node.tag}> (id=${nodeId}, depth=${depth})`);

    const isMatch = checkMatch(node, selector);
    if (isMatch) {
      matches.push(node);
      if (animate) {
        steps.push({
          nodeId, tag: node.tag, depth,
          action: "match",
          parentId: node.parent ? getNodeId(node.parent) : null,
          timestamp: Date.now() - startTime,
        });
      }
      log.push(`[BFS] ✓ MATCH <${node.tag}> (id=${nodeId})`);


      if (limitTop !== undefined && matches.length >= limitTop) {
        log.push(`[BFS] Limit ${limitTop} tercapai, pencarian dihentikan.`);
        break;
      }
    }

    for (const child of node.children) {
      queue.push(child);
    }
  }

  return visited;
}

export function runTraversal(options: TraversalOptions): TraversalResult {
  const { root, method, selector, animate, limitTop } = options;

  _cachedSelector = "";
  _cachedParsed = null;

  const startTime = Date.now();
  const steps: TraversalStep[] = [];
  const matches: DOMNode[] = [];
  const log: string[] = [];

  log.push(`[Engine] Mulai ${method} | selector: "${selector}" | animate: ${animate}`);

  const visitedCount = method === "DFS"
    ? runDFS(root, selector, animate, startTime, steps, matches, log, limitTop)
    : runBFS(root, selector, animate, startTime, steps, matches, log, limitTop);

  const timeMs = Date.now() - startTime;
  const maxDepth = computeMaxDepth(root);

  const finalMatches = matches;

  log.push(`[Engine] Selesai. Visited=${visitedCount}, Matched=${finalMatches.length}, Time=${timeMs}ms`);

  return {
    steps,
    matches: finalMatches,
    stats: {
      visitedCount,
      matchedCount: finalMatches.length,
      timeMs,
      maxDepth,
    },
    traversalLog: log,
    tree: serializeTree(root),
  };
}