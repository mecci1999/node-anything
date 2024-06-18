export default class Bucket {
  public count: number;
  public samples: number[];

  constructor() {
    this.count = 0;
    this.samples = [];
  }

  /**
   * 添加值
   */
  public add(value: number) {
    this.samples.push(value);
    this.count++;
  }

  /**
   * 清除桶数据
   */
  public clear() {
    this.count = 0;
    this.samples.length = 0;
  }
}
