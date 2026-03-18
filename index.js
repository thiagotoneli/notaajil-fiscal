"use strict";

const nodeNfeNfce = require("node-nfe-nfce");
const { emitirMDFe } = require("./lib/mdfe/emitir-mdfe");
const { encerrarMDFe } = require("./lib/mdfe/encerrar-mdfe");
const { consultarMDFe } = require("./lib/mdfe/consultar-mdfe");
const { cancelarMDFe } = require("./lib/mdfe/cancelar-mdfe");
const { gerarMDFePDF } = require("./lib/mdfe/gerar-mdfe-pdf");

module.exports = {
  ...nodeNfeNfce,
  emitirMDFe,
  encerrarMDFe,
  consultarMDFe,
  cancelarMDFe,
  gerarMDFePDF
};