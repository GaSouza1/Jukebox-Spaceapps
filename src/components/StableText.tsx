import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLElement> {
  children: string;
  as?: "span" | "strong" | "p" | "dd" | "li" | "small";
}

/**
 * Renders a string that changes over time in its own element, keyed by the string.
 *
 * Browser page translation (e.g. Chrome's "Translate to Portuguese") swaps the text
 * nodes it translates for new <font> elements. If React later updated one of those
 * original text nodes in place, it would be updating a detached node: the page would
 * keep showing the old translated text — a stale region name or value. With a new
 * key, React replaces the whole element instead, so the new text always appears (and
 * the browser can translate it again). Nothing here detects or performs translation.
 */
export function StableText({ children, as: Tag = "span", ...rest }: Props) {
  return (
    <Tag key={children} {...rest}>
      {children}
    </Tag>
  );
}
