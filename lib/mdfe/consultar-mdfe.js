"use strict";

const https = require("https");
const { deserializeXml } = require("node-nfe-nfce/lib/application/helpers/xml");
const { configuraUrlsSefaz } = require("./configura-urls-sefaz");
const { makeSoapEnvelope } = require("./make-soap-envelope");

function onlyNumbers(value) {
    return String(value || "").replace(/\D/g, "");
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

async function consultarMDFe({ chave, configuracoes }) {
    if (!chave) {
        throw new Error("chave é obrigatório.");
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
    const tpAmb = String(configuracoes.geral.ambiente || "2");
    const cUF = chaveLimpa.substring(0, 2);

    if (chaveLimpa.length !== 44) {
        throw new Error("chave do MDF-e deve conter 44 dígitos.");
    }

    const xml = [
        '<consSitMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">',
        `<tpAmb>${tpAmb}</tpAmb>`,
        "<xServ>CONSULTAR</xServ>",
        `<chMDFe>${chaveLimpa}</chMDFe>`,
        "</consSitMDFe>"
    ].join("");

    const soapBase = configuraUrlsSefaz(
        cUF,
        {
            geral: {
                ambiente: tpAmb,
                modelo: "58"
            }
        },
        "MDFeConsulta"
    );

    const soap = {
        ...soapBase,
        metodo: "mdfeDadosMsg",
        namespace: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta",
        soapAction: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsultaMDF"
    };

    const envelope = makeSoapEnvelope({
        xml,
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
        xml,
        xml_enviado: response.xml_enviado,
        xml_recebido: response.xml_recebido,
        data: response.data,
        debug_http: response.debug_http
    };
}

module.exports = {
    consultarMDFe
};