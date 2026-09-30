import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "border border-border bg-panel-2 hover:border-muted",
        variant === "ghost" && "text-muted hover:text-fg",
        className,
      )}
    />
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-border bg-panel p-4", className)}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const field = "w-full rounded-md border border-border bg-panel-2 px-2.5 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(field, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(field, "font-mono text-xs", className)} />;
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1 flex items-baseline justify-between gap-2 text-xs font-medium text-muted">
      <span>{children}</span>
      {hint && <span className="font-mono text-[11px]">{hint}</span>}
    </span>
  );
}

type Tone = "ok" | "warn" | "err" | "muted";

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" && "border-ok/40 text-ok",
        tone === "warn" && "border-warn/40 text-warn",
        tone === "err" && "border-err/40 text-err",
        tone === "muted" && "border-border text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Notice({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === "err" ? "alert" : undefined}
      className={cx(
        "rounded-md border px-3 py-2 text-sm break-words",
        tone === "ok" && "border-ok/40 text-ok",
        tone === "warn" && "border-warn/40 text-warn",
        tone === "err" && "border-err/40 text-err",
        tone === "muted" && "border-border text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cx("font-mono text-xs break-all", className)}>{children}</code>;
}

export { cx };
