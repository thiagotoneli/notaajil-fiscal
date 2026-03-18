"use strict";

function buildSoapEnvelope({ xml, metodo, namespace }) {
    return (
        `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
            `<soap12:Body>` +
                `<${metodo} xmlns="${namespace}">` +
                    xml +
                `</${metodo}>` +
            `</soap12:Body>` +
        `</soap12:Envelope>`
    );
}

module.exports = {
    buildSoapEnvelope
};