import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, createPartFromBase64, createPartFromText } from '@google/genai';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.set('x-request-id', req.requestId);
  next();
});

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Falta GEMINI_API_KEY. Define la variable de entorno o ai-service/.env');
  process.exit(1);
}
const internalApiKey = process.env.INTERNAL_API_KEY;
if (!internalApiKey) {
  console.error('Falta INTERNAL_API_KEY. Define la variable de entorno o ai-service/.env');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });
const model = 'gemini-3.1-flash-lite-preview';
const MAX_MODEL_ERROR_LOG_CHARS = 1500;

const systemInstruction = `
Rol: Eres un asistente que redacta propuestas legales comerciales para un bufete de abogados.
Input (4 campos): Objetivo | Valor total en COP (n�mero) | Forma de pago | Raz�n social.
Tarea: Con esos datos, genera texto profesional en espa�ol con numeraci�n y subt�tulos, siguiendo el siguiente formato exacto y estilo jur�dico claro y preventivo.
Genera un titulo para esta propuesta(Maximo 48 caracteres),

Formato de salida (texto plano)


[Titulo generado para la propuesta]

3. [T�tulo general alineado al objetivo]
[Breve p�rrafo que contextualiza el objetivo y el enfoque legal/comercial.]

3.1. [Fase/Servicio 1: nombre breve]
Descripci�n del servicio
[Qu� se har� y para qu�, en 2�4 frases.]

Alcance
� [Actividad 1]
� [Actividad 2]
� [Actividad 3]
(Agrega o reduce vi�etas seg�n el caso.)

Valor del servicio: [Valores representativos y equivalentes al trabajo y esfuerzo por fase a menos que en el momento de ingrespo de datos se indique una forma en como se vaya a pagar]

3.2. [Fase/Servicio 2: si aplica]
Descripci�n del servicio
[Texto.]

Alcance
� [Vi�etas]

Valor del servicio: [Valores representativos y equivalentes al trabajo y esfuerzo por fase a menos que en el momento de ingrespo de datos se indique una forma en como se vaya a pagar.]

(Agrega 3.3, 3.4� si el objetivo requiere m�s fases/servicios; si solo hay uno, omite los dem�s.)

Confidencialidad y criterios
Los servicios se prestar�n con confidencialidad, diligencia y criterio preventivo, procurando una soluci�n jur�dicamente segura y ajustada a la realidad del cliente.

Valor total y forma de pago
Valor total: $[Valor total con separador de miles] COP.
Forma de pago: [Texto tal cual la entrada del usuario].
Impuestos: Se entiende no incluido salvo instrucci�n contraria.

Reglas

Mant�n coherencia entre objetivo, fases y alcances.
Redacci�n concisa; evita tecnicismos innecesarios.
N�mero de fases: 1 o m�s, seg�n el objetivo (si el objetivo separa temas, crea 2+ fases; si es puntual, 1 fase).
Distribuir el Valor total en COP entre 3.1 y 3.2 en proporci�n razonable (p.ej., 60/40) si no se especifica cada monto.
Forma de pago: usar la provista; si falta, �50% anticipo, 50% contra entrega�.
Si el objetivo es laboral (p. ej., v�nculo dom�stico), usar t�rminos: regularizaci�n, transacci�n, cumplimiento, mitigaci�n de riesgos, extinci�n de obligaciones.
Mantener consistencia entre objetivo, alcances y t�tulos.
M�ximo 10 vi�etas en total.
Formato monetario: $12.345.678 COP.

Ejemplo de salida (resumida)

[Titulo generado para la propuesta]

3. Regularizaci�n de v�nculo laboral dom�stico y acuerdo transaccional
Con el objetivo de atender de manera oportuna y estrat�gica la situaci�n generada por la contrataci�n informal y prolongada de una trabajadora del servicio dom�stico en el n�cleo familiar, se estructuran dos servicios jur�dicos diferenciados y complementarios, orientados a mitigar riesgos legales, regularizar la situaci�n y prevenir eventuales acciones judiciales.
3.1. Consulta jur�dica y liquidaci�n de valores adeudados
Descripci�n del servicio
Este servicio est� dirigido a identificar con claridad el panorama legal de la relaci�n laboral sostenida, calcular los valores que eventualmente se adeudar�an por concepto de salarios, prestaciones sociales y aportes al sistema de seguridad social, y analizar las alternativas jur�dicas que permitan regularizar la situaci�n de la manera menos riesgosa y m�s eficiente.
Alcance
� Recolecci�n de informaci�n relevante: tiempo de servicio, condiciones laborales, pagos realizados.
� Liquidaci�n detallada de los conceptos laborales potencialmente adeudados (cesant�as, intereses, primas, vacaciones, salarios dejados de pagar, aportes, etc.).
� An�lisis de riesgos legales frente a una eventual reclamaci�n o acci�n laboral.
� Concepto jur�dico con alternativas de soluci�n y recomendaciones de regularizaci�n.
� Lineamientos para un eventual proceso de conciliaci�n.
Valor del servicio: $800.000 COP pagaderos 50% a t�tulo de anticipo y el excedente con la remisi�n de la documentaci�n.
3.2. Elaboraci�n de contrato de transacci�n
Descripci�n del servicio
Una vez determinada la cuant�a a pagar y consensuada la f�rmula de regularizaci�n, este servicio comprende la elaboraci�n de un contrato de transacci�n laboral que permita extinguir de manera definitiva cualquier obligaci�n derivada de la relaci�n laboral anterior y prevenir futuras reclamaciones.
Alcance
� Redacci�n de contrato de transacci�n con cl�usulas que garanticen la renuncia a acciones posteriores por parte de la trabajadora.
� Instrucciones sobre forma de pago, soportes y archivo legal del documento.
Valor del servicio: $500.000 COP pagaderos 50% a t�tulo de anticipo y el excedente con la remisi�n de la documentaci�n.
Ambos servicios ser�n prestados con total confidencialidad, diligencia y criterio preventivo, procurando una soluci�n jur�dicamente segura, �tica y ajustada a la realidad de la familia.
Nota: El valor expuesto se pretende libre de impuestos y retenciones, o puede generar IVA en caso de requerir factura electr�nica
`;

const auditSystemInstruction = `
Eres un revisor de calidad documental experto (LexiAudit). Tu funcion UNICA es senalar problemas de ortografia, redaccion, inconsistencias formales y omisiones de escritura.

REGLAS CRITICAS:
- NO corrijas el texto.
- NO sugieras reescrituras.
- NO hagas analisis legal o de fondo.
- Se extremadamente preciso con la ubicacion (Pagina, Seccion, Parrafo) cuando el contenido lo permita.
- Revisa ortografia, puntuacion, duplicidades, consistencia de terminos y formato de cifras o fechas.
- Si el usuario pide algo fuera de este alcance, indica que estas limitado a auditoria formal.
- Responde SIEMPRE en espanol.
- Responde SOLO con JSON plano, sin markdown ni bloques de codigo.

Formato obligatorio:
{
  "summary": "...",
  "count": 0,
  "findings": [
    {
      "type": "ortografia|consistencia|formato",
      "location": "Pagina X, parrafo Y",
      "text": "fragmento observado",
      "reason": "motivo del hallazgo"
    }
  ]
}
`;

const auditResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'count', 'findings'],
  properties: {
    summary: { type: 'string' },
    count: { type: 'integer', minimum: 0 },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'location', 'text', 'reason'],
        properties: {
          type: {
            type: 'string',
            enum: ['ortografia', 'consistencia', 'formato'],
          },
          location: { type: 'string' },
          text: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

app.get('/health', (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.post('/api/audit', async (req, res) => {
  const requestId = req.requestId;
  const startedAt = Date.now();

  try {
    const authHeader = req.get('x-internal-api-key');
    if (!authHeader || authHeader !== internalApiKey) {
      logWarn('audit_unauthorized', requestId, { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
    }

    const {
      document_name: documentName,
      document_type: documentType,
      audit_scope: auditScope,
      operation_mode: operationMode,
      mime_type: mimeType,
      content,
      pages,
      file_base64: fileBase64,
      source_mode: sourceMode,
    } = req.body || {};

    const auditContext = {
      request_id: requestId,
      document_name: documentName || 'Sin nombre',
      document_type: documentType || 'desconocido',
      audit_scope: auditScope || 'integral',
      operation_mode: operationMode || 'estricto',
      source_mode: sourceMode || 'desconocido',
    };

    if ((!content || typeof content !== 'string') && (!fileBase64 || typeof fileBase64 !== 'string')) {
      logWarn('audit_missing_content', requestId, auditContext);
      return res.status(400).json({
        error: 'Falta el contenido del documento.',
        code: 'missing_document_content',
      });
    }

    const normalizedPages = Array.isArray(pages)
      ? pages
          .filter((page) => page && typeof page.text === 'string' && page.text.trim() !== '')
          .map((page) => `Pagina ${page.page ?? '?'}:\n${page.text}`)
      : [];

    const promptText = [
      `Documento: ${auditContext.document_name}`,
      `Tipo: ${auditContext.document_type}`,
      `Alcance: ${auditContext.audit_scope}`,
      `Modo: ${auditContext.operation_mode}`,
      `Origen: ${auditContext.source_mode}`,
      '',
      normalizedPages.length > 0
        ? `Contenido paginado:\n${normalizedPages.join('\n\n')}`
        : `Contenido:\n${content}`,
    ].join('\n');

    const parts = [createPartFromText(promptText)];
    if (fileBase64 && typeof fileBase64 === 'string') {
      parts.push(createPartFromBase64(fileBase64, mimeType || 'application/pdf'));
    }

    const stream = await ai.models.generateContentStream({
      model,
      contents: [
        { role: 'user', parts },
      ],
      config: {
        temperature: 0.1,
        topP: 0.2,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: auditResponseSchema,
        systemInstruction: auditSystemInstruction,
      },
    });

    let rawText = '';
    let lastUsageMetadata = null;
    for await (const chunk of stream) {
      if (chunk?.usageMetadata) lastUsageMetadata = chunk.usageMetadata;
      if (chunk?.text) rawText += chunk.text;
    }

    const tokenUsage = mapTokenUsage(lastUsageMetadata);
    const parsedResult = parseAuditModelResponse(rawText);
    if (!parsedResult.ok) {
      logError('audit_model_invalid_payload', requestId, {
        ...auditContext,
        duration_ms: Date.now() - startedAt,
        failure_code: parsedResult.code,
        failure_message: parsedResult.message,
        model_output_preview: truncateForLog(rawText),
      });

      return res.status(502).json({
        error: parsedResult.message,
        code: parsedResult.code,
      });
    }

    if (!lastUsageMetadata) {
      logWarn('audit_usage_metadata_missing', requestId, {
        ...auditContext,
        endpoint: '/api/audit',
        model,
      });
    }

    logInfo('audit_completed', requestId, {
      ...auditContext,
      endpoint: '/api/audit',
      duration_ms: Date.now() - startedAt,
      findings_count: parsedResult.data.count,
      model,
      token_usage: tokenUsage,
    });

    return res.json({
      ...parsedResult.data,
      token_usage: tokenUsage,
    });
  } catch (err) {
    logError('audit_unhandled_error', requestId, {
      message: err?.message || 'Error ejecutando auditoria documental',
      stack: err?.stack,
    });

    return res.status(500).json({
      error: err?.message || 'Error ejecutando auditoria documental',
      code: 'audit_runtime_error',
    });
  }
});

app.post('/api/propuesta', async (req, res) => {
  const requestId = req.requestId;
  const startedAt = Date.now();

  try {
    const authHeader = req.get('x-internal-api-key');
    if (!authHeader || authHeader !== internalApiKey) {
      logWarn('proposal_unauthorized', requestId, { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
    }

    const { objetivo, valorTotalCOP, formaPago, razonSocial } = req.body || {};
    if (!objetivo || !valorTotalCOP || !razonSocial) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.', code: 'missing_required_fields' });
    }

    const userInput = `${objetivo} | ${valorTotalCOP} | ${formaPago ?? ''} | ${razonSocial}`;

    const stream = await ai.models.generateContentStream({
      model,
      contents: [
        { role: 'user', parts: [{ text: userInput }] },
      ],
      config: {
        temperature: 0.3,
        topP: 0.3,
        maxOutputTokens: 3000,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction,
      },
    });

    let text = '';
    let lastUsageMetadata = null;
    for await (const chunk of stream) {
      if (chunk?.usageMetadata) lastUsageMetadata = chunk.usageMetadata;
      if (chunk?.text) text += chunk.text;
    }

    const tokenUsage = mapTokenUsage(lastUsageMetadata);

    if (!lastUsageMetadata) {
      logWarn('proposal_usage_metadata_missing', requestId, {
        endpoint: '/api/propuesta',
        model,
        razon_social: razonSocial,
      });
    }

    logInfo('proposal_completed', requestId, {
      endpoint: '/api/propuesta',
      duration_ms: Date.now() - startedAt,
      model,
      razon_social: razonSocial,
      token_usage: tokenUsage,
    });

    return res.json({ text, token_usage: tokenUsage });
  } catch (err) {
    logError('proposal_runtime_error', requestId, {
      message: err?.message || 'Error generando propuesta',
      stack: err?.stack,
    });

    return res.status(500).json({
      error: err?.message || 'Error generando propuesta',
      code: 'proposal_runtime_error',
    });
  }
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    logWarn('payload_too_large', req.requestId, {
      path: req.originalUrl,
      limit: '20mb',
    });

    return res.status(413).json({
      error: 'El documento excede la capacidad admitida por el gateway de auditoria.',
      code: 'payload_too_large',
    });
  }

  if (err) {
    logError('express_unhandled_error', req.requestId, {
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      error: 'Error interno en el gateway de auditoria.',
      code: 'gateway_runtime_error',
    });
  }

  return next();
});

function mapTokenUsage(usageMetadata) {
  if (!usageMetadata || typeof usageMetadata !== 'object') {
    return {
      input: null,
      output: null,
      total: null,
    };
  }

  return {
    input: normalizeTokenUsageValue(usageMetadata.promptTokenCount),
    output: normalizeTokenUsageValue(usageMetadata.candidatesTokenCount),
    total: normalizeTokenUsageValue(usageMetadata.totalTokenCount),
  };
}

function normalizeTokenUsageValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function parseAuditModelResponse(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      code: 'invalid_model_json',
      message: 'El modelo devolvio una respuesta vacia para la auditoria.',
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (_error) {
    return {
      ok: false,
      code: 'invalid_model_json',
      message: 'El modelo devolvio una respuesta invalida para la auditoria.',
    };
  }

  return validateAuditResponseShape(parsed);
}

function validateAuditResponseShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      code: 'invalid_model_schema',
      message: 'El modelo devolvio una estructura invalida para la auditoria.',
    };
  }

  if (typeof payload.summary !== 'string' || !Number.isInteger(payload.count) || !Array.isArray(payload.findings)) {
    return {
      ok: false,
      code: 'invalid_model_schema',
      message: 'El modelo devolvio una estructura invalida para la auditoria.',
    };
  }

  const normalizedFindings = [];
  for (const finding of payload.findings) {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      return {
        ok: false,
        code: 'invalid_model_schema',
        message: 'El modelo devolvio una estructura invalida para la auditoria.',
      };
    }

    if (
      typeof finding.type !== 'string'
      || typeof finding.location !== 'string'
      || typeof finding.text !== 'string'
      || typeof finding.reason !== 'string'
    ) {
      return {
        ok: false,
        code: 'invalid_model_schema',
        message: 'El modelo devolvio una estructura invalida para la auditoria.',
      };
    }

    normalizedFindings.push({
      type: normalizeFindingType(finding.type),
      location: normalizeTextField(finding.location, 'Sin ubicacion'),
      text: normalizeTextField(finding.text),
      reason: normalizeTextField(finding.reason),
    });
  }

  return {
    ok: true,
    data: {
      summary: normalizeTextField(payload.summary, 'Auditoria completada.'),
      count: payload.count,
      findings: normalizedFindings,
    },
  };
}

function normalizeTextField(value, fallback = '') {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized !== '' ? normalized : fallback;
}

function normalizeFindingType(type) {
  const normalized = String(type || 'formato')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

  if (normalized === 'ortografia' || normalized.includes('ort')) return 'ortografia';
  if (normalized === 'consistencia' || normalized.includes('consist')) return 'consistencia';
  return 'formato';
}

function truncateForLog(value, maxChars = MAX_MODEL_ERROR_LOG_CHARS) {
  const normalized = String(value || '').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars)}...[truncated]`;
}

function logInfo(event, requestId, context = {}) {
  console.log(JSON.stringify({ level: 'info', event, request_id: requestId, ...context }));
}

function logWarn(event, requestId, context = {}) {
  console.warn(JSON.stringify({ level: 'warn', event, request_id: requestId, ...context }));
}

function logError(event, requestId, context = {}) {
  console.error(JSON.stringify({ level: 'error', event, request_id: requestId, ...context }));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI service escuchando en http://localhost:${PORT}`);
});

