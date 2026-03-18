"use strict";

const path = require("path");
const validator = require("xsd-schema-validator");

async function validaXmlMDFe(xml) {
    if (!xml) {
        throw new Error("XML do MDF-e não informado para validação");
    }

    const schemaPath = path.resolve(
        __dirname,
        "./xsd/mdfe/mdfe_v3.00.xsd"
    );

    const previousJavaToolOptions = process.env.JAVA_TOOL_OPTIONS || "";
    const extraJavaOptions = [
        "-Djdk.xml.maxOccurLimit=100000",
        "-Djdk.xml.totalEntitySizeLimit=0",
        "-Djdk.xml.entityExpansionLimit=0"
    ].join(" ");

    process.env.JAVA_TOOL_OPTIONS = `${previousJavaToolOptions} ${extraJavaOptions}`.trim();

    return new Promise((resolve, reject) => {
        validator.validateXML(xml, schemaPath, function (err, result) {
            process.env.JAVA_TOOL_OPTIONS = previousJavaToolOptions;

            if (err) {
                return reject(err);
            }

            if (!result.valid) {
                return reject(
                    new Error("XML do MDF-e inválido conforme schema")
                );
            }

            resolve(true);
        });
    });
}

module.exports = {
    validaXmlMDFe
};