import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Evita que um erro de render numa tela derrube o app inteiro (o que
// deixava a página toda preta e sumia até com o menu lateral — porque o
// React desmonta a árvore inteira quando um componente lança durante o
// render). Com isso, um erro fica contido na área de conteúdo e a barra
// lateral continua funcionando pra navegar pra outro lugar.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Erro na tela:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <h2>Ocorreu um erro nesta tela</h2>
          <p>{this.state.error.message || "Erro inesperado."}</p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
              Tentar de novo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
