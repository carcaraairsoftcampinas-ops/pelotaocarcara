import React, { createContext, useCallback, useContext, useState } from "react";

interface ActionNoticeState {
  // onClose (opcional) roda depois que o usuário clica OK — usado quando uma
  // ação de sucesso precisa disparar algo só depois que o aviso foi visto
  // (ex: voltar pra tela em branco depois de "Enviar para Análise").
  notify: (message: string, onClose?: () => void) => void;
}

const ActionNoticeContext = createContext<ActionNoticeState | null>(null);

// Box global mostrado toda vez que uma ação (salvar, enviar, aprovar,
// excluir, etc.) é concluída com sucesso — o usuário só segue depois de
// clicar OK, então nenhuma confirmação passa despercebida.
export function ActionNoticeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ message: string; onClose?: () => void } | null>(null);

  const notify = useCallback((msg: string, onClose?: () => void) => setState({ message: msg, onClose }), []);

  function fechar() {
    const cb = state?.onClose;
    setState(null);
    cb?.();
  }

  return (
    <ActionNoticeContext.Provider value={{ notify }}>
      {children}
      {state && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true">
          <div className="modal-box">
            <p>{state.message}</p>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" autoFocus onClick={fechar}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ActionNoticeContext.Provider>
  );
}

export function useActionNotice(): ActionNoticeState {
  const ctx = useContext(ActionNoticeContext);
  if (!ctx) throw new Error("useActionNotice deve ser usado dentro de ActionNoticeProvider");
  return ctx;
}
