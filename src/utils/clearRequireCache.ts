export default function clearRequireCache(filename: string) {
  Object.keys(require.cache).forEach((key: string) => {
    if (key === filename) {
      delete require.cache[key];
    }
  });
}
