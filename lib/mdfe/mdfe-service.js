"use strict";

function getMdfeSoapConfig({ ambiente, operacao }) {
    const tpAmb = String(ambiente || "2");
    const op = String(operacao || "").toUpperCase();

    const baseUrl = tpAmb === "1"
        ? "https://mdfe.svrs.rs.gov.br/ws"
        : "https://mdfe-homologacao.svrs.rs.gov.br/ws";

    if (op === "STATUS") {
        return {
            url: `${baseUrl}/MDFeStatusServico/MDFeStatusServico.asmx`,
            method: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico",
            action: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico/mdfeStatusServicoMDF",
            contentType: "application/soap+xml;charset=utf-8"
        };
    }

    if (op === "CONSULTA") {
        return {
            url: `${baseUrl}/MDFeConsulta/MDFeConsulta.asmx`,
            method: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta",
            action: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsultaMDF",
            contentType: "application/soap+xml;charset=utf-8"
        };
    }

    if (op === "RECEPCAO" || op === "EMISSAO") {
        return {
            url: `${baseUrl}/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx`,
            soapAction: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc/mdfeRecepcao",
            metodo: "mdfeDadosMsg",
            namespace: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc"
        };
    }

    if (op === "ENCERRAMENTO" || op === "CANCELAMENTO") {
        return {
            url: `${baseUrl}/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx`,
            method: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento",
            action: "http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento",
            contentType: "application/soap+xml;charset=utf-8"
        };
    }

    throw new Error(`Operação MDF-e não suportada: ${op}`);
}

module.exports = {
    getMdfeSoapConfig
};