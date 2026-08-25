const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Evita disparar mais de um redirecionamento quando várias chamadas em
// paralelo recebem 401 ao mesmo tempo (ex.: a tela carrega missões e
// financeiro juntos e a sessão expirou entre uma chamada e outra).
let redirecionandoPorSessaoExpirada = false;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    ...options,
  });

  if (res.status === 204) return null as T;

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    // "/auth-me" devolve 401 normalmente quando ainda não há login (fluxo
    // esperado, tratado pelo AuthContext) — não deve disparar redirecionamento.
    // Para qualquer outro endpoint, 401 significa que a sessão expirou ou
    // ficou inválida no meio do uso: em vez de deixar a tela com dados
    // antigos/sumidos e um aviso discreto, manda direto pro login.
    if (res.status === 401 && path !== "/auth-me" && !redirecionandoPorSessaoExpirada) {
      redirecionandoPorSessaoExpirada = true;
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login?expirada=1";
      }
    }
    throw new ApiError(res.status, data?.error || `Erro ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function arquivoUrl(key: string): string {
  return `${BASE}/arquivo?key=${encodeURIComponent(key)}`;
}

// Envia UM arquivo por vez pro servidor (evita payload grande demais quando
// há vários anexos) e devolve a referência (blobKey) pra guardar no registro.
export async function uploadArquivo(file: File): Promise<{ blobKey: string; nomeArquivo: string }> {
  const base64 = await fileToBase64(file);
  return api.post<{ blobKey: string; nomeArquivo: string }>("/arquivo", {
    base64,
    nomeArquivo: file.name,
    contentType: file.type,
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
