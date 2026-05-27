// api/agent/toolsContext.ts
// Contexto compartido entre tools.ts y toolsExtra.ts.

export interface ToolContext {
  activeUsername: string;
  linbisAccessToken: string;
  userToken: string; // JWT del usuario autenticado
  baseUrl: string;   // URL base del servidor (para ShipsGo proxy)
  ejecutivo: { nombre: string; email: string; telefono: string } | null;
}

let _ctx: ToolContext = {
  activeUsername: '',
  linbisAccessToken: '',
  userToken: '',
  baseUrl: '',
  ejecutivo: null,
};

export function setToolContext(ctx: ToolContext) {
  _ctx = ctx;
}

export function getToolContext(): ToolContext {
  return _ctx;
}
