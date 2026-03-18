const { emitirMDFe, carregaCertificadoPath } = require("../index");

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
      password: "123456"
    }
  };

  const documento = {
    versao: "3.00",
    ide: {
      cUF: "35",
      tpAmb: "2",
      tpEmit: "2",
      mod: "58",
      serie: "1",
      nMDF: "10",
      cMDF: "12345678",
      modal: "1",
      dhEmi: "",
      tpEmis: "1",
      procEmi: "0",
      verProc: "1.0",
      UFIni: "SP",
      UFFim: "SP",
      infMunCarrega: [
        {
          cMunCarrega: "3502101",
          xMunCarrega: "ANDRADINA"
        }
      ],
      dhIniViagem: "2026-03-16T08:54:17-03:00"
    },

    emit: {
      CNPJ: "17953171000138",
      IE: "170059050117",
      xNome: "EMPRESA HOMOLOGACAO LTDA",
      xFant: "EMPRESA HOMOLOGACAO",
      enderEmit: {
        xLgr: "RUA TESTE",
        nro: "100",
        xBairro: "CENTRO",
        cMun: "3502101",
        xMun: "ANDRADINA",
        CEP: "16900000",
        UF: "SP",
        fone: "1837000000"
      }
    },

    infModal: {
      $: {
        versaoModal: "3.00"
      },
      rodo: {
        infANTT: {
          RNTRC: "12345678"
        },
        veicTracao: {
          cInt: "1",
          placa: "ABC1D23",
          RENAVAM: "12345678901",
          tara: "5000",
          capKG: "20000",
          capM3: "50",
          condutor: [
            {
              xNome: "CONDUTOR TESTE",
              CPF: "21963044843"
            }
          ],
          tpRod: "01",
          tpCar: "02",
          UF: "SP"
        }
      }
    },

    infDoc: {
      infMunDescarga: [
        {
          cMunDescarga: "3502101",
          xMunDescarga: "ANDRADINA",
          infNFe: [
            {
              chNFe: "35260317953171000138550010000000011000000018"
            }
          ]
        }
      ]
    },

    tot: {
      qNFe: "1",
      vCarga: "1000.00",
      cUnid: "01",
      qCarga: "1.0000"
    },

    infAdic: {
      infCpl: "MDF-E TESTE COM DHINIVIAGEM E INFORMACAO COMPLEMENTAR"
    }
  };

  const result = await emitirMDFe({
    documento,
    configuracoes
  });

  console.dir(result, { depth: null });
}

teste().catch((error) => {
  console.error("Erro no teste MDF-e:");
  console.error(error);
});