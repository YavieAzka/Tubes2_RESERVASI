// Tipe data untuk membedakan jenis token
export type TokenType = "StartTag" | "EndTag" | "Text";

export interface Token {
  type: TokenType;
  value: string; // Nama tag (misal: 'div') atau teks konten
  attributes?: Record<string, string>;
}

export class HTMLParser {
  // Daftar tag yang tidak memiliki tag penutup (self-closing)
  public static readonly VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  public static tokenize(html: string): Token[] {
    const tokens: Token[] = [];
    let cursor = 0;

    while (cursor < html.length) {
      const char = html[cursor];

      // Jika menemukan kurung sudut buka, ini adalah sebuah Tag
      if (char === "<") {
        // Cek apakah ini komentar , jika ya, lewati
        if (html.substring(cursor, cursor + 4) === "<!--") {
          const endComment = html.indexOf("-->", cursor + 4);
          cursor = endComment !== -1 ? endComment + 3 : html.length;
          continue;
        }

        const endBracket = html.indexOf(">", cursor);
        if (endBracket === -1) break; // HTML Malformed

        const tagContent = html.substring(cursor + 1, endBracket);

        // Cek apakah ini EndTag (contoh: </p>)
        if (tagContent.startsWith("/")) {
          tokens.push({
            type: "EndTag",
            value: tagContent.substring(1).trim().toLowerCase(),
          });
        } else {
          // Ini adalah StartTag (contoh: <div id="main" class="container">)
          const { tagName, attributes } = this.parseTagContent(tagContent);
          tokens.push({
            type: "StartTag",
            value: tagName,
            attributes: attributes,
          });
        }
        cursor = endBracket + 1;
      } else {
        // Ini adalah Text node
        const nextBracket = html.indexOf("<", cursor);
        const textEnd = nextBracket !== -1 ? nextBracket : html.length;
        const textContent = html.substring(cursor, textEnd);

        // Hanya masukkan teks jika bukan sekadar whitespace kosong
        if (textContent.trim().length > 0) {
          tokens.push({
            type: "Text",
            value: textContent.trim(),
          });
        }
        cursor = textEnd;
      }
    }
    return tokens;
  }

  /**
   * Helper untuk memisahkan nama tag dan atribut-atributnya.
   */
  private static parseTagContent(content: string): {
    tagName: string;
    attributes: Record<string, string>;
  } {
    // Regex sederhana untuk menangkap atribut: name="value" atau name='value'
    const attrRegex =
      /([a-zA-Z0-9\-:]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^>\s]+)))?/g;

    // Ambil nama tag (kata pertama sebelum spasi)
    const spaceIndex = content.search(/\s/);
    const tagName =
      spaceIndex === -1 ? content : content.substring(0, spaceIndex);

    const attributes: Record<string, string> = {};

    // Jika ada atribut, ekstrak menggunakan regex
    if (spaceIndex !== -1) {
      let match;
      const attrString = content.substring(spaceIndex);
      while ((match = attrRegex.exec(attrString)) !== null) {
        const key = match[1].toLowerCase();
        // Ambil value dari double quote, single quote, atau tanpa quote
        const value = match[2] || match[3] || match[4] || "";
        attributes[key] = value;
      }
    }

    return { tagName: tagName.toLowerCase().replace("/", ""), attributes };
  }
}
