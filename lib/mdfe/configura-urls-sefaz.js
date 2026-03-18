"use strict";

const { getMdfeSoapConfig } = require("./mdfe-service");

function configuraUrlsSefaz(cUf, configuracoes, servicoSefaz) {
    const {
        geral: { modelo, ambiente }
    } = configuracoes;

    if (String(modelo) !== "58") {
        throw new Error(`Modelo não suportado para MDF-e: ${modelo}`);
    }

    const tpAmb = String(ambiente || "2");

    if (tpAmb !== "1" && tpAmb !== "2") {
        throw new Error(`Ambiente MDF-e inválido: ${ambiente}. Use 1 para produção ou 2 para homologação.`);
    }

    const operacoes = {
        MDFeRecepcaoSinc: "EMISSAO",
        MDFeStatusServico: "STATUS",
        MDFeConsulta: "CONSULTA",
        MDFeRecepcaoEvento: "ENCERRAMENTO"
    };

    const operacao = operacoes[servicoSefaz];

    if (!operacao) {
        throw new Error(`Serviço MDF-e não suportado: ${servicoSefaz}`);
    }

    return getMdfeSoapConfig({
        ambiente: tpAmb,
        operacao,
        cUf
    });
}

module.exports = {
    configuraUrlsSefaz
};