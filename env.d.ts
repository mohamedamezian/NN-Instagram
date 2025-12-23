/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

// Type declarations for Shopify Polaris Web Components
declare namespace JSX {
  interface IntrinsicElements {
    's-app-nav': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    's-link': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { href?: string }, HTMLElement>;
    's-page': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    's-section': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { heading?: string }, HTMLElement>;
    's-text-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      type?: string;
      name?: string;
      label?: string;
      helpText?: string;
      value?: string;
      error?: string;
      autoComplete?: string;
    }, HTMLElement>;
    's-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      submit?: boolean;
      variant?: string;
    }, HTMLElement>;
    's-card': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    's-text': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      variant?: string;
      as?: string;
      tone?: string;
    }, HTMLElement>;
    's-banner': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      tone?: string;
    }, HTMLElement>;
    's-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    's-divider': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    's-spinner': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      size?: string;
    }, HTMLElement>;
  }
}
