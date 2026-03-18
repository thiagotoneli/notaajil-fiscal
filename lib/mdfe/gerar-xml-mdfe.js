"use strict";

const { serializeXml } = require("node-nfe-nfce/lib/application/helpers/xml");
const { removeSelfClosedFields } = require("node-nfe-nfce/lib/application/helpers/utils");

function gerarXmlMDFe({ infMDFe }) {
    if (!infMDFe) {
        throw new Error("infMDFe é obrigatório");
    }

    const MDFe = {
        $: {
            xmlns: "http://www.portalfiscal.inf.br/mdfe"
        },
        infMDFe
    };

    removeSelfClosedFields(MDFe);

    return {
        mdfe: MDFe,
        xml: serializeXml(MDFe, "MDFe")
    };
}

module.exports = {
    gerarXmlMDFe
};