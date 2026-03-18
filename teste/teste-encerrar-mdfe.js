const { encerrarMDFe, carregaCertificadoPath } = require("../index");

async function teste() {
  const cert = carregaCertificadoPath({
    path: "../1.pfx",
    password: "123456"
  });

  const configuracoes = {
    geral: {
      ambiente: 2,
      modelo: "58"
    },
    empresa: {
      pem: cert.pem,
      key: cert.key,
      password: "123456",
      cnpj: "17953171000138"
    }
  };

  const result = await encerrarMDFe({
    chave: "35260317953171000138580010000000091123456787",
    protocolo: "935260000014832",
    cMun: "3502101",
    dtEnc: "2026-03-17",
    configuracoes
  });

  console.dir(result, { depth: null });
}

teste().catch((error) => {
  console.error("Erro no teste de encerramento MDF-e:");
  console.error(error);
});