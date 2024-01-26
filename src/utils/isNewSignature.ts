export function isNewSignature(args) {
  return args.length > 0 && ['ctx', 'context'].indexOf(args[0].toLowerCase()) !== -1;
}
