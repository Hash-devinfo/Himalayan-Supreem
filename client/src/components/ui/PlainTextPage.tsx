import type { ReactNode } from 'react';

// Shows page text written with simple marks: "# " heading, "## " smaller heading, "- " list item,
// a blank line between paragraphs. Everything is shown as text, never as HTML.
export default function PlainTextPage({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-6">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-3 whitespace-pre-line">
        {paragraph.join('\n')}
      </p>,
    );
    paragraph = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      flushList();
      flushParagraph();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-5 mb-2 font-medium">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      flushList();
      flushParagraph();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mt-6 mb-2 text-lg font-medium">
          {line.slice(2)}
        </h2>,
      );
    } else if (/^[-*] /.test(line)) {
      flushParagraph();
      list.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
      flushParagraph();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushList();
  flushParagraph();

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}