/** Tiny DOM builder — keeps rendering declarative without pulling in a framework. */

type Child = Node | string | null | false | undefined;

/**
 * Every field allows an explicit `undefined` so callers can pass conditional
 * props inline (`title: spent ? '…' : undefined`) under
 * `exactOptionalPropertyTypes`.
 */
interface Props {
  class?: string | undefined;
  text?: string | undefined;
  title?: string | undefined;
  type?: string | undefined;
  value?: string | undefined;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
  style?: Partial<CSSStyleDeclaration> | undefined;
  data?: Record<string, string> | undefined;
  onClick?: (() => void) | undefined;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.title) node.title = props.title;
  if (props.ariaLabel) node.setAttribute('aria-label', props.ariaLabel);
  if (props.style) Object.assign(node.style, props.style);
  if (props.data) {
    for (const [key, value] of Object.entries(props.data)) node.dataset[key] = value;
  }
  if (props.onClick) node.addEventListener('click', props.onClick);

  if (node instanceof HTMLButtonElement) {
    node.type = 'button';
    if (props.disabled) node.disabled = true;
  }
  if (node instanceof HTMLInputElement) {
    if (props.type) node.type = props.type;
    if (props.value !== undefined) node.value = props.value;
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}
