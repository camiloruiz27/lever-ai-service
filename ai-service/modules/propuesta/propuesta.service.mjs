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
          topP: 0.3,
          maxOutputTokens: 3500,
          thinkingConfig: { thinkingBudget: 0 },
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

  return {
    text: finalText,
    tokenUsage: mapTokenUsage(finalUsage),
    usageMetadataPresent: Boolean(finalUsage),
    secondPassUsed,
  };
}
