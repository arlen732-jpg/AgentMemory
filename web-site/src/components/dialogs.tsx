"use client";

// 2026/11/12 - Arlen - DevGuidelines：送件結果一律跳窗；刪除須輸入「刪除」兩字

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button, TextInput } from "./ui";

type ResultOpts = { ok: boolean; title: string; message?: string };
type ConfirmOpts = { title: string; message: string; confirmLabel?: string; danger?: boolean };
type DeleteOpts = { target: string };

type DialogApi = {
  notify: (o: ResultOpts) => Promise<void>;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  confirmDelete: (o: DeleteOpts) => Promise<boolean>;
};

type State =
  | { kind: "result"; opts: ResultOpts; resolve: () => void }
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "delete"; opts: DeleteOpts; resolve: (v: boolean) => void }
  | null;

const Ctx = createContext<DialogApi | null>(null);

export function useDialog() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDialog 必須在 DialogProvider 內使用");
  return v;
}

function Modal({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={label} data-testid={testId}>
      <div className="absolute inset-0 bg-neutral-900/40" />
      <div className="relative w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg">{children}</div>
    </div>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const [typed, setTyped] = useState("");

  const notify = useCallback((opts: ResultOpts) => new Promise<void>((resolve) => setState({ kind: "result", opts, resolve })), []);
  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ kind: "confirm", opts, resolve })), []);
  const confirmDelete = useCallback((opts: DeleteOpts) => {
    setTyped("");
    return new Promise<boolean>((resolve) => setState({ kind: "delete", opts, resolve }));
  }, []);

  const close = () => setState(null);

  return (
    <Ctx.Provider value={{ notify, confirm, confirmDelete }}>
      {children}

      {state?.kind === "result" && (
        <Modal label={state.opts.title} testId="submit-result-dialog">
          <div className="flex items-start gap-3">
            {state.opts.ok
              ? <CircleCheck className="mt-0.5 shrink-0 text-success" size={24} strokeWidth={1.75} aria-hidden />
              : <CircleAlert className="mt-0.5 shrink-0 text-danger" size={24} strokeWidth={1.75} aria-hidden />}
            <div>
              <p className="text-lg font-semibold text-fg">{state.opts.title}</p>
              {state.opts.message && <p className="mt-1 whitespace-pre-line text-sm text-fg-secondary">{state.opts.message}</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button data-testid="submit-result-ok-btn" autoFocus onClick={() => { state.resolve(); close(); }}>確定</Button>
          </div>
        </Modal>
      )}

      {state?.kind === "confirm" && (
        <Modal label={state.opts.title} testId="confirm-dialog">
          <p className="text-lg font-semibold text-fg">{state.opts.title}</p>
          <p className="mt-2 text-sm text-fg-secondary">{state.opts.message}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" data-testid="confirm-cancel-btn" onClick={() => { state.resolve(false); close(); }}>取消</Button>
            <Button
              variant={state.opts.danger ? "danger" : "primary"}
              data-testid="confirm-ok-btn"
              onClick={() => { state.resolve(true); close(); }}
            >
              {state.opts.confirmLabel ?? "確定"}
            </Button>
          </div>
        </Modal>
      )}

      {state?.kind === "delete" && (
        <Modal label="確認刪除" testId="delete-confirm-dialog">
          <p className="text-lg font-semibold text-fg">確認刪除</p>
          <p className="mt-2 text-sm text-fg-secondary">
            即將刪除：<strong className="text-fg">{state.opts.target}</strong>
            <br />刪除後無法復原。請輸入「刪除」兩字確認。
          </p>
          <TextInput
            className="mt-4"
            value={typed}
            maxLength={10}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="刪除"
            aria-label="輸入「刪除」確認"
            data-testid="delete-confirm-input"
            autoFocus
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" data-testid="delete-cancel-btn" onClick={() => { state.resolve(false); close(); }}>取消</Button>
            <Button
              variant="danger"
              disabled={typed.trim() !== "刪除"}
              data-testid="delete-confirm-btn"
              onClick={() => { state.resolve(true); close(); }}
            >
              刪除
            </Button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
