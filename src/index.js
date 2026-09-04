import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const PNCP_BASE = "https://pncp.gov.br/api/search";

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
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function encontrarPalavras(texto) {
  const normalizado = normalizar(texto);

  return PALAVRAS_CHAVE.filter((palavra) =>
    normalizado.includes(normalizar(palavra))
  );
}

function dataYYYYMMDD(data) {
  const d = new Date(data);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterDataPublicacao(registro) {
  return (
    registro.data_atualizacao_pncp ||
    registro.createdAt ||
    registro.data_publicacao_pncp ||
    null
  );
}

function estaDentroDoPeriodo(registro, dias) {
  const dataPublicacao = obterDataPublicacao(registro);

  if (!dataPublicacao) {
    return true;
  }

  const data = new Date(dataPublicacao);

  if (Number.isNaN(data.getTime())) {
    return true;
  }

  const agora = new Date();

  const limite = new Date(
    agora.getTime() - dias * 24 * 60 * 60 * 1000
  );

  return data >= limite;
}

function modalidadeCompativel(registro, modalidade) {
  if (modalidade === undefined || modalidade === null) {
    return true;
  }

  return String(registro.modalidade_licitacao_id) === String(modalidade);
}

function ufCompativel(registro, uf) {
  if (!uf) {
    return true;
  }

  return (
    String(registro.uf || "").toUpperCase() ===
    String(uf).toUpperCase()
  );
}

function transformarRegistro(registro, palavraPesquisada) {
  const objeto = registro.description || "";

  const textoBusca = [
    registro.title,
    registro.description,
    registro.numero,
    registro.numero_sequencial,
    registro.numero_controle_pncp,
    registro.orgao_nome,
    registro.unidade_nome,
    registro.municipio_nome,
    registro.uf,
    registro.modalidade_licitacao_nome
  ]
    .filter(Boolean)
    .join(" ");

  const palavrasEncontradas = palavraPesquisada
    ? [palavraPesquisada]
    : encontrarPalavras(textoBusca);

  const itemUrl = registro.item_url
    ? `https://pncp.gov.br${registro.item_url}`
    : null;

  return {
    titulo: registro.title || null,
    numero: registro.numero || registro.numero_sequencial || null,
    ano: registro.ano || null,

    objeto,

    modalidade:
      registro.modalidade_licitacao_nome || null,

    modalidadeCodigo:
      registro.modalidade_licitacao_id || null,

    orgao:
      registro.orgao_nome || null,

    cnpj:
      registro.orgao_cnpj || null,

    unidade:
      registro.unidade_nome || null,

    municipio:
      registro.municipio_nome || null,

    uf:
      registro.uf || null,

    numeroControlePNCP:
      registro.numero_controle_pncp || null,

    dataPublicacao:
      registro.data_publicacao_pncp || registro.createdAt || null,

    dataAtualizacao:
      registro.data_atualizacao_pncp || null,

    inicioVigencia:
      registro.data_inicio_vigencia || null,

    fimVigencia:
      registro.data_fim_vigencia || null,

    situacao:
      registro.situacao_nome || null,

    cancelado:
      registro.cancelado ?? false,

    tipo:
      registro.tipo_nome || null,

    link:
      itemUrl,

    palavrasEncontradas,

    dadosOriginais: registro
  };
}

async function buscarPNCP({
  palavra,
  pagina = 1,
  tamanhoPagina = 50
}) {
  const url = new URL(`${PNCP_BASE}/`);

  url.searchParams.set("q", palavra);
  url.searchParams.set("tipos_documento", "edital");
  url.searchParams.set("ordenacao", "-data");
  url.searchParams.set("pagina", String(pagina));
  url.searchParams.set("tam_pagina", String(tamanhoPagina));
  url.searchParams.set("status", "recebendo_proposta");

  const resposta = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Referer": "https://pncp.gov.br/",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

  if (!resposta.ok) {
    throw new Error(
      `PNCP retornou HTTP ${resposta.status} ${resposta.statusText}`
    );
  }

  return await resposta.json();
}
async function buscarUmaPalavra({
  palavra,
  dias = 7,
  uf,
  modalidade,
  limite = 100
}) {
  const resultados = [];
  const vistos = new Set();

  for (let pagina = 1; pagina <= 10; pagina++) {
    const dados = await buscarPNCP({
      palavra,
      pagina,
      tamanhoPagina: 50
    });

    const registros = Array.isArray(dados?.items)
      ? dados.items
      : [];

    if (!registros.length) {
      break;
    }

    for (const registro of registros) {
      if (!estaDentroDoPeriodo(registro, dias)) {
        continue;
      }

      if (!ufCompativel(registro, uf)) {
        continue;
      }

      if (!modalidadeCompativel(registro, modalidade)) {
        continue;
      }

      const identificador =
        registro.numero_controle_pncp ||
        registro.id ||
        `${registro.orgao_cnpj}-${registro.ano}-${registro.numero_sequencial}`;

      if (vistos.has(identificador)) {
        continue;
      }

      vistos.add(identificador);

      const item = transformarRegistro(registro, palavra);

      resultados.push(item);

      if (resultados.length >= limite) {
        break;
      }
    }

    if (resultados.length >= limite) {
      break;
    }

    if (registros.length < 50) {
      break;
    }

    if (pagina * 50 >= Number(dados?.total || 0)) {
      break;
    }
  }

  return resultados;
}

function criarServidor() {
  const server = new McpServer({
    name: "PNCP Licitações MCP",
    version: "2.0.0"
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
        "Pesquisa editais e avisos de contratação direta no mecanismo de busca do PNCP, priorizando contratações que estão recebendo propostas. Pode pesquisar uma palavra específica ou todas as palavras-chave do radar, com filtros de período, UF, modalidade e limite de resultados.",

      inputSchema: {
        palavra_chave: z
          .string()
          .optional()
          .describe(
            "Termo específico para pesquisar no PNCP. Se omitido, executa o radar utilizando todas as palavras-chave cadastradas."
          ),

        dias: z
          .number()
          .int()
          .min(1)
          .max(7)
          .optional()
          .default(1)
          .describe(
            "Quantidade de dias recentes considerados. Padrão: 1."
          ),

        uf: z
          .string()
          .length(2)
          .optional()
          .describe(
            "UF para restringir os resultados, por exemplo GO, SP ou DF."
          ),

        modalidade: z
          .number()
          .int()
          .optional()
          .describe(
            "Código da modalidade de contratação do PNCP. Exemplos comuns: 6 = Pregão Eletrônico; 8 = Dispensa."
          ),

        limite: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(30)
          .describe(
            "Quantidade máxima de resultados retornados."
          )
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
        const termos = palavra_chave
          ? [palavra_chave]
          : PALAVRAS_CHAVE;

        const resultados = [];
        const vistos = new Set();

        /*
         * Quando o usuário fornece uma palavra específica,
         * fazemos uma busca direta no mecanismo do PNCP.
         *
         * Quando não fornece, percorremos as palavras-chave
         * do radar e consolidamos os resultados.
         */
        for (const termo of termos) {
          const encontrados = await buscarUmaPalavra({
            palavra: termo,
            dias,
            uf,
            modalidade,
            limite
          });

          for (const item of encontrados) {
            const identificador =
              item.numeroControlePNCP ||
              `${item.cnpj}-${item.ano}-${item.numero}`;

            if (vistos.has(identificador)) {
              continue;
            }

            vistos.add(identificador);

            resultados.push(item);

            if (resultados.length >= limite) {
              break;
            }
          }

          if (resultados.length >= limite) {
            break;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sucesso: true,

                  fonte:
                    "Mecanismo de busca do Portal Nacional de Contratações Públicas (PNCP)",

                  endpoint:
                    "https://pncp.gov.br/api/search/",

                  status:
                    "recebendo_proposta",

                  filtro:
                    palavra_chave ||
                    "todas as palavras-chave do radar",

                  dias,

                  uf:
                    uf ||
                    "todas",

                  modalidade:
                    modalidade ??
                    "todas",

                  resultadosEncontrados:
                    resultados.length,

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
                  erro:
                    erro?.message ||
                    "Erro desconhecido ao consultar o PNCP."
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/diagnostico-pncp") {
      try {
        const resposta = await fetch(
          "https://pncp.gov.br/api/search/?q=coturno&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=10&status=recebendo_proposta",
          {
            method: "GET",
            headers: {
              "Accept": "application/json, text/plain, */*",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
              "Referer": "https://pncp.gov.br/",
              "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
            }
          }
        );

        const texto = await resposta.text();

        return new Response(
          JSON.stringify({
            sucesso: resposta.ok,
            status: resposta.status,
            statusText: resposta.statusText,
            resposta: texto.slice(0, 2000)
          }, null, 2),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      } catch (erro) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro: erro?.message || String(erro)
          }, null, 2),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    return createMcpHandler(criarServidor)(request, env, ctx);
  }
};
