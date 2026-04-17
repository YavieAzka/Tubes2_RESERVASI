import { parentPort } from "worker_threads";
import { DOMNode } from "./domtree";
import { SelectorMatcher } from "./selector-matcher";
import { SelectorParser } from "./selector-parser";

// Helper untuk membuat tree menjadi array 1 dimensi
function flattenTree(root: DOMNode): DOMNode[] {
  const result: DOMNode[] = [];
  const queue: DOMNode[] = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const child of current.children) {
      queue.push(child);
    }
  }
  return result;
}

parentPort?.on("message", (data) => {
  const { plainTree, selector, startIdx, endIdx } = data;

  // Bangun ulang object DOMNode
  const root = DOMNode.rehydrate(plainTree);
  const parsedSelector = SelectorParser.parse(selector);

  // Ratakan tree untuk mendapatkan index yang sesuai dengan main thread
  const allNodes = flattenTree(root);

  // Cek kecocokan HANYA pada bagian (chunk) yang ditugaskan ke worker ini
  const matchedIndices: number[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    if (i >= allNodes.length) break;

    if (SelectorMatcher.matches(allNodes[i], parsedSelector)) {
      matchedIndices.push(i);
    }
  }

  // Kirim kembali index yang cocok ke main thread
  parentPort?.postMessage(matchedIndices);
});
