// ============================================================================
// Tipos compartidos — Configuración EXW FCL (valores por contenedor)
// ============================================================================

export interface IFclExwConfig {
  exwRate20GP: number;
  exwRate40: number; // 40HQ y 40NOR
  updatedBy: string;
}

export const DEFAULT_FCL_EXW_CONFIG: IFclExwConfig = {
  exwRate20GP: 900,
  exwRate40: 1090,
  updatedBy: "system",
};

