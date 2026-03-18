"use strict";

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const bwipjs = require("bwip-js");
const { deserializeXml } = require("node-nfe-nfce/lib/application/helpers/xml");

function loadFonts(doc) {
    doc.registerFont("normal", "Helvetica");
    doc.registerFont("negrito", "Helvetica-Bold");
}

function toArray(value) {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function onlyNumbers(value) {
    return String(value || "").replace(/\D/g, "");
}

function safeText(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
}

function formatCNPJ(value) {
    const v = onlyNumbers(value);
    if (v.length !== 14) {
        return String(value || "");
    }
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCPF(value) {
    const v = onlyNumbers(value);
    if (v.length !== 11) {
        return String(value || "");
    }
    return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatDocumento(value) {
    const v = onlyNumbers(value);
    if (v.length === 14) {
        return formatCNPJ(v);
    }
    if (v.length === 11) {
        return formatCPF(v);
    }
    return String(value || "");
}

function formatCEP(value) {
    const v = onlyNumbers(value);
    if (v.length !== 8) {
        return String(value || "");
    }
    return v.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }

    const data = new Date(value);
    if (Number.isNaN(data.getTime())) {
        return String(value || "");
    }

    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = String(data.getFullYear());
    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");
    const segundo = String(data.getSeconds()).padStart(2, "0");

    return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
}

function formatNumberBr(value, casas = 4) {
    const numero = Number(value || 0);
    return numero.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    });
}

function formatSerie(value) {
    return String(value || "").padStart(3, "0");
}

function formatNumeroMDFe(value) {
    const numero = String(value || "").replace(/\D/g, "");
    if (!numero) {
        return "";
    }
    return numero.padStart(9, "0").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1.$2.$3");
}

function formatChaveAcesso(value) {
    const v = onlyNumbers(value);
    if (v.length !== 44) {
        return String(value || "");
    }
    return v.match(/.{1,4}/g).join(" ");
}

function getProtInfo(procMDFe) {
    return procMDFe?.protMDFe?.infProt || {};
}

function getIde(procMDFe) {
    return procMDFe?.MDFe?.infMDFe?.ide || {};
}

function getEmit(procMDFe) {
    return procMDFe?.MDFe?.infMDFe?.emit || {};
}

function getTot(procMDFe) {
    return procMDFe?.MDFe?.infMDFe?.tot || {};
}

function getInfModal(procMDFe) {
    return procMDFe?.MDFe?.infMDFe?.infModal || {};
}

function getInfDoc(procMDFe) {
    return procMDFe?.MDFe?.infMDFe?.infDoc || {};
}

function getQrCodeValue(procMDFe) {
    const supl = procMDFe?.MDFe?.infMDFeSupl;

    if (!supl) {
        return "";
    }

    if (typeof supl.qrCodMDFe === "string") {
        return supl.qrCodMDFe;
    }

    if (supl.qrCodMDFe?._) {
        return supl.qrCodMDFe._;
    }

    return "";
}

function getDocumentoFiscalList(procMDFe) {
    const infDoc = getInfDoc(procMDFe);
    const municipios = toArray(infDoc.infMunDescarga);
    const documentos = [];

    municipios.forEach((mun) => {
        toArray(mun.infNFe).forEach((item) => {
            documentos.push({
                tipo: "NF-e",
                chave: item.chNFe || ""
            });
        });

        toArray(mun.infCTe).forEach((item) => {
            documentos.push({
                tipo: "CT-e",
                chave: item.chCTe || ""
            });
        });

        toArray(mun.infMDFeTransp || mun.MDFeTransp).forEach((item) => {
            documentos.push({
                tipo: "MDF-e",
                chave: item.chMDFe || ""
            });
        });
    });

    return documentos;
}

function drawLine(doc, x1, y1, x2, y2, width = 0.7) {
    doc.save()
        .lineWidth(width)
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke()
        .restore();
}

function drawRect(doc, x, y, w, h, lineWidth = 0.7) {
    doc.save()
        .lineWidth(lineWidth)
        .rect(x, y, w, h)
        .stroke()
        .restore();
}

function drawText(doc, text, x, y, width, opts = {}) {
    doc.font(opts.bold ? "negrito" : "normal")
        .fontSize(opts.size || 8)
        .text(String(text || ""), x, y, {
            width,
            align: opts.align || "left",
            lineGap: opts.lineGap || 0
        });
}

function drawHeaderCell(doc, x, y, w, h, title, value, opts = {}) {
    drawRect(doc, x, y, w, h);
    doc.save()
        .fillColor(opts.fillColor || "#a9c7e8")
        .rect(x, y, w, h)
        .fill()
        .restore();
    drawRect(doc, x, y, w, h);
    drawText(doc, title, x + 3, y + 3, w - 6, { size: 6.5 });
    drawText(doc, value, x + 3, y + 17, w - 6, {
        size: 10,
        bold: true,
        align: opts.align || "center"
    });
}

async function drawBarcode(doc, value, x, y, width, height) {
    const digits = onlyNumbers(value);

    if (!digits) {
        return;
    }

    const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: digits,
        scale: 3,
        height: 12,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
        backgroundcolor: "FFFFFF"
    });

    doc.image(png, x, y, {
        width,
        height
    });
}

async function drawQrImage(doc, value, x, y, size) {
    if (!value) {
        return;
    }

    const qrData = await QRCode.toDataURL(value, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 512
    });

    const qrBase64 = qrData.replace(/^data:image\/png;base64,/, "");
    doc.image(Buffer.from(qrBase64, "base64"), x, y, {
        fit: [size, size],
        align: "center",
        valign: "center"
    });
}

async function pdfMDFe(procMDFe, pathLogo) {
    const ide = getIde(procMDFe);
    const emit = getEmit(procMDFe);
    const tot = getTot(procMDFe);
    const prot = getProtInfo(procMDFe);
    const infModal = getInfModal(procMDFe);
    const rodo = infModal.rodo || {};
    const qrCodeValue = getQrCodeValue(procMDFe);
    const documentos = getDocumentoFiscalList(procMDFe);

    const doc = new PDFDocument({
        size: "A4",
        margin: 20,
        autoFirstPage: true,
        bufferPages: false,
        compress: true
    });

    loadFonts(doc);

    const margem = 22;
    let temLogo = false;
    let emitX = margem + 5;
    let emitWidth = 360;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const usableWidth = pageWidth - (margem * 2);
    const footerY = pageHeight - 40;

    const chave = onlyNumbers(prot.chMDFe || "");
    const emitDocumento = emit.CNPJ || emit.CPF || "";
    const enderecoEmit = emit.enderEmit || {};
    const veicTracao = rodo.veicTracao || {};
    const condutor = toArray(rodo.condutor)[0] || toArray(veicTracao.condutor)[0] || {};
    const consultaUrl = "https://dfe-portal.sefazvirtual.rs.gov.br/MDFe/consulta";

    const linhaEndereco1 = [
        safeText(enderecoEmit.xLgr),
        safeText(enderecoEmit.xBairro),
        safeText(enderecoEmit.nro)
    ].filter(Boolean).join(", ");

    const linhaEndereco2 = [
        safeText(enderecoEmit.xMun),
        safeText(enderecoEmit.UF),
        `CEP: ${formatCEP(enderecoEmit.CEP)}`
    ].filter((v) => v && v !== "CEP: ").join("   ");

    const totalCTe = String(tot.qCTe || documentos.filter((d) => d.tipo === "CT-e").length || "0");
    const totalNFe = String(tot.qNFe || documentos.filter((d) => d.tipo === "NF-e").length || "0");
    const pesoTotal = formatNumberBr(tot.qCarga || 0, 4);

    const numerosNFeResumo = documentos
        .filter((item) => item.tipo === "NF-e" && item.chave)
        .map((item) => {
            const chaveDoc = onlyNumbers(item.chave);
            return chaveDoc.substring(25, 34).replace(/^0+/, "") || "0";
        });

    let y = 18;

    if (pathLogo) {
        try {
            doc.image(pathLogo, margem, y + 2, {
                fit: [100, 70],
                align: "left",
                valign: "top"
            });

            temLogo = true;
            emitX = 110;
            emitWidth = 220;
        } catch (_) {
            temLogo = false;
            emitX = margem + 5;
            emitWidth = 360;
        }
    }

    drawText(doc, emit.xNome || "", emitX, y + 5, emitWidth, { bold: true, size: 11 });
    drawText(doc, linhaEndereco1, emitX, y + 24, emitWidth, { size: 8.3 });
    drawText(doc, linhaEndereco2, emitX, y + 36, emitWidth, { size: 8.3 });
    drawText(
        doc,
        `CNPJ: ${formatDocumento(emitDocumento)}   IE: ${safeText(emit.IE)}`,
        emitX,
        y + 48,
        emitWidth,
        { size: 8.3 }
    );
    drawText(
        doc,
        `TEL.: ${safeText(enderecoEmit.fone || emit.fone)}`,
        emitX,
        y + 60,
        emitWidth,
        { size: 8.3 }
    );

    await drawQrImage(doc, qrCodeValue, 462, 18, 110);

    y = 125;

    drawText(doc, "DAMDFE", margem + 8, y, 70, { bold: true, size: 16 });
    drawText(
        doc,
        "Documento Auxiliar de Manifesto Eletrônico de Documentos Fiscais",
        margem + 105,
        y + 3,
        320,
        { size: 10 }
    );

    y += 24;

    let x = margem;
    const gap = 2;

    drawHeaderCell(doc, x, y, 55, 34, "MODELO", safeText(ide.mod));
    x += 55 + gap;

    drawHeaderCell(doc, x, y, 45, 34, "SÉRIE", formatSerie(ide.serie));
    x += 45 + gap;

    drawHeaderCell(doc, x, y, 100, 34, "NÚMERO", formatNumeroMDFe(ide.nMDF));
    x += 100 + gap;

    drawHeaderCell(doc, x, y, 55, 34, "FOLHA", "01/01");
    x += 55 + gap;

    drawHeaderCell(doc, x, y, 115, 34, "DATA E HORA DE EMISSÃO", formatDateTime(ide.dhEmi));
    x += 115 + gap;

    drawHeaderCell(doc, x, y, 55, 34, "UF Carrega", safeText(ide.UFIni));
    x += 55 + gap;

    drawHeaderCell(doc, x, y, 50, 34, "UF Descar.", safeText(ide.UFFim));
    x += 50 + gap;

    drawHeaderCell(doc, x, y, 60, 34, "PESO TOTAL (Kg)", pesoTotal);
    y += 54;

    drawText(doc, "MODAL RODOVIÁRIO DE CARGA", margem + 9, y + 4, 210, { bold: true, size: 11 });

    doc.save()
        .fillColor("#e6e6e6")
        .rect(margem, y + 24, 80, 34)
        .fill()
        .restore();

    doc.save()
        .fillColor("#e6e6e6")
        .rect(margem + 82, y + 24, 80, 34)
        .fill()
        .restore();

    doc.save()
        .fillColor("#e6e6e6")
        .rect(margem + 164, y + 24, 88, 34)
        .fill()
        .restore();

    drawRect(doc, margem, y + 24, 80, 34);
    drawRect(doc, margem + 82, y + 24, 80, 34);
    drawRect(doc, margem + 164, y + 24, 88, 34);

    drawText(doc, "QTDE CT-e", margem + 6, y + 27, 70, { size: 6.5 });
    drawText(doc, totalCTe, margem + 6, y + 41, 70, { bold: true, size: 10, align: "center" });

    drawText(doc, "QTDE NF-e", margem + 88, y + 27, 70, { size: 6.5 });
    drawText(doc, totalNFe, margem + 88, y + 41, 70, { bold: true, size: 10, align: "center" });

    drawText(doc, "PESO TOTAL (Kg)", margem + 170, y + 27, 76, { size: 6.5 });
    drawText(doc, pesoTotal, margem + 170, y + 41, 76, { bold: true, size: 10, align: "center" });

    drawText(doc, "Controle do Fisco", margem + 260, y + 3, 180, { bold: true, size: 10 });

    await drawBarcode(doc, chave, margem + 260, y + 22, 300, 42);

    drawText(doc, "Chave de acesso", margem + 260, y + 68, 110, { bold: true, size: 8.5 });
    drawText(doc, formatChaveAcesso(chave), margem + 260, y + 81, 300, { bold: true, size: 8.5 });

    drawText(doc, "Protocolo de autorização de uso", margem + 6, y + 76, 200, { bold: true, size: 8.5 });
    drawText(doc, `${safeText(prot.nProt)} ${formatDateTime(prot.dhRecbto)}`, margem + 6, y + 92, 220, { bold: true, size: 8.5 });

    drawText(doc, "Consulte em:", margem + 260, y + 100, 55, { size: 8.5 });
    drawText(doc, consultaUrl, margem + 315, y + 100, 250, { bold: true, size: 8.5 });

    y += 180;

    drawText(doc, "Veículo", margem + 6, y, 80, { bold: true, size: 9 });
    drawText(doc, "Condutor", margem + 260, y, 80, { bold: true, size: 9 });

    drawText(doc, "Placa", margem + 6, y + 18, 40, { size: 7.5 });
    drawText(doc, "RNTRC", margem + 126, y + 18, 60, { size: 7.5 });
    drawText(doc, "CPF", margem + 260, y + 18, 60, { size: 7.5 });
    drawText(doc, "Nome", margem + 380, y + 18, 150, { size: 7.5 });

    drawText(doc, `${safeText(veicTracao.placa)}${veicTracao.UF ? " - " + veicTracao.UF : ""}`, margem + 6, y + 36, 100, { size: 9 });
    drawText(doc, safeText(rodo.infANTT?.RNTRC), margem + 126, y + 36, 100, { size: 9 });
    drawText(doc, formatCPF(condutor.CPF), margem + 260, y + 36, 90, { size: 9 });
    drawText(doc, safeText(condutor.xNome), margem + 380, y + 36, 180, { size: 9 });

    drawLine(doc, margem, y + 62, margem + 228, y + 62, 0.5);
    drawLine(doc, margem + 258, y + 62, margem + usableWidth, y + 62, 0.5);

    y += 95;

    drawText(doc, "Vale Pedágio", margem + 6, y, 120, { bold: true, size: 9 });
    drawText(doc, "Responsável pelo Seguro -", margem + 260, y, 180, { bold: true, size: 9 });

    drawText(doc, "Responsável CNPJ", margem + 6, y + 18, 70, { bold: true, size: 7.5 });
    drawText(doc, "Fornecedor CNPJ", margem + 80, y + 18, 70, { bold: true, size: 7.5 });
    drawText(doc, "N. Comprovante", margem + 150, y + 18, 80, { bold: true, size: 7.5 });

    drawText(doc, "Nome da Seguradora", margem + 260, y + 18, 150, { bold: true, size: 7.5 });
    drawText(doc, "Número da Apólice", margem + 445, y + 18, 105, { bold: true, size: 7.5 });

    drawLine(doc, margem, y + 40, margem + 228, y + 40, 0.5);
    drawLine(doc, margem + 258, y + 40, margem + usableWidth, y + 40, 0.5);

    y += 90;

    drawText(doc, "Relação dos Documentos Fiscais Eletrônicos", margem + 150, y, 270, { bold: true, size: 10 });

    drawText(doc, "Tp. Doc.", margem + 5, y + 22, 40, { size: 7.5 });
    drawText(doc, "CNPJ/CPF Emitente", margem + 65, y + 22, 105, { size: 7.5 });
    drawText(doc, "Série/Nro. Documento", margem + 185, y + 22, 95, { size: 7.5 });

    drawText(doc, "Tp. Doc.", margem + 285, y + 22, 40, { size: 7.5 });
    drawText(doc, "CNPJ/CPF Emitente", margem + 345, y + 22, 100, { size: 7.5 });
    drawText(doc, "Série/Nro. Documento", margem + 455, y + 22, 80, { size: 7.5 });

    const metade = Math.ceil(documentos.length / 2);
    const esquerda = documentos.slice(0, metade);
    const direita = documentos.slice(metade);

    let linhaY = y + 48;
    const maxLinhas = 8;

    for (let i = 0; i < maxLinhas; i++) {
        const left = esquerda[i];
        const right = direita[i];

        if (left) {
            drawText(doc, left.tipo, margem + 5, linhaY, 40, { size: 8 });
            drawText(doc, formatChaveAcesso(left.chave), margem + 45, linhaY, 235, { size: 8 });
        }

        if (right) {
            drawText(doc, right.tipo, margem + 285, linhaY, 40, { size: 8 });
            drawText(doc, formatChaveAcesso(right.chave), margem + 325, linhaY, 235, { size: 8 });
        }

        linhaY += 18;
    }

    y = 720;

    drawText(doc, "Observação", margem + 6, y, 100, { bold: true, size: 9 });
    drawLine(doc, margem, y + 18, margem + usableWidth, y + 18, 0.5);

    if (numerosNFeResumo.length) {
        const resumo =
            numerosNFeResumo.length === 1
                ? `MDF REF NF ${numerosNFeResumo[0]}`
                : `MDF REF NF ${numerosNFeResumo.slice(0, -1).join(", ")} E ${numerosNFeResumo[numerosNFeResumo.length - 1]}`;

        drawText(doc, resumo, margem + 6, y + 26, usableWidth - 12, { size: 9 });
    }

    drawText(
        doc,
        `DATA / HORA DA IMPRESSÃO: ${formatDateTime(new Date().toISOString())}`,
        margem,
        footerY,
        220,
        { size: 8 }
    );

    doc.end();
    return doc;
}

async function gerarMDFePDF(xml, pathLogo) {
    if (!xml) {
        throw new Error("xml é obrigatório.");
    }

    const xmlString = String(xml).trim();

    if (!xmlString) {
        throw new Error("xml é obrigatório.");
    }

    const parsed = await deserializeXml(xmlString, {
        explicitArray: false
    });

    const procMDFe =
        parsed?.procMDFe ||
        parsed?.mdfeProc ||
        parsed;

    if (!procMDFe?.MDFe || !procMDFe?.protMDFe) {
        throw new Error("XML do MDF-e inválido. É necessário informar um XML com MDFe e protMDFe.");
    }

    return pdfMDFe(procMDFe, pathLogo);
}

module.exports = {
    gerarMDFePDF
};