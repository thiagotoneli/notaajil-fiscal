"use strict";

const https = require("https");
const { serializeXml, deserializeXml } = require("node-nfe-nfce/lib/application/helpers/xml");
const { signXmlX509 } = require("node-nfe-nfce/lib/domain/use-cases/signature/sign-xml-x509");
const { configuraUrlsSefaz } = require("./configura-urls-sefaz");
const { makeSoapEnvelope } = require("./make-soap-envelope");

function onlyNumbers(value) {
    return String(value || "").replace(/\D/g, "");
}

function getHojeYMD() {
    return new Date().toISOString().slice(0, 10);
}

function getDataAtual() {
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

    return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${sinal}${tzHora}:${tzMin}`;
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
                            debug_http: {
                                statusCode: res.statusCode,
                                headers: res.headers
                            }
                        });
                    }

                    const parsed = await deserializeXml(data, {
                        explicitArray: false
                    });

                    resolve({
                        data: extractSoapBody(parsed),
                        xml_enviado: xml,
                        xml_recebido: data,
                        debug_http: {
                            statusCode: res.statusCode,
                            headers: res.headers
                        }
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

async function encerrarMDFe({
    chave,
    protocolo,
    cMun,
    dtEnc,
    configuracoes
}) {
    if (!chave) {
        throw new Error("chave MDF-e é obrigatório.");
    }

    if (!protocolo) {
        throw new Error("protocolo é obrigatório.");
    }

    if (!cMun) {
        throw new Error("cMun é obrigatório.");
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

    const chaveLimpa = onlyNumbers(chave);
    const protocoloLimpo = onlyNumbers(protocolo);
    const cMunLimpo = onlyNumbers(cMun);
    const tpAmb = String(configuracoes.geral.ambiente || "2");
    const cUF = cMunLimpo.slice(0, 2);
    const dataEnc = String(dtEnc || getHojeYMD()).trim();

    const cnpjEmpresa =
        onlyNumbers(configuracoes.empresa.cnpj) ||
        chaveLimpa.slice(6, 20);

    if (chaveLimpa.length !== 44) {
        throw new Error("chave do MDF-e deve conter 44 dígitos.");
    }

    if (!protocoloLimpo) {
        throw new Error("protocolo inválido.");
    }

    if (cMunLimpo.length !== 7) {
        throw new Error("cMun deve conter 7 dígitos.");
    }

    if (cnpjEmpresa.length !== 14) {
        throw new Error("CNPJ da empresa deve conter 14 dígitos.");
    }

    const eventoObj = {
        $: {
            versao: "3.00",
            xmlns: "http://www.portalfiscal.inf.br/mdfe"
        },
        infEvento: {
            $: {
                Id: `ID110112${chaveLimpa}01`
            },
            cOrgao: cUF,
            tpAmb,
            CNPJ: cnpjEmpresa,
            chMDFe: chaveLimpa,
            dhEvento: getDataAtual(),
            tpEvento: "110112",
            nSeqEvento: "1",
            detEvento: {
                $: {
                    versaoEvento: "3.00"
                },
                evEncMDFe: {
                    descEvento: "Encerramento",
                    nProt: protocoloLimpo,
                    dtEnc: dataEnc,
                    cUF,
                    cMun: cMunLimpo
                }
            }
        }
    };

    const xml = serializeXml(eventoObj, "eventoMDFe");

    const xmlAssinado = signXmlX509(
        xml,
        "infEvento",
        configuracoes.empresa
    );

    const soapBase = configuraUrlsSefaz(
        cUF,
        {
            geral: {
                ambiente: tpAmb,
                modelo: "58"
            }
        },
        "MDFeRecepcaoEvento"
    );

    const soap = {
        ...soapBase,
        metodo: "mdfeDadosMsg",
        namespace: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento",
        soapAction: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento"
    };

    const envelope = makeSoapEnvelope({
        xml: xmlAssinado,
        metodo: soap.metodo,
        namespace: soap.namespace,
        cUF
    });

    const response = await sendSoapRequest({
        url: soap.url,
        xml: envelope,
        empresa: configuracoes.empresa,
        soapAction: soap.soapAction
    });

    return {
        chave: chaveLimpa,
        protocolo: protocoloLimpo,
        cUF,
        cMun: cMunLimpo,
        dtEnc: dataEnc,
        xml,
        xmlAssinado,
        xml_enviado: response.xml_enviado,
        xml_recebido: response.xml_recebido,
        data: response.data,
        debug_http: response.debug_http
    };
}

module.exports = {
    encerrarMDFe
};