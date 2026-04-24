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
    if (!base64) throw new Error('Arquivo invalido para OCR.');
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

  function buildHumanSummary(foundFields, missingFields, detectedCourseName, detectedHours) {
    const highlights = [];
    if (detectedCourseName) highlights.push(`identificou o curso/evento \"${detectedCourseName}\"`);
    if (detectedHours > 0) highlights.push(`encontrou ${detectedHours}h de carga horaria`);

    let summary = foundFields.length
      ? `O OCR encontrou ${joinHumanList(foundFields)}.`
      : 'O OCR nao conseguiu confirmar nenhum campo importante.';

    if (highlights.length) summary += ` Tambem ${joinHumanList(highlights)}.`;
    if (missingFields.length) summary += ` Ainda faltou ${joinHumanList(missingFields)}.`;

    return summary;
  }

  function detectTextPatterns(text, expectedName = '') {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    const asciiText = normalizeForMatching(normalized);
    const lowerAscii = asciiText.toLowerCase();
    const expectedAscii = normalizeForMatching(expectedName).toLowerCase();

    const hourMatch = findFirstMatch(asciiText, [
      /\b(?:carga\s*horaria|carga|duracao|duracao total|dura(?:c|ç)ao)\s*[:\-]?\s*(\d{1,3})\s*(?:horas?|hrs?|hs?|h)\b/i,
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
      participacao: 'Certificado de Participacao',
      conclusao: 'Certificado de Conclusao',
      aprovacao: 'Certificado de Aprovacao',
      presenca: 'Certificado de Presenca'
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
      foundFields.push('titulo do certificado');
      score += 2;
    } else {
      missingFields.push('titulo do certificado');
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

    let ocrReason = 'O OCR encontrou indicios parciais e o admin deve confirmar manualmente.';
    if (ocrStatus === 'aprovado_automatico') {
      ocrReason = 'Foram encontrados titulo, curso/evento e carga horaria com sinais fortes de certificado.';
    } else if (ocrStatus === 'rejeitado_automatico') {
      ocrReason = 'O texto extraido foi insuficiente para caracterizar um certificado valido.';
    }

    if (missingFields.length) {
      ocrReason += ` Faltou identificar: ${missingFields.join(', ')}.`;
    }

    const humanSummary = buildHumanSummary(foundFields, missingFields, detectedCourseName, detectedHours);

    return {
      extractedText: normalized,
      detectedHours,
      detectedName,
      detectedInstitution: institutionMatch ? institutionMatch[0] : '',
      detectedDate: dateMatch ? dateMatch[0] : '',
      detectedTitle,
      detectedCourseName,
      foundFields,
      missingFields,
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
