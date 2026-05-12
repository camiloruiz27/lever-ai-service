import { validateProposalRequest } from './propuesta.mapper.mjs';
import { generateProposal } from './propuesta.service.mjs';

export function registerPropuestaRoute(app, deps) {
  const {
    ai,
    model,
    internalApiKey,
    logInfo,
    logWarn,
    logError,
    normalizeModelRuntimeError,
    generateModelStreamWithRetry,
    mapTokenUsage,
  } = deps;

  app.post('/api/propuesta', async (req, res) => {
    const requestId = req.requestId;
    const startedAt = Date.now();

    try {
      const authHeader = req.get('x-internal-api-key');
      if (!authHeader || authHeader !== internalApiKey) {
        logWarn('proposal_unauthorized', requestId, { ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
      }

      const validation = validateProposalRequest(req.body || {});
      if (!validation.ok) {
        return res.status(400).json({ error: validation.message, code: validation.code });
      }

      const result = await generateProposal({
        ai,
        model,
        requestId,
        proposalContext: validation.proposalContext,
        generateModelStreamWithRetry,
        mapTokenUsage,
        logWarn,
      });

      if (!result.usageMetadataPresent) {
        logWarn('proposal_usage_metadata_missing', requestId, {
          endpoint: '/api/propuesta',
          model,
          razon_social: validation.proposalContext.cliente.razonSocial,
        });
      }

      logInfo('proposal_completed', requestId, {
        endpoint: '/api/propuesta',
        duration_ms: Date.now() - startedAt,
        model,
        razon_social: validation.proposalContext.cliente.razonSocial,
        token_usage: result.tokenUsage,
        quality_flags: result.secondPassUsed ? ['investment_structure_repaired'] : null,
      });

      return res.json({
        text: result.text,
        token_usage: result.tokenUsage,
        quality_flags: result.secondPassUsed ? ['investment_structure_repaired'] : null,
      });
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
}


