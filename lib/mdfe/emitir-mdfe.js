"use strict";

const https = require("https");
const zlib = require("zlib");
const {
    serializeXml,
    deserializeXml
} = require("node-nfe-nfce/lib/application/helpers/xml");
const { removeSelfClosedFields } = require("node-nfe-nfce/lib/application/helpers/utils");
const { signXmlX509 } = require("node-nfe-nfce/lib/domain/use-cases/signature/sign-xml-x509");

const { configuraUrlsSefaz } = require("./configura-urls-sefaz");
const { gerarChaveMDFe } = require("./gerar-chave-mdfe");
const { gerarXmlMDFe } = require("./gerar-xml-mdfe");
const { validaXmlMDFe } = require("./valida-xml-mdfe");
const { makeSoapEnvelope } = require("./make-soap-envelope");

function addIfDefined(target, key, value) {
    if (value !== undefined && value !== null) {
        target[key] = value;
    }
}

function extractSoapBody(data) {
    const envelope =
        data?.["soap:Envelope"] ||
        data?.["soapenv:Envelope"] ||
        data?.Envelope ||
        {};

    const body =
        envelope?.["soap:Body"] ||
        envelope?.["soapenv:Body"] ||
        envelope?.Body ||
        {};

    return body;
}

function sendSoapRequest({ url, xml, empresa, soapAction }) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: `${urlObj.pathname}${urlObj.search || ""}`,
            method: "POST",
            headers: {
                "Content-Type": `application/soap+xml; charset=utf-8; action="${soapAction}"`,
                "Content-Length": Buffer.byteLength(xml)
            },
            cert: empresa.pem,
            key: empresa.key,
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", async () => {
                try {
                    if (!data || !String(data).trim()) {
                        return resolve({
                            data: {},
                            xml_enviado: xml,
                            xml_recebido: data,
                            statusCode: res.statusCode,
                            headers: res.headers
                        });
                    }

                    const parsed = await deserializeXml(data, {
                        explicitArray: false
                    });

                    resolve({
                        data: extractSoapBody(parsed),
                        xml_enviado: xml,
                        xml_recebido: data,
                        statusCode: res.statusCode,
                        headers: res.headers
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on("error", reject);
        req.write(xml);
        req.end();
    });
}

async function emitirMDFe({
    documento,
    configuracoes
}) {
    if (!documento) {
        throw new Error("documento MDF-e é obrigatório.");
    }

    if (!configuracoes) {
        throw new Error("configuracoes é obrigatório.");
    }

    if (!configuracoes.geral) {
        throw new Error("configuracoes.geral é obrigatório.");
    }

    if (!configuracoes.empresa) {
        throw new Error("configuracoes.empresa é obrigatório.");
    }

    if (!documento.ide) {
        throw new Error("documento.ide é obrigatório.");
    }

    if (!documento.emit) {
        throw new Error("documento.emit é obrigatório.");
    }

    if (!documento.ide.cUF) {
        throw new Error("documento.ide.cUF é obrigatório.");
    }

    const tpAmb = Number(documento.ide.tpAmb || configuracoes.geral.ambiente || 2);

    if (tpAmb !== 1 && tpAmb !== 2) {
        throw new Error("Ambiente inválido. Use 1 para produção ou 2 para homologação.");
    }

    if (!documento.ide.dhEmi) {
        const data = new Date();
        const pad = (n) => String(n).padStart(2, "0");

        const ano = data.getFullYear();
        const mes = pad(data.getMonth() + 1);
        const dia = pad(data.getDate());
        const hora = pad(data.getHours());
        const minuto = pad(data.getMinutes());
        const segundo = pad(data.getSeconds());

        const tz = -data.getTimezoneOffset();
        const sinal = tz >= 0 ? "+" : "-";
        const tzAbs = Math.abs(tz);
        const tzHora = pad(Math.floor(tzAbs / 60));
        const tzMin = pad(tzAbs % 60);

        documento.ide.dhEmi = `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${sinal}${tzHora}:${tzMin}`;
    }

    const chaveData = gerarChaveMDFe({
        cUF: String(documento.ide.cUF || ""),
        AAMM: String(documento.ide.AAMM || ""),
        dhEmi: String(documento.ide.dhEmi || ""),
        CNPJ: String(documento.emit.CNPJ || ""),
        serie: String(documento.ide.serie || ""),
        nMDF: String(documento.ide.nMDF || ""),
        tpEmis: String(documento.ide.tpEmis || "1"),
        cMDF: documento.ide.cMDF
    });

    const chave = chaveData.chave;
    const cMDF = chaveData.cMDF;

    documento.ide.cMDF = cMDF;

    const ide = {
        cUF: documento.ide.cUF,
        tpAmb,
        tpEmit: documento.ide.tpEmit,
        mod: documento.ide.mod || "58",
        serie: documento.ide.serie,
        nMDF: documento.ide.nMDF,
        cMDF,
        cDV: chave.slice(-1),
        modal: documento.ide.modal,
        dhEmi: documento.ide.dhEmi,
        tpEmis: documento.ide.tpEmis,
        procEmi: documento.ide.procEmi,
        verProc: documento.ide.verProc,
        UFIni: documento.ide.UFIni,
        UFFim: documento.ide.UFFim,
        infMunCarrega: documento.ide.infMunCarrega
    };

    addIfDefined(ide, "infPercurso", documento.infPercurso);
    addIfDefined(ide, "dhIniViagem", documento.ide.dhIniViagem);
    

    const infMDFe = {
        $: {
            versao: documento.versao || "3.00",
            Id: "MDFe" + chave
        },
        ide,
        emit: documento.emit
    };

    addIfDefined(infMDFe, "infModal", documento.infModal);
    addIfDefined(infMDFe, "infDoc", documento.infDoc);
    addIfDefined(infMDFe, "seg", documento.seg);
    addIfDefined(infMDFe, "prodPred", documento.prodPred);
    addIfDefined(infMDFe, "tot", documento.tot);
    addIfDefined(infMDFe, "lacres", documento.lacres);
    addIfDefined(infMDFe, "autXML", documento.autXML);
    addIfDefined(infMDFe, "infAdic", documento.infAdic);
    addIfDefined(infMDFe, "infRespTec", documento.infRespTec);
    addIfDefined(infMDFe, "infSolicNFF", documento.infSolicNFF);
    addIfDefined(infMDFe, "infPAA", documento.infPAA);

    const doc = gerarXmlMDFe({ infMDFe });

    const xmlAssinadoBase = signXmlX509(
        doc.xml,
        "infMDFe",
        configuracoes.empresa
    );

    const qrCodeUrl = `https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${chave}&tpAmb=${tpAmb}`;
    const infMDFeSuplXml =
        `<infMDFeSupl><qrCodMDFe><![CDATA[${qrCodeUrl}]]></qrCodMDFe></infMDFeSupl>`;

    const xmlAssinado = xmlAssinadoBase.replace(
        "</infMDFe><Signature",
        `</infMDFe>${infMDFeSuplXml}<Signature`
    );

    await validaXmlMDFe(xmlAssinado);

    const xmlCompactado = zlib
        .gzipSync(Buffer.from(xmlAssinado, "utf8"))
        .toString("base64");

    const soap = configuraUrlsSefaz(
        documento.ide.cUF,
        {
            ...configuracoes,
            geral: {
                ...configuracoes.geral,
                modelo: "58",
                ambiente: tpAmb
            }
        },
        "MDFeRecepcaoSinc"
    );

    const { empresa } = configuracoes;

    const envelope = makeSoapEnvelope({
        xml: xmlCompactado,
        metodo: soap.metodo,
        namespace: soap.namespace,
        cUF: documento.ide.cUF
    });

    const response = await sendSoapRequest({
        url: soap.url,
        xml: envelope,
        empresa,
        soapAction: soap.soapAction
    });

    return await builderResponse({
        chave,
        xml: doc.xml,
        xmlAssinado,
        response
    });
}

async function builderResponse({
    chave,
    xml,
    xmlAssinado,
    response
}) {
    const retorno =
        response?.data?.mdfeRecepcaoResult?.retMDFe ||
        response?.data?.mdfeRecepcaoLoteResult?.retMDFe ||
        response?.data?.retMDFe ||
        response?.data?.retEnviMDFe ||
        response?.data ||
        {};

    const protMDFe = Object(retorno?.protMDFe || {});
    const infProt = Object(protMDFe?.infProt || {});
    const infRec = Object(retorno?.infRec || {});

    let mdfeProc;
    let xml_completo;

    if (protMDFe && Object.keys(protMDFe).length > 0) {
        const xmlObj = await deserializeXml(xmlAssinado, {
            explicitArray: false
        });

        mdfeProc = {
            $: {
                versao: "3.00",
                xmlns: "http://www.portalfiscal.inf.br/mdfe"
            },
            MDFe: Object(xmlObj)?.MDFe,
            protMDFe
        };

        removeSelfClosedFields(mdfeProc);
        xml_completo = serializeXml(mdfeProc, "mdfeProc");
    }

    return {
        xml_enviado: response.xml_enviado,
        xml_recebido: response.xml_recebido,
        mdfeProc,
        success: infProt.cStat === "100",
        xml_completo,
        mensagem: infProt.xMotivo || retorno.xMotivo,
        nRec: infRec.nRec,
        chave,
        xml,
        xmlAssinado,
        data: response.data,
        debug_http: {
            statusCode: response.statusCode,
            headers: response.headers
        }
    };
}

module.exports = {
    emitirMDFe
};