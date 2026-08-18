import { PROPOSAL_SYSTEM_PROMPT_V2 } from './propuesta.prompt.mjs';
import { buildProposalUserInput } from './propuesta.mapper.mjs';

function hasInvestmentStructure(text) {
  const normalized = String(text || '');
  const hasPhaseValue = /\bc\.\s*Valor del servicio\b/i.test(normalized);
  const hasPhasePayment = /\bd\.\s*Forma de pago\b/i.test(normalized);
  const hasSummary = /Resumen de Valor y Honorarios/i.test(normalized);
  const hasMoney = /\$\s*\d[\d\.,]*\s*COP/i.test(normalized);
  return hasPhaseValue && hasPhasePayment && hasSummary && hasMoney;
}

function buildOrthographicReviewInput(text) {
  return [
    'Corrige exclusivamente ortografia, tildes, puntuacion, concordancia gramatical y pequenos errores de redaccion del siguiente texto.',
    'Manten intactos el idioma espanol, la esencia juridico-comercial, la estructura, la numeracion, los encabezados, las fases, los valores, los nombres propios, las fechas y la forma de pago.',
    'No agregues servicios, no elimines contenido, no cambies cifras, no cambies el sentido y no conviertas la respuesta a markdown, tabla o JSON.',
    'Devuelve solamente el texto corregido.',
    '',
    'Texto a corregir:',
    String(text || '').trim(),
  ].join('\n');
}

export async function generateProposal({
  ai,
  model,
  requestId,
  proposalContext,
  generateModelStreamWithRetry,
  mapTokenUsage,
  logWarn,
}) {
  const baseInput = buildProposalUserInput(proposalContext);

  const runGeneration = async (userText) => {
    const stream = await generateModelStreamWithRetry({
      requestId,
      endpoint: '/api/propuesta',
      model,
      run: () => ai.models.generateContentStream({
        model,
        contents: [
          { role: 'user', parts: [{ text: userText }] },
        ],
        config: {
          temperature: 0.2,
          topP: 0.4,
          maxOutputTokens: 3500,
          thinkingConfig: { thinkingLevel: 'minimal' },
          systemInstruction: PROPOSAL_SYSTEM_PROMPT_V2,
        },
      }),
    });

    let text = '';
    let lastUsageMetadata = null;
    for await (const chunk of stream) {
      if (chunk?.usageMetadata) lastUsageMetadata = chunk.usageMetadata;
      if (chunk?.text) text += chunk.text;
    }

    return {
      text: String(text || '').trim(),
      usageMetadata: lastUsageMetadata,
    };
  };

  const firstPass = await runGeneration(baseInput);
  let finalText = firstPass.text;
  let finalUsage = firstPass.usageMetadata;
  let secondPassUsed = false;
  let orthographicReviewUsed = false;

  const requiresInvestment = Number.isFinite(proposalContext.comercial.valorTotalCOP) && proposalContext.comercial.valorTotalCOP > 0;
  if (requiresInvestment && !hasInvestmentStructure(finalText)) {
    secondPassUsed = true;
    if (typeof logWarn === 'function') {
      logWarn('proposal_investment_structure_retry', requestId, {
        endpoint: '/api/propuesta',
        reason: 'missing_investment_sections',
      });
    }

    const correctionInput = [
      'Corrige y reescribe la propuesta anterior sin cambiar el caso de fondo.',
      'Debe incluir de forma obligatoria:',
      '- c. Valor del servicio en cada fase.',
      '- d. Forma de pago en cada fase.',
      '- Resumen de Valor y Honorarios.',
      '- Valores en formato colombiano y consistentes con el valor total.',
      '',
      'Respuesta previa a corregir:',
      finalText,
      '',
      'Contexto original:',
      baseInput,
    ].join('\n');

    const secondPass = await runGeneration(correctionInput);
    finalText = secondPass.text;
    finalUsage = secondPass.usageMetadata ?? finalUsage;
  }

  if (finalText) {
    const reviewed = await runGeneration(buildOrthographicReviewInput(finalText));
    const reviewedKeepsInvestmentStructure = !requiresInvestment || hasInvestmentStructure(reviewed.text);
    if (reviewed.text && reviewedKeepsInvestmentStructure) {
      finalText = reviewed.text;
      finalUsage = reviewed.usageMetadata ?? finalUsage;
      orthographicReviewUsed = true;
    } else if (typeof logWarn === 'function') {
      logWarn('proposal_orthographic_review_discarded', requestId, {
        endpoint: '/api/propuesta',
        reason: reviewed.text ? 'missing_investment_sections_after_review' : 'empty_review_response',
      });
    }
  }

  const qualityFlags = [];
  if (secondPassUsed) qualityFlags.push('investment_structure_repaired');
  if (orthographicReviewUsed) qualityFlags.push('orthographic_review_applied');

  return {
    text: finalText,
    tokenUsage: mapTokenUsage(finalUsage),
    usageMetadataPresent: Boolean(finalUsage),
    secondPassUsed,
    orthographicReviewUsed,
    qualityFlags,
  };
}
