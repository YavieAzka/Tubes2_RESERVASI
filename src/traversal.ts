import { DOMNode } from "./domtree";

export class TreeTraversal {
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
