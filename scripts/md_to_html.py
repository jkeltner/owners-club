#!/usr/bin/env python3
"""Turn a small Markdown report into HTML for email.

Gmail shows Markdown as literal asterisks and pound signs, so the review
runner converts the report with this script and sends it with `gws ... --html`.
Standard library only; covers what the reports use: headings, paragraphs,
bulleted and numbered lists (nested by indentation), fenced code, horizontal
rules, bold, italic, inline code, links, bare URLs and `#123` issue references.

    md_to_html.py [--issues owner/repo] < report.md > report.html
"""
import html
import re
import sys

INLINE_CODE = re.compile(r"`([^`]+)`")
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")
BOLD = re.compile(r"\*\*(.+?)\*\*")
ITALIC = re.compile(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])")
URL = re.compile(r"(?<![\"'>=])\bhttps?://[^\s<)]+")
ISSUE = re.compile(r"(?<![\w/#])#(\d+)\b")


def inline(text, issues):
    """Escape text, then apply inline markup. Code spans are protected first."""
    parts = []
    pos = 0
    for m in INLINE_CODE.finditer(text):
        parts.append(_marks(text[pos:m.start()], issues))
        parts.append(f"<code>{html.escape(m.group(1))}</code>")
        pos = m.end()
    parts.append(_marks(text[pos:], issues))
    return "".join(parts)


def _marks(text, issues):
    links = []

    def keep(s):
        links.append(s)
        return f"\x00{len(links) - 1}\x00"

    text = LINK.sub(lambda m: keep(f'<a href="{html.escape(m.group(2))}">{html.escape(m.group(1))}</a>'), text)
    text = URL.sub(lambda m: keep(f'<a href="{html.escape(m.group(0))}">{html.escape(m.group(0))}</a>'), text)
    text = html.escape(text, quote=False)
    text = BOLD.sub(r"<b>\1</b>", text)
    text = ITALIC.sub(r"<i>\1</i>", text)
    if issues:
        text = ISSUE.sub(lambda m: f'<a href="https://github.com/{issues}/issues/{m.group(1)}">#{m.group(1)}</a>', text)
    return re.sub(r"\x00(\d+)\x00", lambda m: links[int(m.group(1))], text)


def convert(md, issues=None):
    out = []
    para = []
    lists = []  # stack of (indent, tag)
    code = None

    def flush_para():
        if para:
            out.append(f"<p>{inline(' '.join(para), issues)}</p>")
            para.clear()

    def close_lists(to_indent=-1):
        while lists and lists[-1][0] > to_indent:
            out.append(f"</li></{lists.pop()[1]}>")

    for raw in md.splitlines():
        line = raw.rstrip()
        if code is not None:
            if line.strip().startswith("```"):
                out.append(f"<pre>{html.escape(chr(10).join(code))}</pre>")
                code = None
            else:
                code.append(raw)
            continue
        if line.strip().startswith("```"):
            flush_para()
            close_lists()
            code = []
            continue
        if not line.strip():
            flush_para()
            continue
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            flush_para()
            close_lists()
            n = min(len(m.group(1)) + 1, 6)  # report H1 renders as h2; email needs no page title
            out.append(f"<h{n}>{inline(m.group(2), issues)}</h{n}>")
            continue
        if re.match(r"^(-{3,}|\*{3,})$", line.strip()):
            flush_para()
            close_lists()
            out.append("<hr>")
            continue
        m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", line)
        if m:
            flush_para()
            indent = len(m.group(1).expandtabs(4))
            tag = "ol" if m.group(2)[0].isdigit() else "ul"
            if lists and indent > lists[-1][0]:
                out.append(f"<{tag}>")
                lists.append((indent, tag))
            else:
                close_lists(indent)
                if lists and lists[-1][0] == indent:
                    out.append("</li>")
                else:
                    out.append(f"<{tag}>")
                    lists.append((indent, tag))
            out.append(f"<li>{inline(m.group(3), issues)}")
            continue
        if lists and line.startswith(" "):
            out.append(f" {inline(line.strip(), issues)}")  # continuation of a list item
            continue
        close_lists()
        para.append(line.strip())

    if code is not None:
        out.append(f"<pre>{html.escape(chr(10).join(code))}</pre>")
    flush_para()
    close_lists()
    body = "\n".join(out)
    return (
        '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;max-width:720px">'
        "<style>pre,code{font-family:Menlo,Consolas,monospace;font-size:13px}pre{background:#f4f4f4;padding:8px;overflow:auto}"
        "h2,h3,h4{margin:18px 0 6px}li{margin:4px 0}</style>"
        f"{body}</div>"
    )


if __name__ == "__main__":
    issues = None
    args = sys.argv[1:]
    if len(args) >= 2 and args[0] == "--issues":
        issues = args[1]
    sys.stdout.write(convert(sys.stdin.read(), issues))
