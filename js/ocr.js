(function () {
  'use strict';

  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function ensureScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureDependencies() {
    await ensureScript(PDF_CDN);
    await ensureScript(TESSERACT_CDN);
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;
    return { pdfjsLib, Tesseract: window.Tesseract };
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = String(dataUrl || '').split(',');
    if (!base64) throw new Error('Arquivo inválido para OCR.');
    const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  }

  function normalizeForMatching(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findFirstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match;
    }
    return null;
  }

  function cleanupDetectedValue(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s:;,-]+|[\s:;,-]+$/g, '')
      .trim();
  }

  function detectCourseOrEventName(asciiText, detectedTitle) {
    const patterns = [
      /\b(?:curso|oficina|minicurso|workshop|palestra|seminario|evento|feira|jornada|congresso)\s+(?:de|sobre|em)?\s*[:\-]?\s*([A-Z0-9][A-Za-z0-9 '&\/-]{5,80})/i,
      /\btema\s*[:\-]\s*([A-Z0-9][A-Za-z0-9 '&\/-]{5,80})/i,
      /\breferente\s+a[oa]?\s*[:\-]?\s*([A-Z0-9][A-Za-z0-9 '&\/-]{5,80})/i
    ];

    for (const pattern of patterns) {
      const match = asciiText.match(pattern);
      if (match?.[1]) return cleanupDetectedValue(match[1]);
    }

    const lines = asciiText
      .split(/(?<=\.)\s+|\n/)
      .map((line) => cleanupDetectedValue(line))
      .filter(Boolean);

    const blacklist = new Set([
      detectedTitle.toLowerCase(),
      'certificado',
      'declaracao',
      'certificamos que',
      'declaramos que'
    ]);

    const fallback = lines.find((line) => {
      const lower = line.toLowerCase();
      if (blacklist.has(lower)) return false;
      if (/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(line)) return false;
      if (/\b(?:horas?|hrs?|hs?|h)\b/i.test(line)) return false;
      return /\b(?:curso|oficina|minicurso|workshop|palestra|seminario|evento|feira|jornada|congresso)\b/i.test(line);
    });

    return fallback || '';
  }

  function joinHumanList(items) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} e ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  }

  function normalizeFieldKey(field) {
    return normalizeForMatching(field).toLowerCase();
  }

  function formatOcrFieldLabel(field) {
    const labels = {
      titulo: 'título do certificado',
      'titulo do certificado': 'título do certificado',
      'título do certificado': 'título do certificado',
      'nome do participante': 'nome do participante',
      'carga horaria': 'carga horária',
      'carga horária': 'carga horária',
      data: 'data',
      instituicao: 'instituição',
      instituição: 'instituição',
      'curso/evento': 'curso/evento'
    };

    return labels[normalizeFieldKey(field)] || String(field || '').trim();
  }

  function dedupeOcrFields(fields) {
    const seen = new Set();
    return (Array.isArray(fields) ? fields : [])
      .map((field) => formatOcrFieldLabel(field))
      .filter(Boolean)
      .filter((field) => {
        const key = normalizeFieldKey(field);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function buildHumanSummary(foundFields, missingFields, detectedCourseName, detectedHours) {
    const uniqueFoundFields = dedupeOcrFields(foundFields);
    const uniqueMissingFields = dedupeOcrFields(missingFields)
      .filter((field) => !uniqueFoundFields.some((foundField) => normalizeFieldKey(foundField) === normalizeFieldKey(field)));

    if (uniqueFoundFields.length <= 1 && uniqueMissingFields.length >= 4) {
      return 'Não foi possível validar automaticamente este certificado. O texto extraído não contém informações suficientes para confirmar os principais dados do documento. Recomenda-se revisão manual.';
    }

    const parts = [];
    if (uniqueFoundFields.length) {
      const intro = uniqueMissingFields.length
        ? 'Pré-análise concluída com pendências.'
        : 'Pré-análise concluída.';
      parts.push(`${intro} O OCR identificou ${joinHumanList(uniqueFoundFields)}.`);
    } else {
      parts.push('Não foi possível validar automaticamente este certificado. O texto extraído não contém informações suficientes para confirmar os principais dados do documento.');
    }

    if (uniqueMissingFields.length) {
      parts.push(`Não foi possível identificar: ${joinHumanList(uniqueMissingFields)}.`);
      parts.push('Recomenda-se revisão manual antes da decisão final.');
    }

    if (detectedHours > 0) parts.push(`Carga horária detectada: ${detectedHours}h.`);
    if (detectedCourseName) parts.push(`Curso/evento detectado: ${detectedCourseName}.`);

    return parts.join(' ');
  }

  function buildOcrReason(ocrStatus, missingFields) {
    const uniqueMissingFields = dedupeOcrFields(missingFields);

    let reason = 'A pré-análise identificou informações parciais. A decisão final deve ser confirmada manualmente.';
    if (ocrStatus === 'aprovado_automatico') {
      reason = 'Os principais dados do certificado foram identificados com boa consistência.';
    } else if (ocrStatus === 'rejeitado_automatico') {
      reason = 'O texto extraído não contém informações suficientes para validar automaticamente o certificado.';
    }

    if (uniqueMissingFields.length) {
      reason += ` Campos não identificados: ${joinHumanList(uniqueMissingFields)}.`;
    }

    return reason;
  }

  function detectTextPatterns(text, expectedName = '') {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    const asciiText = normalizeForMatching(normalized);
    const lowerAscii = asciiText.toLowerCase();
    const expectedAscii = normalizeForMatching(expectedName).toLowerCase();

    const hourMatch = findFirstMatch(asciiText, [
      /\b(?:carga\s*horaria|carga|duracao|duracao total|dura(?:c|\u00e7)[a\u00e3]o)\s*[:\-]?\s*(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
      /\b(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
      /\b(\d{1,3})\s*horas?\s*complementares\b/i
    ]);
    const dateMatch = asciiText.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/);
    const institutionMatch = asciiText.match(/\b(SENAC|SENAI|SEBRAE|UNINASSAU|UNICAP|UNINTER|IFPE|UFPE|UNIVERSIDADE|FACULDADE|ESCOLA TECNICA|INSTITUTO FEDERAL|CENTRO UNIVERSITARIO)\b/i);
    const titleMatch = findFirstMatch(asciiText, [
      /\bcertificado\s+de\s+(participacao|conclusao|aprovacao|presenca)\b/i,
      /\bcertificado\b/i,
      /\bdeclaracao\b/i,
      /\bdeclaramos\s+que\b/i,
      /\bcertificamos\s+que\b/i
    ]);

    const titleLabelMap = {
      participacao: 'Certificado de Participação',
      conclusao: 'Certificado de Conclusão',
      aprovacao: 'Certificado de Aprovação',
      presenca: 'Certificado de Presença'
    };

    const detectedTitle = titleMatch
      ? (titleMatch[1] ? (titleLabelMap[titleMatch[1].toLowerCase()] || titleMatch[0]) : titleMatch[0])
      : '';
    const detectedName = expectedAscii && lowerAscii.includes(expectedAscii) ? expectedName : '';
    const detectedHours = hourMatch ? Number(hourMatch[1]) : 0;
    const detectedCourseName = detectCourseOrEventName(asciiText, detectedTitle);
    const foundFields = [];
    const missingFields = [];
    let score = 0;

    if (detectedTitle) {
      foundFields.push('título do certificado');
      score += 2;
    } else {
      missingFields.push('título do certificado');
    }

    if (detectedName) {
      foundFields.push('nome do participante');
      score += 2;
    } else if (expectedName) {
      missingFields.push('nome do participante');
    }

    if (detectedHours > 0) {
      foundFields.push('carga horaria');
      score += 3;
    } else {
      missingFields.push('carga horaria');
    }

    if (dateMatch) {
      foundFields.push('data');
      score += 1;
    } else {
      missingFields.push('data');
    }

    if (institutionMatch) {
      foundFields.push('instituicao');
      score += 1;
    } else {
      missingFields.push('instituicao');
    }

    if (detectedCourseName) {
      foundFields.push('curso/evento');
      score += 2;
    } else {
      missingFields.push('curso/evento');
    }

    if (detectedTitle || /\b(curso|oficina|evento|seminario|declaracao)\b/i.test(lowerAscii)) {
      score += 1;
    }

    let ocrStatus = 'analise_manual';
    if (!normalized || normalized.length < 20) {
      ocrStatus = 'rejeitado_automatico';
    } else if (detectedTitle && detectedHours > 0 && detectedCourseName && (!expectedName || detectedName) && score >= 7) {
      ocrStatus = 'aprovado_automatico';
    } else if (!detectedTitle && !detectedHours && !institutionMatch && !dateMatch) {
      ocrStatus = 'rejeitado_automatico';
    }

    const normalizedFoundFields = dedupeOcrFields(foundFields);
    const normalizedMissingFields = dedupeOcrFields(missingFields)
      .filter((field) => !normalizedFoundFields.some((foundField) => normalizeFieldKey(foundField) === normalizeFieldKey(field)));
    const humanSummary = buildHumanSummary(normalizedFoundFields, normalizedMissingFields, detectedCourseName, detectedHours);
    const ocrReason = buildOcrReason(ocrStatus, normalizedMissingFields);

    return {
      extractedText: normalized,
      detectedHours,
      detectedName,
      detectedInstitution: institutionMatch ? institutionMatch[0] : '',
      detectedDate: dateMatch ? dateMatch[0] : '',
      detectedTitle,
      detectedCourseName,
      foundFields: normalizedFoundFields,
      missingFields: normalizedMissingFields,
      confidenceScore: score,
      humanSummary,
      ocrStatus,
      ocrReason
    };
  }

  async function extractPdfText(blob, pdfjsLib) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const rawText = textContent.items.map((item) => item.str).join(' ').trim();
    if (rawText.length > 30) return rawText;

    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;
    return { canvas };
  }

  async function runOcr(source, Tesseract) {
    const worker = await Tesseract.createWorker('por');
    try {
      const { data } = await worker.recognize(source);
      return data.text || '';
    } finally {
      await worker.terminate();
    }
  }

  async function analyzeCertificateData(fileData, options = {}) {
    const { pdfjsLib, Tesseract } = await ensureDependencies();
    const blob = dataUrlToBlob(fileData);
    let extractedText = '';

    if (blob.type === 'application/pdf') {
      const pdfResult = await extractPdfText(blob, pdfjsLib);
      if (typeof pdfResult === 'string') {
        extractedText = pdfResult;
      } else {
        extractedText = await runOcr(pdfResult.canvas, Tesseract);
      }
    } else {
      extractedText = await runOcr(blob, Tesseract);
    }

    return detectTextPatterns(extractedText, options.expectedName || '');
  }

  window.SIGACOCR = { analyzeCertificateData };
})();
