import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end("<main><h1>Pusher 工作台</h1><p>公众号图文生成与发布准备。</p></main>");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pusher placeholder server listening on http://127.0.0.1:${port}`);
});
