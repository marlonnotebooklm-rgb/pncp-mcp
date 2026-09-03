import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const PNCP_BASE = "https://pncp.gov.br/api/consulta";

const PALAVRAS_CHAVE = [
  "combat shirt",
  "coturno",
  "cordura",
  "molle",
  "acero",
  "invictus",
  "confratec air",
  "arroyo",
  "bota tática",
  "tática",
  "tático",
  "calça militar",
  "gandola",
  "boonie hat",
  "cinto de nylon",
  "rip stop",
  "tonfa",
  "bastão retrátil",
  "polícia judicial",
  "capa de colete",
  "colete modular",
  "luva motociclista",
  "capacete condutor",
  "capacete motociclista",
  "bota cano longo",
  "fiel retrátil",
  "cinto de guarnição",
  "protetor lombar",
  "fivela tripla retenção",
  "lanterna militar",
  "lanterna tática",
  "descensor",
  "ascensor",
  "console duplo",
  "macacão neoprene",
  "mergulho",
  "mergulhador",
  "mosquetão",
  "polia dupla",
  "polia simples",
  "salvamento",
  "salvamento em altura",
  "trabalho em altura",
  "bota motociclista",
  "bota bombeiro",
  "combate incêndio",
  "algema",
  "porta carregador",
  "porta algema",
  "bornal de perna",
  "embornal",
  "joelheira",
  "joelheira motociclista",
  "cotoveleira",
  "cotoveleira motociclista",
  "coldre",
  "kydex",
  "dual lock system",
  "maynards",
  "porta lanterna",
  "bolso modular",
  "forhonor",
  "airstep",
  "multicam",
  "fardamento operacional",
  "sapatilha neoprene",
  "meia tática",
  "mochila tática",
  "shemagh",
  "canivete",
  "boina",
  "bandoleira",
  "saco de descarte",
  "dispose",
  "iwb",
  "owb",
  "balaclava",
  "camuflada",
  "aph",
  "torniquete",
  "porta aph",
  "samu",
  "macacão samu",
  "pmesp",
  "luva para tiro",
  "luva tática",
  "tecido cordura 1000",
  "tecido cordura 500",
  "salvamento aquático"
];

function normalizar(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function encontrarPalavras(texto) {
  const normalizado = normalizar(texto);

  return PALAVRAS_CHAVE.filter((palavra) =>
    normalizado.includes(normalizar(palavra))
  );
}

function formatarData(data) {
  const agora = new Date(data);
  if (Number.isNaN(agora.getTime())) return null;

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}${mes}${dia}`;
}

function extrairRegistros(dados) {
  if (Array.isArray(dados)) return dados;

  if (Array.isArray(dados?.content)) return dados.content;

  if (Array.isArray(dados?.data)) return dados.data;

  if (Array.isArray(dados?.results)) return dados.results;

  return [];
}

function valor(obj, ...nomes) {
  for (const nome of nomes) {
    if (
      obj &&
      obj[nome] !== undefined &&
      obj[nome] !== null &&
      obj[nome] !== ""
    ) {
      return obj[nome];
    }
  }

  return null;
}

async function buscarPropostasAbertas({
  dataFinal,
  uf,
  modalidade,
  pagina = 1,
  tamanhoPagina = 50
}) {
  const params = new URLSearchParams();

  params.set("dataFinal", dataFinal);
  params.set("pagina", String(pagina));
  params.set(
    "tamanhoPagina",
    String(Math.min(Math.max(tamanhoPagina, 10), 50))
  );

  if (modalidade !== undefined && modalidade !== null) {
    params.set("codigoModalidadeContratacao", String(modalidade));
  }

  if (uf) {
    params.set("uf", uf.toUpperCase());
  }

  const url = `${PNCP_BASE}/v1/contratacoes/proposta?${params.toString()}`;

  const resposta = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!resposta.ok) {
    const erro = await resposta.text();

    throw new Error(
      `PNCP respondeu HTTP ${resposta.status}: ${erro.slice(0, 500)}`
    );
  }

  return resposta.json();
}

function transformarRegistro(registro) {
  const objeto = valor(
    registro,
    "objetoCompra",
    "objeto",
    "objetoContratacao",
    "descricao"
  );

  const numero = valor(
    registro,
    "numeroCompra",
    "numeroContratacao",
    "numeroEdital",
    "numero"
  );

  const modalidade = valor(
    registro,
    "modalidadeNome",
    "nomeModalidade",
    "modalidadeContratacaoNome"
  );

  const orgao = valor(
    registro,
    "orgaoEntidade",
    "orgaoNome",
    "nomeOrgao",
    "razaoSocial"
  );

  const municipio = valor(
    registro,
    "municipioNome",
    "nomeMunicipio",
    "municipio"
  );

  const uf = valor(
    registro,
    "ufSigla",
    "uf",
    "siglaUf"
  );

  const valorEstimado = valor(
    registro,
    "valorTotalEstimado",
    "valorEstimado",
    "valorTotal"
  );

  const dataPublicacao = valor(
    registro,
    "dataPublicacaoPncp",
    "dataPublicacao",
    "dataInclusao"
  );

  const dataAbertura = valor(
    registro,
    "dataAberturaProposta",
    "dataAbertura"
  );

  const controlePncp = valor(
    registro,
    "numeroControlePNCP",
    "numeroControlePncp"
  );

  const textoBusca = [
    objeto,
    numero,
    modalidade,
    orgao,
    municipio,
    uf
  ]
    .filter(Boolean)
    .join(" ");

  return {
    numero,
    objeto,
    modalidade,
    orgao,
    municipio,
    uf,
    valorEstimado,
    dataPublicacao,
    dataAbertura,
    numeroControlePNCP: controlePncp,
    palavrasEncontradas: encontrarPalavras(textoBusca),
    dadosOriginais: registro
  };
}

function criarServidor() {
  const server = new McpServer({
    name: "PNCP Licitações MCP",
    version: "1.0.0"
  });

  server.registerTool(
    "ping",
    {
      description:
        "Testa a conexão entre Claude, o MCP e o servidor Cloudflare.",
      inputSchema: {}
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "Pong! O MCP do PNCP está funcionando corretamente."
        }
      ]
    })
  );

  server.registerTool(
    "listar_palavras_chave",
    {
      description:
        "Retorna a lista de palavras-chave utilizadas pelo radar de licitações.",
      inputSchema: {}
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              quantidade: PALAVRAS_CHAVE.length,
              palavras: PALAVRAS_CHAVE
            },
            null,
            2
          )
        }
      ]
    })
  );

  server.registerTool(
    "buscar_licitacoes",
    {
      description:
        "Pesquisa contratações do PNCP com recebimento de propostas aberto e filtra localmente pelos termos de interesse do radar.",
      inputSchema: {
        palavra_chave: z
          .string()
          .optional()
          .describe(
            "Termo específico para pesquisar. Se omitido, usa todas as palavras-chave do radar."
          ),

        dias: z
          .number()
          .int()
          .min(1)
          .max(7)
          .optional()
          .default(1)
          .describe(
            "Quantidade de dias anteriores usados como referência. Padrão: 1."
          ),

        uf: z
          .string()
          .length(2)
          .optional()
          .describe("UF para restringir a busca, por exemplo GO, SP ou DF."),

        modalidade: z
          .number()
          .int()
          .optional()
          .describe(
            "Código da modalidade de contratação no PNCP, quando desejado."
          ),

        limite: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(30)
          .describe("Quantidade máxima de resultados retornados.")
      }
    },
    async ({
      palavra_chave,
      dias = 1,
      uf,
      modalidade,
      limite = 30
    }) => {
      try {
        const hoje = new Date();

        const termos = palavra_chave
          ? [palavra_chave]
          : PALAVRAS_CHAVE;

        const termoNormalizado = termos.map(normalizar);

        const resultados = [];
        const vistos = new Set();

        for (let deslocamento = 0; deslocamento < dias; deslocamento++) {
          const data = new Date(hoje);
          data.setDate(data.getDate() - deslocamento);

          const dataFinal = formatarData(data);

          for (let pagina = 1; pagina <= 5; pagina++) {
            const dados = await buscarPropostasAbertas({
              dataFinal,
              uf,
              modalidade,
              pagina,
              tamanhoPagina: 50
            });

            const registros = extrairRegistros(dados);

            if (!registros.length) break;

            for (const registro of registros) {
              const item = transformarRegistro(registro);

              const texto = normalizar(
                [
                  item.objeto,
                  item.numero,
                  item.modalidade,
                  item.orgao,
                  item.municipio,
                  item.uf
                ]
                  .filter(Boolean)
                  .join(" ")
              );

              const correspondencias = termos.filter((termo, indice) =>
                texto.includes(termoNormalizado[indice])
              );

              if (!correspondencias.length) continue;

              const identificador =
                item.numeroControlePNCP ||
                `${item.numero || ""}-${item.orgao || ""}-${item.objeto || ""}`;

              if (vistos.has(identificador)) continue;

              vistos.add(identificador);

              item.palavrasEncontradas = correspondencias;

              resultados.push(item);

              if (resultados.length >= limite) break;
            }

            if (resultados.length >= limite) break;

            if (registros.length < 50) break;
          }

          if (resultados.length >= limite) break;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sucesso: true,
                  fonte: "API oficial de consulta do PNCP",
                  filtro: palavra_chave || "todas as palavras-chave",
                  uf: uf || "todas",
                  resultadosEncontrados: resultados.length,
                  resultados
                },
                null,
                2
              )
            }
          ]
        };
      } catch (erro) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sucesso: false,
                  erro: erro.message
                },
                null,
                2
              )
            }
          ],
          isError: true
        };
      }
    }
  );

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(criarServidor)(request, env, ctx);
  }
};
