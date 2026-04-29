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
const MODEL_OVERLOAD_MAX_RETRIES = 2;
const MODEL_OVERLOAD_BASE_DELAY_MS = 900;

const systemInstruction = `
Rol y objetivo:
Eres un asistente que redacta propuestas legales comerciales para un bufete de abogados.
Debes producir una propuesta clara, profesional, preventiva y comercialmente coherente, alineada con el objetivo del cliente y con el valor total informado.

Entradas esperadas:
- Objetivo
- Valor total en COP (numero)
- Forma de pago
- Razon social

Instruccion principal:
Con esos 4 datos, genera una propuesta en espanol, en texto plano, con el formato exacto indicado abajo.
Debes mejorar redaccion, estructura y distribucion por fases, sin cambiar el encargo ni inventar servicios ajenos al objetivo.
Genera un titulo para esta propuesta con maximo 48 caracteres.

Formato obligatorio de salida:
La respuesta debe contener SOLO este formato, sin texto antes ni despues:

[Titulo generado para la propuesta]

3. [Titulo general alineado al objetivo]
[Un unico parrafo breve que contextualiza el objetivo y el enfoque legal/comercial.]

3.1. [Fase o servicio 1]
Descripcion del servicio
[2 a 4 frases que expliquen que se hara, para que se hara y que resultado busca.]

Alcance
• [Actividad 1]
• [Actividad 2]
• [Actividad 3]

Valor del servicio: [Monto y, si aplica, condicion de pago asociada a esa fase.]

3.2. [Fase o servicio 2, solo si aplica]
Descripcion del servicio
[Texto.]

Alcance
• [Actividad 1]
• [Actividad 2]

Valor del servicio: [Monto y, si aplica, condicion de pago asociada a esa fase.]

[Agrega 3.3., 3.4. o mas solo si el objetivo realmente lo exige.]

Confidencialidad y criterios
Los servicios se prestaran con confidencialidad, diligencia y criterio preventivo, procurando una solucion juridicamente segura y ajustada a la realidad del cliente.

Valor total y forma de pago
Valor total: $[Valor total con separador de miles] COP.
Forma de pago: [Texto tal cual la entrada del usuario, o el valor por defecto si no fue suministrado].
Impuestos: Se entiende no incluido salvo instruccion contraria.

Reglas de contenido:
- Mantener alineacion explicita entre objetivo, titulo general, fases y alcances.
- Cada fase debe tener un proposito distinto y entendible; no repetir lo mismo con palabras diferentes.
- Si el objetivo es puntual, crea solo 1 fase.
- Si el objetivo mezcla asuntos distintos o complementarios, crea 2 o mas fases.
- La seccion 3. debe resumir el enfoque general sin repetir literalmente el objetivo recibido.
- La redaccion debe ser juridica, clara, preventiva y comercial, sin exceso de retorica.
- Evita tecnicismos innecesarios, frases vacias y explicaciones demasiado generales.
- Usa verbos de accion concretos: analizar, estructurar, redactar, revisar, acompanar, regularizar, mitigar, negociar, documentar.
- Si el objetivo es laboral, prioriza terminos como regularizacion, transaccion, cumplimiento, mitigacion de riesgos y extincion de obligaciones, cuando correspondan.

Reglas de distribucion economica:
- El Valor total debe respetar exactamente el monto de entrada.
- Si hay una sola fase, el Valor del servicio de 3.1. debe ser coherente con el valor total.
- Si hay varias fases, distribuye el valor total entre ellas de forma razonable segun complejidad, carga de trabajo y secuencia del servicio.
- La suma de todos los "Valor del servicio" debe ser coherente con el "Valor total".
- No uses rangos, no dejes montos abiertos y no omitas el valor por fase.
- Si el usuario no especifica forma de pago, usa exactamente: 50% anticipo, 50% contra entrega.

Restricciones negativas:
- No uses markdown.
- No uses tablas.
- No agregues notas, advertencias, cierres comerciales, firmas ni texto fuera del formato obligatorio.
- No cambies los encabezados obligatorios: Descripcion del servicio, Alcance, Confidencialidad y criterios, Valor total y forma de pago.
- No reemplaces la numeracion 3., 3.1., 3.2. por otro esquema.
- No incluyas mas de 10 viñetas en total.
- Usa siempre formato monetario colombiano: $12.345.678 COP.

Ejemplo corto de referencia:

Propuesta de regularizacion laboral

3. Regularizacion laboral y cierre preventivo
Se propone una intervencion juridica orientada a revisar la situacion laboral identificada, cuantificar contingencias y estructurar una salida preventiva que reduzca riesgos y permita documentar adecuadamente la solucion.

3.1. Diagnostico y liquidacion
Descripcion del servicio
Este servicio comprende la revision de los antecedentes de la relacion laboral, la identificacion de obligaciones potenciales y la estructuracion de un concepto juridico practico para definir la mejor ruta de regularizacion.

Alcance
• Recoleccion y revision de informacion relevante.
• Liquidacion de conceptos economicos aplicables.
• Analisis de riesgos y alternativas de cierre.

Valor del servicio: $900.000 COP.

3.2. Acuerdo y documentacion de cierre
Descripcion del servicio
Este servicio comprende la preparacion del instrumento juridico necesario para formalizar la solucion acordada y disminuir el riesgo de reclamaciones posteriores.

Alcance
• Redaccion del acuerdo o documento de cierre.
• Ajuste de clausulas conforme a la solucion definida.

Valor del servicio: $600.000 COP.

Confidencialidad y criterios
Los servicios se prestaran con confidencialidad, diligencia y criterio preventivo, procurando una solucion juridicamente segura y ajustada a la realidad del cliente.

Valor total y forma de pago
Valor total: $1.500.000 COP.
Forma de pago: 50% anticipo, 50% contra entrega.
Impuestos: Se entiende no incluido salvo instruccion contraria.
`;
const auditSystemInstruction = `
Eres un revisor de calidad documental experto (LexiAudit). Tu funcion UNICA es senalar problemas de ortografia, redaccion, inconsistencias formales, omisiones de escritura y, cuando se active, contrastes documentales de nombre + cedula.

REGLAS CRITICAS:
- NO corrijas el texto.
- NO sugieras reescrituras.
- NO hagas analisis legal o de fondo.
- Se extremadamente preciso con la ubicacion (Pagina, Seccion, Parrafo) cuando el contenido lo permita.
- Revisa ortografia, puntuacion, duplicidades, consistencia de terminos y formato de cifras o fechas.
- Si la validacion de identidades esta activa, identifica nombres y cedulas presentes en el documento y comparalos con las referencias manuales cuando existan.
- Si detectas diferencias reales entre nombre y cedula esperados vs documento, registralas como hallazgos de tipo "consistencia" y tambien reflejalas dentro de identity_summary.
- Si la validacion de identidades esta inactiva, identity_summary debe salir desactivado y vacio.
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
  ],
  "identity_summary": {
    "enabled": false,
    "references": [
      {
        "name": "Juan Perez",
        "national_id": "123456789"
      }
    ],
    "matches": [
      {
        "document_name": "Juan Perez",
        "document_id": "123456789",
        "status": "matched|mismatch|detected_only|reference_only",
        "reference_name": "Juan Perez",
        "reference_id": "123456789",
        "reason": "motivo del estado"
      }
    ],
    "detected_count": 0,
    "mismatches_count": 0
  }
}
`;

const auditResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'count', 'findings', 'identity_summary'],
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
    identity_summary: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'references', 'matches', 'detected_count', 'mismatches_count'],
      properties: {
        enabled: { type: 'boolean' },
        references: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'national_id'],
            properties: {
              name: { type: 'string' },
              national_id: { type: 'string' },
            },
          },
        },
        matches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['document_name', 'document_id', 'status', 'reference_name', 'reference_id', 'reason'],
            properties: {
              document_name: { type: 'string' },
              document_id: { type: 'string' },
              status: {
                type: 'string',
                enum: ['matched', 'mismatch', 'detected_only', 'reference_only'],
              },
              reference_name: { type: 'string' },
              reference_id: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
        detected_count: { type: 'integer', minimum: 0 },
        mismatches_count: { type: 'integer', minimum: 0 },
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
      identity_check_enabled: identityCheckEnabled,
      detect_document_identities: detectDocumentIdentities,
      identity_references: identityReferences,
    } = req.body || {};

    const normalizedIdentityReferences = normalizeIdentityReferences(identityReferences);
    const identityCheckActive = Boolean(identityCheckEnabled);
    const detectDocumentIdentitiesActive = identityCheckActive && detectDocumentIdentities !== false;

    const auditContext = {
      request_id: requestId,
      document_name: documentName || 'Sin nombre',
      document_type: documentType || 'desconocido',
      audit_scope: auditScope || 'integral',
      operation_mode: operationMode || 'estricto',
      source_mode: sourceMode || 'desconocido',
      identity_check_enabled: identityCheckActive,
      identity_reference_count: normalizedIdentityReferences.length,
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
      `Validacion de identidades: ${identityCheckActive ? 'activa' : 'inactiva'}`,
      `Deteccion automatica de identidades: ${detectDocumentIdentitiesActive ? 'activa' : 'inactiva'}`,
      normalizedIdentityReferences.length > 0
        ? `Referencias manuales esperadas:\n${normalizedIdentityReferences.map((reference, index) => `${index + 1}. ${reference.name} | Cedula: ${reference.national_id}`).join('\n')}`
        : 'Referencias manuales esperadas: ninguna',
      '',
      normalizedPages.length > 0
        ? `Contenido paginado:\n${normalizedPages.join('\n\n')}`
        : `Contenido:\n${content}`,
    ].join('\n');

    const parts = [createPartFromText(promptText)];
    if (fileBase64 && typeof fileBase64 === 'string') {
      parts.push(createPartFromBase64(fileBase64, mimeType || 'application/pdf'));
    }

    const stream = await generateModelStreamWithRetry({
      requestId,
      endpoint: '/api/audit',
      model,
      run: () => ai.models.generateContentStream({
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
      }),
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
    const runtimeError = normalizeModelRuntimeError(err, 'audit_runtime_error', 'Error ejecutando auditoria documental');

    logError('audit_unhandled_error', requestId, {
      code: runtimeError.code,
      status: runtimeError.status,
      message: runtimeError.logMessage,
      stack: err?.stack,
    });

    return res.status(runtimeError.status).json({
      error: runtimeError.clientMessage,
      code: runtimeError.code,
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

    const stream = await generateModelStreamWithRetry({
      requestId,
      endpoint: '/api/propuesta',
      model,
      run: () => ai.models.generateContentStream({
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
      }),
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
    const runtimeError = normalizeModelRuntimeError(err, 'proposal_runtime_error', 'Error generando propuesta');

    logError('proposal_runtime_error', requestId, {
      code: runtimeError.code,
      status: runtimeError.status,
      message: runtimeError.logMessage,
      stack: err?.stack,
    });

    return res.status(runtimeError.status).json({
      error: runtimeError.clientMessage,
      code: runtimeError.code,
    });
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateModelStreamWithRetry({ requestId, endpoint, model, run }) {
  let attempt = 0;

  while (true) {
    try {
      return await run();
    } catch (err) {
      if (!isModelOverloadedError(err) || attempt >= MODEL_OVERLOAD_MAX_RETRIES) {
        throw err;
      }

      const retryInMs = computeRetryDelayMs(attempt);
      logWarn('model_overloaded_retry', requestId, {
        endpoint,
        model,
        attempt: attempt + 1,
        retry_in_ms: retryInMs,
        message: getModelErrorMessage(err),
      });

      await sleep(retryInMs);
      attempt += 1;
    }
  }
}

function normalizeModelRuntimeError(err, fallbackCode, fallbackMessage) {
  if (isModelOverloadedError(err)) {
    return {
      status: 503,
      code: 'model_overloaded',
      clientMessage: 'El servicio de IA esta presentando alta demanda. Intenta nuevamente en unos momentos.',
      logMessage: getModelErrorMessage(err),
    };
  }

  return {
    status: 500,
    code: fallbackCode,
    clientMessage: err?.message || fallbackMessage,
    logMessage: err?.message || fallbackMessage,
  };
}

function isModelOverloadedError(err) {
  const message = getModelErrorMessage(err).toLowerCase();
  const status = extractModelErrorStatus(err);

  return status === 503
    || message.includes('high demand')
    || message.includes('try again later')
    || message.includes('service unavailable')
    || message.includes('unavailable');
}

function extractModelErrorStatus(err) {
  const directStatus = Number(err?.status || err?.code || err?.statusCode);
  if (Number.isFinite(directStatus) && directStatus > 0) {
    return directStatus;
  }

  const message = getModelErrorMessage(err);
  const match = message.match(/"code"\s*:\s*(\d{3})/);
  if (match) {
    return Number(match[1]);
  }

  return 0;
}

function getModelErrorMessage(err) {
  if (typeof err?.message === 'string' && err.message.trim() !== '') {
    return err.message.trim();
  }

  if (typeof err === 'string' && err.trim() !== '') {
    return err.trim();
  }

  try {
    return JSON.stringify(err);
  } catch (_error) {
    return 'Error desconocido del modelo';
  }
}

function computeRetryDelayMs(attempt) {
  const jitter = Math.floor(Math.random() * 250);
  return MODEL_OVERLOAD_BASE_DELAY_MS + (attempt * 700) + jitter;
}
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

    if (
    typeof payload.summary !== 'string'
    || !Number.isInteger(payload.count)
    || !Array.isArray(payload.findings)
    || !payload.identity_summary
    || typeof payload.identity_summary !== 'object'
    || Array.isArray(payload.identity_summary)
  ) {
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

    const normalizedIdentitySummary = normalizeIdentitySummary(payload.identity_summary);

  return {
    ok: true,
    data: {
      summary: normalizeTextField(payload.summary, 'Auditoria completada.'),
      count: payload.count,
      findings: normalizedFindings,
      identity_summary: normalizedIdentitySummary,
    },
  };
}

function normalizeIdentityReferences(references) {
  if (!Array.isArray(references)) {
    return [];
  }

  return references.map((reference) => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
      return null;
    }

    const name = normalizeTextField(reference.name);
    const nationalId = normalizeNationalId(reference.national_id);

    if (!name && !nationalId) {
      return null;
    }

    return {
      name,
      national_id: nationalId,
    };
  }).filter(Boolean);
}

function normalizeIdentitySummary(identitySummary) {
  const payload = identitySummary && typeof identitySummary === 'object' && !Array.isArray(identitySummary)
    ? identitySummary
    : {};

  const references = Array.isArray(payload.references) ? payload.references : [];
  const matches = Array.isArray(payload.matches) ? payload.matches : [];

  return {
    enabled: Boolean(payload.enabled),
    references: references.map((reference) => ({
      name: normalizeTextField(reference?.name),
      national_id: normalizeNationalId(reference?.national_id),
    })).filter((reference) => reference.name || reference.national_id),
    matches: matches.map((match) => ({
      document_name: normalizeTextField(match?.document_name),
      document_id: normalizeNationalId(match?.document_id),
      status: normalizeIdentityMatchStatus(match?.status),
      reference_name: normalizeTextField(match?.reference_name),
      reference_id: normalizeNationalId(match?.reference_id),
      reason: normalizeTextField(match?.reason),
    })).filter((match) => (
      match.document_name
      || match.document_id
      || match.reference_name
      || match.reference_id
      || match.reason
    )),
    detected_count: normalizeCount(payload.detected_count),
    mismatches_count: normalizeCount(payload.mismatches_count),
  };
}

function normalizeIdentityMatchStatus(status) {
  const normalized = String(status || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'matched' || normalized === 'mismatch' || normalized === 'reference_only') {
    return normalized;
  }

  return 'detected_only';
}

function normalizeNationalId(value) {
  return String(value || '').replace(/\D+/g, '');
}

function normalizeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
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
