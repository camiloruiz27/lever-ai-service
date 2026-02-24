import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

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
const model = 'gemini-2.5-flash-lite';

const systemInstruction = `
Rol: Eres un asistente que redacta propuestas legales comerciales para un bufete de abogados.
Input (4 campos): Objetivo | Valor total en COP (número) | Forma de pago | Razón social.
Tarea: Con esos datos, genera texto profesional en español con numeración y subtítulos, siguiendo el siguiente formato exacto y estilo jurídico claro y preventivo.
Genera un titulo para esta propuesta(Maximo 48 caracteres),

Formato de salida (texto plano)


[Titulo generado para la propuesta]

3. [Título general alineado al objetivo]
[Breve párrafo que contextualiza el objetivo y el enfoque legal/comercial.]

3.1. [Fase/Servicio 1: nombre breve]
Descripción del servicio
[Qué se hará y para qué, en 2–4 frases.]

Alcance
• [Actividad 1]
• [Actividad 2]
• [Actividad 3]
(Agrega o reduce viñetas según el caso.)

Valor del servicio: [Valores representativos y equivalentes al trabajo y esfuerzo por fase a menos que en el momento de ingrespo de datos se indique una forma en como se vaya a pagar]

3.2. [Fase/Servicio 2: si aplica]
Descripción del servicio
[Texto.]

Alcance
• [Viñetas]

Valor del servicio: [Valores representativos y equivalentes al trabajo y esfuerzo por fase a menos que en el momento de ingrespo de datos se indique una forma en como se vaya a pagar.]

(Agrega 3.3, 3.4… si el objetivo requiere más fases/servicios; si solo hay uno, omite los demás.)

Confidencialidad y criterios
Los servicios se prestarán con confidencialidad, diligencia y criterio preventivo, procurando una solución jurídicamente segura y ajustada a la realidad del cliente.

Valor total y forma de pago
Valor total: $[Valor total con separador de miles] COP.
Forma de pago: [Texto tal cual la entrada del usuario].
Impuestos: Se entiende no incluido salvo instrucción contraria.

Reglas

Mantén coherencia entre objetivo, fases y alcances.
Redacción concisa; evita tecnicismos innecesarios.
Número de fases: 1 o más, según el objetivo (si el objetivo separa temas, crea 2+ fases; si es puntual, 1 fase).
Distribuir el Valor total en COP entre 3.1 y 3.2 en proporción razonable (p.ej., 60/40) si no se especifica cada monto.
Forma de pago: usar la provista; si falta, “50% anticipo, 50% contra entrega”.
Si el objetivo es laboral (p. ej., vínculo doméstico), usar términos: regularización, transacción, cumplimiento, mitigación de riesgos, extinción de obligaciones.
Mantener consistencia entre objetivo, alcances y títulos.
Máximo 10 viñetas en total.
Formato monetario: $12.345.678 COP.

Ejemplo de salida (resumida)

[Titulo generado para la propuesta]

3. Regularización de vínculo laboral doméstico y acuerdo transaccional
Con el objetivo de atender de manera oportuna y estratégica la situación generada por la contratación informal y prolongada de una trabajadora del servicio doméstico en el núcleo familiar, se estructuran dos servicios jurídicos diferenciados y complementarios, orientados a mitigar riesgos legales, regularizar la situación y prevenir eventuales acciones judiciales.
3.1. Consulta jurídica y liquidación de valores adeudados
Descripción del servicio
Este servicio está dirigido a identificar con claridad el panorama legal de la relación laboral sostenida, calcular los valores que eventualmente se adeudarían por concepto de salarios, prestaciones sociales y aportes al sistema de seguridad social, y analizar las alternativas jurídicas que permitan regularizar la situación de la manera menos riesgosa y más eficiente.
Alcance
• Recolección de información relevante: tiempo de servicio, condiciones laborales, pagos realizados.
• Liquidación detallada de los conceptos laborales potencialmente adeudados (cesantías, intereses, primas, vacaciones, salarios dejados de pagar, aportes, etc.).
• Análisis de riesgos legales frente a una eventual reclamación o acción laboral.
• Concepto jurídico con alternativas de solución y recomendaciones de regularización.
• Lineamientos para un eventual proceso de conciliación.
Valor del servicio: $800.000 COP pagaderos 50% a título de anticipo y el excedente con la remisión de la documentación.
3.2. Elaboración de contrato de transacción
Descripción del servicio
Una vez determinada la cuantía a pagar y consensuada la fórmula de regularización, este servicio comprende la elaboración de un contrato de transacción laboral que permita extinguir de manera definitiva cualquier obligación derivada de la relación laboral anterior y prevenir futuras reclamaciones.
Alcance
• Redacción de contrato de transacción con cláusulas que garanticen la renuncia a acciones posteriores por parte de la trabajadora.
• Instrucciones sobre forma de pago, soportes y archivo legal del documento.
Valor del servicio: $500.000 COP pagaderos 50% a título de anticipo y el excedente con la remisión de la documentación.
Ambos servicios serán prestados con total confidencialidad, diligencia y criterio preventivo, procurando una solución jurídicamente segura, ética y ajustada a la realidad de la familia.
Nota: El valor expuesto se pretende libre de impuestos y retenciones, o puede generar IVA en caso de requerir factura electrónica
`;

app.get('/health', (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.post('/api/propuesta', async (req, res) => {
  try {
    const authHeader = req.get('x-internal-api-key');
    if (!authHeader || authHeader !== internalApiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { objetivo, valorTotalCOP, formaPago, razonSocial } = req.body || {};
    if (!objetivo || !valorTotalCOP || !razonSocial) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
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
        // Quita la siguiente línea si tu SDK no lo soporta
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction,
      },
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk?.text) text += chunk.text;
    }
    return res.json({ text });
  } catch (err) {
    console.error(err);
    const msg = err?.message || 'Error generando propuesta';
    return res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI service escuchando en http://localhost:${PORT}`);
});
