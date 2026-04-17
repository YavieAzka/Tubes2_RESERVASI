export class DOMNode {
  public tag: string;
  public attributes: Record<string, string>;
  public text: string;

  public parent: DOMNode | null;
  public children: DOMNode[];
  public nextSibling: DOMNode | null;
  public prevSibling: DOMNode | null;

  constructor(tag: string) {
    this.tag = tag.toLowerCase(); // Standarisasi nama tag menjadi lowercase
    this.attributes = {};
    this.text = "";

    // Inisialisasi pointer relasi sebagai null/empty saat node baru dibuat
    this.parent = null;
    this.children = [];
    this.nextSibling = null;
    this.prevSibling = null;
  }

  // --- Helper Methods untuk Mempermudah CSS Matching ---

  /**
   * Menambahkan child node dan otomatis mengatur pointer parent & sibling.
   */
  public addChild(child: DOMNode): void {
    child.parent = this;

    if (this.children.length > 0) {
      const lastChild = this.children[this.children.length - 1];
      lastChild.nextSibling = child;
      child.prevSibling = lastChild;
    }

    this.children.push(child);
  }

  /**
   * Menyimpan atribut (seperti id, href, src).
   */
  public setAttribute(key: string, value: string): void {
    this.attributes[key] = value;
  }

  /**
   * Mengambil nilai atribut tertentu.
   */
  public getAttribute(key: string): string | null {
    return this.attributes[key] || null;
  }

  /**
   * Mengambil daftar class dalam bentuk array untuk mempermudah class selector (.).
   */
  public get classes(): string[] {
    const classStr = this.attributes["class"];
    if (!classStr) return [];
    // Memecah string class berdasarkan spasi dan menghilangkan spasi berlebih
    return classStr.split(/\s+/).filter((c) => c.length > 0);
  }

  /**
   * Mengambil ID untuk mempermudah ID selector (#).
   */
  public get id(): string | null {
    return this.attributes["id"] || null;
  }

  public static rehydrate(plainNode: any): DOMNode {
    const node = new DOMNode(plainNode.tag);
    node.attributes = plainNode.attributes || {};
    node.text = plainNode.text || "";

    if (plainNode.children) {
      for (const child of plainNode.children) {
        const rehydratedChild = DOMNode.rehydrate(child);
        node.addChild(rehydratedChild);
      }
    }
    return node;
  }
}
