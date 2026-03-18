"use strict";

function makeSoapEnvelope({ xml, metodo, namespace, cUF }) {
    return (
        `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
            `<soap:Header>` +
                `<mdfeCabecMsg xmlns="${namespace}">` +
                    `<cUF>${cUF}</cUF>` +
                    `<versaoDados>3.00</versaoDados>` +
                `</mdfeCabecMsg>` +
            `</soap:Header>` +
            `<soap:Body>` +
                `<mdfeDadosMsg xmlns="${namespace}">` +
                    xml +
                `</mdfeDadosMsg>` +
            `</soap:Body>` +
        `</soap:Envelope>`
    );
}

module.exports = {
    makeSoapEnvelope
};