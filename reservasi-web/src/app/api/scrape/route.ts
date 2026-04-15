import { NextResponse } from "next/server";
import { scrapeHTML } from "@/core/scraper";
import { DOMParser } from "@/core/parser";
import { SelectorMatcher } from "@/core/selector-matcher";
import { DOMNode } from "@/core/domtree";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, selector } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL tidak diberikan" },
        { status: 400 },
      );
    }

    const htmlString = await scrapeHTML(url);

    const root = DOMParser.parse(htmlString);

    let results: any[] = [];

    if (selector && selector.trim() !== "") {
      const matchedNodes: DOMNode[] = SelectorMatcher.querySelectorAll(
        root,
        selector,
      );

      // Format hasil pencarian agar mudah ditampilkan di frontend (JSON)
      results = matchedNodes.map((node) => ({
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
