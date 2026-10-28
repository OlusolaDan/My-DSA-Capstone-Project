const parsedPort = Number.parseInt(process.env.PORT ?? '3000', 10);

export const config = Object.freeze({
  port: Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3000,
});
