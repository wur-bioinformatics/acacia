import { useEffect, useLayoutEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDocsStore } from "./docsStore";
import { docsContent } from "./content";
import { toc } from "./toc";

export function DocsSheet() {
  const open = useDocsStore((s) => s.open);
  const scrollTarget = useDocsStore((s) => s.scrollTarget);
  const closeDocs = useDocsStore((s) => s.closeDocs);
  const openDocs = useDocsStore((s) => s.openDocs);
  const articleRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !scrollTarget) return;
    const raf = requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article) return;
      const target = article.querySelector(`#${CSS.escape(scrollTarget)}`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: "start" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, scrollTarget]);

  useEffect(() => {
    if (!open) return;
    const initial = scrollTarget ? `#docs/${scrollTarget}` : "#docs";
    if (window.location.hash !== initial) {
      history.replaceState(null, "", initial);
    }
    return () => {
      if (window.location.hash.startsWith("#docs")) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
  }, [open, scrollTarget]);

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? openDocs() : closeDocs())}>
      <SheetContent
        side="right"
        className="data-[side=right]:w-[90vw] data-[side=right]:sm:w-[min(70vw,1400px)] data-[side=right]:sm:max-w-none p-0 overflow-hidden flex flex-col gap-0"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Documentation</SheetTitle>
        </SheetHeader>
        <nav className="flex items-center gap-1 overflow-x-auto border-b px-4 py-2 shrink-0">
          {toc
            .filter((e) => e.depth === 1)
            .map((entry) => (
              <a
                key={entry.id}
                href={`#${entry.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  openDocs(entry.id);
                }}
                className="whitespace-nowrap rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {entry.text}
              </a>
            ))}
        </nav>
        <article
          ref={articleRef}
          className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-auto px-8 py-6"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
              rehypeHighlight,
            ]}
          >
            {docsContent}
          </ReactMarkdown>
        </article>
      </SheetContent>
    </Sheet>
  );
}
