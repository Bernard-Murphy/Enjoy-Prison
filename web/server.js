const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { schema } = require("./src/lib/graphql/apollo-server");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({
      server,
      path: "/api/graphql",
    });

    // Swallow write-after-end when sending subscription payloads to closed connections
    wss.on("connection", (socket) => {
      const originalSend = socket.send.bind(socket);
      socket.send = function (data, errCallback) {
        originalSend(data, (err) => {
          const isWriteAfterEnd =
            err &&
            (err.code === "ERR_STREAM_WRITE_AFTER_END" ||
              String(err.message || "").includes("write after end"));
          if (isWriteAfterEnd) {
            if (typeof errCallback === "function") errCallback();
            return;
          }
          if (typeof errCallback === "function") errCallback(err);
        });
      };
    });

    useServer(
      {
        schema,
        context: () => ({
          user: null,
          sessionId: null,
        }),
      },
      wss,
    );

    const port = process.env.PORT || 3000;
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
