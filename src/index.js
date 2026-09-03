import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "PNCP Licitações MCP",
    version: "1.0.0",
  });

  server.registerTool(
    "ping",
    {
      description: "Testa se o servidor MCP do PNCP está funcionando.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "Pong! O MCP do PNCP está funcionando corretamente.",
        },
      ],
    }),
  );

  server.registerTool(
    "buscar_licitacoes",
    {
      description:
        "Busca oportunidades de licitações e contratações no PNCP.",
      inputSchema: {
        palavra_chave: z
          .string()
          .optional()
          .describe("Palavra ou termo para pesquisar"),
      },
    },
    async ({ palavra_chave }) => {
      return {
        content: [
          {
            type: "text",
            text: `Busca recebida: ${palavra_chave || "sem palavra-chave"}`,
          },
        ],
      };
    },
  );

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
};


