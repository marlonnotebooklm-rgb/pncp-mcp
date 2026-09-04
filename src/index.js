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

function classificarRelevancia(registro, palavraPesquisada) {
  const titulo = normalizar(registro.title || "");
  const descricao = normalizar(registro.description || "");
  const texto = `${titulo} ${descricao}`;

  const palavra = normalizar(palavraPesquisada);

  let pontuacao = 0;
  const motivos = [];

  /*
   * ============================================================
   * 1. PRESENÇA DA PALAVRA PESQUISADA
   * ============================================================
   */

  if (titulo.includes(palavra)) {
    pontuacao += 8;
    motivos.push("produto/termo encontrado no título");
  }

  if (descricao.includes(palavra)) {
    pontuacao += 5;
    motivos.push("produto/termo encontrado no objeto/descrição");
  }


  /*
   * ============================================================
   * 2. TERMOS DE AQUISIÇÃO
   * ============================================================
   */

  const termosAquisicao = [
    "aquisicao",
    "fornecimento",
    "compra",
    "contratacao",
    "registro de precos",
    "registro de preços",
    "licitacao",
    "licitação",
    "pregao",
    "pregão",
    "dispensa"
  ];

  for (const termo of termosAquisicao) {
    if (texto.includes(normalizar(termo))) {
      pontuacao += 3;
      motivos.push(`contratação identificada: ${termo}`);
      break;
    }
  }


  /*
   * ============================================================
   * 3. CONTEXTO DE SEGURANÇA / OPERAÇÃO
   * ============================================================
   */

  const termosOperacionais = [
    "policia",
    "polícia",
    "policia militar",
    "polícia militar",
    "policia civil",
    "polícia civil",
    "policia judicial",
    "polícia judicial",
    "guarda municipal",
    "guarda civil municipal",
    "seguranca publica",
    "segurança pública",
    "seguranca",
    "segurança",
    "bombeiro",
    "corpo de bombeiros",
    "defesa civil",
    "salvamento",
    "resgate",
    "samu",
    "militar",
    "fardamento",
    "operacional",
    "epi",
    "uniforme",
    "uniformes",
    "trânsito",
    "transito"
  ];

  let encontrouOperacional = false;

  for (const termo of termosOperacionais) {
    if (texto.includes(normalizar(termo))) {
      encontrouOperacional = true;
      break;
    }
  }

  if (encontrouOperacional) {
    pontuacao += 5;
    motivos.push("contexto de segurança/uso operacional");
  }


  /*
   * ============================================================
   * 4. PRODUTOS DIRETAMENTE RELACIONADOS AO NOSSO SEGMENTO
   * ============================================================
   */

  const produtosRelacionados = [
    "coturno",
    "bota tatica",
    "bota tática",
    "bota motociclista",
    "bota bombeiro",
    "combat shirt",
    "calca militar",
    "calça militar",
    "gandola",
    "fardamento",
    "fardamento operacional",
    "uniforme operacional",
    "uniformes",
    "colete",
    "capa de colete",
    "colete modular",
    "coldre",
    "porta carregador",
    "porta algema",
    "cinto de guarnicao",
    "cinto de guarnição",
    "cinto tatico",
    "cinto tático",
    "luva tatica",
    "luva tática",
    "luva motociclista",
    "capacete",
    "joelheira",
    "cotoveleira",
    "lanterna tatica",
    "lanterna tática",
    "mochila tatica",
    "mochila tática",
    "bandoleira",
    "torniquete",
    "shemagh",
    "balaclava",
    "boina",
    "canivete",
    "salvamento",
    "salvamento em altura",
    "salvamento aquatico",
    "salvamento aquático",
    "mergulho",
    "mosquetao",
    "mosquetão",
    "polia",
    "descensor",
    "ascensor",
    "macacao neoprene",
    "macacão neoprene",
    "tecido cordura",
    "cordura"
  ];

  let encontrouProduto = false;

  for (const produto of produtosRelacionados) {
    if (texto.includes(normalizar(produto))) {
      encontrouProduto = true;
      break;
    }
  }

  if (encontrouProduto) {
    pontuacao += 4;
    motivos.push("produto compatível com o segmento comercial");
  }


  /*
   * ============================================================
   * 5. PRODUTO + AQUISIÇÃO
   * ============================================================
   *
   * Quando o objeto demonstra claramente que o produto está
   * sendo adquirido, damos um bônus significativo.
   */

  if (
    encontrouProduto &&
    termosAquisicao.some((termo) =>
      texto.includes(normalizar(termo))
    )
  ) {
    pontuacao += 4;
    motivos.push("produto relacionado diretamente a uma aquisição");
  }


  /*
   * ============================================================
   * 6. SEGURANÇA + PRODUTO
   * ============================================================
   *
   * Exemplo:
   * "Coturno para Guarda Civil Municipal"
   *
   * Isso é muito mais interessante comercialmente.
   */

  if (
    encontrouProduto &&
    encontrouOperacional
  ) {
    pontuacao += 4;
    motivos.push("produto associado a órgão/atividade operacional");
  }


  /*
   * ============================================================
   * 7. PENALIZAÇÃO DE FALSOS POSITIVOS
   * ============================================================
   */

  const termosFalsoPositivo = [
    "papai noel",
    "brinquedo",
    "brinquedos",
    "inflavel",
    "inflável",
    "decoracao",
    "decoração",
    "evento",
    "festividade",
    "festividades",
    "show",
    "musical",
    "carnaval",
    "festa junina",
    "ornamentacao",
    "ornamentação"
  ];

  let encontrouFalsoPositivo = false;

  for (const termo of termosFalsoPositivo) {
    if (texto.includes(normalizar(termo))) {
      encontrouFalsoPositivo = true;
      break;
    }
  }

  if (encontrouFalsoPositivo) {
    pontuacao -= 8;
    motivos.push("possível falso positivo identificado");
  }


  /*
   * ============================================================
   * 8. CLASSIFICAÇÃO FINAL
   * ============================================================
   */

  if (pontuacao < 0) {
    pontuacao = 0;
  }

  let nivel = "BAIXA";

  if (pontuacao >= 16) {
    nivel = "ALTÍSSIMA";
  } else if (pontuacao >= 11) {
    nivel = "ALTA";
  } else if (pontuacao >= 6) {
    nivel = "MÉDIA";
  }

  return {
    nivel,
    pontuacao,
    motivos
  };
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

  const relevancia = classificarRelevancia(
    registro,
    palavraPesquisada
  );

  return {
    titulo: registro.title || null,

    numero:
      registro.numero ||
      registro.numero_sequencial ||
      null,

    ano:
      registro.ano ||
      null,

    objeto,

    modalidade:
      registro.modalidade_licitacao_nome ||
      null,

    modalidadeCodigo:
      registro.modalidade_licitacao_id ||
      null,

    orgao:
      registro.orgao_nome ||
      null,

    cnpj:
      registro.orgao_cnpj ||
      null,

    unidade:
      registro.unidade_nome ||
      null,

    municipio:
      registro.municipio_nome ||
      null,

    uf:
      registro.uf ||
      null,

    numeroControlePNCP:
      registro.numero_controle_pncp ||
      null,

    dataPublicacao:
      registro.data_publicacao_pncp ||
      registro.createdAt ||
      null,

    dataAtualizacao:
      registro.data_atualizacao_pncp ||
      null,

dataAberturaProposta:
  registro.data_abertura_proposta ||
  null,

dataEncerramentoProposta:
  registro.data_encerramento_proposta ||
  null,

inicioVigencia:
  registro.data_inicio_vigencia ||
  null,

fimVigencia:
  registro.data_fim_vigencia ||
  null,

valorEstimado:
  registro.valor_global ??
  null,

modoDisputa:
  registro.modo_disputa_nome ||
  null,

linkSistemaOrigem:
  registro.link_sistema_origem ||
  null,

    situacao:
      registro.situacao_nome ||
      null,

    cancelado:
      registro.cancelado ?? false,

    tipo:
      registro.tipo_nome ||
      null,

    link:
      itemUrl,

    palavrasEncontradas,

    relevancia: relevancia.nivel,

    pontuacaoRelevancia:
      relevancia.pontuacao,

    motivosRelevancia:
      relevancia.motivos,

    dadosOriginais:
      registro
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

async function buscarDetalhesContratacao(registro) {
  const numeroControle = registro.numero_controle_pncp;

  if (!numeroControle) return null;

  const partes = String(numeroControle).split("-");

if (partes.length < 3) return null;

const cnpj = partes[0];

const sequencialAno = partes[2];

const partesSequencialAno =
  sequencialAno.split("/");

if (partesSequencialAno.length !== 2) {
  return null;
}

const sequencial = partesSequencialAno[0];
const ano = partesSequencialAno[1];

  const url =
    `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`;

  try {
    const resposta = await fetch(url, {
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
      console.error(
        `Erro ao buscar detalhes ${numeroControle}: HTTP ${resposta.status}`
      );
      return null;
    }

    return await resposta.json();

  } catch (erro) {
    console.error(
      `Erro ao buscar detalhes ${numeroControle}:`,
      erro?.message || String(erro)
    );

    return null;
  }
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

      const detalhes = await buscarDetalhesContratacao(registro);

if (detalhes) {
  registro.data_abertura_proposta =
    detalhes.dataAberturaProposta ||
    registro.data_abertura_proposta ||
    null;

  registro.data_encerramento_proposta =
    detalhes.dataEncerramentoProposta ||
    registro.data_encerramento_proposta ||
    null;

  registro.valor_global =
    detalhes.valorTotalEstimado ??
    registro.valor_global ??
    null;

  registro.modo_disputa_nome =
    detalhes.modoDisputaNome ||
    null;

  registro.link_sistema_origem =
    detalhes.linkSistemaOrigem ||
    null;
}

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
function dividirEmBlocos(lista, quantidadeBlocos = 5) {
  const blocos = Array.from(
    { length: quantidadeBlocos },
    () => []
  );

  lista.forEach((item, indice) => {
    blocos[indice % quantidadeBlocos].push(item);
  });

  return blocos.filter((bloco) => bloco.length > 0);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarBloco({
  palavras,
  dias,
  uf,
  modalidade
}) {
  const resultados = [];

  /*
   * Executa as palavras do bloco de forma SEQUENCIAL.
   *
   * Isso evita disparar várias consultas simultaneamente
   * contra o PNCP e reduz o risco de rate limit.
   */
  for (let i = 0; i < palavras.length; i++) {
    const palavra = palavras[i];

    try {
      const resultadosPalavra =
        await buscarUmaPalavra({
          palavra,
          dias,
          uf,
          modalidade,
          limite: 100
        });

      resultados.push(
        ...resultadosPalavra
      );

    } catch (erro) {
      /*
       * Se uma palavra falhar, o radar continua
       * normalmente para a próxima.
       */
      console.error(
        `Erro ao pesquisar "${palavra}":`,
        erro?.message || String(erro)
      );
    }

    /*
     * Pequena pausa entre consultas.
     *
     * Não existe necessidade de esperar depois
     * da última palavra do bloco.
     */
    if (i < palavras.length - 1) {
      await esperar(500);
    }
  }

  return resultados;
}

async function executarRadarCompleto({
  dias = 7,
  uf,
  modalidade,
  limite = 100
}) {
  /*
   * Divide as 89 palavras em até 5 blocos.
   */
  const blocos =
    dividirEmBlocos(PALAVRAS_CHAVE, 5);

  const blocosConcluidos = [];

  /*
   * Executa os 5 blocos de forma SEQUENCIAL.
   *
   * Isso evita que o PNCP receba dezenas de
   * requisições simultaneamente.
   */
  for (let indice = 0; indice < blocos.length; indice++) {
    const palavras = blocos[indice];

    console.log(
      `Iniciando bloco ${indice + 1} de ${blocos.length}`
    );

    try {
      const resultados =
        await executarBloco({
          palavras,
          dias,
          uf,
          modalidade
        });

      blocosConcluidos.push({
        bloco: indice + 1,
        palavras,
        resultados
      });

      console.log(
        `Bloco ${indice + 1} concluído: ${resultados.length} resultados`
      );

    } catch (erro) {
      /*
       * Se um bloco inteiro apresentar erro,
       * registramos e seguimos para o próximo.
       */
      console.error(
        `Erro no bloco ${indice + 1}:`,
        erro?.message || String(erro)
      );

      blocosConcluidos.push({
        bloco: indice + 1,
        palavras,
        resultados: [],
        erro: erro?.message || String(erro)
      });
    }

    /*
     * Pequena pausa entre blocos.
     *
     * Não espera depois do último bloco.
     */
    if (indice < blocos.length - 1) {
      await esperar(3000);
    }
  }

  /*
   * Junta todos os resultados dos 5 blocos.
   */
  const todosResultados = [];

  for (const bloco of blocosConcluidos) {
    todosResultados.push(
      ...bloco.resultados
    );
  }

  /*
   * Cruzamento e remoção de duplicidades.
   */
  const consolidados =
    consolidarResultados(
      todosResultados
    );

  /*
   * Ordenação final.
   */
  const ordenados =
    ordenarResultados(
      consolidados
    );

  return {
    blocosExecutados: blocos.length,

    palavrasPesquisadas:
      PALAVRAS_CHAVE.length,

    resultadosBrutos:
      todosResultados.length,

    oportunidadesUnicas:
      ordenados.length,

    resultados:
      ordenados.slice(0, limite)
  };
}
function identificarOportunidade(item) {
  return (
    item.numeroControlePNCP ||
    `${item.cnpj || ""}-${item.ano || ""}-${item.numero || ""}`
  );
}

function classificarJanelaTemporal(item) {
  const agora = new Date();

const dataFim = item.dataEncerramentoProposta
  ? new Date(item.dataEncerramentoProposta)
  : null;

  if (!dataFim || Number.isNaN(dataFim.getTime())) {
    return {
      janela: "DESCONHECIDA",
      prioridadeTemporal: 0
    };
  }

  const diferencaHoras =
    (dataFim.getTime() - agora.getTime()) /
    (1000 * 60 * 60);

  if (diferencaHoras <= 24) {
    return {
      janela: "URGENTE",
      prioridadeTemporal: 5
    };
  }

  if (diferencaHoras <= 72) {
    return {
      janela: "PRÓXIMAS 72 HORAS",
      prioridadeTemporal: 4
    };
  }

  if (diferencaHoras <= 168) {
    return {
      janela: "PRÓXIMOS 7 DIAS",
      prioridadeTemporal: 3
    };
  }

  return {
    janela: "ACIMA DE 7 DIAS",
    prioridadeTemporal: 1
  };
}

function consolidarResultados(resultados) {
  const mapa = new Map();

  for (const item of resultados) {
    const identificador =
      identificarOportunidade(item);

    const existente =
      mapa.get(identificador);

    if (!existente) {
      mapa.set(
        identificador,
        {
          ...item,
          palavrasEncontradas:
            item.palavrasEncontradas || []
        }
      );

      continue;
    }

    const palavrasExistentes =
      new Set(
        existente.palavrasEncontradas || []
      );

    for (const palavra of item.palavrasEncontradas || []) {
      palavrasExistentes.add(palavra);
    }

    existente.palavrasEncontradas =
      Array.from(palavrasExistentes);

    if (
      (item.pontuacaoRelevancia || 0) >
      (existente.pontuacaoRelevancia || 0)
    ) {
      existente.pontuacaoRelevancia =
        item.pontuacaoRelevancia;

      existente.relevancia =
        item.relevancia;

      existente.motivosRelevancia =
        item.motivosRelevancia;
    }
  }

  return Array.from(mapa.values());
}

function ordenarResultados(resultados) {
  return resultados
    .map((item) => {
      const temporal =
        classificarJanelaTemporal(item);

      return {
        ...item,

        janelaTemporal:
          temporal.janela,

        prioridadeTemporal:
          temporal.prioridadeTemporal,

        prioridadeFinal:
          (item.pontuacaoRelevancia || 0) +
          temporal.prioridadeTemporal
      };
    })
    .sort(
      (a, b) =>
        b.prioridadeFinal -
        a.prioridadeFinal
    );
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
       let respostaRadar;

if (palavra_chave) {
  const resultados = await buscarUmaPalavra({
    palavra: palavra_chave,
    dias,
    uf,
    modalidade,
    limite
  });

  respostaRadar = {
    blocosExecutados: 1,
    palavrasPesquisadas: 1,
    resultadosBrutos: resultados.length,
    oportunidadesUnicas: resultados.length,
    resultados: ordenarResultados(
      consolidarResultados(resultados)
    ).slice(0, limite)
  };
} else {
  respostaRadar = await executarRadarCompleto({
  dias,
  uf,
  modalidade,
  limite
});
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
  respostaRadar.oportunidadesUnicas,

blocosExecutados:
  respostaRadar.blocosExecutados,

palavrasPesquisadas:
  respostaRadar.palavrasPesquisadas,

resultadosBrutos:
  respostaRadar.resultadosBrutos,

resultados:
  respostaRadar.resultados
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
