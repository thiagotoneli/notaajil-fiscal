"use strict";

/**
 * Calcula dígito verificador
 */
function calcularDV(chave) {
  let peso = 2;
  let soma = 0;

  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i], 10) * peso;
    peso++;

    if (peso > 9) {
      peso = 2;
    }
  }

  const resto = soma % 11;

  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/**
 * Gera chave MDF-e
 */
function gerarChaveMDFe({
  cUF,
  AAMM,
  dhEmi,
  CNPJ,
  serie,
  nMDF,
  tpEmis,
  cMDF
}) {
  if (!cUF) throw new Error("cUF é obrigatório");

  if (!AAMM) {
    if (!dhEmi) {
      throw new Error("dhEmi é obrigatório para gerar AAMM");
    }

    const data = new Date(dhEmi);
    const ano = data.getFullYear().toString().slice(-2);
    const mes = String(data.getMonth() + 1).padStart(2, "0");

    AAMM = ano + mes;
  }

  if (!CNPJ) throw new Error("CNPJ é obrigatório");
  if (!serie) throw new Error("serie é obrigatório");
  if (!nMDF) throw new Error("nMDF é obrigatório");
  if (!tpEmis) throw new Error("tpEmis é obrigatório");

  const modelo = "58";

  const chave =
    String(cUF).padStart(2, "0") +
    String(AAMM) +
    String(CNPJ).padStart(14, "0") +
    modelo +
    String(serie).padStart(3, "0") +
    String(nMDF).padStart(9, "0") +
    String(tpEmis) +
    String(cMDF || Math.floor(Math.random() * 99999999))
      .padStart(8, "0");

  const dv = calcularDV(chave);

  return chave + dv;
}

module.exports = {
  gerarChaveMDFe
};