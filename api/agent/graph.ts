// api/agent/graph.ts
// Agente LangGraph con orquestación para Seemann Group.
// Usa un grafo reactivo: Classify → (Tools | DirectAnswer) → Respond.

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, MessagesAnnotation, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ALL_TOOLS, setToolContext, type ToolContext } from './tools.js';

// ============================================================================
// SYSTEM PROMPT — conciso y con reglas claras
// ============================================================================

function buildSystemPrompt(ctx: ToolContext): string {
  const ejecutivoBlock = ctx.ejecutivo
    ? `\n## EJECUTIVO COMERCIAL ASIGNADO\n- Nombre: ${ctx.ejecutivo.nombre}\n- Email: ${ctx.ejecutivo.email}\n- Teléfono: ${ctx.ejecutivo.telefono}\nEl cliente puede ver esta info en el menú de su perfil (navbar superior derecha).`
    : '\n## EJECUTIVO COMERCIAL\nEste cliente no tiene un ejecutivo asignado actualmente.';

  return `Eres el asistente de logística de **Seemann Group** en su portal de clientes.

## CLIENTE ACTUAL: "${ctx.activeUsername}"
Solo muestra datos de esta cuenta. Nunca inventes datos.
${ejecutivoBlock}

## REGLAS DE RESPUESTA (OBLIGATORIAS)
1. **BREVEDAD**: Respuestas cortas y directas. Si la pregunta es simple, responde en 1-3 líneas. NO rellenes con información que no se pidió.
2. **MÁXIMO RESULTADOS**: Cuando muestres cotizaciones, envíos, facturas o rastreos, muestra MÁXIMO 3 items. Si hay más, dile al cliente dónde ver el resto en el portal.
3. **RUTAS Y PRECIOS**: Hay miles de rutas. NUNCA listes todas. Si el cliente pide tarifa de una ruta específica → usa **get_rate_estimate**. Si pide solo rutas (sin precio) usa **search_available_routes**.
4. **PRECIOS = ESTIMACIONES**: Las tarifas que entregas tienen un margen estándar aplicado. SIEMPRE termina con: *"Es una estimación referencial. Para una cotización formal entra a /newquotes."* Nunca prometas un precio fijo.
5. **USA HERRAMIENTAS**: Para datos del cliente (cotizaciones, envíos, facturas, rastreos, dashboard) USA las herramientas. NUNCA inventes.
6. **RASTREOS vs OPERACIONES**:
   - "Mis envíos" / "tracking" / "rastreo" / "seguimiento" → **get_shipsgo_trackings**
   - Si dan un número específico (AWB/contenedor) → **find_shipment_by_number**
   - "Operaciones" / "shipments de Linbis" → search_air/ocean/ground_shipments
7. **DASHBOARD/RESUMEN**: Para "cómo estoy", "dame un resumen", "qué tengo pendiente" → **get_my_dashboard**.
8. **FINANZAS**: "Facturas pendientes", "qué debo", "balance" → **get_finance_summary**.
9. **CALCULADORAS**:
   - Peso volumétrico / chargeable → **calculate_chargeable_weight**
   - Gastos de aduana en Chile → **calculate_customs_fees**
   - Comparar AÉREO vs LCL vs FCL → **compare_transport_modes**
10. **INCOTERMS**: "¿Qué es FOB/CIF/EXW…?" → **explain_incoterm** (NO uses lookup_glossary para incoterms).
11. **DOCUMENTOS**: "BL", "factura comercial", "documentos de mi envío X" → **get_documents_for_shipment**.
12. **PUERTOS/AEROPUERTOS**: "¿Dónde queda MIA?", "código de Shanghai" → **get_location_info**.
13. **VENCIMIENTOS**: "Tarifas que vencen", "rates que expiran" → **get_rates_expiring_soon**.
14. **NAVEGACIÓN**: Para crear tracking aéreo → /new-tracking. Marítimo → /new-ocean-tracking. Cotizar → /newquotes. Ver rastreos → /trackings. Finanzas → /financiera.
15. **EJECUTIVO**: Si preguntan por su ejecutivo, usa get_ejecutivo_info.
16. **GLOSARIO**: Para términos generales (no incoterms) usa lookup_glossary.
17. **IDIOMA**: Siempre español.
18. **NO AYUDES** con temas fuera de logística y el portal.

## SEEMANN GROUP
Freight forwarder con +35 años. Oficinas en Miami, Santiago, Viña del Mar, Lima, Bogotá.
Servicios: Marítimo FCL/LCL, aéreo, terrestre, multimodal, warehouse, aduana, seguros, 4PL.
Redes: Atlas Logistic, Globalink, WineCargo Alliance.
Contacto: contacto@seemanngroup.com`;
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

export async function runAgent(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  context: ToolContext,
): Promise<string> {
  // Setear contexto para las herramientas
  setToolContext(context);

  // Modelo
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.15,
    maxTokens: 800,
    openAIApiKey: process.env.OPENAI_API_KEY,
  }).bindTools(ALL_TOOLS);

  // Tool node
  const toolNode = new ToolNode(ALL_TOOLS);

  // Función del nodo agente
  async function agentNode(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  // Función router: si hay tool_calls → tools, sino → END
  function shouldContinue(state: typeof MessagesAnnotation.State): 'tools' | typeof END {
    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray((lastMessage as AIMessage).tool_calls) &&
      (lastMessage as AIMessage).tool_calls!.length > 0
    ) {
      return 'tools';
    }
    return END;
  }

  // Construir grafo
  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
    .addEdge('tools', 'agent')
    .compile();

  // Construir mensajes iniciales
  const messages: BaseMessage[] = [
    new SystemMessage(buildSystemPrompt(context)),
  ];

  // Agregar historial (máx 16 mensajes recientes)
  if (Array.isArray(conversationHistory)) {
    const recent = conversationHistory.slice(-16);
    for (const msg of recent) {
      if (msg.role === 'user') messages.push(new HumanMessage(msg.content));
      else if (msg.role === 'assistant') messages.push(new AIMessage(msg.content));
    }
  }

  // Agregar mensaje actual
  messages.push(new HumanMessage(userMessage));

  // Ejecutar grafo con recursión limitada
  const result = await graph.invoke(
    { messages },
    { recursionLimit: 12 },
  );

  // Extraer respuesta final
  const finalMessages = result.messages;
  for (let i = finalMessages.length - 1; i >= 0; i--) {
    const msg = finalMessages[i];
    if (msg instanceof AIMessage && typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content;
    }
  }

  return 'Lo siento, no pude procesar tu consulta. ¿Podrías reformularla?';
}
