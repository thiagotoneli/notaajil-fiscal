"use strict";

const nodeNfeNfce = require("node-nfe-nfce");
const { emitirMDFe } = require("./lib/mdfe/emitir-mdfe");
const { encerrarMDFe } = require("./lib/mdfe/encerrar-mdfe");

module.exports = {
  ...nodeNfeNfce,
  emitirMDFe,
  encerrarMDFe
};