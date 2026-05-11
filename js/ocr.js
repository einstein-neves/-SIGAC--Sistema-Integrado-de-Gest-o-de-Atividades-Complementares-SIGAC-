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
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(
        new Error('Nao foi possivel carregar as bibliotecas externas do OCR. Verifique a conexao com a internet ou faca a validacao manual do certificado.')
      );
      document.head.appendChild(script);
    });
  }

  async function ensureDependencies() {
    await ensureScript(PDF_CDN);
    await ensureScript(TESSERACT_CDN);

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;

    if (!pdfjsLib || !window.Tesseract) {
      throw new Error('Nao foi possivel inicializar as bibliotecas externas do OCR. Continue o envio manualmente e use os dados preenchidos no formulario como fonte final.');
    }

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

  function cleanupCourseName(value) {
    return cleanupDetectedValue(value)
      .replace(/\s+com\s+dura(?:c|ç)[aã]o.*$/i, '')
      .replace(/\s+realizando\s+todas.*$/i, '')
      .replace(/\s+e\s+avalia(?:c|ç)[oõ]es.*$/i, '')
      .replace(/\s*\[\s*(\d{1,3})\s*horas?\s*\]\s*/i, ' [$1 HORAS]')
      .trim();
  }

  function formatCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 14) return cleanupDetectedValue(value);

    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  function detectCnpj(asciiText) {
    const match = asciiText.match(/\bCNPJ\s*[:\-]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2})\b/i);
    return match ? formatCnpj(match[1]) : '';
  }

  function normalizeNumericDate(value) {
    const match = String(value || '').match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
    if (!match) return '';

    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];

    return `${day}/${month}/${year}`;
  }

  function detectWrittenDate(asciiText) {
    const monthMap = {
      janeiro: '01',
      fevereiro: '02',
      marco: '03',
      março: '03',
      abril: '04',
      maio: '05',
      junho: '06',
      julho: '07',
      agosto: '08',
      setembro: '09',
      outubro: '10',
      novembro: '11',
      dezembro: '12'
    };

    const months = Object.keys(monthMap).join('|');
    const match = asciiText.match(new RegExp('\\b(\\d{1,2})\\s+de\\s+(' + months + ')\\s+de\\s+(\\d{4})\\b', 'i'));

    if (!match) return '';

    const day = match[1].padStart(2, '0');
    const month = monthMap[String(match[2]).toLowerCase()] || '';

    return month ? `${day}/${month}/${match[3]}` : '';
  }

  function detectInstitution(asciiText) {
    const detectedCnpj = detectCnpj(asciiText);

    const companyWithCnpj = asciiText.match(/\b([A-Za-z0-9À-ÿ &.,'’\-–—]{3,120}?(?:LTDA|EIRELI|S\.?A\.?|ME|EPP))\s*[–—-]?\s*CNPJ\s*[:\-]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2})\b/i);
    if (companyWithCnpj) {
      const companyName = cleanupDetectedValue(companyWithCnpj[1]);
      return `${companyName} - CNPJ: ${formatCnpj(companyWithCnpj[2])}`;
    }

    const companyOnly = asciiText.match(/\b([A-Za-z0-9À-ÿ &.,'’\-–—]{3,120}?(?:LTDA|EIRELI|S\.?A\.?|ME|EPP))\b/i);
    if (companyOnly) return cleanupDetectedValue(companyOnly[1]);

    const knownInstitution = asciiText.match(/\b(CURSO\s+EM\s+VIDEO|CURSOEMVIDEO|DIGIRATI\s+INFORMATICA|DIGIRATI|SENAC|SENAI|SEBRAE|UNINASSAU|UNICAP|UNINTER|IFPE|UFPE|UFRPE|UNIVERSIDADE|FACULDADE|ESCOLA\s+TECNICA|INSTITUTO\s+FEDERAL|CENTRO\s+UNIVERSITARIO|ALURA|UDEMY|FUNDA[CC]AO\s+BRADESCO|FGV)\b/i);
    if (knownInstitution) return cleanupDetectedValue(knownInstitution[1]);

    return detectedCnpj ? `CNPJ: ${detectedCnpj}` : '';
  }

  function detectCertificateCode(asciiText) {
    const match = findFirstMatch(asciiText, [
      /\b(?:codigo\s+do\s+certificado|codigo\s+certificado|codigo|code|certificado\s+n[ºo])\s*[:\-]?\s*([A-Z0-9]{3,}(?:[-\/][A-Z0-9]{1,})+)\b/i,
      /\b([A-Z0-9]{5,}(?:-[A-Z0-9]{2,}){1,})\b/i
    ]);

    return match?.[1] ? cleanupDetectedValue(match[1]) : '';
  }

  function detectCourseOrEventName(asciiText, detectedTitle, originalText = '') {
    const originalLines = String(originalText || '')
      .split(/\r?\n+/)
      .map((line) => cleanupCourseName(normalizeForMatching(line)))
      .filter(Boolean);

    const patterns = [
      /\bJAVA\s+BASICO\s*\[\s*\d{1,3}\s*HORAS?\s*\]/i,
      /\bcurso\s+em\s+videoaula\s+([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{3,100}?)(?=\s+com\s+duracao|\s+com\s+duração|\s+realizando|\s+e\s+avaliacoes|\s+e\s+avaliações|$)/i,
      /\b(?:curso|oficina|minicurso|workshop|palestra|seminario|evento|feira|jornada|congresso)\s+(?:de|sobre|em)?\s*[:\-]?\s*([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{5,100})/i,
      /\btema\s*[:\-]\s*([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{5,100})/i,
      /\breferente\s+a[oa]?\s*[:\-]?\s*([A-Z0-9][A-Za-z0-9 #+.'’&\/\-\[\]]{5,100})/i
    ];

    for (const pattern of patterns) {
      const match = asciiText.match(pattern);
      if (match) return cleanupCourseName(match[1] || match[0]);
    }

    const titleLine = originalLines.find((line) => {
      if (/\b(?:certificado|certificamos|declaramos|codigo|cnpj|powered|lei)\b/i.test(line)) return false;
      return /\b(?:JAVA|BASICO|HTML|CSS|PYTHON|JAVASCRIPT|EXCEL|LOGICA|BANCO\s+DE\s+DADOS|HORAS?)\b/i.test(line);
    });

    if (titleLine) return cleanupCourseName(titleLine);

    const lines = asciiText
      .split(/(?<=\.)\s+|\n/)
      .map((line) => cleanupCourseName(line))
      .filter(Boolean);

    const blacklist = new Set([
      String(detectedTitle || '').toLowerCase(),
      'certificado',
      'declaracao',
      'certificamos que',
      'declaramos que'
    ]);

    const fallback = lines.find((line) => {
      const lower = line.toLowerCase();

      if (blacklist.has(lower)) return false;
      if (/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(line)) return false;
      if (/\bcodigo\b|\bcnpj\b|\bpowered\b/i.test(line)) return false;

      return /\b(?:curso|oficina|minicurso|workshop|palestra|seminario|evento|feira|jornada|congresso|java|python|javascript|html|css|excel)\b/i.test(line);
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
      return 'OCR de apoio concluído: o texto extraído não trouxe informações suficientes para uma pré-análise confiável. Revise o certificado manualmente; a decisão final deve considerar os dados preenchidos no formulário.';
    }

    const parts = [];

    if (uniqueFoundFields.length) {
      const intro = uniqueMissingFields.length
        ? 'OCR de apoio concluído com pendências.'
        : 'OCR de apoio concluído.';

      parts.push(`${intro} Foram identificados ${joinHumanList(uniqueFoundFields)}.`);
    } else {
      parts.push('OCR de apoio concluído sem dados suficientes para pré-análise automática.');
    }

    if (uniqueMissingFields.length) {
      parts.push(`Campos que exigem conferência manual: ${joinHumanList(uniqueMissingFields)}.`);
    }

    if (detectedHours > 0) parts.push(`Carga horária detectada: ${detectedHours}h.`);
    if (detectedCourseName) parts.push(`Curso/evento detectado: ${detectedCourseName}.`);

    parts.push('O OCR é apenas apoio e não substitui a validação humana nem os dados obrigatórios informados no formulário.');

    return parts.join(' ');
  }

  function buildOcrReason(ocrStatus, missingFields) {
    const uniqueMissingFields = dedupeOcrFields(missingFields);

    let reason = 'O OCR identificou informações parciais. Confirme manualmente antes da decisão final.';

    if (ocrStatus === 'aprovado_automatico') {
      reason = 'Os principais dados foram encontrados com boa consistência, mas a validação humana continua obrigatória.';
    } else if (ocrStatus === 'rejeitado_automatico') {
      reason = 'O texto extraído não contém informações suficientes para apoiar a aprovação automática.';
    }

    if (uniqueMissingFields.length) {
      reason += ` Campos não identificados: ${joinHumanList(uniqueMissingFields)}.`;
    }

    return reason;
  }

  function buildRejectedOcrMissingReport({
    ocrStatus,
    missingFields,
    foundFields,
    detectedHours,
    detectedDate,
    detectedInstitution,
    detectedCnpj,
    detectedCourseName,
    detectedTitle,
    detectedName,
    expectedName
  }) {
    if (ocrStatus !== 'rejeitado_automatico') {
      return {
        shouldShow: false,
        title: '',
        message: '',
        missingFields: [],
        foundFields: dedupeOcrFields(foundFields),
        tips: []
      };
    }

    const uniqueMissingFields = dedupeOcrFields(missingFields);
    const uniqueFoundFields = dedupeOcrFields(foundFields);

    const tipsByField = {
      'título do certificado': 'Não foi identificado que o arquivo é um certificado ou declaração válida.',
      'nome do participante': expectedName
        ? `O nome esperado "${expectedName}" não foi encontrado no texto extraído.`
        : 'O nome do participante não foi encontrado no certificado.',
      'carga horária': 'Não foi encontrada uma carga horária válida, como "40 horas", "40h" ou "40 hrs".',
      data: 'Não foi encontrada uma data válida, como "25/10/2025" ou "25 de outubro de 2025".',
      instituição: 'Não foi encontrada uma instituição válida. O sistema aceita nome da instituição, empresa LTDA ou CNPJ.',
      'curso/evento': 'Não foi identificado o nome do curso, evento, oficina, palestra ou atividade.'
    };

    const tips = uniqueMissingFields.map((field) => tipsByField[field] || `Campo não identificado: ${field}.`);

    const detectedParts = [];

    if (detectedTitle) detectedParts.push(`título: ${detectedTitle}`);
    if (detectedName) detectedParts.push(`nome: ${detectedName}`);
    if (detectedCourseName) detectedParts.push(`curso/evento: ${detectedCourseName}`);
    if (detectedHours > 0) detectedParts.push(`carga horária: ${detectedHours}h`);
    if (detectedDate) detectedParts.push(`data: ${detectedDate}`);
    if (detectedInstitution) detectedParts.push(`instituição: ${detectedInstitution}`);
    if (detectedCnpj) detectedParts.push(`CNPJ: ${detectedCnpj}`);

    const missingText = uniqueMissingFields.length
      ? `Campos faltando: ${joinHumanList(uniqueMissingFields)}.`
      : 'Nenhum campo faltante foi listado, mas a confiança do OCR foi baixa.';

    const foundText = detectedParts.length
      ? `Dados encontrados: ${detectedParts.join('; ')}.`
      : 'Nenhum dado confiável foi encontrado no certificado.';

    return {
      shouldShow: true,
      title: 'OCR rejeitado: informações obrigatórias não encontradas',
      message: `${missingText} ${foundText}`,
      missingFields: uniqueMissingFields,
      foundFields: uniqueFoundFields,
      tips
    };
  }

  function detectTextPatterns(text, expectedName = '') {
    const originalText = String(text || '');
    const normalized = originalText
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const asciiText = normalizeForMatching(normalized);
    const lowerAscii = asciiText.toLowerCase();
    const expectedAscii = normalizeForMatching(expectedName).toLowerCase();

    const hourMatch = findFirstMatch(asciiText, [
      /\b(?:carga\s*horaria|carga|duracao|duracao\s+total|dura(?:c|ç)[aã]o(?:\s+total)?)\s*[:\-]?\s*(?:de\s+)?(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
      /\[\s*(\d{1,3})\s*HORAS?\s*\]/i,
      /\b(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
      /\b(\d{1,3})\s*horas?\s*complementares\b/i
    ]);

    const dateMatch = asciiText.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/);
    const writtenDate = detectWrittenDate(asciiText);
    const detectedDate = dateMatch ? normalizeNumericDate(dateMatch[0]) : writtenDate;

    const detectedCnpj = detectCnpj(asciiText);
    const detectedInstitution = detectInstitution(asciiText);
    const detectedCode = detectCertificateCode(asciiText);

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
    const detectedCourseName = detectCourseOrEventName(asciiText, detectedTitle, normalized);

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

    if (detectedDate) {
      foundFields.push('data');
      score += 1;
    } else {
      missingFields.push('data');
    }

    if (detectedInstitution) {
      foundFields.push('instituicao');
      score += detectedCnpj ? 2 : 1;
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
    } else if (!detectedTitle && !detectedHours && !detectedInstitution && !detectedDate) {
      ocrStatus = 'rejeitado_automatico';
    }

    const normalizedFoundFields = dedupeOcrFields(foundFields);
    const normalizedMissingFields = dedupeOcrFields(missingFields)
      .filter((field) => !normalizedFoundFields.some((foundField) => normalizeFieldKey(foundField) === normalizeFieldKey(field)));

    let humanSummary = buildHumanSummary(normalizedFoundFields, normalizedMissingFields, detectedCourseName, detectedHours);

    if (detectedCode) humanSummary += ` Código do certificado detectado: ${detectedCode}.`;
    if (detectedCnpj) humanSummary += ` CNPJ detectado: ${detectedCnpj}.`;

    const ocrReason = buildOcrReason(ocrStatus, normalizedMissingFields);

    const rejectedMissingReport = buildRejectedOcrMissingReport({
      ocrStatus,
      missingFields: normalizedMissingFields,
      foundFields: normalizedFoundFields,
      detectedHours,
      detectedDate,
      detectedInstitution,
      detectedCnpj,
      detectedCourseName,
      detectedTitle,
      detectedName,
      expectedName
    });

    if (rejectedMissingReport.shouldShow) {
      humanSummary += ` ${rejectedMissingReport.message}`;

      if (rejectedMissingReport.tips.length) {
        humanSummary += ` Motivos: ${rejectedMissingReport.tips.join(' ')}`;
      }
    }

    return {
      extractedText: normalized,
      detectedHours,
      detectedName,
      detectedInstitution,
      detectedCnpj,
      detectedDate,
      detectedCode,
      detectedTitle,
      detectedCourseName,
      foundFields: normalizedFoundFields,
      missingFields: normalizedMissingFields,
      confidenceScore: score,
      humanSummary,
      ocrStatus,
      ocrReason,
      rejectedMissingReport
    };
  }

  async function extractPdfText(blob, pdfjsLib) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts = [];
    const canvases = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ').trim();

      if (pageText.length > 20) {
        textParts.push(pageText);
        continue;
      }

      const viewport = page.getViewport({ scale: 2.25 });
      const canvas = document.createElement('canvas');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;

      await page.render({ canvasContext: context, viewport }).promise;
      canvases.push(canvas);
    }

    const rawText = textParts.join('\n').trim();

    if (rawText.length > 30) return rawText;

    return { canvases };
  }

  async function runOcr(source, Tesseract) {
    const worker = await Tesseract.createWorker('por');

    try {
      const sources = Array.isArray(source) ? source : [source];
      const texts = [];

      for (const item of sources.filter(Boolean)) {
        const { data } = await worker.recognize(item);
        texts.push(data.text || '');
      }

      return texts.join('\n').trim();
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
        extractedText = await runOcr(pdfResult.canvases || pdfResult.canvas, Tesseract);
      }
    } else {
      extractedText = await runOcr(blob, Tesseract);
    }

    return detectTextPatterns(extractedText, options.expectedName || '');
  }

  window.SIGACOCR = { analyzeCertificateData };
})();