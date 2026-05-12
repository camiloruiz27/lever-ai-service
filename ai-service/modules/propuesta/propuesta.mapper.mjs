function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeCopValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return null;
  return Number.isFinite(Number(digits)) ? Math.trunc(Number(digits)) : null;
}

function formatCop(value) {
  if (!Number.isFinite(value) || value <= 0) return 'No suministrado.';
  return `$${new Intl.NumberFormat('es-CO').format(value)} COP`;
}

export function normalizeProposalContext(input) {
  const source = input && typeof input === 'object' ? input : {};
  const cliente = source.cliente && typeof source.cliente === 'object' ? source.cliente : {};
  const comercial = source.comercial && typeof source.comercial === 'object' ? source.comercial : {};

  return {
    objetivoCliente: cleanText(source.objetivoCliente),
    contextoCaso: cleanText(source.contextoCaso),
    partesInvolucradas: cleanText(source.partesInvolucradas),
    serviciosSugeridos: cleanText(source.serviciosSugeridos),
    etapaJudicial: cleanText(source.etapaJudicial) || 'mencionar_futuro',
    costosExclusiones: cleanText(source.costosExclusiones),
    tonoPrincipal: cleanText(source.tonoPrincipal) || 'profesional',
    estiloTexto: cleanText(source.estiloTexto) || 'tecnico_ejecutivo',
    nivelDetalle: cleanText(source.nivelDetalle) || 'medio',
    informacionAdicional: cleanText(source.informacionAdicional),
    cliente: {
      razonSocial: cleanText(cliente.razonSocial),
    },
    comercial: {
      valorTotalCOP: normalizeCopValue(comercial.valorTotalCOP),
      formaPago: cleanText(comercial.formaPago) || 'No definido por el usuario.',
    },
  };
}

export function validateProposalRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'invalid_payload', message: 'Payload invalido.' };
  }

  if (!body.proposal_context || typeof body.proposal_context !== 'object' || Array.isArray(body.proposal_context)) {
    return { ok: false, code: 'invalid_proposal_context', message: 'proposal_context es obligatorio y debe ser un objeto.' };
  }

  const normalized = normalizeProposalContext(body.proposal_context);
  if (!normalized.objetivoCliente || !normalized.cliente.razonSocial) {
    return {
      ok: false,
      code: 'missing_required_fields',
      message: 'Faltan campos obligatorios en proposal_context: objetivoCliente y cliente.razonSocial.',
    };
  }

  return { ok: true, proposalContext: normalized, metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {} };
}

export function buildProposalUserInput(context) {
  const valueExists = Number.isFinite(context.comercial.valorTotalCOP) && context.comercial.valorTotalCOP > 0;
  const lines = [
    'Contexto de usuario para propuesta comercial juridica:',
    `Cliente: ${context.cliente.razonSocial}`,
    `Objetivo del cliente: ${context.objetivoCliente}`,
    `Contexto del caso: ${context.contextoCaso || 'No suministrado.'}`,
    `Partes involucradas: ${context.partesInvolucradas || 'No suministrado.'}`,
    `Servicios sugeridos: ${context.serviciosSugeridos || 'No suministrado.'}`,
    `Etapa judicial: ${context.etapaJudicial}`,
    `Costos y exclusiones: ${context.costosExclusiones || 'No suministrado.'}`,
    `Tono principal: ${context.tonoPrincipal}`,
    `Estilo: ${context.estiloTexto}`,
    `Nivel de detalle: ${context.nivelDetalle}`,
    `Informacion adicional: ${context.informacionAdicional || 'No suministrada.'}`,
    `Valor total COP: ${context.comercial.valorTotalCOP ?? 'No suministrado.'}`,
    `Valor total formateado: ${formatCop(context.comercial.valorTotalCOP)}`,
    `Forma de pago: ${context.comercial.formaPago}`,
    '',
  ];

  if (valueExists) {
    lines.push('REGLA OBLIGATORIA: Debes incluir "c. Inversion estimada" en cada fase.');
    lines.push('REGLA OBLIGATORIA: Debes incluir la seccion "Resumen de Inversion y Honorarios".');
    lines.push(`REGLA OBLIGATORIA: La suma de fases debe ser exactamente ${formatCop(context.comercial.valorTotalCOP)}.`);
  }

  lines.push('Genera la propuesta siguiendo estrictamente la estructura solicitada en las instrucciones del sistema.');

  return lines.join('\n');
}
