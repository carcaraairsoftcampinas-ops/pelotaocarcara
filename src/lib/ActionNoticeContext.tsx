import React, { createContext, useCallback, useContext, useState } from "react";

interface ActionNoticeState {
  notify: (message: string) => void;
}

const ActionNoticeContext = createContext<ActionNoticeState | null>(null);

// Box global mostrado toda vez que uma ação (salvar, enviar, aprovar,
// excluir, etc.) é concluída com sucesso — o usuário só segue depois de
// clicar OK, então nenhuma confirmação passa despercebida.
export function ActionNoticeProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const notify = useCallback((msg: string) => setMessage(msg), []);

  return (
    <ActionNoticeContext.Provider value={{ notify }}>
      {children}
      {message && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true">
          <div className="modal-box">
            <p>{message}</p>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" autoFocus onClick={() => setMessage(null)}>
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
