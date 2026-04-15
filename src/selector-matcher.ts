import { DOMNode } from "./domtree";
import {
  SelectorParsed,
  SimpleSelector,
  SelectorStep,
  SelectorParser,
} from "./selector-parser";
import { TreeTraversal } from "./traversal";

export class SelectorMatcher {
  /*
  Mengecek apakah sebuah node tertentu cocok dengan selector yang sudah di-parse.
  Strategi: Matching dilakukan dari kanan ke kiri (seperti browser engine).
   */
  public static matches(node: DOMNode, parsed: SelectorParsed): boolean {
    const steps = parsed.steps;
    return this.matchStepRecursive(node, steps, steps.length - 1);
  }

  /*
  Mencari semua node di bawah root yang cocok dengan string selector.
   */
  public static querySelectorAll(root: DOMNode, selector: string): DOMNode[] {
    const parsed = SelectorParser.parse(selector);
    const results: DOMNode[] = [];


    TreeTraversal.dfs(root, (node) => {
      if (this.matches(node, parsed)) {
        results.push(node);
      }
    });

    return results;
  }

  /*
  Helper rekursif untuk mengecek kecocokan step demi step dari kanan ke kiri.
   */
  private static matchStepRecursive(
    node: DOMNode | null,
    steps: SelectorStep[],
    stepIndex: number,
  ): boolean {
    if (stepIndex < 0) return true; 
    if (!node) return false;

    const currentStep = steps[stepIndex];

    if (!this.matchSimpleSelector(node, currentStep.selector)) {
      return false;
    }

    if (stepIndex === 0) return true;

    const prevStepIndex = stepIndex - 1;
    const combinator = currentStep.combinator;

    switch (combinator) {
      case ">":
        return this.matchStepRecursive(node.parent, steps, prevStepIndex);

      case " ":
        let ancestor = node.parent;
        while (ancestor) {
          if (this.matchStepRecursive(ancestor, steps, prevStepIndex))
            return true;
          ancestor = ancestor.parent;
        }
        return false;

      case "+":
        return this.matchStepRecursive(node.prevSibling, steps, prevStepIndex);

      case "~":
        let sibling = node.prevSibling;
        while (sibling) {
          if (this.matchStepRecursive(sibling, steps, prevStepIndex))
            return true;
          sibling = sibling.prevSibling;
        }
        return false;

      default:
        return false;
    }
  }

  /*
  Mengecek apakah satu node cocok dengan kriteria SimpleSelector (Tag, ID, Class).
   */
  private static matchSimpleSelector(
    node: DOMNode,
    simple: SimpleSelector,
  ): boolean {
    if (!simple.universal && simple.tag && node.tag !== simple.tag) {
      return false;
    }

    if (simple.id && node.id !== simple.id) {
      return false;
    }

    if (simple.classes.length > 0) {
      const nodeClasses = node.classes;
      for (const cls of simple.classes) {
        if (!nodeClasses.includes(cls)) return false;
      }
    }

    return true;
  }
}
