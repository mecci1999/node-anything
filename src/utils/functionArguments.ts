/**
 * 从给定的 JavaScript 函数中提取函数的参数列表，不包括默认值
 * @param function_
 * @returns
 */
export function functionArguments(function_: Function) {
  if (typeof function_ !== 'function') {
    throw new TypeError('Expected a function');
  }

  // 匹配单行和多行注释
  const commentRegex = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/gm;
  const quotes = ['`', '"', "'"];
  // 获得方法源代码，去除注释
  const functionSource = function_.toString().replace(commentRegex, '');

  let functionWithNoDefaults = '';
  let depth = 0;
  let index = 0;

  for (; index < functionSource.length && functionSource.charAt(index) !== ')'; index += 1) {
    if (functionSource.startsWith('=>', index)) {
      functionWithNoDefaults = functionSource;
      index = functionSource.length;
      break;
    }

    if (functionSource.charAt(index) === '=') {
      for (
        ;
        index < functionSource.length &&
        ((functionSource.charAt(index) !== ',' && functionSource.charAt(index) !== ')') || depth !== 0);
        index += 1
      ) {
        let wasQuote = false;

        for (const quote of quotes) {
          if (functionSource.charAt(index) === quote) {
            index += 1;

            for (; index < functionSource.length && functionSource.charAt(index) !== quote; ) {
              index += 1;
            }

            wasQuote = true;

            break;
          }
        }

        if (wasQuote) {
          continue;
        }

        switch (functionSource.charAt(index)) {
          case '(':
          case '[':
          case '{':
            depth += 1;
            break;
          case ')':
          case ']':
          case '}':
            depth -= 1;
            break;
          default:
        }
      }

      if (functionSource.charAt(index) === ',') {
        functionWithNoDefaults += ',';
      }

      if (functionSource.charAt(index) === ')') {
        functionWithNoDefaults += ')';
        break;
      }
    } else {
      functionWithNoDefaults += functionSource.charAt(index);
    }
  }

  if (index < functionSource.length && functionSource.charAt(index) === ')') {
    functionWithNoDefaults += ')';
  }

  const regexFnArguments = /^(?:async)?([^=()]+)=|\(([^)]+)\)/;

  const match = regexFnArguments.exec(functionWithNoDefaults);

  return match
    ? (match[1] || match[2])
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
}
