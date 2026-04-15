import { DOMNode } from "./domtree";
import { HTMLParser as Lexer } from "./lexer";

export class DOMParser {
  public static parse(html: string): DOMNode {
    const tokens = Lexer.tokenize(html);
    const root = new DOMNode("#document");

    const stack: DOMNode[] = [root];

    for (const token of tokens) {
      const currentParent = stack[stack.length - 1];

      if (token.type === "StartTag") {
        const node = new DOMNode(token.value);

        if (token.attributes) {
          for (const [key, val] of Object.entries(token.attributes)) {
            node.setAttribute(key, val);
          }
        }
        currentParent.addChild(node);
        if (!Lexer.VOID_ELEMENTS.has(token.value)) {
          stack.push(node);
        }
      } else if (token.type === "EndTag") {
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === token.value) {
            stack.splice(i);
            break;
          }
        }
      } else if (token.type === "Text") {
        const textNode = new DOMNode("#text");
        textNode.text = token.value;
        currentParent.addChild(textNode);
      }
    }

    return root;
  }
}
