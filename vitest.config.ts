const config = {
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
};

export default config;
